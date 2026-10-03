# myjobbot — Design Spec

**Date:** 2026-10-03
**Status:** Draft for review

## Purpose

An autonomous agent that, on a schedule, gathers software-engineering job postings
from company job boards, judges how well each fits the user's resume, looks up
Glassdoor ratings for companies with matching jobs, and emails a ranked digest.

A secondary, explicit goal is **learning how to build autonomous agentic workflows**.
The design therefore uses a real LLM-driven tool-calling loop (rather than a fixed
pipeline) and invests in observability (run traces) so agent behavior can be studied.

## Decisions Summary

| Area | Decision |
|---|---|
| Usage | Scheduled run, emailed digest |
| Language | TypeScript / Node |
| LLM | Local llama.cpp `llama-server`, OpenAI-compatible API, reached directly on LAN (not via Open WebUI). Base URL is config (`LLM_BASE_URL`) |
| Orchestration | **Approach C**: hand-rolled agent loop with tool calling. Fallbacks held in reserve: A (fixed pipeline script calling the same tools) and B (long-running service with internal scheduler) |
| Job sources | Public ATS board APIs: Greenhouse, Lever, Ashby |
| Matching input (v1) | Job metadata only (title, location, department/team, posted date). Full description retrieval is stubbed |
| Glassdoor | Playwright browser automation, low volume, cached |
| Delivery | HTML email via SMTP (nodemailer) |
| Runtime | Docker container on a home server, triggered by cron, single run per invocation |
| Storage | SQLite on a mounted volume |

## Architecture

```
                ┌───────────── agent loop (src/agent/loop.ts) ─────────────┐
 system prompt  │  messages → llama.cpp (/v1/chat/completions, tools=[…])   │
 + goal + resume│  ← tool_calls → validate → dispatch → result appended     │
                │  stop on: finish() | max steps | wall-clock budget        │
                └──────────────────────────┬───────────────────────────────┘
                                           │
   src/tools/  (plain TS functions + zod schemas → JSON Schema for the LLM)
   ├─ list_companies
   ├─ fetch_jobs
   ├─ get_job_details        (stub in v1)
   ├─ record_match
   ├─ get_company_rating
   ├─ send_digest
   └─ finish
```

Each tool is an independent, unit-tested module. The agent loop knows nothing about
jobs; it only knows how to call tools. This keeps Approach A cheap: a fallback script
can call the same tools in a fixed order.

### Proposed layout

```
src/
  cli.ts                 # `myjobbot run [--dry-run] [--glassdoor]`, `myjobbot trace <file>`
  config.ts              # loads + validates config.yaml and env (zod)
  db.ts                  # SQLite schema, migrations, queries (better-sqlite3)
  agent/
    loop.ts              # message/tool-call loop, guardrails
    llm.ts               # openai SDK client pointed at LLM_BASE_URL
    prompt.ts            # system prompt construction
    trace.ts             # JSONL trace writer/reader
  tools/
    index.ts             # registry: name → {schema, handler}
    listCompanies.ts
    fetchJobs.ts
    getJobDetails.ts
    recordMatch.ts
    getCompanyRating.ts
    sendDigest.ts
    finish.ts
  http/
    limiter.ts           # per-host rate limiter + retry/backoff for all outbound API calls
  sources/
    greenhouse.ts  lever.ts  ashby.ts   # → normalized Job (all HTTP via http/limiter)
  glassdoor/
    browser.ts           # Playwright persistent-context management
    lookup.ts            # search + resolve company page
    parse.ts             # extract rating fields from page HTML
  digest/
    render.ts            # HTML email from DB rows
    send.ts              # nodemailer SMTP
test/
  fixtures/              # recorded ATS JSON, saved Glassdoor HTML
```

## Inputs

- **`resume.md`**: the user's resume as Markdown or plain text, mounted into the container.
- **`config.yaml`**:
  - `companies`: list of `{name, ats: greenhouse|lever|ashby, slug, glassdoor_url?}`.
    A starter list of well-known SWE employers per ATS is provided.
  - `preferences`: free-text notes for the agent (e.g. locations, remote, seniority,
    roles to avoid). Passed into the system prompt.
  - `match_threshold`: score (0–100) at or above which a job is included in the digest. Default 70.
  - `ghost_threshold_days`: default 60.
  - `job_retention_days`: days after `last_seen` before a job row is pruned. Default 90.
  - `glassdoor`: `{max_lookups_per_run: 10, cache_ttl_days: 30, min_delay_s: 5, max_delay_s: 15}`.
  - `agent`: `{max_steps: 200, max_wall_clock_min: 60, max_consecutive_tool_errors: 3}`.
  - `http`: `{min_interval_ms: 1000, max_concurrency_per_host: 1, max_requests_per_host_per_run: 300, max_retries: 2, max_retry_after_s: 60, timeout_s: 30}`.
- **Environment**: `LLM_BASE_URL` (currently `http://llm.home.arpa:8081/v1`), `LLM_MODEL` (currently `qwen3-coder-30b`), `LLM_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASS`, `DIGEST_TO`, `DIGEST_FROM`.

