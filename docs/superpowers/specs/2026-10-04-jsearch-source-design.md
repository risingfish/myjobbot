# JSON Config and JSearch Source — Design Spec

**Date:** 2026-10-04
**Status:** Implemented
**Parent spec:** `2026-10-03-myjobbot-design.md`

Two changes, shipped in this order:

- **Part A:** switch the config file from YAML to JSON. Independent and small.
- **Part B:** add JSearch (Google for Jobs) as a second kind of job source: saved searches
  next to company boards. This brings in LinkedIn, Indeed and other postings without
  scraping LinkedIn.

---

## Part A: JSON config

### Behaviour

- `data/config.json` replaces `data/config.yaml`. It is read with `JSON.parse` and validated by
  the existing zod `fileConfigSchema`, so error messages stay field-specific.
- Invalid JSON fails with `config.json is not valid JSON: <parser message>`.
- If `config.json` is missing but `config.yaml` exists in the data dir, loading fails with:
  `config is now JSON: convert data/config.yaml to data/config.json`. The old file is never read.
- The `yaml` dependency is removed from `package.json` and the lockfile.
- JSON has no comments. Each setting is explained in the README settings table instead.

### Files touched

| File | Change |
|---|---|
| `src/config/load.ts` | Read and parse `config.json`; the migration and invalid-JSON errors |
| `package.json`, `package-lock.json` | Remove `yaml` |
| `examples/config.yaml` | Replaced by `examples/config.json` (same three companies, preferences, threshold) |
| `tests/helpers/dataDir.ts` | `SAMPLE_CONFIG` becomes an object; `makeDataDir` writes `config.json` |
| `tests/config.test.ts` | YAML fixtures become JSON; new tests for invalid JSON and the YAML-migration error |
| `docker/entrypoint.sh` | Prerequisite check looks for `config.json` |
| `tests/docker.sh` | Copies `examples/config.json`; expects `missing /data/config.json` |
| `README.md` | Setup, Docker and settings-table references |
| Parent spec, Docker spec | `config.yaml` → `config.json`; drop `yaml` from the runtime deps list |

The local `data/config.yaml` (gitignored) is converted to `data/config.json` as part of the
rollout.

---

## Part B: JSearch source

### Goal

Saved searches such as "senior backend engineer, remote, US" pull matching postings from
JSearch. JSearch aggregates Google for Jobs, which indexes LinkedIn, Indeed, Glassdoor,
ZipRecruiter and company sites. The results flow into the same database, title filter,
scoring and ghost tracking as company boards. They stay within the free tier's 200 requests
per month, enforced in code.

### Decisions

| Area | Decision |
|---|---|
| Access | Direct OpenWebNinja API: `GET https://api.openwebninja.com/jsearch/search-v2`, header `x-api-key`. Not RapidAPI, which adds about a 30% markup |
| Plan | Free tier: 200 requests/month, hard cap |
| Agent integration | Saved searches are a second kind of source. The agent's routine is unchanged |
| Budget | Enforced in code inside `fetch_jobs`; the model cannot spend requests |
| Duplicates | Prefer the company board: skip a JSearch result that matches an existing board job |
| Tool names | `list_companies` → `list_sources`; `fetch_jobs(company)` → `fetch_jobs(source)` |

Rejected: a code-side pre-fetch before the agent runs (splits fetching across two places,
against the agent-drives design); a model-driven `search_jobs(query)` tool (the model would
choose how to spend a hard-capped budget).

### Config

```json
{
  "companies": [{ "name": "Palantir", "ats": "lever", "slug": "palantir" }],
  "searches": [
    {
      "name": "Senior backend remote US",
      "query": "senior backend engineer",
      "remote_only": true,
      "country": "us"
    }
  ],
  "jsearch": { "monthly_request_cap": 190, "refresh_hours": 24, "date_posted": "3days" }
}
```

