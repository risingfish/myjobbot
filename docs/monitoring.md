# Monitoring

Watching the workers: what each run, fetch, lookup, re-score and mail send records, the Monitoring
page, every metric served to Prometheus, the alerts, and the Helm chart's monitoring option.

[← README](../README.md)

## What is recorded

Every run is recorded in the database as it goes (feature 030), in plain code beside the workers;
the workers themselves know nothing about it.

| Recorded | When | Table |
|---|---|---|
| A run | when it starts, then a heartbeat every minute, then how it ended with its totals | `agent_runs` |
| Each user's part of a run | as running before its work, then how it ended (finished, stopped early, failed, skipped, deleted, deletion held) with its counts: fetches and failures, jobs found and scored, company searches and failed search steps, model calls and tokens | `run_users` |
| Each fetch or planned skip of a saved source | when it happens: module, outcome, fixed reason, pages, jobs, cost, how long it took | `source_fetches` |
| Each mail send | after the send: its kind, sent or failed, the fixed reason; never the address or the text | `mail_sends` |
| Each re-score's model use | when it ends: model calls, prompt and completion tokens | `rescore_runs` |
| Careers lookups | already in the careers audit; counted from it when read | `careers_audit` |

A run that stops showing a heartbeat for 5 minutes counts as **never finished**, so a crashed run
shows within minutes whatever its length. A part's counts come from the events its trace already
holds, read by a schema-checked tally. A failure keeps only a fixed reason (`database`, `model`,
`timeout`, `browser`, `other` for a run part), never error text. If a record can't be written the
run carries on: the failure is logged as a fixed line and the run is marked as having an
incomplete record.

The history is kept 90 days, pruned by each run. Deleting an account removes its parts and
fetches; each run keeps its totals.

## The Monitoring page

`/monitoring`, linked in the menu for admins only; anyone else gets the not-found page. Choose the
last day, 7 days or 30 days.

- **Runs**: each run's start, how long it took, how it stands (running, finished, finished with
  errors, failed, never finished; "record incomplete" when a write failed), its users, fetches,
  jobs and model calls, and a chart of runs per day by status. A run's start opens its detail:
  each user's part, by user id only.
- **Sources**: each source module's fetches by outcome, pages, jobs, cost, its top 3 failure
  reasons and how many of its sources failed on their latest 3 fetches, with a chart of fetches per
  day.
- **Careers lookups and company searches**, **Re-scores** (typical and longest durations, model
  use) and **Mail** (by kind and outcome, failures by reason).

Every chart's numbers are also given as a table under it. The page shows user ids, module names,
counts, times and fixed reasons only: never a source's name, a search term, an address, an email
or a job (a test checks every read and view for them).

Each user also sees, on **Settings → Sources**, their own sources' last 10 fetches, marked
"Failing repeatedly" when the latest 3 failed.

## Serving metrics to Prometheus

```bash
MYJOBBOT_METRICS_TOKEN=$(openssl rand -hex 32) npm start -- metrics
```

| Request | Answer |
|---|---|
| `GET /metrics` with `Authorization: Bearer <MYJOBBOT_METRICS_TOKEN>` | `200`, the metrics in Prometheus's text format |
| `GET /metrics` without the header, or with another token | `401`, empty |
| Any other path or method | `404`, empty |
| The database can't be read | `503`, empty; the process stays up |

- It listens on `MYJOBBOT_METRICS_PORT` (default `9464`), a port of its own: the web UI's port and
  the ingress never serve it.
- It refuses to start unless `MYJOBBOT_METRICS_TOKEN` is set and at least 32 characters. The token
  is compared in constant time.
- It reads `MYJOBBOT_DB_*` and `config.json` (for `jsearch.monthly_request_cap`), like a run.
- Every value is a **gauge** read from the stored history at scrape time, so short-lived runs are
  covered without anything pushing. Counts are over a **window**, `24h` or `7d`, rather than
  counters, because the history is pruned and a counter computed from it would drop.
- A label combination with nothing to count isn't emitted (no zero series), except the run
  timestamps, `myjobbot_last_run_ok`, `myjobbot_runs_running`, the duration maxima, company
  searches, model use, the mail streak and the JSearch ratio, which are always given.
- No metric carries a user, a source name, a search term, an address or a job: only modules,
  workers, outcomes, fixed reasons and windows.

## Metrics

