# Data model: Scoring evals

All files live under `<data>/evals/` (inside the gitignored `data/`). Every file is JSON, carries
`"schema": 1` and is parsed with a strict zod schema (unknown fields refused). Times are ISO-8601
UTC strings. A file whose `schema` is not 1 is reported as `needs upgrade (schema N)`.

```
data/evals/
  profiles/<profileId>.json
  cases/<caseId>.json
  labels/<caseId>.json
  prompts/<promptId>.json
  runs/<runId>/run.json
  runs/<runId>/results.jsonl     one result per line
  runs/<runId>/trace.jsonl       the run's agent trace (not parsed by EvalFiles)
```

## Profile (`profiles/<profileId>.json`)

| Field | Type | Rules |
|---|---|---|
| schema | 1 | |
| resume | string | non-empty |
| preferences | string | any length (settings set none) |
| matchThreshold | int | 0..100 |
| ghostThresholdDays | int | ≥ 1 |
| capturedAt | ISO time | first capture that used it |

`profileId` = first 16 hex of SHA-256 over canonical JSON (sorted keys) of
`{resume, preferences, matchThreshold, ghostThresholdDays}`; written once, never rewritten.

## Case (`cases/<caseId>.json`)

| Field | Type | Rules |
|---|---|---|
| schema | 1 | |
| id | string | `<ats>-<jobId>` or `<ats>--<16 hex>` (research R5); equals the file name |
| profile | string | an existing `profileId` (else reported `orphaned`) |
| source | `{ ats, jobId }` | the stored job's key, for tracing only |
| title, company | string | for reports; company is not sent to the model (research R1) |
| job | object | the `get_job` payload as of the observed score (or capture): `job_id`, `title`, and when present `location`, `department`, `team`, `workplace_type`, `is_remote`, `compensation`, `posted_at`, `days_open` (int ≥ 0), `possible_ghost` (bool), `description` (≤ 6,000 chars or `"(none provided)"`), `description_truncated`, `description_from`, `requirements`, `skills`, `preferred_skills` |
| dates | object | `capturedAt`, `daysOpenAtCapture` (int ≥ 0), `daysOpenAsScored` (int ≥ 0), `shiftedDays` (int ≥ 0) |
| observed | object \| null | the latest verdict at capture: `base`, `bonus` (0..50 or null), `score` (0..100), `reasons`, `gaps` (string[]), `scoredAt`, `runId` (string or null), `read` (`details` \| `summary` \| `unknown`) |
| descriptionChangedSinceScored | bool | FR-005; false without `observed` |
| tags | string[] | each `[a-z0-9-]{1,40}`, ≤ 20 |

Rules: `shiftedDays = daysOpenAtCapture − daysOpenAsScored`; `job.days_open = daysOpenAsScored`
(when `days_open` is present); `observed: null` ⇒ `shiftedDays = 0`.

## Label (`labels/<caseId>.json`)

| Field | Type | Rules |
|---|---|---|
| schema | 1 | |
| verdict | `recommend` \| `borderline` \| `reject` \| `zero` | |
| score | `{ min, max }` \| null | 0..100, min ≤ max |
| base, bonus | `{ min, max }` \| null | 0..50, min ≤ max |
| mustMention | string[] | ≤ 10, each 1..60 chars |
| note | string | ≤ 2,000 chars |
| labeledAt | ISO time | |
| history | array | earlier labels (same fields, no `schema`/`history`), newest first, ≤ 50 |

A label whose case file is missing is reported as `orphaned`.

## Prompt (`prompts/<promptId>.json`)

| Field | Type | Rules |
|---|---|---|
| schema | 1 | |
| text | string | the system message, with the attempt's data markers replaced by `{open}` / `{close}` |

`promptId` = first 16 hex of SHA-256 over canonical JSON of `{text}`.

## Run (`runs/<runId>/run.json`)

| Field | Type | Rules |
|---|---|---|
| schema | 1 | |
| id | string | `<yyyymmdd-hhmmss>-<4 hex>`; equals the folder name |
| model | string | |
| prompts | `{ [profileId]: promptId }` | one entry per profile its cases use, ≥ 1 |
| repeats | int | 1..20 |
| cases | string[] | case ids, ≥ 1 |
| tags | string[] | the filter used, if any |
| gitCommit | string \| null | `git rev-parse HEAD` when available |
| startedAt | ISO time | |
| endedAt | ISO time \| null | null while running or when stopped (shown as unfinished) |

## Result (one line of `runs/<runId>/results.jsonl`)

| Field | Type | Rules |
|---|---|---|
| schema | 1 | |
| case | string | a case id in the run |
| attempt | int | 1..repeats |
| base, bonus | int \| null | 0..50; null on failure |
| score | int \| null | base + bonus |
| reasons, gaps | string[] | |
| failure | `no_record` \| `invalid_tool_call` \| `timed_out` \| `model_error` \| null | research R9 |
| tokensIn, tokensOut | int \| null | null when the server reports no usage |
| ms | int | ≥ 0 |
| passed | bool \| null | against the label at run time; null when unlabeled |

A bad line is reported as `runs/<id>/results.jsonl:<line>` and skipped; reports re-judge against
current labels and say when a label changed since the run (spec edge case).

## Derived (not stored)

- **Spread** of a case in a run: min, max and range of its attempts' scores. A case is
  **unstable** when its attempts' pass states are mixed or its range is ≥ 10.
- **Move** between two runs, or a run and `observed`: the case's median score and pass state in
  each; moved when the pass state differs or the medians differ by ≥ 5. A comparison also counts
  cases **fixed** (fail → pass) and **broken** (pass → fail), and the change in pass rate, tokens
  and time. Cases with `observed.read ≠ details` or `descriptionChangedSinceScored` are left out
  of the observed comparison and counted by reason.
