# Data Model: Job details from company careers pages

Migration `004_careers_lookup` (`src/db/migrations/004_careers_lookup.ts`, listed in
`migrations/index.ts`, mirrored in `src/db/schema.ts`). Every table is `utf8mb4_bin`, InnoDB.

## jobs (changed)

| Column | Type | Rule |
|---|---|---|
| `description_source` | `VARCHAR(16) NULL` | `'source'` (the job's own source: board, JSearch) or `'careers'`. NULL when `description` is NULL. Backfilled to `'source'` where `description IS NOT NULL`. |
| `description_url` | `VARCHAR(2048) NULL` | The page a careers description was read from; NULL for `'source'`. |

- `upsertAll` writes `description_source = 'source'` when it writes a non-null description.
- `setDescription(key, { description, url, source: 'careers' })` writes all three and changes
  nothing else.
- Both columns are set in `toParams` (`src/db/rows.ts`), so the MariaDB store and the memory
  store produce the same rows.
- Jobs copied by the one-time `import-sqlite` (already run on 2026-10-15; it refuses a non-empty
  target) were in the database before migration 004, so the backfill covers them. Code reads
  only `description_source === 'careers'`; NULL with a description is treated as a source
  description.

## careers_pages (new): remembered careers pages (P3, FR-015)

| Column | Type | Rule |
|---|---|---|
| `company_key` | `VARCHAR(255) NOT NULL` PK | `normalizeCompany(company)` |
| `company` | `VARCHAR(255) NOT NULL` | As last seen, for reading the table by eye |
| `url` | `VARCHAR(2048) NOT NULL` | `http(s)` only |
| `found_at` | `VARCHAR(32) NOT NULL` | ISO time |
| `last_used_at` | `VARCHAR(32) NOT NULL` | ISO time; updated when offered in a lookup |

**Lifecycle**:
- **Remembered** when a lookup ends `found` after opening a link as `careers_page`. An existing
  row is replaced.
- **Used**: offered as link 1, and `last_used_at` is updated.
- **Forgotten** (row deleted) when opening it fails (an HTTP error or a refusal), or when it
  opens with zero job links (JavaScript-built listing).

## careers_audit (new): the audit log (US2, FR-016–FR-018)

| Column | Type | Rule |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` PK | |
| `run_id` | `VARCHAR(36) NOT NULL` | The run's UUID |
| `at` | `VARCHAR(32) NOT NULL` | ISO time; indexed |
| `ats` | `VARCHAR(32) NOT NULL` | Job key, part 1 |
| `job_id` | `VARCHAR(255) NOT NULL` | Job key, part 2; index (`ats`, `job_id`) |
| `company` | `VARCHAR(255) NOT NULL` | Indexed |
| `step` | `VARCHAR(16) NOT NULL` | `search` · `remembered` (the remembered page was offered as link 1; `url`, `outcome = ok`) · `open_careers` · `open_job` · `finish` · `skipped` |
| `url` | `VARCHAR(2048) NULL` | `search` rows: the search text (`<company> careers`), never the SearXNG host. `open_*` rows: the address opened. `finish` rows: the last careers page opened, if any (so a `job_not_found` warning names it). |
| `chars` | `INT NULL` | Trimmed size handed to the model |
| `cut` | `TINYINT NOT NULL DEFAULT 0` | 1 when trimming hit `page_chars` |
| `more_pages` | `TINYINT NOT NULL DEFAULT 0` | 1 when the page appears to continue (FR-010 placeholder) |
| `outcome` | `VARCHAR(16) NOT NULL` | `ok` · `found` · `failed` |
| `reason` | `VARCHAR(32) NULL` | Fixed set below; indexed |
| `warning` | `TINYINT NOT NULL DEFAULT 0` | 1 on every lookup that ends without a description |
| `detail` | `VARCHAR(2000) NULL` | Addresses or a fixed word only: the search-result addresses seen (on the `finish` row of a `no_careers_page` lookup, empty when the search had no results), or `forgotten` (on the failed `open_careers` row of a remembered page). Never page or email text. |

**Reasons** (FR-017):
- `no_careers_page`
- `careers_page_unreadable`
- `job_not_found`
- `job_page_unreadable`
- `fetch_refused`
- `timed_out`
- `gave_up`
- `lookup_error`: the model server or the database failed during the lookup. It is contained:
  the next lookup still starts.
- `search_unavailable`

The `search_unavailable` reason uses one `skipped` row per run, not one per job, when search
isn't configured or can't be used. That row belongs to no job: `ats = ''`, `job_id = ''`,
`company = ''`. A job whose lookup was interrupted by search becoming unusable gets no `finish`
row.

**Which jobs count as attempted**: `attempted(keys)` returns the keys that have a `finish` row
whose `reason` is neither `lookup_error` nor `search_unavailable`. So a lookup ended by a
temporary failure is tried again in a later run, and `skipped` rows never count.

**Retention**: rows with `at` before the job-retention cutoff are deleted in `pruneOldJobs`.

## In-memory shapes (not stored)

- **SoughtJob**: `{ ats, jobId, title, company, location | null }`. The lookup's only input
  (FR-019).
- **LookupOutcome**: one of:
  - `{ found: true, description, url, careersUrl | null }`
  - `{ found: false, reason }`
- **TrimmedPage**: `{ url, text, links: { text, url }[], cut, morePages, chars }`. Links are
  unnumbered here; the registry numbers them when they are handed to the model.
- **LinkRegistry**: the per-lookup numbered addresses (R6). Search results are numbered first,
  then each opened page's links get the next numbers.
- **SearchResult**: `{ n, title, url, snippet }`.

## Stores

`Stores` gains `careers: CareersStore`:

```ts
interface CareersStore {
    rememberedPage(companyKey: string): Promise<CareersPageRow | null>;
    rememberPage(page: { companyKey: string; company: string; url: string }, at: string): Promise<void>;
    usePage(companyKey: string, at: string): Promise<void>;
    forgetPage(companyKey: string): Promise<void>;
    audit(entry: AuditEntry): Promise<void>;
    attempted(keys: JobKey[]): Promise<JobKey[]>;
    pruneAuditBefore(cutoff: string): Promise<void>;
}
```

`JobStore` gains `setDescription(key: JobKey, found: { description: string; url: string; source: "careers" }): Promise<void>`.

Contracts:
- `tests/helpers/careersStoreContract.ts`: new, run against the memory fake (unit) and MariaDB
  (integration).
- `tests/helpers/descriptionContract.ts`: new, holds the `description_source` and
  `setDescription` cases (`storeContract.ts` is near its 200-line limit), run against both
  stores.
- `tests/helpers/testDb.ts` `TABLES` gains `careers_audit` and `careers_pages`, so `emptyTables`
  clears them and the migrate test drops and re-creates them.