## Tools

All tools validate arguments with zod. Validation failures are returned to the model
as a tool result `{error: "..."}` so it can correct itself; they never throw out of the loop.

| Tool | Args | Returns | Notes |
|---|---|---|---|
| `list_companies` | — | `[{name, ats}]` | From config |
| `fetch_jobs` | `company` | `[{job_id, title, location, department, team, workplace_type, is_remote, compensation, posted_at, days_open, possible_ghost}]` | Calls the ATS list endpoint through the rate limiter. Upserts all jobs into SQLite and updates `last_seen`. Returns **only jobs not yet scored**, never description text. **Memoized per run**: a repeat call for the same company returns the cached result without an HTTP request. On failure returns `{error}` |
| `get_job_details` | `job_id` | Stored metadata + `full_description: "not_available_in_v1"` | **Stub.** v2 returns the stored description (already captured for Lever/Ashby; Greenhouse needs `?content=true`) |
| `record_match` | `job_id, score (0–100), reasons[], gaps[]` | `{ok}` | Persists the agent's verdict; marks job as scored. Required for every job the agent evaluates |
| `get_company_rating` | `company` | `{status: ok\|not_found\|blocked\|error\|skipped, rating?, review_count?, recommend_pct?, ceo_approval_pct?, url}` | See Glassdoor section. Never throws |
| `send_digest` | — | `{ok, sent_count}` or `{error}` | Builds the email **from SQLite** (scored ≥ threshold, not yet emailed). Idempotent: refuses a second send in the same run. Marks jobs emailed |
| `finish` | `summary` | — | Ends the run; summary goes to the trace |

### Expected agent behavior (encoded in system prompt, not enforced)

1. List companies; fetch jobs per company.
2. Score each returned job against resume + preferences using metadata only; call `record_match`.
3. For companies with at least one job ≥ threshold, call `get_company_rating`.
4. Call `send_digest`, then `finish`.

The system prompt states that v1 scoring is metadata/title-based only.

## Agent Loop

- Hand-rolled using the `openai` npm SDK against llama.cpp's `/v1/chat/completions`
  with `tools`. No agent framework in v1, so the loop's mechanics stay visible.
- **Server requirement:** `llama-server` started with `--jinja` and a model whose chat
  template supports tool calls. Current server: `qwen3-coder-30b` (30.5B MoE, Q8_0,
  131k ctx loaded), API-key protected (Bearer). Native tool calling verified 2026-10-03
  (build b10362; ~520 tok/s prompt, ~54 tok/s generation).
- **Context management:** tool results are compact (no description bodies in v1).
  If message history exceeds a configured token estimate, older `fetch_jobs` results
  for companies already fully scored are replaced with a one-line summary.
- **Guardrails (enforced in code):**
  - `max_steps` and `max_wall_clock_min` caps → abort.
  - `max_consecutive_tool_errors` (default 3) invalid/failed tool calls in a row → abort.
  - A text-only response with no tool call is answered with a nudge
    ("Call a tool or call finish"), counted as an error.
  - `send_digest` single-send per run.
  - Email content comes only from DB rows, never from model free text.
- **Abort handling (code, not agent):** on any abort, code sends a short
  "myjobbot run failed: <reason>" email and writes the final status to the trace.
  If the agent ends without calling `send_digest` but matches exist, code does **not**
  auto-send (keeps agent behavior observable); the run summary flags it.

## Data Model (SQLite)

- **`jobs`**: `job_id` (ATS id, PK with `ats`), `ats`, `company`, `title`,
  `normalized_title`, `location`, `department`, `team`, `workplace_type`, `is_remote`,
  `compensation` (text, nullable), `url`, `posted_at` (from the ATS: Greenhouse
  `first_published`, Lever `createdAt`, Ashby `publishedAt`), `description`
  (plain text, nullable, capped at 20k chars; stored when the list response already
  includes it, never sent to the model in v1), `first_seen`, `last_seen`, `scored_at`, `score`, `reasons` (JSON), `gaps` (JSON),
  `emailed_at`.
- **`ratings`**: `company` (PK), `status`, `rating`, `review_count`, `recommend_pct`,
  `ceo_approval_pct`, `glassdoor_url`, `fetched_at`.
- **`runs`**: `run_id`, `started_at`, `ended_at`, `status`, `steps`, `summary`, `trace_path`.

### Ghost / fishing-post detection

- Every successful `fetch_jobs` updates `last_seen` for all live postings, including
  already-scored and already-emailed ones.
- `days_open` = now − the earliest of `posted_at` and `first_seen` across all rows with
  the same `(company, normalized_title)`. The ATS date gives a true age from the first
  run; `first_seen` catches reposts under new ATS ids with fresh posting dates.
  `normalized_title` = lowercased, punctuation stripped, whitespace collapsed.
- `possible_ghost` = `days_open > ghost_threshold_days`.
- Job rows are pruned when `last_seen` is older than `job_retention_days` (90).
- The digest shows a "⚠ open N days" badge for possible ghosts. The agent sees the
  flag and may factor it into its score.

