# Data Model: Read careers pages built by JavaScript

## Migration `005_page_sources` (new; listed in `src/db/migrations/index.ts`)

`ALTER TABLE careers_audit` adds four columns, all on the existing `utf8mb4_bin` table:

| Column | Type | Meaning |
|---|---|---|
| `page_source` | `VARCHAR(16) NULL` | How an opened page was read: `html`, `board` or `rendered`. Set on `open_careers` / `open_job` rows only. |
| `fallback` | `VARCHAR(32) NULL` | What didn't work on the way, comma-separated in the order it happened: `board_failed`, `render_failed`, `render_off` (e.g. `board_failed,render_off`). |
| `board` | `VARCHAR(160) NULL` | `<kind>:<slug>` for board pages, e.g. `ashby:Vetcove`, `workday:cisco/Cisco_Careers`. |
| `retry_once` | `TINYINT NOT NULL DEFAULT 0` | 1 on pre-010 `finish` rows that earn one retry (FR-023). |

Then one data step: `UPDATE careers_audit SET retry_once = 1 WHERE step = 'finish' AND reason IN
('careers_page_unreadable', 'job_page_unreadable', 'gave_up')`. Rows written after the migration
always have `retry_once = 0`.

New audit `step` values (no column change): `retry` (a retried lookup's first row) and
`render_check` (the LAN self-test; `warning = 1` when the browser could reach the LAN).

`src/db/schema.ts`: `CareersAuditTable` gains the four columns (`page_source`, `fallback`, `board`
as `Text`; `retry_once` as `Generated<number>`).

## Store changes (`src/db/store.ts`)

- `AuditEntry` gains optional `pageSource`, `fallback` and `board`; `AuditStep` gains `retry` and
  `render_check`.
- `CareersStore.attempted(keys)`: unchanged meaning, except rows with `retry_once = 1` are ignored.
- `CareersStore.retries()` (new): the keys that have a `retry_once = 1` finish row and no later
  finish row other than `lookup_error` / `search_unavailable` (the same exclusion as `attempted()`),
  i.e. still owed their one retry.
- `JobStore.setDescription` now also clears `scored_at`, so a job that was scored before its
  description was found is scored again (FR-023's retried jobs were all scored after their
  failed 008 lookup).
- Contract cases (`tests/helpers/careersStoreContract.ts`): a pre-010 unreadable finish is not
  attempted and is a retry; a later finish for the same job is attempted and no longer a retry; the
  new columns round-trip. Rows are planted through a per-store `plantRetryOnce` hook.
  `tests/helpers/descriptionContract.ts`: `setDescription` clears `scored_at`.
- `MemoryCareersStore` mirrors both.

## Lookup types (`src/careers/`)

- `SoughtJob` gains `retry?: boolean`.
- `PageRead` (new, `readPage.ts`): a `TrimmedPage` plus `source: "html" | "board" | "rendered"`,
  `fallback: string | null` (the comma-separated list above) and `board: string | null`.
- `RenderState` (new, per run): `{ off: string | null; checked: boolean }`, where `off` is the
  summary note once rendering is turned off, and `checked` marks the LAN self-test as done.
- `BoardLink` (new, `src/sources/boardLink.ts`): `{ kind: "ashby" | "greenhouse" | "lever" |
  "workday"; slug: string; postingId: string | null; host?: string; site?: string }`.

## Config (`src/config/schema.ts`)

`careers_lookup` gains:

| Setting | Default | Meaning |
|---|---|---|
| `render_seconds` | 15 (min 5, max 60) | Time limit for one rendering. |
| `skip_hosts` | `glassdoor.com`, `ziprecruiter.com`, `indeed.com`, `linkedin.com`, `builtin.com`, `teamworkonline.com` | Search results on these hosts (or their subdomains) are dropped. |
| `lan_probe_url` | unset | A local-network address for the rendering self-test. |

Env: `MYJOBBOT_BROWSER_URL` (optional, `ws://` or `wss://`). Unset = no rendering.

## State transitions

- Rendering per run: `on` → `off` at the first connection or rendering failure (note
  "page rendering turned off: browser service failed"); unset address starts `off` (note "page
  rendering not configured").
- A job's lookup eligibility: never looked up → looked up (attempted) → stays attempted, except
  pre-010 unreadable/gave-up finishes → eligible once (`retry` row), even though the job was
  already scored → attempted after that lookup. A retried job that is found becomes unscored and is
  scored again in the same run.
