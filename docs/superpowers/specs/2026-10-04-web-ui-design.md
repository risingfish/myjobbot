# Web UI and Verdict History — Design Spec

**Date:** 2026-10-04
**Status:** Approved design, pending implementation plan
**Parent spec:** `2026-10-03-myjobbot-design.md`

## Goal

A simple read-only web page for the jobs myjobbot has found, with three tabs:

| Tab | Purpose |
|---|---|
| **Recommended** | The running list of jobs the bot would recommend, with details and score |
| **All jobs** | Every job retrieved from every source, with details and score (or blank if unscored) |
| **Reasoning** | A history of every scoring decision: why each job got its score, per run |

It also adds a **`verdicts` table**: the model's reasoning for each job posting it scores, kept
as history instead of overwritten.

## Decisions

| Area | Decision |
|---|---|
| Rendering | Server-rendered HTML from TypeScript using Node's built-in `http` module. No framework, no new dependencies, no browser JavaScript. Tabs are links |
| Command | `myjobbot serve` (`npm run serve`) |
| Data access | Read-only queries against the same SQLite file the agent writes |
| Concurrency | SQLite WAL mode plus a busy timeout, so the UI reads while a run writes |
| Auth | None. LAN-only; do not expose the port to the internet |
| Docker | A second Compose service `web` from the same image, running `serve` |

Rejected: a JSON API plus a vanilla-JS front end (client code would sit outside habit-hooks'
TypeScript checks; more parts than "simple" needs); React or Vite (overkill for read-only tables).

## Data: `verdicts` table

```sql
CREATE TABLE IF NOT EXISTS verdicts (
  ats TEXT NOT NULL, job_id TEXT NOT NULL, run_id TEXT, scored_at TEXT NOT NULL,
  score INTEGER NOT NULL, reasons TEXT NOT NULL, gaps TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS verdicts_by_time ON verdicts (scored_at);
```

- **Writes:** `record_matches` inserts one `verdicts` row per accepted verdict, tagged with the
  run's `run_id`, inside the same transaction as the existing update of the job's latest
  score/reasons/gaps. Unknown job IDs write nothing, as today.
- **`ats` lookup:** the verdict row's `ats` comes from the job row that was updated, so the pair
  identifies the job.
- **Backfill:** when `verdicts` is empty, `openDatabase` copies every already-scored job in as
  one verdict with `run_id = NULL`. Nothing scored before this change is lost. Idempotent.
- **Pruning:** after jobs are pruned, verdicts whose job no longer exists are deleted.
- **Context:** `ToolContext` gains `runId: string` (set by `runOnce`; `"test-run"` in tests).

## Database settings

`openDatabase` runs `PRAGMA journal_mode = WAL` and `PRAGMA busy_timeout = 5000` for file
databases (`:memory:` ignores WAL harmlessly). This creates `myjobbot.db-wal` and
`myjobbot.db-shm` next to the database in `data/` (already gitignored).

## Read model (`src/db/jobViews.ts`)

A `JobViews` class with three read-only queries. All return plain row objects validated with zod.

| Method | Returns |
|---|---|
| `recommended(sources: string[], threshold: number)` | Scored jobs whose `source` is in `sources` and `score >= threshold`, ordered by score desc, then `scored_at` desc |
| `allJobs()` | Every job row, ordered by `last_seen` desc, then `first_seen` desc |
| `verdictHistory()` | Every verdict joined to its job's title, company, url and source (left join; title shows "(pruned)" if missing), ordered by `scored_at` desc |

Job rows include: `ats, job_id, source, company, title, url, location, workplace_type,
is_remote, compensation, posted_at, first_seen, last_seen, publisher, score, reasons, gaps,
scored_at`. `reasons` and `gaps` are parsed from JSON text into string arrays (empty when
null).

## Pages

The config is reloaded on every request, so `match_threshold`, sources and the title filter
follow edits to `data/config.json` without a restart.

