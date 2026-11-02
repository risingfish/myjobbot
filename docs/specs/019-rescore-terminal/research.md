# Research: Re-score terminal

Decisions behind [plan.md](plan.md), each checked against the code on 2026-11-02 (main at `77c8f17`).

## R1. Where a re-score's steps are kept

- **Decision**: two new tables, written only through a new `RescoreLogStore`
  (`src/db/rescoreLogStore.ts`, Kysely builders in `src/db/kysely/rescoreLogStore.ts`, memory
  version in `tests/helpers/`), added by migration `014_rescore_runs`:
  - `rescore_runs`: one row per re-score (`id` = the re-score's run id, the job's `ats` and
    `job_id`, `started_at`, `ended_at`, `outcome`, `filter`, `score`);
  - `rescore_steps`: one row per step (`run_id`, `seq`, `elapsed_ms`, `kind`, `fields` as JSON of
    the step's allowed values).
- **Rationale**:
  - FR-010–FR-013 need the log after the panel closes, listed per job, and pruned with the job.
    The trace file holds everything but also outside text, and is per run, not per job.
  - Steps are stored as a kind plus allowed values, not as rendered text, so the message wording
    can change and a later iteration (sanitized model output) can add kinds without touching old
    rows. The line is rendered by one pure function (R4) wherever it is shown.
  - A store per concern follows `SourceStore` and `SearchSettingsStore`; `src/db/store.ts` is at
    197 lines and can take only the `Stores` field, not another interface.
- **Alternatives**:
  - Reading the trace file back: it holds page and model text, so every reader would have to
    filter it, and following a running file across processes is fiddly. Rejected.
  - One table with a JSON array of steps per run: appending under concurrent readers means
    rewriting the row each step. Rejected.

## R2. How steps are captured

- **Decision**: a `RescoreLog` (`src/rescore/log.ts`) the re-score is given, with
  `step(kind, fields)` that stamps `seq` and `elapsed_ms`, stores the step, and tells any local
  listener (the CLI's console printer). Steps come from three places:
  1. `rescore.ts` itself: start, settings, filters, lookup start and end, scoring start, outcome.
  2. The careers lookup's audit rows: `openRescore` wraps the careers store so each `audit(entry)`
     also logs a `page` or `search` step from the entry's step, address, size, read source and
     outcome (never its detail text).
  3. The re-score's trace: a `Trace` wrapper (`stepsFromTrace`), made once in `openRescore` and used
     as the re-score's trace everywhere (the careers lookup, the agent loop and `reportLookalike`),
     turns `tool` events for `get_job` into a `reading` step and `lookalike_removed` (from the
     lookup or the scoring) into a `lookalike` step; the careers tools' names never match
     `get_job`; the score comes from the
     one-job store's `recordVerdict` (the stored total).
  - `Trace.write` is synchronous, so `RescoreLog` numbers steps at once and chains their writes;
    `end` waits for the chain, so no step is stored after its run's end.
- **Rationale**: every value a step carries is already one the app controls or has checked
  (FR-003): audit rows hold addresses and sizes only (feature 008 rule); the trace's tool names
  and the verdict's numbers are the app's. Model and page text never pass through `RescoreLog`.
  The trace file keeps being written exactly as now (FR-009).
- **Alternatives**: deriving everything from trace events. Rejected: careers audit details live
  in the database, not the trace, and tool-result events carry outside text.

## R3. How the browser follows a run

- **Decision**:
  - **Start**: the `rescoreJob` server action becomes `startRescore(ats, jobId)`. It checks the
    input (`jobRequest`), refuses a second run (R6) by returning the running run's id, otherwise
    records the run and schedules the re-score with Next's `after()` (`next/server`), returning
    the run id at once.
  - **Follow**: a Route Handler `web/app/api/rescores/[id]/route.ts` answers `GET` with a
    `text/event-stream` body (Server-Sent Events): it sends every stored step after the client's
    `Last-Event-ID` (the step's `seq`), then polls the store every 400 ms for new steps with a
    named `ping` event every 5 s (an SSE comment would be dropped by `EventSource` unseen), and once the run has ended reads its steps once more, sends them and an
    `end` event (outcome, filter, score), and closes. `Cache-Control: no-cache, no-transform` and
    `X-Accel-Buffering: no` keep it from being buffered.
  - **Lost**: `EventSource` reconnects by itself, so the browser calls the view lost when the source
    is CLOSED or no event (`ping` included) arrives for 15 s.
  - **Browser**: the native `EventSource` reads it (`useRescoreLog`), so reconnects resume from
    the last step on their own.
- **Rationale**:
  - Server Actions return one value; Next documents Route Handlers returning a `ReadableStream`
    for streaming, and `after()` for work that outlives a response: both are Next used its own
    way (constitution IV).
  - Following the stored log, not an in-memory stream, gives FR-012 (reopen a running run),
    US3's lost connection, a second tab and CLI runs for free, and needs no shared memory.
  - 400 ms polling meets SC-002 (≤ 1 s) with one small indexed query per open terminal.
  - The re-score no longer holds a server action for minutes, so Hide, Applied, Load more and
    opening jobs no longer wait behind it (018's accepted limit goes away).
- **Alternatives**:
  - WebSockets: Next's Route Handlers don't serve them, and they'd need a custom server. Rejected.
  - Polling a server action from the browser: works, but Next runs server actions one at a time
    per client, so it would block the page's other actions. Rejected.
  - An in-process event emitter: lost on reload, invisible to CLI runs. Rejected.

## R4. The fixed messages

- **Decision**: `src/rescore/steps.ts` holds the step kinds, each kind's allowed fields (a zod
  schema), and `stepLine(step): string`, the only place a line's text is built. Each field is a
  number, an enum, the job key, or an http(s) address the lookup tried (`isWebAddress`, shortened
  past 120 characters; a failed open's address may be one that was refused). Unknown kinds render nothing. The CLI and the browser both use `stepLine`.
- **Rationale**: FR-003 and SC-003 are then checked in one unit-tested function; the stored row
  is parsed against the schema before it is rendered, so a bad row can't smuggle text.

## R5. History as one list

- **Decision**: `JobDetailView.history` entries gain an optional `rescore: { id, state }`. A pure
  `historyRows(verdicts, runs, now)` (`src/web/history.ts`) merges them: a verdict whose `run_id`
  is a re-score run's id gets that run; each run with no verdict (filtered, failed, running)
  becomes a row of its own with its outcome. Rows are newest first by time.
- **Rationale**: FR-011's single list, decided as a plain function and unit-tested.

## R6. One re-score per job

- **Decision**: `RescoreLogStore.begin(key, run, now)` runs in a transaction that first locks the
  job's row (`SELECT … FOR UPDATE` through Kysely's `forUpdate()`), then inserts the run only if no
  run of that job is open (`ended_at` null and `started_at` within 10 minutes). It returns
  `{ started: id }`, `{ running: id }`, or `{ missing: true }` for a job that isn't stored. A run
  open 10 minutes or more counts as failed when shown and doesn't block.
- **Rationale**: FR-014 and the clarified 10-minute limit. Under InnoDB's REPEATABLE READ a plain
  select takes no lock, so without the row lock two presses could both insert; the contract runs
  two `begin`s at once to prove only one starts.

## R7. Delivery and test split

- **Decision**: five PRs (see [plan.md](plan.md), Delivery).
- **Test split**: 27 new unit tests, 2 integration tests (the `RescoreLogStore` contract on
  MariaDB) and 1 UI test (the terminal). Baseline (main, 2026-11-02): 790 unit, 61 integration,
  63 UI; after: 817 / 63 / 64, every share toward 95 / 4 / 1.
