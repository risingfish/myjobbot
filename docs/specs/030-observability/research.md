# Research: Worker observability (030)

Decisions taken while planning, against the code on `main` at 1a46081 (029 merged).

## R1. What a run is

**Decision**: A run is one call of `runAll` (`src/app/runAll.ts`). It gets its own id (`randomUUID()`)
and a row in `agent_runs`. Each user's part keeps one id across its trace and the careers audit
(their `run_id`), now made by `runAll` before the part starts and handed through `runForUser` to
`openRunLogs`, which used to make it, so the part's row in `run_users` can be written at its start (R2).

**Rationale**: The per-user id already ties a part to its trace file and its `careers_audit` rows,
so lookups are counted from what is stored (FR-004) with no new writes in the lookup.

**Alternatives**: one id for the whole run and the users (would change every trace and audit row);
recording only users (no place for a run that crashed before the first user, or the deletions step).

## R2. Never finished: the heartbeat

**Decision**: `RunRecorder.begin` writes `started_at` and `alive_at`, then sets `alive_at` every 60
seconds through an injected timer (`unref`ed, as `rescoreFollow` is handed its timers);
`end` stops it and writes `ended_at`, the outcome and the totals. Each user's part is written when
it starts (outcome `running`, with its `part_id`) and updated when it ends, so a run that dies shows
the user it died in and the parts before it ("how far it got", Story 1). A write that fails is
logged as a fixed line and sets the run's `incomplete` flag on the next write that succeeds (at the
latest, `end`); the page marks such a run's record as incomplete (Edge Cases). `runStatus` (pure, in
`src/monitoring/runStatus.ts`) says a run with no `ended_at` and `alive_at` older than 5 minutes is
`never_finished`, otherwise `running`. A run's outcome is `finished` (every user finished or
skipped), `finished_with_errors` (some user failed or the agent stopped early), or `failed` (the
run itself threw).

**Rationale**: Clarification 2026-11-10. Works whatever the run's length, locally and on the
cluster; nothing has to clean up after a dead process.

**Alternatives**: the Job's 2-hour deadline only (rejected by the owner); a database event or a
sweeper process (more moving parts for the same answer, which reads compute anyway).

## R3. Counting a user's part from the trace

**Decision**: A `RunTally` (`src/monitoring/tally.ts`) is a `Trace` teed onto the part's trace and
model log (`teeTrace`, as the stdout echo is). It parses only the events it knows, each with a zod
schema (`src/monitoring/tallyEvents.ts`), and ignores the rest: `source_fetch`, `source_skipped`,
`source_fetch_failed` (fetches, failures, jobs found), `company_search`, `company_search_failed`
(searches, failures), `jobs_scored` (new event from `record_matches`, its saved count) and
`llm_response` (one model call; `usage.prompt_tokens`, `usage.completion_tokens`). Its totals are
written to `run_users` when the part ends. A re-score gets its own `RunTally` on its model log,
and `RescoreLog`'s end writes its model calls and tokens to `rescore_runs` (Story 3).

**Rationale**: The re-score log already builds its steps from schema-checked trace events
(`src/rescore/traceSteps.ts`); the workers keep tracing as they do, and nothing in them learns
about monitoring (SOLID S, D). Only counts and fixed values are read, never text.

**Alternatives**: counters threaded through `ToolContext` into every worker (touches the fetch
phase, the company search, the loop and the LLM client for one concern); reading trace files
after the run (lost when the process dies, which is the case that matters most).

## R4. Fetch history

