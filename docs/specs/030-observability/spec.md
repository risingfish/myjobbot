# Feature Specification: Worker observability

**Feature Branch**: `030-observability`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Lets get some observability setup. I want to be able to monitor the
workers especially, see how they are pulling, how often, how many errors, etc."

## Clarifications

### Session 2026-11-10

- Q: Where is the monitoring watched? → A: Both: an admin page in the app, and metrics for the
  cluster's Prometheus/Grafana with alerts. The history is stored once and feeds both.
- Q: Who sees what? → A: Admins see operational health across all users (counts, durations,
  outcomes, fixed error reasons, users by id only; no source names, search terms, addresses or job
  data). Each user sees their own sources' fetch history. Metrics carry the admin-level data only.
- Q: How is a run whose process died recognised as never finished? → A: By heartbeat: a running
  run marks itself alive every minute, and one with no sign of life for 5 minutes counts as never
  finished, locally and on the cluster, whatever the run's length.
- Q: How may Prometheus read the metrics? → A: On a separate port the ingress never routes, and only
  with a secret token sent on each scrape; both guards apply.
- Q: Is mail delivery monitored? → A: Yes, counts only: mails sent and failed by kind and fixed
  failure reason, never addresses or content, on the page and in the metrics, with an alert when
  sending keeps failing.
- Q: Which alert thresholds? → A: Defaults, each a chart value: missed run when no run has finished
  for the schedule interval plus 1 hour (9 hours now); a module failing when its last 3 fetches
  failed, for any user; mail failing after 3 failures in a row; JSearch at 90% of the month's budget.

## Background

The workers are the scheduled run (a Kubernetes CronJob, every 8 hours; for each user in turn it
fetches every source that is on, reads Gmail alerts, looks up careers pages, searches for company
pages and has the model score new jobs) and re-scores (one job, started from the panel or the CLI).

Today a source keeps only its latest fetch (`last_fetched_at`, `last_outcome`, `last_jobs`,
`last_cost`, `last_reason`), overwritten each run. A run has no stored record: its trace is a file
on the volume, echoed to the container log. The careers audit, the JSearch call count and the
re-score log are stored, but nothing shows them together. On 2026-11-10 a run crashed after 1m41s
and the only signs were a failed Kubernetes Job and its log file; nothing in the app showed it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See every run and how it went (Priority: P1)

An admin opens the Monitoring page and sees the recent runs: when each started, how long it took,
and how it ended (finished, finished with errors, failed, or never finished). Opening a run shows
each user's part of it, by user id: sources fetched, jobs found and scored, lookups, model calls,
and each error's fixed reason.

**Why this priority**: "Did the last run work, and if not, where did it go wrong" is the first
question, and today it needs the cluster and a log file.

**Independent Test**: Run the agent once cleanly and once with a source failing; both appear with
their times, durations and outcomes, and the failing source's reason is shown under its user's part.

**Acceptance Scenarios**:

1. **Given** a run that finished, **When** the admin opens Monitoring, **Then** it is listed with
   its start time, duration, outcome and per-user counts.
2. **Given** a run whose process died (as on 2026-11-10), **When** it has shown no sign of life for
   5 minutes, **Then** it is shown as never finished, with how far it got.
3. **Given** a user whose part of a run failed, **When** the admin opens that run, **Then** the
   failure's fixed reason is shown, the user is identified by id only, and the other users' parts
   are shown as they went.
4. **Given** no runs yet, **When** the admin opens Monitoring, **Then** an empty state says so.

---

### User Story 2 - See how sources are pulling (Priority: P2)

An admin sees, per source module (JSearch, Gmail alerts, each job board), how often it was fetched,
how each fetch ended (ok, partial, failing, skipped and why), pages read, jobs found and cost, over
the last day, week and 30 days, with failure counts and the most common reasons. Each user sees the
same history for their own sources, by name, on their Settings page's sources section.

**Why this priority**: Pulling is where most failures come from (expired Gmail passwords, a board
changing its pages, the JSearch budget), and only the latest fetch is kept today.

