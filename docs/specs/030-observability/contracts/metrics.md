# Contract: the metrics endpoint

Served by `npm start -- metrics` (entrypoint `metrics`), prom-client 15.1.3, Prometheus text
format 0.0.4.

## Requests

| Request | Answer |
|---|---|
| `GET /metrics` with `Authorization: Bearer <MYJOBBOT_METRICS_TOKEN>` | `200`, the metrics |
| `GET /metrics` without the header, or a wrong token | `401`, empty body |
| any other path or method | `404`, empty body |
| the database can't be read | `503`, empty body; the process stays up |

The process refuses to start when `MYJOBBOT_METRICS_TOKEN` is unset or under 32 characters, or the
database settings are missing. It listens on `MYJOBBOT_METRICS_PORT` (default `9464`). It loads the
runtime settings as `run` does (`loadConfig`, `config.json` in `MYJOBBOT_DATA_DIR`) for
`jsearch.monthly_request_cap`, so its container mounts `/data` like the web's.

## Metrics

Every value is read from the stored history at scrape time. Labels are only those listed; their
values are module names, worker names, fixed outcomes and reasons, and windows. Never a user id,
user name, source name, search term, address or job field.

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `myjobbot_last_run_started_timestamp_seconds` | gauge | | latest run's start |
| `myjobbot_last_run_finished_timestamp_seconds` | gauge | | latest run that ended, any outcome |
| `myjobbot_last_run_ok` | gauge | | 1 when the latest ended run is `finished`, else 0 |
| `myjobbot_runs_running` | gauge | | runs alive now |
| `myjobbot_runs` | gauge | `status`, `window` | runs started in the window by status (`finished`, `finished_with_errors`, `failed`, `never_finished`) |
| `myjobbot_run_duration_seconds_max` | gauge | `window` | longest ended run in the window |
| `myjobbot_source_fetches` | gauge | `module`, `outcome`, `window` | fetches by outcome |
| `myjobbot_source_fetch_failures` | gauge | `module`, `reason`, `window` | failing fetches by fixed reason |
| `myjobbot_source_jobs` | gauge | `module`, `window` | jobs found |
| `myjobbot_source_failing_streak_max` | gauge | `module` | longest current run of failing fetches over the module's sources |
| `myjobbot_careers_lookups` | gauge | `outcome`, `page_source`, `window` | lookups from the careers audit |
| `myjobbot_company_searches` | gauge | `outcome`, `window` | searched, failed |
| `myjobbot_rescores` | gauge | `outcome`, `window` | re-scores by outcome |
| `myjobbot_rescore_duration_seconds_max` | gauge | `window` | longest re-score |
| `myjobbot_model_calls` | gauge | `worker`, `window` | `run` or `rescore` |
| `myjobbot_model_tokens` | gauge | `worker`, `kind`, `window` | `prompt`, `completion` |
| `myjobbot_mail_sends` | gauge | `kind`, `outcome`, `window` | |
| `myjobbot_mail_failure_streak` | gauge | | failures since the last sent mail |
| `myjobbot_jsearch_budget_used_ratio` | gauge | | this month's JSearch requests over the cap |

`window` is `24h` or `7d`.

## Alert rules (chart, `monitoring.enabled`)

| Alert | Expression (defaults) | `for` |
|---|---|---|
| `MyjobbotRunFailed` | `myjobbot_last_run_ok == 0` | 0m |
| `MyjobbotRunNeverFinished` | `myjobbot_runs{status="never_finished",window="24h"} > 0` | 0m |
| `MyjobbotRunMissed` | `time() - myjobbot_last_run_finished_timestamp_seconds > missedRunHours * 3600` (9) | 0m |
| `MyjobbotSourceModuleFailing` | `myjobbot_source_failing_streak_max >= moduleFailingFetches` (3) | 0m |
| `MyjobbotMailFailing` | `myjobbot_mail_failure_streak >= mailFailures` (3) | 0m |
| `MyjobbotJsearchBudget` | `myjobbot_jsearch_budget_used_ratio >= jsearchBudgetRatio` (0.9) | 1h |

Each value only changes when a run, fetch or mail is stored, so no `for` is needed to ride out noise
except the budget. SC-002: a dead run turns `never_finished` 5 minutes after its last heartbeat
(at most 6 after the crash); with the chart's 1-minute scrape and rule evaluation, the alert fires
by about 8 minutes, within 15.
