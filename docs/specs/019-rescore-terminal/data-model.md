# Data Model: Re-score terminal

Migration `014_rescore_runs` adds two tables (Kysely schema builder, `utf8mb4_bin`). Written only
through `RescoreLogStore`.

## `rescore_runs`

| Column | Type | Notes |
|---|---|---|
| `id` | varchar(36) PK | the re-score's run id (also its trace file's and verdict's `run_id`) |
| `ats`, `job_id` | varchar | the job; index `(ats, job_id, started_at)` |
| `started_at` | varchar(32) | ISO time |
| `ended_at` | varchar(32) null | null while running |
| `outcome` | varchar(16) null | `scored`, `filtered`, `failed`; null while running |
| `filter` | varchar(16) null | `company`, `title`, `body` when filtered |
| `score` | int null | the saved total when scored |

States: **running** (`ended_at` null, started < 10 min ago) → **ended** (`scored` / `filtered` /
`failed`). A row still open 10 minutes after `started_at` is shown as `failed` and no longer blocks
a new re-score (FR-014). `begin` locks the job's row while it checks and inserts, so only one run
of a job can be open.

## `rescore_steps`

| Column | Type | Notes |
|---|---|---|
| `run_id` | varchar(36) | foreign key to `rescore_runs.id`, `ON DELETE CASCADE`; PK `(run_id, seq)` |
| `seq` | int | 1, 2, 3… in order; the stream's event id |
| `elapsed_ms` | int | since the run's `started_at` |
| `kind` | varchar(24) | one of the kinds below |
| `fields` | text | JSON of the kind's allowed values |

## Step kinds (`src/rescore/steps.ts`)

| Kind | Fields | Line (example) |
|---|---|---|
| `settings` | `fallbacks: int` | `settings loaded` / `settings loaded (1 fell back)` |
| `filters` | `by: company\|title\|body\|null` | `filters passed` / `filtered: hidden by body filter` |
| `lookup` | — | `no description: looking for the careers page` |
| `search` | `chars: int\|null`, `ok: bool` | `searched the web (2,201 chars of results)`; the audit's `url` (the query, holding the company's name) is never copied |
| `page` | `kind: careers\|job`, `url`, `chars: int\|null`, `via: download\|board\|browser\|null`, `ok: bool`, `reason: code\|null` | `open careers page https://www.bigpanda.io/company/panda-way/jobs/  6,193 chars  download`; a failed open: `open job page https://… failed (timed_out)` |
| `lookup_end` | `found: bool`, `reason: code\|null` | `description found` / `no description found (gave_up)` |
| `lookup_failed` | — | `careers lookup failed; scoring from what we have` |
| `reading` | — | `model reading the job` |
| `lookalike` | — | `removed a look-alike marker from the job's text` |
| `saved` | `score: int` | `model score saved: 72` |
| `outcome` | `outcome`, `filter\|null`, `score\|null` | `done: model score 72` / `done: not re-scored, hidden by body filter` / `done: failed, old score kept` |

`via` maps the audit's `pageSource`: `html` → download, `rendered` → browser, `board` → board; a
failed open has null `chars` and `via`, except a remembered careers page that came back stale,
which keeps its size and source and has a null `reason`: its line reads `… failed`. Every `url` is an http(s) address the lookup tried
(`isWebAddress`), shown at most 120 characters; a failed open's address may be one that was
refused. No field holds page, email or model text. Reason codes are the lookup's fixed codes. The
score is the model's total; the panel may show it boosted.

## Pruning

`JobStore.pruneLastSeenBefore` deletes the runs of jobs it removed through one helper shared with
the verdicts (`deleteOrphansOf`); their steps go by the foreign key's cascade. Applied jobs are
never pruned, so their logs stay (FR-013).