**Independent Test**: Over several runs, one source fails twice then recovers; the admin view shows
the module's fetch count and two failures with their reason; the owning user sees the same three
fetches under the source's name; another user sees nothing of it.

**Acceptance Scenarios**:

1. **Given** several runs, **When** the admin views sources, **Then** each module shows fetches,
   outcomes, pages, jobs and cost for the chosen period, and its top failure reasons.
2. **Given** a source that has failed on each of its last 3 fetches, **When** the admin or its
   owner looks, **Then** it is marked as failing repeatedly.
3. **Given** a user with sources, **When** they open their sources section, **Then** each source
   shows its recent fetches (time, outcome, jobs, reason); no other user's sources appear.
4. **Given** the admin view, **When** it lists anything, **Then** no source name, search term,
   address or job field appears, only the module, counts and fixed reasons.

---

### User Story 3 - See lookups, company searches, re-scores and mail (Priority: P3)

An admin sees how the careers lookup, company search and re-scores are doing: how many ran, how
each ended (found, not found, refused, failed, timed out), how long they took, and model use
(calls and tokens) per run and per re-score. They also see how many mails (sign-in links, codes,
security notices) were sent and how many failed, by kind and fixed reason.

**Why this priority**: These are the slow and costly parts of a run; their failures hide behind a
job with no description or no score.

**Independent Test**: A run with lookups and two re-scores (one succeeding, one failing) shows
their counts, outcomes and durations, and the model calls and tokens each used.

**Acceptance Scenarios**:

1. **Given** a run with careers lookups, **When** the admin opens it, **Then** lookups are counted
   by outcome and how pages were read (board data, download, browser).
2. **Given** re-scores over a period, **When** the admin views them, **Then** they are counted by
   outcome with typical and longest durations.
3. **Given** a run, **When** the admin opens it, **Then** its model calls and tokens are shown, in
   total and per user.
4. **Given** mail sent over a period with some failures, **When** the admin views mail, **Then**
   sends and failures are counted by kind and fixed reason, with no address or content shown.

---

### User Story 4 - Watch and be alerted from the cluster (Priority: P4)

The owner's Prometheus reads myjobbot's metrics (the same counts as the admin page), a Grafana
dashboard shows them, and alerts fire when a run fails or doesn't finish, when no run has finished
in longer than the schedule allows, when a source module keeps failing, when mail keeps failing to
send, or when the JSearch budget is nearly spent.

**Why this priority**: Alerts tell the owner without anyone opening a page, but they build on the
stored history of Stories 1 and 2.

**Independent Test**: On a cluster with Prometheus, the metrics are scraped; a run made to fail
fires the run alert; stopping the schedule past its interval fires the missed-run alert.

**Acceptance Scenarios**:

1. **Given** the chart's monitoring option on, **When** Prometheus scrapes, **Then** it gets run,
   fetch, lookup, re-score and model-use metrics, labelled by module and outcome, never by user name,
   source name or address.
2. **Given** a failed or never-finished run, **When** the alert rules are evaluated, **Then** a run
   alert fires.
3. **Given** no run finished for longer than the schedule interval plus 1 hour, **When** the rules
   are evaluated, **Then** a missed-run alert fires.
4. **Given** the monitoring option off (the default), **When** the chart is installed, **Then** no
   monitoring resources are created and the app works as before.

---

### Edge Cases

- A run that crashes leaves its record open; it is counted as never finished once it has shown no
  sign of life for 5 minutes. A long run that is alive is never cut short by this.
- Recording a step fails (database away): the run carries on, the failure is traced, and the run
  shows that its record is incomplete.
- Two runs overlap (a manual `npm start -- run` during a scheduled one): both are recorded
  separately.
- A deactivated user is skipped by runs: shown as skipped, not failed.
- A deleted account: its own fetch history is removed with it (029); runs keep their totals, with
  that user's part no longer attributed.
- Old history: kept 90 days, then pruned with the run's cleanup.
- The metrics are never public: they are served on a separate port the ingress never routes, and a
  scrape without the right token is refused with no data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every run MUST be recorded when it starts and when it ends: start and end times, how it
  ended, and its totals. A running run MUST mark itself alive at least every minute, and a run with
  no sign of life for 5 minutes MUST count as never finished.
