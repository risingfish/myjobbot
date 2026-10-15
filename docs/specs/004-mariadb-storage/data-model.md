# Data Model: MariaDB Storage

Same three tables and the same fields as today, so behaviour doesn't change. What changes:
- the column types (research R4)
- exact (`utf8mb4_bin`) comparison on every table (R2)
- a real `id` on verdicts, in place of SQLite's hidden `rowid` (R3)
- two bookkeeping tables that Kysely's migrator adds itself

Every table is created with `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`.

## `jobs`

| Column | Type | Null | Notes |
|---|---|---|---|
| `ats` | VARCHAR(32) | no | Board kind (`greenhouse`, `lever`, `ashby`, `jsearch`); part of the key |
| `job_id` | VARCHAR(255) | no | The board's ID; part of the key; compared exactly, letter case included |
| `company` | VARCHAR(255) | no | |
| `source` | VARCHAR(255) | no | The configured board or search name the job came from |
| `title` | VARCHAR(500) | no | |
| `normalized_title` | VARCHAR(500) | no | Lowercased and trimmed, for matching reposts |
| `location`, `department`, `team`, `workplace_type`, `compensation`, `publisher` | VARCHAR(255) | yes | |
| `is_remote` | TINYINT | yes | 1, 0 or unknown |
| `url` | VARCHAR(2048) | no | |
| `posted_at` | VARCHAR(32) | yes | ISO-8601 UTC text |
| `description` | MEDIUMTEXT | yes | Up to 16 MB |
| `requirements`, `skills`, `preferred_skills` | TEXT | yes | JSON list of strings; null when empty |
| `first_seen`, `last_seen` | VARCHAR(32) | no | ISO-8601 UTC |
| `scored_at` | VARCHAR(32) | yes | Set when scored |
| `score`, `base_score`, `bonus_score` | INT | yes | |
| `reasons`, `gaps` | TEXT | yes | JSON lists |
| `emailed_at` | VARCHAR(32) | yes | Kept for the planned digest feature |
| `hidden` | TINYINT | no, default 0 | The owner's Hide flag |

**Keys and indexes**:
- `PRIMARY KEY (ats, job_id)`
- `jobs_by_company_title (company, normalized_title)`
- `jobs_by_source (source, scored_at)`

**Rules, unchanged from today**:
- **Upsert**: re-fetching a posting refreshes every descriptive field and `last_seen`, keeps
  `first_seen`, keeps its score and keeps `hidden`.
- **Pruning**: jobs last seen before the retention cutoff are deleted, then any verdicts left
  without a job.

## `verdicts`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | no | Primary key. Breaks ties between verdicts at the same moment; copied from SQLite's `rowid` |
| `ats`, `job_id` | as in `jobs` | no | The job scored; no foreign key, because pruning removes orphans explicitly |
| `run_id` | VARCHAR(64) | yes | Null for history from before run IDs |
| `scored_at` | VARCHAR(32) | no | |
| `score` | INT | no | |
| `base_score`, `bonus_score` | INT | yes | |
| `reasons`, `gaps` | TEXT | no | JSON lists |

**Index**: `verdicts_by_time (scored_at)`. The history lists newest first by `scored_at`, then
`id`.

## `api_calls`

| Column | Type | Null |
|---|---|---|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | no (key) |
| `api` | VARCHAR(32) | no |
| `source` | VARCHAR(255) | no |
| `called_at` | VARCHAR(32) | no |

**Index**: `api_calls_by_api_time (api, called_at)`. This table feeds the monthly request cap and
the refresh interval.

## Migrator tables (created by Kysely)

`kysely_migration` records each step's name and when it ran. `kysely_migration_lock` stops two
processes from migrating at once.

## Typed schema

`src/db/schema.ts` describes the tables above as the Kysely `Database` type. Queries are checked
against it, so a wrong column name or value type fails `npm run typecheck`. JSON-list columns stay
strings in the database and are decoded by the existing `jsonList` parser when rows are read.

## Store interfaces (what the rest of the code sees)

`src/db/store.ts`: the same methods as today's `JobStore`, `JobViews` and `ApiCallLog`, now
returning promises. Two implementations:

| Implementation | Where | Used by |
|---|---|---|
| Kysely over MariaDB | `src/db/kysely/` | the agent, the web app, integration tests |
| In-memory arrays | `tests/helpers/memoryStore.ts` | unit tests |

Both must pass the same contract suite (research R9).
