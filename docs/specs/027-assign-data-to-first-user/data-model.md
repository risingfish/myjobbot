# Data model: Each user's own data (027)

Everything here is in steps `020_user_jobs`, `021_history_owners`, `022_gmail_by_user` and
`023_jobs_without_user_columns`, each applied once per database. All tables stay
`utf8mb4_bin` and InnoDB.

## `user_jobs` (new): one user's view of one posting

| Column | Type | Notes |
|---|---|---|
| `user_id` | integer, not null | FK `users.id` |
| `ats` | varchar, not null | with `job_id`, FK `jobs(ats, job_id)` |
| `job_id` | varchar, not null | |
| `source_id` | integer, null | that user's `user_sources.id` which found it; FK `user_sources.id` `ON DELETE SET NULL`, as `jobs.source_id` had |
| `source` | varchar, not null | that user's source label, copied from `jobs.source`; relabelled by `replaceSource` |
| `first_seen` | varchar(32), not null | when this user first had it |
| `last_seen` | varchar(32), not null | when this user's source last saw it |
| `scored_at` | varchar(32), null | |
| `score` | integer, null | |
| `base_score` | integer, null | |
| `bonus_score` | integer, null | |
| `reasons` | text, null | |
| `gaps` | text, null | |
| `hidden` | tinyint, not null, default 0 | |
| `applied` | tinyint, not null, default 0 | |
| `applied_on` | varchar(32), null | |

- **Primary key**: `(user_id, ats, job_id)`.
- **Indexes**: `(user_id, scored_at)` for Recommended, `(user_id, applied)` for Applied, and
  `(user_id, last_seen)` for clean-up.
- **Upgrade**: one row per existing `jobs` row with `user_id = 1`, every column copied from it.
- **Rules**: `applied` and `applied_on` are written in one statement, keeping the first time (013).
  A user sees a posting only through their row (FR-013).

## `jobs`: the shared posting

The step drops FK `jobs_source_fk` and index `jobs_source` first, then these columns, after the
copy: `source_id`, `scored_at`, `score`, `base_score`, `bonus_score`, `reasons`, `gaps`, `hidden`,
`applied`, `applied_on`. `jobs.source` stays but is no longer refreshed or read (R1).

A refresh keeps an existing non-null description when the incoming one is null (R7).

These stay: the posting's fields, `first_seen` and `last_seen` (across all users), the description
and its format and source, `company_id`, `injection_seen_at` and `emailed_at`.

## `verdicts`

- **New**: `user_id`, integer, not null, FK `users.id`.
- **Upgrade**: set to 1 on every existing row.
- **Index**: `(user_id, ats, job_id, scored_at)` for a job's history.

## `rescore_runs`

- **New**: `user_id`, integer, not null, FK `users.id`.
- **Upgrade**: set to 1 on every existing row.
- **Rule**: one open run per `(user_id, ats, job_id)`. `begin` locks that `user_jobs` row.
- `rescore_steps` is unchanged; each step belongs to its run.

## `gmail_connection` and `gmail_alert_state`

- **Column**: `id` is renamed to `user_id` and changed from `TINYINT` to `integer` not null, the
  type of `users.id`, so the FK can exist. It stays the primary key and gains a FK to `users.id`.
- **Upgrade**: the existing row (`id = 1`) becomes user 1's.
- **Rule**: one connection, and one alert state, per user.

## Unchanged

- **Already per user**: `user_settings`, `user_sources`, `resumes` and `resume_profiles` (keyed by
  `user_id` since 015, 017 and 023).
- **Shared**: `companies`, `careers_audit` and `api_calls` (FR-005, FR-014).
- **Sign-in data**: the 024 tables.

## Code entities

- **`Stores`** (`src/db/store.ts`): a container of the shared stores only (`companies`, `careers`,
  `apiCalls`, `accounts`, `postings`, `sources` and the sign-in stores), plus `forUser(userId)` and
  `close()`. It has no operations of its own, no per-user members and no default user.
- **`PostingStore`** (`src/db/postingStore.ts`, shared): the posting itself.
  - `known(keys)`: whether postings exist and have a description, used only to skip lookups
  - `setDescription`, `flagInjection`, `linkUnlinkedJobs` and `earliestSeen`
  - `prune(cutoff)`: clean-up across users, replacing `JobStore.pruneLastSeenBefore`
- **Cross-user listings on their owners**:
  - `AccountStore.userIds()`: every user, for the run
  - `SourceStore.scheduledOnForAll()`: every user's scheduled sources that are on, for the JSearch
    budget checks
- **`UserStores`** (`stores.forUser(id)`, composed in `src/db/userStores.ts`): bound to the user:
  `jobStore` (the user's view: `upsertAll`, `markSeen`, unscored reads, duplicate checks,
  `findJob`, `recordVerdict`), `jobViews`, `gmail`, `alerts`, `rescoreLog`, `sources`,
  `searchSettings` and `resume`. The shared stores are passed through.
  - The bound `sources`, `searchSettings` and `resume` are `UserSourceStore`,
    `UserSearchSettingsStore` and `UserResumeStore`: the same methods without the `userId`
    argument. Each is declared beside its own store (`sourceStore.ts`, `searchSettingsStore.ts`,
    `resumeStore.ts`).
- **`ownsResumeFile(userId)`** (`src/config/resumeFile.ts`): whether `data/resume.md` is this
  user's, which is true for user 1 only.
- **Run**: one per user per scheduled run, each with its own random run id and today's log file
  names. The trace's first event records `userId`.
  - `runAll` (`src/app/runAll.ts`) loops over users.
  - `usersToRun` (`src/app/usersToRun.ts`) decides who runs.
  - `runLines` (`src/app/runLines.ts`) words the outcome.