**Decision**: `finishFetch` and `skipped` in `src/sources/fetchPhase.ts` also call
`context.fetches.record(...)` (`UserFetchHistory`, bound to the user), giving the source id,
module, run part id, time, duration, outcome (`ok`, `partial`, `failing`, `skipped` with its
`SkipReason`), pages, jobs, cost and the fixed reason. A skipped source that is `off` is not
recorded (it isn't fetched or planned). A record failure is traced (`fetch_history_failed`) and
the fetch carries on. `FetchHistory.pruneBefore` removes fetches older than 90 days with the
run history (FR-012).

**Rationale**: Skips are traced but not stored today; the history has to hold them (Story 2). The
source's `last_*` columns stay as they are (FR-003).

## R5. Failure reasons are fixed

**Decision**: A user's part that throws is recorded with `runFailureReason(error)`
(`src/monitoring/failureReason.ts`): `database` (a mysql2 error code), `model` (the OpenAI client's
`APIError` or connection errors), `browser` (a Playwright error), `timeout`, else `other`. Fetches
keep `failureReason` (`src/sources/failure.ts`); mail keeps the queue's fixed reasons.

**Rationale**: `runPlanned` keeps `describeError(error)`, which holds error text; FR-007 allows only
fixed reasons in admin views and metrics.

## R6. Mail sends

**Decision**: Every builder in `src/mail/messages.ts` gives its `kind`, a `MailKind`
(`account_created`, `someone_tried`, `security_notice`, `account_deleted`, `sign_in_link`,
`password_reset`, `confirm_new_email`, `confirm_its_you`, `email_changed`, `test`), a type union
used by `MailMessage` and `MailLog`; no list constant is exported, so nothing is there for tests
only. A
`recordedMailer(mailer, log)` (`src/mail/recorded.ts`) wraps the `Mailer` and writes
`{ at, kind, outcome, reason }` to `MailLog` after each send; the queue, `sendMail` and
`queueMail` are unchanged. A failed record is logged by fixed reason and never fails the send.

**Rationale**: Decorating the `Mailer` adds recording beside sending (SOLID O) in one place both
the web and the agent build their mailers from (`mailSlot`).

## R7. Metrics: gauges over windows, from the database

**Decision**: A separate process, `npm start -- metrics` (`src/metrics/`), serves
`GET /metrics` on `MYJOBBOT_METRICS_PORT` (default 9464) with prom-client 15.1.3 (approved by the
owner 2026-11-10, pinned exactly). Its `Registry` holds gauges whose `collect()` reads
`MonitoringReads` on each scrape (contract: [contracts/metrics.md](contracts/metrics.md)). Values
are gauges over fixed windows (`window="24h"`, `"7d"`) and timestamps, not counters.

**Rationale**: Runs are short-lived CronJob processes, so a pull from the stored history covers them
without a Pushgateway (FR-008). History is pruned after 90 days; a counter computed from it would
drop at each prune and look like a reset to Prometheus, so windows are gauges. A separate process
keeps Next.js as it is (it serves one port) and keeps the metrics port off the web container.

**Alternatives**: hand-written text format (owner chose the library); OpenTelemetry SDK (heavier,
push-oriented); a Next.js route (on the public port, against FR-009); the Pushgateway (another
service, and a crashed run never pushes).

## R8. Metrics access

**Decision**: The metrics process refuses to start without `MYJOBBOT_METRICS_TOKEN` (at least 32
characters). It answers only `GET /metrics` with `Authorization: Bearer <token>`, compared with
`timingSafeEqual` on SHA-256 digests; anything else gets `401` (or `404` for another path) with an
empty body. In the chart it runs as a second container in the web pod with its own port, exposed by
its own `Service`; the ingress routes only the web service. The token lives in the chart's Secret
values and the `ServiceMonitor` reads it from there (`bearerTokenSecret`).

**Rationale**: Clarification 2026-11-10: a separate port the ingress never routes, and a token.

## R9. The Monitoring page

**Decision**: `web/app/(app)/monitoring/page.tsx`, admins only: it calls `requireSession()` and
answers `notFound()` to anyone else; the header shows the link only to admins. `MonitoringReads`
is a shared store (on `SharedStores`), reached like the admin's `accounts` list in
`settingsState`: through `myStores()`, read in `web/lib/monitoringState.ts` only when the signed-in
account is an admin, so the web still reaches data only through `myStores()` (CLAUDE.md, 027). The
panels' rows are built by pure functions in `src/web/monitoringViews.ts` from the reads, so the
components only lay them out. The
period is a query parameter (`?period=day|week|month`, default `week`); a run's detail is
`?run=<id>`. Pico tables and `<details>` first (R18 of 024); charts are Chart.js 4.6.1 (approved
2026-11-10, pinned exactly) in one client component, `MonitoringChart`, registering only the parts
it uses (`Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)`)
and colouring from Pico's CSS variables. Chart.js sets canvas sizes through the CSSOM, which the
nonce content policy allows; checked in the browser during the sitting.

## R10. A user's own fetch history

**Decision**: The Settings page's sources section shows, per source, its last 10 fetches (time,
outcome, jobs, reason) in a `<details>`, and a "failing repeatedly" mark when its last 3 fetches
failed (`failingRepeatedly`, pure, shared with the admin view and the metric). Read through
`myStores().fetches.recent()`.

