---

description: "Task list for 030: worker observability"
---

# Tasks: Worker observability

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/metrics.md](contracts/metrics.md),
[contracts/monitoring-page.md](contracts/monitoring-page.md), [quickstart.md](quickstart.md)

**Tests**: Test-first (constitution II). Each test task names its kind; ledger at the end.

## Format: `[ID] [P?] [Story] Description`

## Sittings

Worked in the main checkout on `030-observability`, one PR per sitting (owner's small-PR rule),
each merged and tested before the next. S1, S2 and S5 change the run or add a migration: the Docker
stack stays stopped (`docker compose stop`). S3 and S4 are UI work and may keep it running, each
turn ending clean. Each sitting starts by creating `.specify/sitting-in-progress` naming it and ends
with `npm run check` **and** `npm run check:db` green, then deletes the marker. Every new export and
store method gets its production caller in the sitting that adds it (knip's production pass);
nothing is exported for tests only. Commit only at a sitting's end, when the owner asks.

Contracts (CLAUDE.md: every case on memory, only the strict ones on MariaDB): the new stores' cases
live in `tests/helpers/monitoringContract.ts` and run on memory in `tests/monitoringStores.test.ts`;
its `monitoringStrictCases` group (foreign-key cascades and the account removal) also runs on
MariaDB in `tests/integration/monitoringStores.test.ts`. A case for both goes in
`monitoringStrictCases` only. Memory versions live in `tests/helpers/memoryMonitoring.ts`, wired
into `memoryStores` (`tests/helpers/memoryStore.ts`).

---

## Phase 1: Setup

- [X] T001 Create `.specify/sitting-in-progress` containing `030 S1`.

---

## Phase 2: Foundational

### Sitting S1: Runs are recorded (stack stopped)

- [X] T002 [P] Integration test first, `tests/integration/monitoringMigration.test.ts` (pattern of `tests/integration/accountStatusMigration.test.ts`): after migrating, `agent_runs`, `run_users`, `source_fetches` and `mail_sends` exist with the columns, types, nullability, keys and indexes of [data-model.md](data-model.md), all `utf8mb4_bin`; `agent_runs.incomplete` is `tinyint` default 0; `rescore_runs` has `model_calls`, `prompt_tokens`, `completion_tokens` (`int`, default 0) and existing rows read 0; deleting a `user_sources` row deletes its `source_fetches`, and deleting an `agent_runs` row deletes its `run_users`.
- [X] T003 Add `src/db/migrations/026_monitoring.ts` (export `monitoringTables`) with Kysely's `createTable`/`alterTable`/`createIndex` builders only (`` sql`tinyint` `` only for the type fragment): `agent_runs` (`id` varchar(36) primary key; `started_at`, `alive_at` varchar(32) not null; `ended_at`, `outcome`, `reason` varchar(32) null; `incomplete` tinyint not null default 0; the 13 count columns of data-model.md, `integer` not null default 0; index on `started_at`), `run_users` (primary key `(run_id, user_id)`, `run_id` → `agent_runs.id` on delete cascade, `user_id` → `users.id`, `part_id` varchar(36) null with an index, `started_at` varchar(32) not null, `ended_at` varchar(32) null, `outcome` varchar(32) not null, `reason` varchar(32) null, the 9 counts not null default 0), `source_fetches` (`id` auto increment primary key, `user_id` → `users.id`, `source_id` → `user_sources.id` on delete cascade, `part_id` varchar(36) not null, `module` varchar(64) not null, `at` varchar(32) not null, `ms` int not null, `outcome` varchar(16) not null, `reason` varchar(64) null, `pages`/`jobs`/`cost` int not null default 0; indexes `(user_id, source_id, at)` and `(module, at)`), `mail_sends` (`id` auto increment primary key, `at` varchar(32) not null, `kind` varchar(32) not null, `outcome` varchar(8) not null, `reason` varchar(16) null; index `at`), and the three `rescore_runs` columns. List `"026_monitoring": monitoringTables` in `src/db/migrations/index.ts` and append it to the step list in `tests/integration/migrate.test.ts`.
- [X] T004 Types: new `src/db/schema/monitoring.ts` (`AgentRunsTable`, `RunUsersTable`, `SourceFetchesTable`, `MailSendsTable`), the three columns in `src/db/schema/rescore.ts`, and their entries in `Database` (`src/db/schema.ts`).
- [X] T005 [P] Unit tests first, `tests/monitoringRules.test.ts`: `runOutcome(parts)` gives `finished` when every part is `finished`/`skipped`/`deleted`/`held`, else `finished_with_errors`; `runFailureReason` maps an error with a string `sqlState` (mysql2) to `database`, an instance of the OpenAI client's `APIError` or `APIConnectionError` to `model`, an error named `TimeoutError` to `timeout`, an error named `TargetClosedError` (Playwright) to `browser`, anything else, a string included, to `other`.
- [X] T006 Implement `src/monitoring/runStatus.ts` (`runOutcome`), `src/monitoring/failureReason.ts` (`runFailureReason`) and `src/monitoring/retention.ts` (`MONITORING_RETENTION_DAYS = 90`).
- [X] T007 [P] Unit tests first, `tests/runTally.test.ts`: `RunTally` counts `source_fetch` (a fetch; `outcome: "failing"` adds a failure; `jobs` adds to found), `source_skipped` (a fetch, no failure), `source_fetch_failed` (a fetch and a failure), `company_search` and `company_search_failed`, `jobs_scored` (its `count`), and `llm_response` (one call; `response.usage.prompt_tokens`/`completion_tokens`, 0 when missing); an unknown event or one whose fields don't parse changes nothing; `totals()` returns all nine counts.
- [X] T008 Implement `src/monitoring/tallyEvents.ts` (one zod schema per counted event, in a table keyed by `type`) and `src/monitoring/tally.ts` (`RunTally implements Trace`, `totals()`). In `src/tools/recordMatches.ts`, trace `{ type: "jobs_scored", count }` with the number of jobs saved.
- [X] T009 [P] Contract cases first in `tests/helpers/monitoringContract.ts` (`runHistoryCases`, unit on memory): `begin` then `alive` moves `alive_at`; `partStarted` stores a `running` part with its `part_id` and `partEnded` updates it with outcome, reason and counts; `markIncomplete` sets `incomplete`; `end` writes `ended_at`, outcome, reason and totals; `pruneBefore(cutoff)` removes runs started before it with their parts; two runs open at once (an overlapping manual and scheduled run) each keep their own heartbeat, parts and totals.
- [X] T010 Add `RunHistory` (`src/db/runHistory.ts`: `begin`, `alive`, `partStarted`, `partEnded`, `markIncomplete`, `end`, `pruneBefore`), `KyselyRunHistory` (`src/db/kysely/runHistory.ts`, builders only), `MemoryRunHistory` (`tests/helpers/memoryMonitoring.ts`); add `runHistory` to `SharedStores` (`src/db/store.ts`), `src/db/kysely/stores.ts` and `tests/helpers/memoryStore.ts`.
- [X] T011 [P] Unit tests first, `tests/runRecorder.test.ts`, with a fake timer and clock: `begin` writes the run and arms a 60 s heartbeat that calls `alive`; `partStarted(userId, partId)` writes a `running` part before the user's work; `partEnded(userRun, tally)` updates it (outcome from the `UserRun`, fixed reason, tally totals); a skipped, deleted or held user is written once, ended; `end` stops the timer and writes the outcome from `runOutcome`, the summed totals and `users`/`users_failed`/`users_skipped`; a store write that throws is logged as the fixed line `run_history_failed` through the `log` it is handed, never thrown, and the next write that succeeds also calls `markIncomplete` (at the latest, `end`); `fail(error)` ends the run `failed` with `runFailureReason`.
- [X] T012 Implement `RunRecorder` in `src/monitoring/recorder.ts` (handed `RunHistory`, `{ now, every }` timers and a `log` line writer, `console.error` by default as `sendMail` does; `runAll` has no trace of its own).
- [X] T013 [P] Unit tests first in `tests/runAll.test.ts`: a run records one `agent_runs` row and one part per user (finished, skipped with its reason, failed with a fixed reason, deleted); a user's part is `running` while `runForUser` works (checked from a seam that reads the memory store mid-run); a user's throw keeps `describeError` out of the stored reason; the tally totals reach the part; the run's totals are the sum; the prune also prunes run history older than 90 days.
- [X] T014 Wire it: `runAll` (`src/app/runAll.ts`) creates a `RunRecorder` (a `RunSeams.timers` seam for tests), `begin`s before the deletions, records each deleted or held user, `partStarted`s each planned user before `runPlanned` and `partEnded`s it after, `end`s after the prune, and `fail`s in a `catch` around the work; `runAll` makes each planned user's part id (`randomUUID()`) before `partStarted` and passes it to `runForUser` (`src/app/run.ts`), which hands it to `openRunLogs(config, out, runId)` (`src/app/runLogs.ts`, the id now an optional parameter defaulting to `randomUUID()` for its other callers, so the part row, the trace and the careers audit share one id); `runForUser` tees a `RunTally` onto the part's trace and model log (`teeTrace`) and returns it with the report; `runPlanned` records `runFailureReason(error)` alongside the existing `describeError`. `pruneOldJobs` calls `runHistory.pruneBefore` with `MONITORING_RETENTION_DAYS`.
- [X] T015 Account removal: add `run_users` to `USER_TABLES` in `src/db/kysely/accountRemoval.ts` (the type check requires it) and drop a user's parts in `MemoryAccountRemoval`'s callbacks (`tests/helpers/memoryStore.ts`). Strict case first, in `monitoringStrictCases` (memory and MariaDB, `tests/integration/monitoringStores.test.ts`): removing an account removes its parts, the other users' parts stay, and `agent_runs` keeps its totals.
- [X] T016 Run `npm run check` and `npm run check:db`; when green, delete the marker. End of S1.

**Checkpoint**: Every run and each user's part is stored as it goes, with a heartbeat; nothing shows it yet.

S1 notes (2026-11-10): `runAll` needed no timer seam (its tests don't drive the heartbeat; `runRecorder.test.ts` does, with fake timers handed to `RunRecorder`), so `RunSeams` is unchanged. The run's totals are the 3 user counts and the tally's 9 (`search_failures` included, no `lookups`: lookups are counted from the careers audit when read). `record_matches` now takes a `trace` on all three paths (run, re-score, eval case), so it can trace `jobs_scored`. A failed `UserRun` carries its fixed `reason` (`runAll`, `accountDeletions`). The run part's id is made by `runAll` and passed to `openRunLogs`; `observedLogs` tees the part's trace and model log into its tally.

---

## Phase 3: User Story 2 - See how sources are pulling (Priority: P2), recording part

**Goal**: Every fetch, planned skip and mail send is stored (the views come in S3 and S4).

### Sitting S2: Fetch history, mail log, re-score model use (stack stopped)

- [X] T017 Create `.specify/sitting-in-progress` containing `030 S2`.
- [X] T018 [P] [US2] Contract cases first (`fetchHistoryCases`, unit on memory): `record` stores a fetch with every field; `pruneBefore(cutoff)` removes older fetches only. Extend `monitoringStrictCases` (memory and MariaDB): deleting a source deletes its fetches; removing an account removes its fetches and leaves another user's.
- [X] T019 [US2] Add `FetchHistory` (`src/db/fetchHistory.ts`: `record`, `pruneBefore`; `UserFetchHistory` with `record`, and `userFetchHistory(store, userId)`), `KyselyFetchHistory`, `MemoryFetchHistory`; `fetchHistory` on `SharedStores`, `fetches` on `UserStores` (`src/db/userStores.ts`, `src/db/kysely/stores.ts`, memory); `source_fetches` in `USER_TABLES` and the memory removal; `pruneOldJobs` calls `fetchHistory.pruneBefore` with `MONITORING_RETENTION_DAYS` (FR-012).
- [X] T020 [P] [US2] Unit tests first in `tests/fetchPhase.test.ts`: an `ok`, a `partial` and a `failing` fetch each record `module`, `part_id`, `at`, `ms`, pages, jobs, cost and the fixed reason; a planned skip records `skipped` with its `SkipReason`; an `off` source records nothing; a record that throws is traced `fetch_history_failed` and the next source is still fetched.
- [X] T021 [US2] In `src/sources/fetchPhase.ts`, `finishFetch` and `skipped` record through `context.fetches` (a narrow `Pick<ToolContext, "fetches" | "runId" | "now">`), timing the fetch from `seen`; add `fetches: UserFetchHistory` to `ToolContext` (`src/tools/context.ts`) and fill it in `buildContext` (`src/app/run.ts`).
- [X] T022 [P] [US2] Unit test first in `tests/runAll.test.ts` (SC-004, the write budget): a run of 2 users with 3 sources each, on a counting memory store, writes at most 2 run-history rows per part, 1 fetch row per source and 1 heartbeat per elapsed minute.
- [X] T023 [P] [US2] Contract cases first (`mailLogCases`, unit on memory): `record` stores `{ at, kind, outcome, reason }`; `pruneBefore` removes older rows.
- [X] T024 [US2] Add `MailLog` (`src/db/mailLog.ts`), Kysely and memory versions, `mailLog` on `SharedStores`; `pruneOldJobs` prunes it with `MONITORING_RETENTION_DAYS`.
- [X] T025 [P] [US2] Unit tests first: in `tests/mail.test.ts`, every builder in `src/mail/messages.ts` gives its `kind`; `tests/recordedMailer.test.ts` checks `recordedMailer(mailer, log, now)` records `sent` after a send, `failed` with the queue's fixed reason after a throw (and still throws to the queue), and a log that throws never changes the send.
- [X] T026 [US2] Add `kind: MailKind` (a type union, no exported list) to `MailContent` and every builder (`src/mail/messages.ts`), carry it on `MailMessage` (`src/mail/mailer.ts`); move the fixed-reason mapping out of `src/mail/queue.ts` into `src/mail/failureReason.ts` (shared by the queue and the recorder); add `recordedMailer` (`src/mail/recorded.ts`); `mailSlot` (`src/mail/fromEnv.ts`) takes the `MailLog` and wraps the mailer it builds, and its three callers pass it: the web (`web/lib/authDeps.ts`), the run (`src/app/runAll.ts`) and `account init`/`reset` (`src/accounts/terminal.ts`).
- [X] T027 [P] [US3] Unit tests first in `tests/rescoreLog.test.ts`: a re-score's model calls and tokens (from a `RunTally` on its model log) are written at its end.
- [X] T028 [US3] `RescoreLog`'s end (`src/rescore/log.ts`) writes `model_calls`, `prompt_tokens`, `completion_tokens`; `openRescore` (`src/rescore/open.ts`) tees a `RunTally` onto the session's model log; `RescoreLogStore` gains the three fields.
- [X] T029 Run `npm run check` and `npm run check:db`; when green, delete the marker. End of S2.

**Checkpoint**: Fetches, skips, mail sends and re-score model use are stored and pruned.

S2 notes (2026-11-10): the fetch history is recorded through `src/sources/fetchRecord.ts` (its own module, called by the fetch phase). A source that is off is left out of the tally too (`source_skipped` with reason `off`). `recordedMailer` reports a failed log write as `mail_log_failed`. The memory re-score store keeps model use in the shared tables' `rescoreUse`, beside the run rows, since `RescoreRun` doesn't show it until S4's reads.

---

## Phase 4: User Stories 1 and 2 - the Monitoring page and a user's fetch history (Priority: P1, P2) 🎯 MVP

**Goal**: Admins see runs and source modules; each user sees their sources' recent fetches.

**Independent Test**: [quickstart.md](quickstart.md) steps 1-4.

### Sitting S3: Runs, sources, charts (UI work: the stack may run)

- [X] T030 Create `.specify/sitting-in-progress` containing `030 S3`.
- [X] T031 [P] [US1] Unit tests first in `tests/monitoringRules.test.ts`: `runStatus(run, now)` gives `running` (no end, alive 4m59s ago), `never_finished` (no end, alive 5m ago), else the stored outcome; `periodSince("day"|"week"|"month", now)` gives 1, 7 and 30 days back and `periodOf` turns anything else into `week`; `failingRepeatedly(outcomes)` is true when the latest 3 are `failing`, false with fewer than 3 or any other among them.
- [X] T032 [US1] Implement `runStatus` in `src/monitoring/runStatus.ts` (its 5-minute limit a module constant, not exported), `src/monitoring/periods.ts` (`periodSince`, `periodOf`) and `src/monitoring/failing.ts` (`failingRepeatedly`).
- [X] T033 [P] [US1] Contract cases first (`monitoringReadCases`, unit on memory) for `runs(since)` (newest first, with totals, `alive_at` and `incomplete`), `run(id)` (its parts by user id, a `running` part included, with lookups counted from `careers_audit` by `part_id`), and `modules(since)` (per module: fetches by outcome, pages, jobs, cost, top 3 reasons, sources failing repeatedly by `failingRepeatedly`); every row's fields are ids, module names, counts, times and fixed reasons only.
- [X] T034 [US1] Add `MonitoringReads` (`src/db/monitoringReads.ts`: `runs`, `run`, `modules`), Kysely (`src/db/kysely/monitoringReads.ts`, builders only) and memory versions; `monitoring` on `SharedStores`.
- [X] T035 [P] [US1] Unit tests first, `tests/monitoringViews.test.ts`: `runRows` gives each run's start (app time zone), duration, status label (`never finished` from `runStatus`, "record incomplete" when flagged), users and counts; `runDetailRows` names parts "User 2", never by name, and shows a `running` part as "running when it stopped" for a never-finished run; `moduleRows` and the charts' series (`runsPerDay`, `fetchesPerDay`) by status and outcome; empty inputs give the empty states' texts.
- [X] T036 [US1] Implement `src/web/monitoringViews.ts` (pure, no Next.js).
- [X] T037 [US1] Install `chart.js@4.6.1` exactly (`npm install --save-exact`; check the lockfile keeps every optional platform entry). T039's `MonitoringChart` is its first import.
- [X] T038 [P] [US1] UI tests first, `tests/client/monitoring.test.tsx` (2 tests): the page's runs panel renders `runRows` as a table with the period choice, and "No runs yet" when empty; `MonitoringChart` renders a `<canvas>` with an accessible label and its data as a table fallback.
- [X] T039 [US1] `web/lib/monitoringState.ts` reads `myStores()`'s `monitoring` only when the signed-in account is an admin (else null), as `settingsState` reads `accounts`; page `web/app/(app)/monitoring/page.tsx`: `requireSession()`, `notFound()` unless admin, `?period` through `periodOf`, `?run` for the detail. Components in `web/components/monitoring/`: `RunsPanel.tsx`, `RunDetail.tsx`, `SourcesPanel.tsx`, `PeriodChoice.tsx`, and the client `MonitoringChart.tsx` (`Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)`, colours from Pico's CSS variables, destroyed on unmount). Pico tables and `<details>`, no hand-picked sizes. Add a `tests/webIsolation.test.ts` case: a non-admin's `monitoringState` is null.
- [X] T040 [US1] Header (`web/components/sections/Header.tsx`): a Monitoring link for admins only.
- [X] T041 [P] [US2] Contract case first (`fetchHistoryCases`): `recent(sourceIds, 10)` gives each source's latest 10, newest first, for that user only. UI test first, `tests/client/sourceHistory.test.tsx` (1 test): a source's "Recent fetches" lists time, outcome, jobs and reason, newest first, with "Failing repeatedly" after 3 failing fetches.
- [X] T042 [US2] Add `recent` to `FetchHistory`/`UserFetchHistory` (Kysely and memory); `web/components/settings/SourceHistory.tsx` in `SourcesSection.tsx`, fed by `myStores().fetches.recent()` through `sourcesView` (`web/lib/settingsState.ts`).
- [ ] T043 [US1] Check in the browser (brave-debug skill): `/monitoring` as admin and as a non-admin (404), the charts drawing with no content-policy errors in the console, light and dark, phone width.
- [X] T044 Run `npm run check` and `npm run check:db`; when green, delete the marker. End of S3.

**Checkpoint**: MVP: runs and sources are visible to admins; users see their own fetches.

S3 notes (2026-11-11): `MonitoringReads` gives raw rows (runs, a run's parts with their lookup counts, fetches) and the page's aggregation is plain functions (`src/web/monitoringRuns.ts`, `monitoringSources.ts`, `chartSeries.ts`), so memory and Kysely share one tested piece of logic; the reads and recent-fetches cases also run on MariaDB, as one test. `DataTable` is shared (`web/components/sections/`), used by the panels and Settings' recent fetches. T043 (the browser check) is left for the owner to sign in at this checkout's dev server on port 8081 (the second session's server holds 8080), with sample data or a real run so the charts draw.

---

## Phase 5: User Story 3 - Lookups, company searches, re-scores and mail (Priority: P3)

**Goal**: The rest of the Monitoring page, and the privacy scan over every read.

**Independent Test**: [quickstart.md](quickstart.md) steps 4-5.

### Sitting S4: The other panels (UI work: the stack may run)

- [ ] T045 Create `.specify/sitting-in-progress` containing `030 S4`.
- [ ] T046 [P] [US3] Contract cases first (`monitoringReadCases`, unit on memory): `lookups(since)` (careers audit finishes by outcome and `page_source`), `searches(since)` (searched and failed, from `run_users`), `rescores(since)` (by outcome, median and longest duration, model calls and tokens), `mail(since)` (by kind and outcome, failures by reason).
- [ ] T047 [US3] Add those four to `MonitoringReads` (Kysely and memory).
- [ ] T048 [P] [US3] Unit tests first: in `tests/monitoringViews.test.ts`, `lookupRows`, `rescoreRows` and `mailRows` and their "Nothing in this period" texts; `tests/monitoringPrivacy.test.ts` seeds memory stores with distinctive source names, search terms, addresses, emails and job titles, runs every `MonitoringReads` method and every view function, and asserts none of the seeded strings appears in any result (SC-005).
- [ ] T049 [US3] Add the three view functions to `src/web/monitoringViews.ts`; `web/components/monitoring/LookupsPanel.tsx` (searches inside), `RescoresPanel.tsx`, `MailPanel.tsx`, added to the page and `monitoringState.ts`.
- [ ] T050 Run `npm run check` and `npm run check:db`; when green, delete the marker. End of S4.

**Checkpoint**: The whole Monitoring page.

---

## Phase 6: User Story 4 - Watch and be alerted from the cluster (Priority: P4)

**Goal**: Prometheus metrics behind a token on their own port; chart resources, alerts, dashboard;
docs.

**Independent Test**: [quickstart.md](quickstart.md) steps 6-8.

### Sitting S5: Metrics, the chart and docs (stack stopped)

- [ ] T051 Create `.specify/sitting-in-progress` containing `030 S5`.
- [ ] T052 [P] [US4] Contract cases first (`monitoringReadCases`, unit on memory): `alertFacts(now)` gives the latest run's start, end and outcome, runs alive, never-finished runs in 24 h, each module's longest current failing streak, the mail failure streak, and this month's JSearch requests.
- [ ] T053 [US4] Add `alertFacts` to `MonitoringReads` (Kysely and memory).
- [ ] T054 [US4] Install `prom-client@15.1.3` exactly; check the lockfile diff (it brings `@opentelemetry/api` and `tdigest`) keeps every optional platform entry. First imported by T056.
- [ ] T055 [P] [US4] Unit tests first, `tests/metricsRegistry.test.ts`: from memory stores and a loaded config, the registry's text holds every metric of [contracts/metrics.md](contracts/metrics.md) with only its listed labels and `window` values; `myjobbot_last_run_ok` is 0 after a failed run; the JSearch ratio uses `jsearch.monthly_request_cap`; T048's privacy seeds never appear. `tests/metricsToken.test.ts`: `tokenOk` accepts the exact token and refuses a wrong one, a missing header and another scheme; `metricsToken(env)` refuses one under 32 characters.
- [ ] T056 [US4] `src/metrics/registry.ts` (a prom-client `Registry` of `Gauge`s whose `collect()` reads `MonitoringReads` and the runtime settings; metric definitions in one table), `src/metrics/token.ts` (`metricsToken`, `tokenOk` with SHA-256 and `timingSafeEqual`), `src/metrics/server.ts` (`node:http`: `GET /metrics` with the token → 200; no or wrong token → 401 empty; other path or method → 404 empty; a read failure → 503 empty), and the `metrics` command in `src/cli.ts` (loads the config as `run` does, `loadConfig` with `MYJOBBOT_DATA_DIR`; `MYJOBBOT_METRICS_PORT`, default 9464; refuses to start without a valid token).
- [ ] T057 [P] [US4] Integration test first, `tests/integration/metricsServer.test.ts` (1 test): the server on a free port answers 200 with metrics for the token, 401 with an empty body without it, and 404 for `/other`.
- [ ] T058 [US4] `docker/entrypoint.sh`: a `metrics` case (with `check_prerequisites`) running the command. `.env.example`: `MYJOBBOT_METRICS_TOKEN`, `MYJOBBOT_METRICS_PORT`.
- [ ] T059 [US4] Chart: `monitoring` values in `deploy/helm/myjobbot/values.yaml` (`enabled: false`, `port: 9464`, `alerts.missedRunHours: 9`, `moduleFailingFetches: 3`, `mailFailures: 3`, `jsearchBudgetRatio: 0.9`, `dashboard.enabled: true`); in `templates/web.yaml`, a `metrics` container when enabled (same image, `args: ["metrics"]`, its own port, the `/data` mount and env as the web container); new `templates/metrics.yaml` (a `-metrics` Service), `servicemonitor.yaml` (`bearerTokenSecret` naming `MYJOBBOT_METRICS_TOKEN` in the chart's Secret, 1-minute interval), `prometheusrule.yaml` (the six alerts and `for` durations of the contract, thresholds from the values), `dashboard.yaml` (a `ConfigMap` labelled `grafana_dashboard: "1"` from `files/dashboard.json`); the ingress unchanged. Check `helm template` off and on, and `helm lint`.
- [ ] T060 [US4] `deploy/helm/myjobbot/files/dashboard.json`: panels for runs by status, run duration, fetches by module and outcome, failing streaks, lookups, re-scores, model tokens, mail, JSearch budget.
- [ ] T061 [P] Docs: CLAUDE.md "Observability (feature 030)" note; `docs/how-it-works.md` (what is recorded and where it shows), `docs/database.md` (the four tables), `docs/cli.md` (`metrics`), the chart's README (`monitoring.*`, the token).
- [ ] T062 Walk [quickstart.md](quickstart.md) steps 1-7 (step 3a's duration comparison included); step 8 is the owner's, on the cluster.
- [ ] T063 Run `npm run check` and `npm run check:db`; when green, delete the marker. End of S5.

---

## Dependencies & Execution Order

- S1 → S2 → S3 → S4 → S5, each a PR merged before the next.
- S3 needs S1 (runs) and S2 (fetches); S4 needs S2 (mail, re-score use); S5 needs S3/S4's reads.
- In each sitting, a test task precedes the code it covers.

### Parallel Opportunities

- S1: T002, T005, T007, T009 (different test files); T011 and T013 after T010.
- S2: T018, T020, T022, T023, T025, T027.
- S3: T031, T033, T035, T038, T041.
- S4: T046, T048. S5: T052, T055, T057, T061.

## Test ledger

Today about 1,227 unit, 102 integration, 84 UI (87 / 7.2 / 5.9%). New tests keep integration
under 7.2% and UI under 5.9%, moving toward 95/4/1.

| Kind | New tests (approx.) | Where |
|---|---|---|
| Unit | 75 | rules, tally, recorder, runAll (with the write budget), fetch phase, mail kinds and recorder, re-score use, every contract case on memory, views, privacy scan, registry, token |
| Integration | 4 | migration, the step list, `monitoringStrictCases` on MariaDB (cascades and removal), metrics server |
| UI | 3 | `monitoring.test.tsx` (2), `sourceHistory.test.tsx` (1) |

## Implementation Strategy

- **MVP**: S1-S3 (runs, fetches and mail recorded; runs and sources on the page; users' own
  history).
- S4 completes the page; S5 adds Prometheus, alerts, the dashboard and the docs.