| Field | Default | Meaning |
|---|---|---|
| `searches[].name` | required | Source name shown to the agent. Unique, and must not equal a company name |
| `searches[].query` | required | Free-text JSearch `query` |
| `searches[].remote_only` | `false` | Sends `work_from_home=true` |
| `searches[].country` | `"us"` | JSearch `country` code |
| `jsearch.monthly_request_cap` | 190 | Requests allowed per calendar month (UTC). The free tier is 200; this keeps a margin |
| `jsearch.refresh_hours` | 24 | A search calls the API at most once per this many hours |
| `jsearch.date_posted` | `"3days"` | JSearch `date_posted`: `today`, `3days`, `7days` or `30days`. Overlap means a missed refresh loses nothing |

`searches` defaults to `[]`, and `companies` may then be empty as long as `searches` is not.
Validation enforces:

- At least one company or one search.
- **Budget feasibility:** `searches.length × ceil(30 × 24 / refresh_hours) ≤ monthly_request_cap`.
  With the defaults, that allows at most 6 searches.
- `JSEARCH_API_KEY` (in `.env`) is required when `searches` is non-empty. `loadConfig` reports
  `JSEARCH_API_KEY is required when searches are configured`.

### Agent-facing tools

**`list_sources`** (replaces `list_companies`) returns one entry per board and per search:

```json
[
  { "name": "Palantir", "kind": "board", "ats": "lever", "fetched": true, "total_unscored": 0 },
  { "name": "Senior backend remote US", "kind": "search", "fetched": false }
]
```

`fetch_failed: true` appears as today when the last fetch attempt failed.

**`fetch_jobs(source)`** (parameter renamed from `company`):

- **Board sources:** unchanged. The first call in a run downloads the board, and every call
  returns up to 25 unscored jobs that pass the title filter, plus `total_unscored`.
- **Search sources:** the first call in a run calls JSearch only if the search is **due**: its
  last request was more than `refresh_hours` ago, **and** this month's request count is under
  `monthly_request_cap`. Either way, the call returns up to 25 unscored, title-filtered jobs
  for that search, regardless of `last_seen`, because search results have no "still listed"
  signal. The result adds:
  - `refreshed: true | false`
  - when false, `refresh_note`: `"refreshed 5h ago; next refresh in 19h"` or
    `"monthly JSearch budget used (190/190)"`

  Not being due is not an error.

The system prompt, compaction notice and nudge refer to "sources" instead of "companies". The
loop is unchanged.

### Mapping a JSearch result to `Job`

| `Job` field | JSearch field |
|---|---|
| `ats` | `"jsearch"` |
| `jobId` | `js_` + first 16 hex chars of SHA-256(`job_id`). The real `job_id` is about 400 characters, too long for the model to copy reliably in `record_matches`; the hash is stable, so the same posting keeps its ID |
| `company` | `employer_name` |
| `title` | `job_title` |
| `url` | `job_apply_link` |
| `location` | `job_city`, `job_state`, `job_country` joined with ", " (nulls skipped) |
| `isRemote` | `job_is_remote` |
| `workplaceType` | `work_arrangement` |
| `compensation` | `job_salary_string` |
| `postedAt` | `job_posted_at_datetime_utc` |
| `description` | `job_description` (stored, capped at 20k chars, not shown to the model in v1) |
| `publisher` (new) | `job_publisher`, e.g. `"LinkedIn"` |

One page per refresh: a single request with `query`, `country`, `date_posted`, and
`work_from_home` when `remote_only` is set. It returns 10 jobs. The response is validated with zod
(unknown fields ignored). The real shape, confirmed with a live request on 2026-10-04, is
`{status, request_id, parameters, data: {jobs: [...], cursor}}`. In that sample,
`work_arrangement` was absent and city, state and country were null for remote jobs, so all
three are optional.

### Duplicates

Before storing a JSearch result, skip it if a row with `ats != 'jsearch'` exists whose
normalized company equals the normalized `employer_name` and whose `normalized_title` matches.