## R11. Alerts, dashboard and chart values

**Decision**: `monitoring.enabled` (default `false`) adds the metrics container and `Service`, a
`ServiceMonitor`, a `PrometheusRule` and a Grafana dashboard `ConfigMap`
(`grafana_dashboard: "1"`, for the kube-prometheus-stack sidecar). Thresholds are values:
`monitoring.alerts.missedRunHours` (default the schedule interval plus 1 hour, 9),
`moduleFailingFetches` (3), `mailFailures` (3), `jsearchBudgetRatio` (0.9). The rules use the
gauges in [contracts/metrics.md](contracts/metrics.md).

## R12. Retention and account deletion

**Decision**: `pruneOldJobs` also calls `RunHistory.pruneBefore` and `MailLog.pruneBefore` with a
fixed 90-day cutoff (`MONITORING_RETENTION_DAYS`), separate from `job_retention_days`.
`run_users` and `source_fetches` carry `user_id`, so `AccountRemoval`'s type-checked table list
must name them and a deleted user's parts and fetches go with the account (FR-013); `agent_runs`
keeps its totals.

## R13. Test split

Today's suite is about 1,227 unit, 102 integration and 84 UI tests (87%, 7.2%, 5.9%). New tests
must move it toward 95/4/1, so their integration share stays under 7.2% and their UI share under
5.9%.

**Decision**: About **75 unit, 4 integration, 3 UI** tests (91%, 5%, 4%).
- Unit: `runStatus`, `runOutcome`, `failingRepeatedly`, `runFailureReason`, the period windows,
  every tally event and an unknown one, the recorder (begin, heartbeat, parts at start and end,
  `incomplete`) with a fake timer, fetch recording (each outcome, a record failure), `recordedMailer`,
  each mail builder's kind, every contract case on the memory stores (the reads' aggregations
  included), `monitoringViews`, the metric names and labels, the token check, the write budget
  (SC-004), and the privacy scan (SC-005).
- Integration, MariaDB only for what memory can't show (CLAUDE.md: strict cases only): step
  `026_monitoring` (columns, keys, cascades); one strict contract case (a deleted source takes its
  fetches, a removed account takes its parts and fetches and the run keeps its totals); the metrics
  server over a real port.
- UI: the Monitoring page (runs table and empty state), `MonitoringChart`, the sources section's
  history.

## R14. Delivery

**Decision**: Five small PRs, each merged and tested before the next (owner's small-PR rule):
1. Runs: step, `RunHistory`, recorder, heartbeat, tally, failure reasons, removal list, prune.
2. Fetches and mail: `source_fetches`, `UserFetchHistory`, `MailLog`, `recordedMailer`, kinds.
3. Page: Monitoring (runs, modules), Chart.js, the user's fetch history in Settings.
4. Page: lookups, company searches, re-scores and mail panels.
5. Metrics process, prom-client, chart resources, alerts, dashboard; docs.