**Layout (all tabs):** title "myjobbot", tab links (current tab highlighted), a one-line summary
(e.g. "15 recommended · threshold 70"), a table, and footer text with the database path and
render time. Minimal inline CSS, readable in light and dark (`prefers-color-scheme`).

**Recommended** (`/recommended`)
- Scope: jobs from sources in the current config, at or above `match_threshold`.
- Columns: **Score**, **Title** (links to the posting), **Company**, **Location**, **Remote**
  (yes/no/blank), **Source** (source name; plus "via LinkedIn" etc. when `publisher` is set),
  **Posted** (date, or "N days open" with "⚠ possible ghost" past `ghost_threshold_days`),
  **Scored** (date).
- Each row has a `<details>` element listing the model's reasons and gaps.

**All jobs** (`/jobs`)
- All rows from `allJobs()`, no cap; summary shows the count.
- Same columns. Score is blank when unscored. A "hidden by title filter" note marks jobs whose
  title fails the current title filter (the model never sees them).
- Includes jobs from sources no longer in the config, until they are pruned.

**Reasoning** (`/reasoning`)
- One row per verdict: **Scored at**, **Run** (first 8 chars of `run_id`, or "before history"
  when null), **Job** (title linked to the posting), **Company**, **Score**, **Reasons**,
  **Gaps** (as bullet lists).

**Empty states:** each tab says plainly when it has no rows (e.g. "No recommendations yet: run
`myjobbot run`").

## Server (`src/web/`)

| Route | Response |
|---|---|
| `GET /` | 302 to `/recommended` |
| `GET /recommended`, `/jobs`, `/reasoning` | 200 HTML |
| Other paths | 404 HTML "Not found" |
| Non-GET methods | 405 |
| Render error | 500 HTML with the error message (escaped); the server keeps running |

- Settings: `MYJOBBOT_PORT` (default 8080), `MYJOBBOT_HOST` (default `127.0.0.1`; Docker sets
  `0.0.0.0`). Startup prints `myjobbot UI on http://<host>:<port>`.
- `serve` loads config with the same `loadConfig` as `run`, so the same `.env` works.
- **Safety:** every value from the database or a job board is HTML-escaped. Links are emitted
  only for `http:`/`https:` URLs; anything else renders as plain text.

## CLI

`myjobbot serve` joins `myjobbot run`. Usage becomes `usage: myjobbot run | serve`.
`package.json` gains `"serve": "NODE_OPTIONS=--disable-warning=ExperimentalWarning tsx src/cli.ts serve"`.

## Docker

- `docker/entrypoint.sh` adds a `serve` command: check prerequisites, then
  `exec node_modules/.bin/tsx src/cli.ts serve`.
- `compose.yaml` adds:

```yaml
  web:
    image: myjobbot:latest
    restart: unless-stopped
    command: ["serve"]
    env_file: .env
    environment:
      MYJOBBOT_DATA_DIR: /data
      MYJOBBOT_LOG_DIR: /data/log
      MYJOBBOT_HOST: 0.0.0.0
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
```

- `tests/docker.sh` adds a check: start the image with `serve` and a configured data dir,
  publish a port, and `GET /recommended` returns 200 containing "myjobbot".

## Testing

- **`verdicts`:**
  - `record_matches` writes history rows with `run_id` and keeps the job's latest score
  - re-scoring adds a second row instead of replacing
  - the backfill on a database with scored jobs and no verdicts
  - pruning removes orphaned verdicts
- **`JobViews`:** threshold and source filtering, ordering, JSON parsing of reasons and gaps, and
  verdict history joined to jobs (including pruned).
- **Rendering:**
  - each tab against an in-memory database: right rows, columns and empty states
  - a job title containing `<script>` renders escaped
  - a `javascript:` URL renders as text, not a link
  - the title-filter note and the ghost marker
- **Server:** routes return the documented status codes (started on an ephemeral port in tests).
- **CLI:** usage text lists `run | serve`.

## Out of scope

Sorting and filtering controls, pagination, search, editing, marking jobs applied or ignored,
auth, live refresh. Each can be added later without changing this structure.
