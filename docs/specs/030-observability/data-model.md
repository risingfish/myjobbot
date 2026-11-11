# Data model: Worker observability (030)

Step `026_monitoring` adds four tables, and three columns on `rescore_runs`, all through Kysely's schema builders,
every table `utf8mb4_bin`. Areas: a new `src/db/schema/monitoring.ts`, and `rescore.ts`.

## agent_runs

One call of `runAll` (R1).

| Column | Type | Notes |
|---|---|---|
| `id` | varchar(36), key | `randomUUID()` |
| `started_at` | varchar(32) | ISO time |
| `alive_at` | varchar(32) | set at start and every 60 s (R2) |
| `ended_at` | varchar(32), null | null while running or when it died |
| `outcome` | varchar(32), null | `finished`, `finished_with_errors`, `failed`; null until it ends |
| `reason` | varchar(32), null | fixed reason when `failed` (R5) |
| `incomplete` | tinyint, default 0 | 1 when a write of this run's record failed and the run went on (R2) |
| `users`, `users_failed`, `users_skipped` | int, default 0 | totals |
| `fetches`, `fetch_failures`, `jobs_found`, `jobs_scored`, `searches`, `search_failures` | int, default 0 | totals |
| `model_calls`, `prompt_tokens`, `completion_tokens` | int, default 0 | totals (lookups are counted from `careers_audit` when read) |

Index: `started_at`. Status (`running`, `never_finished`, or the outcome) comes from `runStatus`.
Totals are written at the end, so they stay when a user's parts are removed.

## run_users

One user's part of a run.

| Column | Type | Notes |
|---|---|---|
| `run_id` | varchar(36) | → `agent_runs.id`, cascade delete |
| `user_id` | int | → `users.id`; removed with the account (`AccountRemoval`) |
| `part_id` | varchar(36), null | the part's trace id (`careers_audit.run_id`); null when skipped |
| `started_at`, `ended_at` | varchar(32) | |
| `outcome` | varchar(32) | `running` (written at its start, R2), then `finished`, `stopped` (agent aborted), `failed`, `skipped`, `deleted`, `held` |
| `reason` | varchar(32), null | skip reason (`deactivated`, `no_sources`, …) or fixed failure reason |
| `fetches`, `fetch_failures`, `jobs_found`, `jobs_scored`, `searches`, `search_failures` | int, default 0 | from the tally (R3) |
| `model_calls`, `prompt_tokens`, `completion_tokens` | int, default 0 | from the tally |

Key: `(run_id, user_id)`. Index: `part_id`. Lookups are counted from `careers_audit` by
`part_id` at read time.

## source_fetches

One fetch, or planned skip, of a saved source (R4).

| Column | Type | Notes |
|---|---|---|
| `id` | int, auto | |
| `user_id` | int | → `users.id`; removed with the account |
| `source_id` | int | → `user_sources.id`, cascade delete |
| `part_id` | varchar(36) | the run part's id |
| `module` | varchar(64) | the source module's name |
| `at` | varchar(32) | when it started |
| `ms` | int | how long it took |
| `outcome` | varchar(16) | `ok`, `partial`, `failing`, `skipped` |
| `reason` | varchar(64), null | fixed failure reason, or the `SkipReason` |
| `pages`, `jobs`, `cost` | int, default 0 | |

Indexes: `(user_id, source_id, at)`, `(module, at)`.

## mail_sends

One mail send (R6). No user, address or content.

| Column | Type | Notes |
|---|---|---|
| `id` | int, auto | |
| `at` | varchar(32) | |
| `kind` | varchar(32) | a `MailKind` (`src/mail/messages.ts`) |
| `outcome` | varchar(8) | `sent`, `failed` |
| `reason` | varchar(16), null | `auth`, `connect`, `tls`, `refused`, `other` |

Index: `at`.

## rescore_runs (new columns)

`model_calls`, `prompt_tokens`, `completion_tokens`: int, default 0, written by `RescoreLog`'s end.

## Stores

All with Kysely and memory versions and a shared contract (`tests/helpers/monitoringContract.ts`).

- `RunHistory` (on `SharedStores`, written by the agent): `begin(id, at)`, `alive(id, at)`,
  `partStarted(row)`, `partEnded(row)`, `markIncomplete(id)`, `end(id, ending)`, `pruneBefore(cutoff)`.
- `FetchHistory` (on `SharedStores`) and `UserFetchHistory` (`forUser(id).fetches`): `record(fetch)`,
  `pruneBefore(cutoff)`, and (S3) `recent(sourceIds, perSource)` for the user's own view.
- `MailLog` (on `SharedStores`): `record(send)`, `pruneBefore(cutoff)`.
- `MonitoringReads` (on `SharedStores`, read by the web only for an admin, and by the metrics): `runs(since)`, `run(id)`,
  `fetches(since)`, `lookups(since)`, `rescores(since)`, `mails(since)`, each giving raw rows
  that plain functions aggregate (`src/web/monitoring*.ts` for the page, `src/metrics/` for the
  metrics); company searches come from the runs' totals. Every row holds ids, module names,
  counts, times and fixed reasons only.

## Rules (plain functions, `src/monitoring/`)

- `runStatus(run, now)`: `running`, `never_finished` (no end, `alive_at` over 5 minutes old) or the
  stored outcome.
- `runOutcome(parts)`: `finished`, `finished_with_errors` from the users' parts.
- `failingRepeatedly(outcomes)`: the last 3 fetches all `failing`.
- `periodSince(period, now)`: `day`, `week`, `month` (30 days).
- `runFailureReason(error)`: R5.