## Glassdoor Rating Tool

- **Cache first:** return a `ratings` row if `fetched_at` is within `cache_ttl_days` (30).
- **On miss:** Playwright headless Chromium with a **persistent profile directory** on the
  mounted volume (cookies survive runs). One browser per run, opened lazily.
  - If `glassdoor_url` is set for the company in config, go there directly.
  - Otherwise search Glassdoor for the company name and pick the best name match.
  - Parse overall rating, review count, recommend-to-friend %, CEO approval %.
  - Store the resolved URL with the result.
- **Politeness:** sequential lookups, random 5–15 s delay between them,
  `max_lookups_per_run` cap (default 10; further calls return `status: skipped`),
  realistic user agent and viewport.
- **Blocks:** on captcha or login wall, return `blocked`, save a screenshot to `runs/`,
  and short-circuit all further lookups this run to `blocked`.
- The user accepts that automated access is against Glassdoor's ToS and may be brittle.

## Digest Email

- Subject: `myjobbot: N new matches (YYYY-MM-DD)`.
- Jobs ranked by score. Each entry: title, company, location, score, reasons, gaps,
  Glassdoor rating (or "rating unavailable" + Glassdoor search link), ghost badge if
  applicable, apply link.
- Header note: "v1 scores are based on job title/metadata only."
- If no matches, no email is sent (the run summary records it).
- `--dry-run` writes the HTML to `runs/<run_id>.html` instead of sending.

## Observability

- Every LLM request/response and tool call/result is appended to
  `runs/<timestamp>.jsonl`.
- `myjobbot trace <file>` pretty-prints a run: steps, tool calls, args, result sizes,
  errors, timing.
- Run row in SQLite with final status and summary.

## Outbound API Rate Limiting

All outbound HTTP to job boards goes through `src/http/limiter.ts`; source adapters
never call `fetch` directly.

- **Per-host limiter:** at most `max_concurrency_per_host` (1) request in flight per host,
  and at least `min_interval_ms` (1000 ms) between request starts to the same host.
- **Per-run cap:** `max_requests_per_host_per_run` (300). Past the cap, requests fail fast
  with a `rate_limit_cap` error that the agent sees, so a looping agent cannot hammer an API.
- **429 / 503:** honor `Retry-After` (capped at `max_retry_after_s`), otherwise exponential
  backoff with jitter; up to `max_retries` (2), then return an error.
- **Timeouts:** `timeout_s` (30) per request.
- **Per-run memoization** in `fetch_jobs` (see Tools) means the same board is fetched at
  most once per run, whatever the agent does.
- **Response size:** responses are parsed and reduced to normalized `Job` fields at once;
  raw bodies (up to ~15 MB for large Ashby boards) are not stored or logged in the trace.
- **LLM calls** are sequential by construction (one request per loop step), bounded by
  `max_steps`. Glassdoor has its own politeness limits (see Glassdoor section).

## Error Handling

- ATS fetch failures are per company; the agent sees `{error}` and can move on.
- LLM unreachable → abort with failure email.
- Jobs are marked scored only via `record_match`, so jobs from a crashed run are
  re-offered next run.
- Glassdoor failures never fail the run.

## Deployment

- Docker image based on the official Playwright Node image (`mcr.microsoft.com/playwright`),
  with the version pinned.
- Mounted volume: `/data` holding `myjobbot.db`, `runs/`, `browser-profile/`,
  `config.yaml`, `resume.md`.
- Host cron runs `docker run --rm ... myjobbot run` daily.
- All npm dependencies pinned with upper bounds (exact or `~`) and installed from the
  lockfile (`npm ci`).

## Testing

- **Unit (vitest):** rate limiter with fake timers (interval, concurrency, per-run cap,
  `Retry-After` handling, backoff); `fetch_jobs` memoization; each source adapter against recorded ATS JSON fixtures; Glassdoor
  parser against saved HTML; DB queries (including ghost detection and pruning) on
  in-memory SQLite; digest rendering snapshot.
- **Agent loop:** a scripted fake LLM returning canned tool calls, covering dispatch,
  invalid-args feedback, step/time caps, consecutive-error abort, text-only nudge,
  single-send enforcement, and trace output.
- **Live smoke:** `myjobbot run --dry-run` against real llama.cpp and ATS APIs;
  Glassdoor skipped unless `--glassdoor` is passed.

## Out of Scope for v1

- Full job description retrieval and skill-level matching (`get_job_details` is a stub).
- Other job sources (Adzuna, RemoteOK, HN Who's Hiring).
- Web dashboard or application tracking.
- An eval harness for comparing models and prompts on saved runs (planned next).
- Agent frameworks (revisit after the hand-rolled loop is understood).

## Fallback Plan

If the local model can't drive the loop reliably (judged from traces):
- **A:** `src/pipeline.ts` calls the same tools in a fixed order, using the LLM only
  for per-job scoring.
- **B:** wrap A or C in a long-running service with an internal scheduler.