- **Company normalization:** lowercase, strip punctuation, drop trailing legal suffixes (`inc`,
  `llc`, `ltd`, `corp`, `corporation`, `co`, `gmbh`, `plc`).
- The same job found by two searches is one row: the upsert on `(ats, job_id)` keeps it, and
  `source` becomes the most recent search.

### Budget

- New table `api_calls(api TEXT, source TEXT, called_at TEXT)`. One row is written **before**
  each JSearch request, whatever its outcome, so failed calls also count against the budget.
- **Due check:** the newest `called_at` for that `source` is older than `refresh_hours`, and
  `COUNT(*)` for `api = 'jsearch'` in the current UTC calendar month is below the cap.
- OpenWebNinja's billing month may not match the calendar month. The 10-request margin under
  200 covers small misalignment. An exhausted real quota surfaces as an HTTP error (see below).
- `api_calls` rows older than 90 days are pruned along with jobs.

### Database changes (migration)

`openDatabase` runs idempotent migrations after creating tables:

- Add `jobs.source TEXT` and backfill `source = company` where it is null.
- Add `jobs.publisher TEXT`.
- Create table `api_calls` and index `jobs_by_source (source, scored_at)`.

The migration checks existing columns with `PRAGMA table_info(jobs)`, so it is safe to run on
every start and on databases created before this change. `unscoredSince` and progress
counting key on `source` instead of `company`. Board rows set `source` = company name and
search rows set `source` = search name.

### HTTP

`JsonGetter.getJson(url, headers?)` gains an optional headers argument, passed through to
`fetch`. JSearch requests go through the same `HttpClient`: per-host spacing, the per-run cap,
and retries on 429/5xx. A 401 or 403 is rethrown as
`JSearch refused the request (HTTP 401); check JSEARCH_API_KEY and that the account is subscribed to JSearch`.

### Errors

| Situation | Behaviour |
|---|---|
| Search not due / budget used | Not an error: `refreshed: false` with `refresh_note`; stored jobs are served |
| JSearch HTTP error, network error, malformed response | A failed tool call, as for boards: the model sees `{error}`, it counts toward the consecutive-error abort, and `list_sources` shows `fetch_failed: true`. The request still counts against the budget |
| Missing `JSEARCH_API_KEY` with searches configured | Config error at startup |

### Logging

Each JSearch request writes one line to the run's jobs log
(`log/<ts>-<run_id>.jobs.jsonl`):

```json
{ "type": "search_fetch", "source": "...", "query": "...", "params": { "country": "us", "date_posted": "3days", "work_from_home": true },
  "requests_this_month": 37, "job_count": 10, "skipped_duplicates": 2, "jobs": [ ... ] }
```

Jobs are logged without descriptions, as with board fetches. Board-fetch lines gain
`"source"`.

### Testing

- **Fixture:** `tests/fixtures/jsearch.json`, built from the documented response fields (two
  jobs: one LinkedIn, one duplicating a board job).
- **Unit tests:**
  - mapping, including location joining and null handling
  - the request URL and `x-api-key` header
  - the due check: never called, called recently, called long ago
  - the monthly cap reached
  - duplicate skipping against a board row, including employer-suffix normalization
  - the migration on a pre-change database (old columns, no `source`)
  - config validation (budget feasibility, missing key, name collision)
  - `list_sources` output for both kinds
- **Scripted end-to-end:** one board and one search; the agent lists sources, fetches and
  scores both, and finishes. A second run in the same hour serves the search without a new
  request.
- **Live smoke:** once a `JSEARCH_API_KEY` is set, one run against the real API. Check the
  `search_fetch` log line and the stored rows, and adjust the zod response schema if the real
  shape differs from the docs.

### Out of scope

More than one page per refresh; RapidAPI access; the salary-estimate endpoint; showing
JSearch-only fields (seniority, technologies, highlights) to the model, which can come with v2
descriptions; showing `publisher` in a digest, which belongs to the digest plan.
