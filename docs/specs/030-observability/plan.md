# Implementation Plan: Worker observability

**Branch**: `030-observability` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/030-observability/spec.md`

## Summary

Every run gets a stored record with a heartbeat, every user's part a row of counts taken from the
trace by a schema-checked tally, every source fetch (and planned skip) a history row, and every
mail send a row with its kind and fixed outcome. Admins read it on a new Monitoring page (Pico
tables, Chart.js bar charts); each user sees their own sources' recent fetches on Settings. A
separate metrics process serves the same history as Prometheus gauges through prom-client, on its
own port and behind a token, and the Helm chart's monitoring option adds the scrape, alert rules
and a Grafana dashboard. See [research.md](research.md), [data-model.md](data-model.md),
[contracts/metrics.md](contracts/metrics.md),
[contracts/monitoring-page.md](contracts/monitoring-page.md).

## Technical Context

**Language/Version**: TypeScript 5 on Node 24; Next.js 16 (web)

**Primary Dependencies**: Kysely (MariaDB); **prom-client 15.1.3** and **chart.js 4.6.1**, both new,
pinned exactly, approved by the owner 2026-11-10 (R7, R9); `node:http` for the metrics server

**Storage**: MariaDB; step `026_monitoring` adds `agent_runs`, `run_users`, `source_fetches`,
`mail_sends` and three `rescore_runs` columns

**Testing**: vitest; memory stores for unit tests, the new stores' strict contract cases on MariaDB, the metrics
server over a real port, a few `.test.tsx`

**Target Platform**: The agent (CronJob), the web app, and a new metrics container in the web pod;
Docker and Kubernetes (kube-prometheus-stack)

**Project Type**: Web app + CLI agent

**Performance Goals**: Recording adds under 1% to a run (SC-004): a few inserts per user and per
source, one heartbeat update a minute

**Constraints**: Only ids, module names, counts, durations and fixed reasons in admin views and
metrics (FR-007); metrics never on the public port (FR-009); recording never fails a worker
(FR-011)

**Scale/Scope**: 1 migration, 4 stores, 1 page, 1 settings addition, 1 process, chart resources

## Constitution Check

*Checked against constitution 2.7.0 (the version on `main`).*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. Each sitting gives every new export and store method a production caller in the sitting that adds it; nothing is exported for tests only. |
| II. Test-first | Pass. About **75 unit, 4 integration, 3 UI** tests (R13), moving the suite toward 95/4/1 (today 87/7.2/5.9); contract cases run on memory, and on MariaDB only the strict ones. `check` and `check:db` end every sitting. |
| III. Purpose comments | Pass. |
| IV. Dependencies, libraries as designed | Pass. prom-client and Chart.js were presented with alternatives and approved (2026-11-10), pinned exactly and installed through the lockfile. prom-client's `Registry` and `collect()`, and Chart.js's `Chart.register` of only the parts used, are each library's own way. The migration and queries use Kysely's builders. |
| V. Specs in docs/specs | Pass. |
| VI. SOLID | **S**: recording (`RunRecorder`, `RunTally`, `recordedMailer`, the fetch record), rules (`src/monitoring/`), reads (`MonitoringReads`), serving (`src/metrics/`) and showing (page, settings) are separate. **O**: tally events are a table of schemas, mail kinds a list, metrics a list of definitions; a new event, kind or metric is added beside the others. The `Mailer` is decorated, not edited. **L**: every store has memory and Kysely versions passing one contract. **I**: the fetch phase gets `UserFetchHistory` only; the page and the metrics get `MonitoringReads` only (the web through `myStores()`, for an admin, as the accounts list is); the recorder gets `RunHistory` only. **D**: clocks, timers, stores and the mailer are handed in; everything is unit-tested on memory versions. |
| Workflow | Main checkout, Docker stack stopped for sittings 1, 2 and 5 (a migration and the run change); sittings 3 and 4 are UI and may keep it running. |
| CLAUDE.md | Gets an "Observability (feature 030)" note; `docs/how-it-works.md`, `docs/database.md`, `docs/cli.md` and the chart's README are updated. |

Re-checked after design: no breach; nothing in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
docs/specs/030-observability/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/metrics.md, contracts/monitoring-page.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
src/db/migrations/026_monitoring.ts           # 4 tables, rescore_runs columns
src/db/schema/monitoring.ts, schema/rescore.ts
src/db/runHistory.ts, fetchHistory.ts, mailLog.ts, monitoringReads.ts   # interfaces
src/db/kysely/runHistory.ts, fetchHistory.ts, mailLog.ts, monitoringReads.ts
src/db/kysely/accountRemoval.ts               # run_users, source_fetches in the table list
src/monitoring/runStatus.ts, failing.ts, periods.ts, failureReason.ts   # rules
src/monitoring/tally.ts, tallyEvents.ts       # RunTally from the trace
src/monitoring/recorder.ts                    # RunRecorder: begin, heartbeat, parts, end
src/app/runAll.ts, run.ts                     # record the run and each part; prune
src/sources/fetchPhase.ts                     # record each fetch and skip
src/tools/recordMatches.ts                    # trace jobs_scored
src/rescore/log.ts                            # model use on rescore_runs
src/mail/messages.ts, recorded.ts, fromEnv.ts # kinds; recordedMailer
src/metrics/server.ts, registry.ts, token.ts  # the metrics process
src/cli.ts                                    # `metrics` command
src/web/monitoringViews.ts                    # pure: the panels' rows from the reads
web/app/(app)/monitoring/page.tsx, web/lib/monitoringState.ts
web/components/monitoring/*.tsx               # panels; MonitoringChart (client)
web/components/settings/SourceHistory.tsx     # the user's recent fetches
web/components/sections/Header.tsx            # admin link
docker/entrypoint.sh                          # `metrics`
deploy/helm/myjobbot/templates/metrics.yaml, servicemonitor.yaml, prometheusrule.yaml, dashboard.yaml
deploy/helm/myjobbot/files/dashboard.json, values.yaml, templates/web.yaml
tests/helpers/monitoringContract.ts, memoryMonitoring.ts
```

**Structure Decision**: As 019 and 027: rules as plain functions, recording fed by the trace,
stores behind interfaces with memory and Kysely versions, shared reads on `SharedStores`, the page and
the metrics process thin over them.

## Sittings (one PR each; detail in tasks.md)

1. Runs: step `026_monitoring`, `RunHistory`, rules, `RunTally`, `RunRecorder` with the heartbeat,
   `runAll`/`runForUser` recording, fixed failure reasons, removal list, prune.
2. Fetches and mail: `FetchHistory`, the fetch phase's records, `MailLog`, `MailKind`,
   `recordedMailer`, re-score model use.
3. Page: the run-status and period rules, `MonitoringReads` (runs, modules), `/monitoring`,
   Chart.js, the admin link, the user's source history (`UserFetchHistory.recent`).
4. Page: lookups, company searches, re-scores and mail panels; the privacy scan over every read.
5. Metrics process (prom-client, token, port), entrypoint, chart option, rules, dashboard; docs
   and the quickstart walk-through, before the sitting's closing check.

## Complexity Tracking

None.