- **FR-002**: Each user's part of a run MUST be recorded: skipped (and why), finished or failed (with
  its fixed reason), sources fetched, jobs found and scored, lookups, company searches, and model
  calls and tokens.
- **FR-003**: Every source fetch MUST be recorded: when, the module, the outcome (ok, partial,
  failing, skipped with its reason), pages, jobs, cost, duration and fixed reason; the source's
  latest-fetch fields keep working as today.
- **FR-004**: Careers lookups, company searches and re-scores MUST be countable per run and per
  period by outcome and duration, from what is already stored where it suffices.
- **FR-004a**: Every mail send MUST be recorded by kind, time and outcome (sent, or failed with its
  fixed reason), never with its address or content.
- **FR-005**: Admins MUST have a Monitoring page with the run list (Story 1), source modules (Story 2)
  and lookups, re-scores and mail (Story 3), for the last day, week and 30 days.
- **FR-006**: Each user MUST see their own sources' recent fetches on their Settings page; nobody
  sees another user's sources.
- **FR-007**: The admin views and the metrics MUST identify users by id only and MUST NOT contain
  source names, search terms, addresses, email, page or model text, or job fields; error reasons
  MUST be the fixed reasons the workers already produce.
- **FR-008**: The app MUST expose its metrics in a form Prometheus reads, from the stored history, so
  short-lived runs are covered without a process staying up.
- **FR-009**: The metrics MUST be served only on a separate port that the ingress never routes, and
  MUST refuse, with no data, any request without the secret token, which is kept with the chart's
  other secrets.
- **FR-010**: The Helm chart MUST offer an option, off by default, adding the scrape configuration,
  alert rules and a Grafana dashboard. The alerts, each threshold a chart value with these defaults:
  a failed or never-finished run; no finished run for the schedule interval plus 1 hour; a module
  whose last 3 fetches failed, for any user; 3 mail failures in a row; 90% of the month's JSearch
  budget used.
- **FR-011**: Recording MUST never fail or slow a worker noticeably: a recording failure is traced
  and the work carries on.
- **FR-012**: History older than 90 days MUST be removed by the run's cleanup.
- **FR-013**: Deleting an account MUST remove its own fetch history with the rest of its data.

### Key Entities

- **Run record**: one scheduled or manual run: start, last sign of life, end, how it ended, totals.
- **User's part of a run**: one user within a run: outcome, fixed reason, counts, model use.
- **Fetch record**: one source fetch: the source and its owner, module, time, outcome, pages, jobs,
  cost, duration, reason.
- **Mail record**: one mail send: kind, time, outcome, fixed reason; no address or content.
- **Metric**: a count or duration derived from the records, labelled by module, worker and outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the Monitoring page, the owner can tell whether the last run succeeded, how long
  it took and which sources failed, within 1 minute and without the cluster or log files.
- **SC-002**: A run that crashes, as on 2026-11-10, shows as never finished on the page within 6
  minutes of the crash and fires an alert within 15 minutes of it.
- **SC-003**: A missed run fires an alert within 1 hour 15 minutes of when the next run was due.
- **SC-004**: Recording adds under 1% to a run's duration.
- **SC-005**: No admin view or metric ever contains a source name, search term, address or job
  field, checked by tests over every view and metric.
- **SC-006**: With the monitoring option off, an install is unchanged: no new cluster resources.

## Assumptions

- The cluster runs a Prometheus Operator stack (the `KubeJobFailed` alert comes from one), so the
  chart's monitoring option provides its resources; other setups use the metrics address directly.
- History starts when 030 is deployed; old run log files are not imported.
- Times are shown in the app's time zone (`TZ`), as elsewhere.
- Admin views use the 024 admin role; there is no new role.
- Out of scope: web request metrics, log collection (Loki), request tracing, and evals (run by
  hand).
- Any metrics library is chosen at plan time, presented to the owner for approval first.
