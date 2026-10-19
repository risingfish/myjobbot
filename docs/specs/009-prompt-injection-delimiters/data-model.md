# Data Model: Run-bound delimiters against prompt injection

## Migration `006_injection_flag` (Kysely schema builder)

`db.schema.alterTable("jobs").addColumn("injection_seen_at", "varchar(32)")` adds a nullable ISO
time, which inherits the table's `utf8mb4_bin`. It is null for every existing job.
`src/db/schema.ts`: `JobsTable` gains `injection_seen_at: Text`.

## Store

- `JobStore.flagInjection(jobId: string, at: string): Promise<void>` sets `injection_seen_at = at`
  on every row with that `job_id` whose `injection_seen_at` is null, using Kysely's
  `updateTable`. A later call keeps the first time.
  - Contract case in `tests/helpers/descriptionContract.ts` (memory and MariaDB): the first flag
    sets the time; a second keeps it; score and `scored_at` are unchanged; re-upserting the job
    keeps the flag. It reads the flag through `jobViews.allJobs`.
- `jobViewSchema` and `JOB_COLUMNS` gain `injection_seen_at`; `jobRowSchema` doesn't, since no
  tool reads it. Upserts never write it, so a job re-fetched with clean text stays flagged.

## Code types

- `DataMarkers` (`src/agent/markers.ts`): `{ tag, open, close }`, built once per run from the run
  ID (a UUID; test helpers pass a fixed UUID) by `dataMarkers(runId)`.
- `Lookalike` (`src/agent/markers.ts`): `{ tool: string; jobId: string | null }`, one per removed
  look-alike. Opening-message hits use `tool: "lookup_opening"`.
- `Tool.outsideText: boolean`, declared by every tool.
- `JobRowView.injection: boolean` (`src/web/api.ts`), from `injection_seen_at !== null`.

## Trace events

- `tool` events gain `wrapped: boolean`, saying whether the model saw this result between markers.
  The event's `content` stays unwrapped.
- `{ type: "lookalike_removed", tool, job_id, lookup? }`, with no text.
- `{ type: "injection_flag_failed", tool, job_id, error }`, when noting or flagging fails; the run
  carries on.
