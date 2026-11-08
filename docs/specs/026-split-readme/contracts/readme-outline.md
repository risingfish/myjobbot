# Contract: README outline

The README's headings, in order, and what each must hold. Line budgets are targets that add up
to at most 250 lines (FR-007).

```text
# myjobbot                                   ~10 lines
  What it does: fetches postings from your saved sources (company boards, JSearch searches,
  LinkedIn alert emails), fills in missing descriptions from employers' careers pages, scores each
  against your resume and preferences with an LLM, and lists them in a web UI with the reasons.
  One line: runs on a schedule, keeps history to spot long-open postings.

## Quickstart                                ~70 lines
  What you need first: Docker (or Node 24 + npm), an LLM endpoint (see The parts).
### Option 1: The full stack (Docker Compose)
  git clone; cp .env.example .env (set LLM_*, MYJOBBOT_HOSTS, MYJOBBOT_DB_NAME/_USER/_PASSWORD,
  SEARXNG_SECRET, MYJOBBOT_BASE_URL=http://localhost:8080); mkdir data;
  cp examples/config.json examples/resume.md data/;
  docker compose -f compose.full.yaml up -d --build;
  docker compose -f compose.full.yaml exec web npm start -- account init you@example.com;
  open http://localhost:8080, sign in → Settings → Sources → paste a board link → Open → Save.
  Link: docs/deploying.md.
### Option 2: The app alone (other parts hosted elsewhere)
  npm ci; .env with LLM_*, MYJOBBOT_DB_* (an existing MariaDB ≥ 10.11 database and user),
  optional MYJOBBOT_SEARXNG_URL, MYJOBBOT_BROWSER_URL, MYJOBBOT_SECRET_KEY, JSEARCH_API_KEY;
  MYJOBBOT_BASE_URL; data/config.json (+ resume.md, optional here); npm start -- account init;
  npm run web; sign in; add a source; npm start -- run.
  One line each: the image with compose.yaml (docs/deploying.md), Kubernetes (docs/deploying.md).

## The parts                                 ~60 lines
  A table, one row per part: what it does · required? · without it · settings.
  - The app: agent run (scheduled in Docker) and web UI (sign-in required; MYJOBBOT_BASE_URL,
    MYJOBBOT_HOSTS, MYJOBBOT_PORT, MYJOBBOT_TRUSTED_PROXIES behind proxies → docs/deploying.md)
  - MariaDB database (MYJOBBOT_DB_*; tables made on first start)
  - LLM (LLM_BASE_URL, LLM_MODEL, LLM_API_KEY; research R1's wording, tested with llama.cpp)
  - Playwright browser service (MYJOBBOT_BROWSER_URL; 1.64.1 exactly; isolated network)
  - SearXNG (MYJOBBOT_SEARXNG_URL; must answer JSON)
  - Email in: Gmail alert reading (IMAP app password; MYJOBBOT_SECRET_KEY seals it)
  - Account mail out: SMTP (MYJOBBOT_SMTP_*, MYJOBBOT_MAIL_FROM; optional: links, resets, notices)
  - JSearch (JSEARCH_API_KEY; monthly budget)
  - data/ folder (config.json, resume.md, runs/, log/)
  Then 3–5 lines on how they connect (fetch → lookup → score → UI), linking docs/how-it-works.md.

## Job sources                               ~35 lines
  Short table: module · what it reads · how often (Greenhouse, Lever, Ashby, Gem, Workday, JSearch,
  Gmail alerts). Adding one: paste a link on Settings → Sources.
### JSearch's limits
  API key; monthly_request_cap (free tier 200, default 190); refresh_hours; date_posted;
  aggregators and exclude_publishers; alert-description lookups share the budget.
  Link: docs/sources.md.

## How scoring works                         ≤ 25 lines
  The four stages (filters → model reads promising jobs → two-part rubric, base 0–50 resume fit
  + bonus 0–50 preference fit → boosts at display time), match_threshold, every verdict kept,
  "treat a score as a sort order". Link: docs/how-it-works.md#how-scoring-works.

## Further reading                           ~15 lines
  One line per sub page; docs/react-walkthrough.md; the design doc; docs/specs/; Still to come
  (trace of how each job was categorized, email digest, Glassdoor ratings).

## License                                   ~6 lines (unchanged)
```
