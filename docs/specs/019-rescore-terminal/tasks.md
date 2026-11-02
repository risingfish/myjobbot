---

description: "Task list for feature 019, the re-score terminal"
---

# Tasks: Re-score terminal

**Input**: Design documents from `docs/specs/019-rescore-terminal/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/rescore-log.md](contracts/rescore-log.md),
[quickstart.md](quickstart.md)

**Tests**: required by constitution Principle II. Each sitting writes its tests before its code;
each test task names its kind and count. The ledger is at the end.

**Organization**: sittings follow the PRs in [plan.md](plan.md) (Delivery). The store (S1) and the
step capture (S2) come first because every story reads them; US1 and US2 (watch a run, no outside
text) land in S2–S3; US3 (looking away) lands with S3's stored-log stream; US4 (History) in S4.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: the user story (US1–US4). Sitting-boundary tasks carry no story label.

## Sitting rules (constitution Principle I and Development Workflow)

- **Where:** the main checkout on `019-rescore-terminal`.
- **Docker stack** (constitution 2.4.0, Development Workflow): stopped for S1–S2, which add a
  migration and change the run, so the stack's scheduled run would migrate the production database
  from an unmerged branch. S3–S4 are UI work (no migration, none of the run's paths), so the
  stack may keep running; it serves this checkout live, so **every S3–S4 turn ends clean**: each
  test task lands in the same turn as the code that makes it pass (T027+T030, T028+T033/T034,
  T029+T032/T035, T038+T039), never a test whose module doesn't exist yet. S5 is docs.
- **Start:** create `.specify/sitting-in-progress` naming the sitting. **End:** `npm run check` and
  `npm run check:db` green, delete the marker. **Commits:** at a sitting's end, when the owner asks,
  with no attribution lines.
- **Code rules:** one-line `/** … */` purpose comment on every new function; functions ≤ 20 lines,
  ≤ 3 parameters; files ≤ 200 lines; every new export reached from production in its sitting.

---

## Phase 1: Setup

### Sitting S0: the design docs (docs PR)

- [X] T001 Remove the Sync Impact Report comment from `.specify/memory/constitution.md`, then, when the owner asks, commit `docs/specs/019-rescore-terminal/` together with the 2.4.0 amendment (`.specify/memory/constitution.md`, `.specify/templates/overrides/tasks-template.md`, `CLAUDE.md`), as Governance requires, and open the docs PR
- [ ] T002 After the docs PR merges, run `npm run check` and `npm run check:db` on `main`, correct the ledger's baseline row below if it differs from 790 unit / 61 integration / 63 UI, and recompute that every share still moves toward 95 / 4 / 1 (the integration margin is thin; add a unit test if needed)

---

## Phase 2: Foundational (the re-score log store)

### Sitting S1: the tables and `RescoreLogStore` (PR 1)

- [ ] T003 Stop the Docker stack (`docker compose stop`), confirm `docker:watch` isn't running, and create `.specify/sitting-in-progress` naming S1
- [ ] T004 [P] Write the contract `tests/helpers/rescoreLogContract.ts` with `rescoreLogContract(make)`, 2 tests, run from `tests/storeContract.test.ts` (unit, 2) and `tests/integration/storeContract.test.ts` (integration, 2):
  - **runs:** `begin(key, id, at)` gives `{ started: id }`; a second `begin` for the same job gives `{ running: id }`; two `begin`s at once (`Promise.all`) give exactly one `started`; `begin` for a job that isn't stored gives `{ missing: true }`; a run begun 10 minutes or more before `at` doesn't block (`{ started }`); `end(id, { outcome, filter, score }, at)` closes it; `runsFor(key)` lists the job's runs newest first with their outcome, filter, score, `startedAt`, `endedAt`; `run(id)` gives one or null;
  - **steps:** `addStep(id, { seq, elapsedMs, kind, fields })` stores steps; `stepsAfter(id, seq)` gives those with a larger `seq`, in order; after `pruneLastSeenBefore` removes the job, `runsFor` and `stepsAfter` give nothing, while an applied job's runs stay.
- [ ] T005 Create `src/db/migrations/014_rescore_runs.ts` with the schema builder, `utf8mb4_bin` table options as in `012_user_sources.ts`, list it in `src/db/migrations/index.ts`, add `rescore_steps` then `rescore_runs` to `TABLES` in `tests/helpers/testDb.ts` (so `emptyTables` and the fresh-database drop cover them), and update `tests/integration/migrate.test.ts`'s migration-name lists and collation list (0 new tests):
  - `rescore_runs`: `id varchar(36)` primary key, `ats varchar(32)` not null, `job_id varchar(255)` not null, `started_at varchar(32)` not null, `ended_at varchar(32)` null, `outcome varchar(16)` null, `filter varchar(16)` null, `score integer` null; index `rescore_runs_job` on `(ats, job_id, started_at)`;
  - `rescore_steps`: `run_id varchar(36)` not null, `seq integer` not null, `elapsed_ms integer` not null, `kind varchar(24)` not null, `fields text` not null; primary key `(run_id, seq)`; foreign key `run_id` → `rescore_runs.id` with `onDelete("cascade")`, so a run's steps go with it.
- [ ] T006 Add both tables to `src/db/schema.ts` (`RescoreRunsTable`, `RescoreStepsTable`, entries in `Database`).
- [ ] T007 Create `src/db/rescoreLogStore.ts`: the `RescoreLogStore` interface (`begin`, `end`, `addStep`, `stepsAfter`, `run`, `runsFor`), `RescoreRun`, `StoredStep`, `RescoreEnd` (`{ outcome: "scored" | "filtered" | "failed"; filter: "company" | "title" | "body" | null; score: number | null }`, the stream's `end` event and `rescoreNote`'s input), `BeginResult` (`{ started: string } | { running: string } | { missing: true }`) types, and `OPEN_RUN_MINUTES = 10`. A run open `OPEN_RUN_MINUTES` or more is reported as `failed` everywhere it is shown.
- [ ] T008 Create `src/db/kysely/rescoreLogStore.ts`, `KyselyRescoreLogStore`, with Kysely builders only: `begin` inside `db.transaction()` first locks the job's row (`selectFrom("jobs")…forUpdate()`; none gives `{ missing: true }`), then selects an open run of the job started after `at − 10 min` and inserts if none, so two presses can't both start (InnoDB's plain select takes no lock); `fields` stored as JSON text and parsed back.
- [ ] T009 Create `tests/helpers/memoryRescoreLog.ts` (`MemoryRescoreLog` over the shared `Tables` in `tests/helpers/memoryJobViews.ts`, which gain `rescoreRuns` and `rescoreSteps`) and add `rescoreLog` to both `memoryStores` and `storesWithSettings` in `tests/helpers/memoryStore.ts`.
- [ ] T010 Add `rescoreLog: RescoreLogStore` to `Stores` in `src/db/store.ts` (keep it ≤ 200 lines; import the type from `rescoreLogStore.ts`) and to `storesOver` in `src/db/kysely/stores.ts`.
- [ ] T011 In `src/db/kysely/jobStore.ts`, pull `pruneLastSeenBefore`'s verdicts clause into one private helper, `deleteOrphansOf(table: "verdicts" | "rescore_runs")` (delete the rows whose job is gone, the existing `not exists` shape), and call it for both tables; the steps go by cascade (T005). Keep the function ≤ 20 lines and the file ≤ 200; mirror it in the memory job store. Update its purpose comment.
- [ ] T012 Run `npm run check` and `npm run check:db` until green, delete the marker, and when the owner asks, commit S1 and open PR 1

**Checkpoint**: PR 1. The tables exist; nothing writes them yet.

---

## Phase 3: User Story 1 + 2 - Watch a re-score, with nothing outside in it (Priority: P1)

**Goal**: each re-score records its steps as fixed lines; the CLI prints them live; then the panel shows them live.

**Independent Test**: `npm start -- rescore <ats> <job_id>` prints the command line, a line per step and the outcome; pressing Re-score shows the same lines arriving in the panel's terminal.

### Sitting S2: steps, capture and the CLI (PR 2)

- [ ] T013 Create `.specify/sitting-in-progress` naming S2 (stack still stopped)

#### Tests (S2)

- [ ] T014 [P] [US2] Write unit tests (7) in `tests/rescoreSteps.test.ts` for `stepLine`, `parseStep`, `consoleLine` and `alreadyRunningLine`: one line per kind in the [data-model](data-model.md) table (settings with and without fallbacks; filters passed and filtered; search with its chars; page via download, board and browser with a thousands separator, and a failed open with its code; lookup_end found and not found with its code; reading, lookalike, saved; outcome scored, filtered, failed); a `url` longer than 120 characters is cut with `…`; a stored row of an unknown kind, or with a field outside its schema (a `url` that isn't an http(s) address by `isWebAddress`, or holds a newline, or a `reason` not in the codes), parses to null and renders nothing; `consoleLine` gives `[  2.4s] <line>`; `alreadyRunningLine` gives `rescore <ats> <job_id>: already running (<run id>)`.
- [ ] T015 [P] [US2] Write unit tests (4) in `tests/traceSteps.test.ts`: `stepFromAudit` turns `search` (chars only, never its `url`, which holds the company's name), `open_careers`, `open_job` and `finish` audit entries into `search`, `page` (careers or job; `pageSource` html → download, rendered → browser, board → board; a failed open has null `chars` and `via` and its reason code, and a stale remembered page keeps its chars and source with a null reason) and `lookup_end` steps with only the address, chars, read source and outcome code, and gives null for `retry`, `render_check`, `remembered`, `skipped`; `stepsFromTrace` turns a `tool` event named `get_job` into `reading` and a `lookalike_removed` event into `lookalike`, ignores every other event (including tool results' content), and still passes every event to the trace it wraps.
- [ ] T016 [P] [US1] Write unit tests (2) in `tests/rescoreLog.test.ts`: `RescoreLog.step` numbers steps 1, 2, 3 synchronously, stamps `elapsedMs` from the run's `started_at`, stores them in that order even when the store answers out of order, and calls the listener with the rendered line; `end(result)` waits for every stored step before `store.end`; a step the store refuses (throws) is traced (`rescore_log_failed`) and doesn't stop the re-score.
- [ ] T017 [US1] Extend `tests/rescore.test.ts` (unit, 4 new): a scored re-score stores `settings`, `filters` (passed), `reading`, `saved` (the total) and `outcome` steps in order and ends its run `scored` with the score; a filtered one stores `settings`, `filters` (body) and `outcome` and ends `filtered`/`body`; a lookup stores `lookup`, the audit-derived steps and `lookup_end`, then one `filters` step from the final plan, before `reading`; a failing one ends its run `failed`, and a look-alike marker in the job's text adds a `lookalike` step. Update the existing `depsFor` helper for the new `log` dependency; `RescoreOutcome` is unchanged, so the six existing cases pass with only that change.

#### Implementation (S2)

- [ ] T018 [US2] Create `src/rescore/steps.ts`: `STEP_KINDS` with a zod schema per kind for its `fields` (addresses must pass `isWebAddress` (`src/descriptions/webAddress.ts`), have no control characters and be at most 2,000 long; reasons from the lookup's fixed codes; numbers as integers), `parseStep(kind, fields): Step | null`, `stepLine(step: Step): string` built only from the fields, per the data-model's lines, `consoleLine(line, elapsedMs)` and `alreadyRunningLine(key, runId)`.
- [ ] T019 [US1] Create `src/rescore/log.ts`: `RescoreLog` (`{ store: RescoreLogStore; runId; startedAt; trace; clock; onLine?: (line, elapsedMs) => void }`), with `step(kind, fields)` (parse, number synchronously, stamp from `startedAt`, chain the store write after the previous one, notify; a store failure is traced, not thrown) and `end(result: RescoreEnd)` (wait for the chain, then `store.end`). `Trace.write` is synchronous, so the chain is what keeps every step stored before `end`.
- [ ] T020 [US2] Create `src/rescore/traceSteps.ts`: `stepFromAudit(entry: AuditEntry)` and `stepsFromTrace(trace, log): Trace` per T015.
- [ ] T021 [US1] In `src/rescore/rescore.ts`: `RescoreDeps` gains `log: RescoreLog` and `fallbacks: number`; `rescore` logs `settings` (the fallbacks), `lookup` / `lookup_end` / `lookup_failed` when it looks up, then one `filters` step from the final plan (after any lookup), then `outcome`, and calls `deps.log.end(...)` with the outcome, filter and score; the score comes from the session (T022). `RescoreOutcome` stays as it is. Keep functions ≤ 20 lines.
- [ ] T022 [US1] In `src/rescore/session.ts`: `scoreOne` returns the recorded total (or null) and uses `deps.trace`, already wrapped by `openRescore` (T023), for both the agent's deps and `reportLookalike` (which writes `lookalike_removed`), so it wraps nothing itself; the one-job store's successful `recordVerdict` logs `saved` with the total (via a callback from `oneJobStore`, `src/rescore/oneJobStore.ts`).
- [ ] T023 [US2] In `src/rescore/open.ts`: build the `RescoreLog` on `stores.rescoreLog` with the run id and a `startedAt` taken once; wrap `logs.trace` once with `stepsFromTrace` and use the wrapped trace for `careersParts` and `deps.trace`, so a look-alike found by the lookup or the scoring becomes one step; wrap `stores.careers` so `audit(entry)` also logs `stepFromAudit(entry)`; count the fallbacks by giving `settingsForRun` a trace wrapper that counts `settings_fallback` events (only fallbacks, not `file_ignored` or `retired`), so `settingsForRun`, `run.ts` and their tests stay as they are; export `beginRun(opened, key)` returning `BeginResult` through `stores.rescoreLog.begin`, with the log's `startedAt` as `begin`'s `at`, so `elapsedMs` and the run's `started_at` share one time.
- [ ] T024 [US1] In `src/cli.ts`: `rescoreWith` calls `beginRun`; when running, prints `alreadyRunningLine(...)` and returns 1 (missing: the usual failed line, 1); otherwise prints `$ myjobbot rescore <ats> <job_id>`, gives the log an `onLine` that prints `consoleLine(line, elapsedMs)` (both in `src/rescore/steps.ts`, covered by T014), and runs the re-score.
- [ ] T025 Run `npm run check` and `npm run check:db` until green, delete the marker, and when the owner asks, commit S2 and open PR 2

**Checkpoint**: PR 2. The CLI prints a live log, every re-score is stored with its steps, and a second CLI re-score of a running job is refused.

### Sitting S3: the live terminal in the panel (PR 3)

- [ ] T026 Start the Docker stack if stopped (UI work; owner decision), create `.specify/sitting-in-progress` naming S3

#### Tests (S3)

- [ ] T027 [P] [US3] Write unit tests (3) in `tests/rescoreStream.test.ts` for `streamEvents(run, steps, now)` in `src/web/rescoreStream.ts`: a running run gives `start` and one `step` event per stored step, each with `id` = its `seq` and `data` `{ seq, elapsedMs, line }` from `stepLine`, and no `end`; an ended run adds `end` with `{ outcome, filter, score }`; a run open 10 minutes or more ends `failed`; a stored step that doesn't parse is left out.
- [ ] T028 [P] [US1] Write a UI test (1) in `tests/client/rescoreTerminal.test.tsx` with a fake `EventSource` (`vi.stubGlobal`) and fake timers: `RescoreTerminal` has `data-theme="dark"`, shows `$ myjobbot rescore greenhouse a`, appends lines as `step` events arrive (`role="log"`), shows the cursor until `end`, then the outcome line and no cursor, calls `onEnd` once, and closes with its × button; the source reaching CLOSED, or no event (the fake's `ping` events included) for 15 seconds, shows `live view lost: reopen the log from History`, while `ping` events every 5 seconds keep a quiet run alive.
- [ ] T029 [US1] Update `tests/rescoreNote.test.ts` (unit, 0 new) for `rescoreNote` taking `RescoreEnd`, or `{ failed: true }` for a re-score that couldn't start; `tests/client/panelRescore.test.tsx` (UI, 0 new) for `startRescore` being called, the run handed to `onStart`, and the failure note on `{ failed: true }`; `tests/client/detailsPanel.test.tsx` (UI, 0 new) for the terminal opening under the header once a run starts; and the `PanelHeader` renders in `tests/client/panelHeader.test.tsx`, `panelPostingLink.test.tsx` and `detailsPanel.test.tsx` (UI, 0 new) for the changed props. Write unit tests (2) in `tests/webRows.test.ts` for `startRescoreFor` with a fake opener: a job with a run open gives `{ run }` and no work, and opens nothing further; a started run gives `{ run, work }`, and running `work` ends the run and closes what it opened.

#### Implementation (S3)

- [ ] T030 [US3] Create `src/web/rescoreStream.ts`: `streamEvents` per T027 (the `end` event's data is `RescoreEnd`), `sseText(events)` formatting `id:`, `event:`, `data:` lines, and `PING` (a named `ping` event with `data: {}`; an SSE comment would be dropped by `EventSource` unseen).
- [ ] T031 [US3] Create `web/app/api/rescores/[id]/route.ts`: `GET` checks `[id]` is a UUID (else 404), reads the run (404 when unknown), then returns a `Response` whose `ReadableStream` sends `streamEvents` for steps after `Last-Event-ID`, polls `stepsAfter` every 400 ms and sends `PING` every 5 s; the store is `(await getStores()).stores.rescoreLog` (`web/lib/uiState.ts`); once the run reads as ended (or counts as failed) it calls `stepsAfter` once more, sends those steps and `end`, and closes; stops polling when the request is aborted; headers `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`; `export const dynamic = "force-dynamic"`. Add `web/app/**/route.ts` to `knip.json`'s `next.entry`.
- [ ] T032 [US1] In `web/lib/rows.ts` replace `rescoreFor` / `refreshedRow` with `startRescoreFor(stores, open, request)` (`open` is `openRescore` in production, a fake in T029): check `jobRequest`, open, `beginRun`; when running, close and return `{ run: id }`; when missing, close and return `{ failed: true }`; otherwise return `{ run: id, work }` where `work` runs the re-score and closes. In `web/lib/actions.ts` replace `rescoreJob` with `startRescore(ats, jobId)`: call it with `(stores, () => openRescore(process.env, stores))`, hand `work` to `after()` (`next/server.js`), return `{ run }`, or `{ failed: true }` on any error (logged on the server only). Delete `RescoreResult` from `src/web/api.ts`, and change `rescoreNote` (`src/web/rescoreNote.ts`) to take `RescoreEnd | { failed: true }`, mapping `filter` through `FILTER_NOTES`; update its purpose comment.
- [ ] T033 [US1] Create `web/lib/useRescoreLog.ts`: opens an `EventSource` on `/api/rescores/<id>`, keeps `{ command, lines, ended, end, lost }`, closes on `end` and on unmount.
- [ ] T034 [US1] Create `web/components/panel/RescoreTerminal.tsx` (root with `data-theme="dark"`, so Pico's own dark variables apply in both page themes; title bar with `myjobbot rescore <ats> <job_id>` and a × button; `pre`-styled body with `role="log"` `aria-live="polite"`, the command line, `[  2.4s] <line>` rows, a blinking cursor while running; scrolls to the newest line), and its styles in `web/app/styles.css` from Pico variables (`--pico-font-family-monospace`, `--pico-code-background-color`, `--pico-code-color`, `--pico-border-radius`, `--pico-spacing`). In `useRescoreLog` (T033), which listens for `ping` as well as `start`, `step` and `end`, "lost" means the source is CLOSED or no event (`ping` included) arrived for 15 seconds; it then closes the source.
- [ ] T035 [US1] Rewire the panel through a new hook, `web/lib/useRescoreTerminal.ts`, which owns `{ terminal: { run, key } | null, note, running, open(run), ended(end), close() }`: `ended` bumps the details refresh, sets `rescoreNote(end)`, and calls `onRescored(job, view.job)` once the bumped refresh's details arrive. `useRescore` (`web/lib/useRescore.ts`) calls `startRescore` and hands the run to `open`, or sets the failed note on `{ failed: true }`; `PanelHeader` (`web/components/panel/PanelHeader.tsx`) passes `running`, `note` and `onStart` to `PanelRescore`, which stays disabled while `running`; `DetailsPanel` renders `RescoreTerminal` under the header; opening another job or closing the panel drops the terminal (an assertion in `tests/client/detailsPanel.test.tsx`, 0 new).
- [ ] T036 Run `npm run check` and `npm run check:db` until green, delete the marker, and when the owner asks, commit S3 and open PR 3

**Checkpoint**: PR 3. Re-score shows the live terminal; reloading and pressing Re-score again follows the running run.

---

## Phase 4: User Story 4 - Read an earlier re-score's log (Priority: P2)

### Sitting S4: History as one list (PR 4)

- [ ] T037 Create `.specify/sitting-in-progress` naming S4 (stack running)
- [ ] T038 [P] [US4] Write unit tests (3) in `tests/history.test.ts` for `historyRows(verdicts, runs, now)`: a verdict whose `run_id` is a re-score run carries `rescore: { id, state: "scored", filter: null }`; a filtered, failed or running run with no verdict is its own row (outcome, filter, no score), newest first among the verdicts; a run open 10 minutes or more is `failed`; scheduled-run verdicts carry no `rescore`.
- [ ] T039 [US4] Create `src/web/history.ts` (`historyRows`); `HistoryEntry` (`src/web/api.ts`) gains `rescore: { id: string; state: "scored" | "filtered" | "failed" | "running"; filter: string | null } | null` and `total` becomes nullable; `toJobDetailView(row, { verdicts, runs }, context)` (`src/web/jobDetail.ts`) uses `historyRows`; `loadDetailsFor({ views, rescoreLog }, config, request)` (`web/lib/rows.ts`) reads `rescoreLog.runsFor(key)`; `getUiState` (`web/lib/uiState.ts`) exposes `rescoreLog`, and `loadJobDetails` (`web/lib/actions.ts`) passes it. Update `tests/jobDetail.test.ts` and `tests/webRows.test.ts` for the new shapes (0 new).
- [ ] T040 [US4] In `web/components/panel/HistorySection.tsx`: a row with `rescore` gets a **Log** button; a row without a score shows its outcome (`filtered: body filter`, `failed`, `running…`) in the Score column; **Log** calls `onOpenLog(id)`, which `DetailsPanel` passes down to `useRescoreTerminal.open` (following it live if running). When the panel opens a job whose History has a running re-score, `DetailsPanel` opens its terminal at once (clarification Q3); only on opening a job, so a terminal closed with × stays closed when the details refresh (an assertion in `tests/client/detailsPanel.test.tsx`, 0 new). Update `tests/client/panelSections.test.tsx` for the new column contents (UI, 0 new).
- [ ] T041 Run `npm run check` and `npm run check:db` until green, delete the marker, and when the owner asks, commit S4 and open PR 4

---

## Phase 5: Polish & Cross-Cutting Concerns

### Sitting S5: documentation (PR 5)

- [ ] T042 Create `.specify/sitting-in-progress` naming S5
- [ ] T043 [P] Update `README.md`: the Web UI's Re-score paragraph (the terminal, following a running re-score, one at a time, History's Log), the CLI's `rescore` output and `already running`, and remove the "server action holds the page's other actions" note.
- [ ] T044 [P] Update `CLAUDE.md`'s Re-score paragraph (and its Commands line for `rescore`, which now also prints the log and `already running`, and drop the "holds up the page's other actions" sentence): `rescore_runs` / `rescore_steps` written only through `RescoreLogStore`; lines only from `stepLine` (never page or model text); `startRescore` with `after()`; the `api/rescores/[id]` stream follows the stored log; one run per job, 10-minute open limit.
- [ ] T045 Run [quickstart.md](quickstart.md) §1–§6 on the stack, fill the ledger's last row, run `npm run check` and `npm run check:db`, delete the marker, and when the owner asks, commit S5 and open PR 5

---

## Dependencies & Execution Order

- **S0 → S1 → S2 → S3 → S4 → S5**, each PR merged and tested before the next (small PRs).
- S2 needs S1's store; S3 needs S2's steps and runs; S4 needs S1's `runsFor` and S3's terminal.
- Within each sitting, its tests come first and fail first.
- First production callers: the store in `storesOver` (S1); `steps.ts`, `log.ts`, `traceSteps.ts` from `rescore.ts`/`open.ts`/`cli.ts` (S2); `rescoreStream.ts` from the route (S3); `history.ts` from `jobDetail.ts` (S4).

## Parallel Opportunities

- S1: T004 alongside T005–T007.
- S2: T014, T015, T016 together; then T018, T019, T020 together; T021–T024 in order.
- S3: in pairs, each in one turn: T027 with T030; T028 with T033 and T034; T029 with T032 and T035; T031 after T030.
- S4: T038 with T039 in one turn, then T040.
- S5: T043 and T044 together.

## Implementation Strategy

- **MVP**: S2's CLI log proves capture end to end; S3 delivers the feature the owner asked for.
- **Incremental**: PR 1 (store) → PR 2 (CLI log) → PR 3 (live terminal) → PR 4 (History) → PR 5 (docs).

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (2026-11-02, T002) | 790 (86.43%) | 61 (6.67%) | 63 (6.89%) |
| Planned new | 27 (T004 2, T014 7, T015 4, T016 2, T017 4, T027 3, T029 2, T038 3) | 2 (T004's MariaDB run) | 1 (T028) |
| Planned removed | 0 | 0 | 0 |
| Planned after | 817 (86.55%) | 63 (6.67%) | 64 (6.78%) |
| After PR 5 (T045) | | | |

Every share moves toward 95 / 4 / 1 (integration 6.674% → 6.674%, down by 0.0003 points).

## Notes

- Never print `.env`; integration tests use `myjobbot_test` only.
- No new library; if one turns out to be needed, present options first (constitution IV).