| Metric | Labels | What it is |
|---|---|---|
| `myjobbot_last_run_started_timestamp_seconds` | | When the latest run started (Unix seconds), 0 with none recorded |
| `myjobbot_last_run_finished_timestamp_seconds` | | When the latest run that ended ended, 0 with none, so a missed run still alerts |
| `myjobbot_last_run_ok` | | 1 when the latest run that ended finished cleanly (or none has), 0 when it finished with errors or failed |
| `myjobbot_runs_running` | | Runs alive now |
| `myjobbot_runs` | `status`, `window` | Runs started in the window, by how they stand |
| `myjobbot_run_duration_seconds_max` | `window` | The longest run that ended in the window, in seconds |
| `myjobbot_source_fetches` | `module`, `outcome`, `window` | Source fetches and planned skips in the window |
| `myjobbot_source_fetch_failures` | `module`, `reason`, `window` | Failing fetches in the window, by fixed reason |
| `myjobbot_source_jobs` | `module`, `window` | Jobs the sources found in the window |
| `myjobbot_source_failing_streak_max` | `module` | The longest current run of failing fetches among the module's sources (any user's) |
| `myjobbot_careers_lookups` | `outcome`, `window` | Careers lookups that ended in the window |
| `myjobbot_careers_page_reads` | `read_by`, `window` | Careers pages read in the window |
| `myjobbot_company_searches` | `outcome`, `window` | Company searches the runs made in the window, and their search steps that failed |
| `myjobbot_rescores` | `outcome`, `window` | Re-scores started in the window, by how they ended |
| `myjobbot_rescore_duration_seconds_max` | `window` | The longest re-score that ended in the window, in seconds |
| `myjobbot_model_calls` | `worker`, `window` | Model calls in the window |
| `myjobbot_model_tokens` | `worker`, `kind`, `window` | Model tokens in the window |
| `myjobbot_mail_sends` | `kind`, `outcome`, `window` | Mail sends in the window |
| `myjobbot_mail_failure_streak` | | Mail failures since the last mail that was sent |
| `myjobbot_jsearch_budget_used_ratio` | | This month's JSearch requests over `jsearch.monthly_request_cap` |

### Label values

| Label | Values |
|---|---|
| `window` | `24h`, `7d` |
| `status` | `running`, `never_finished`, `finished`, `finished_with_errors`, `failed` |
| `module` | `greenhouse`, `lever`, `ashby`, `gem`, `workday`, `jsearch`, `gmail_alerts` |
| `outcome` on `myjobbot_source_fetches` | `ok`, `partial` (stopped at its limit, continues next run), `failing`, `skipped` (planned: not due, budget used, not set up, ...) |
| `reason` | `not found`, `refused`, `unreachable`, `unexpected answer`, `not set up` |
| `outcome` on `myjobbot_careers_lookups` | `found`, `not_found` |
| `read_by` | `board` (the job board's own data), `download`, `browser`, `other` |
| `outcome` on `myjobbot_company_searches` | `searched`, `failed` |
| `outcome` on `myjobbot_rescores` | `scored`, `filtered`, `failed` (also one open over 10 minutes), `running` |
| `worker` | `run`, `rescore` |
| `kind` on `myjobbot_model_tokens` | `prompt`, `completion` |
| `kind` on `myjobbot_mail_sends` | `account_created`, `someone_tried`, `security_notice`, `account_deleted`, `sign_in_link`, `password_reset`, `confirm_new_email`, `confirm_its_you`, `email_changed`, `test` |
| `outcome` on `myjobbot_mail_sends` | `sent`, `failed` |

### Example queries

```promql
# Hours since a run last finished
(time() - myjobbot_last_run_finished_timestamp_seconds) / 3600

# Share of the last day's fetches that failed, by module
sum by (module) (myjobbot_source_fetches{outcome="failing",window="24h"})
  / sum by (module) (myjobbot_source_fetches{window="24h"})

# Model tokens per day
sum(myjobbot_model_tokens{window="24h"})
```

## Alerts

The Helm chart's monitoring option adds these rules; each threshold is a chart value.

| Alert | Fires when | Value (default) |
|---|---|---|
| `MyjobbotRunFailed` | `myjobbot_last_run_ok == 0` | |
| `MyjobbotRunNeverFinished` | a run in the last day never finished | |
| `MyjobbotRunMissed` | no run has finished for this many hours | `monitoring.alerts.missedRunHours` (9) |
| `MyjobbotSourceModuleFailing` | a module's sources failed this many fetches in a row | `monitoring.alerts.moduleFailingFetches` (3) |
| `MyjobbotMailFailing` | this many mail failures since the last mail sent | `monitoring.alerts.mailFailures` (3) |
| `MyjobbotJsearchBudget` | this share of the month's JSearch requests used, for 1 hour | `monitoring.alerts.jsearchBudgetRatio` (0.9) |

A crashed run turns never finished 5 minutes after its last heartbeat, so with the 1-minute scrape
`MyjobbotRunNeverFinished` fires about 8 minutes after a crash.

## In Kubernetes

With the Prometheus Operator (kube-prometheus-stack), set `monitoring.enabled=true` and put
`MYJOBBOT_METRICS_TOKEN` (at least 32 characters) in the chart's Secret. The chart then adds:

- a `metrics` container in the web pod, with the same image, environment and `/data` volume;
- its own `<release>-metrics` Service; the ingress routes only the web Service;
- a ServiceMonitor scraping every `monitoring.serviceMonitor.interval` (1m), reading the token
  from the Secret;
- a PrometheusRule with the alerts above;
- with `monitoring.dashboard.enabled` (default), a ConfigMap labelled `grafana_dashboard: "1"`
  holding the Grafana dashboard (`deploy/helm/myjobbot/files/dashboard.json`), for the Grafana
  sidecar to load. It charts runs, durations, fetches and failing streaks, lookups, re-scores,
  model tokens, mail and the JSearch budget, with a data source picker.

Set `monitoring.serviceMonitor.labels` and `monitoring.rules.labels` to what your Prometheus
selects, often `release: <its release name>`. With monitoring off (the default) the chart adds
nothing. The rest of the chart is in [Deploying](deploying.md#kubernetes).
