# myjobbot

An autonomous job-search agent. It pulls software-engineering postings from your saved sources
(company job boards on Greenhouse, Lever, Ashby, Gem and Workday, saved JSearch searches of Google
for Jobs, and your LinkedIn job-alert emails), looks up missing descriptions on employers' own
careers pages, scores every job against your resume and preferences with an LLM, and lists the
results in a web UI that explains each score. It runs on a schedule and keeps history in MariaDB,
so it can spot long-open "ghost" postings.

## Quickstart

You need Docker (or Node 24 and npm) and an LLM server it can reach (see [The parts](#the-parts)).

### Option 1: The full stack (Docker Compose)

Everything except the LLM, database included:

```bash
git clone https://github.com/risingfish/myjobbot.git && cd myjobbot
cp .env.example .env    # set LLM_*, MYJOBBOT_HOSTS=localhost:8080, MYJOBBOT_BASE_URL=http://localhost:8080,
                        # MYJOBBOT_DB_NAME, MYJOBBOT_DB_USER, MYJOBBOT_DB_PASSWORD (any values) and SEARXNG_SECRET
mkdir -p data && cp examples/config.json examples/resume.md data/
docker compose -f compose.full.yaml up -d --build
docker compose -f compose.full.yaml exec web npm start -- account init you@example.com   # the first admin
```

Open http://localhost:8080, sign in, and on **Settings → Sources** paste a company's jobs page link
(for example `https://boards.greenhouse.io/stripe`), press **Open**, then **Save**. Runs start on a
schedule (every 8 hours from 1 a.m.); `docker compose -f compose.full.yaml run --rm myjobbot run`
starts one now. More in [Deploying](docs/deploying.md#the-full-stack-composefullyaml).

### Option 2: The app alone

When the database, LLM, SearXNG and browser service already run elsewhere:

```bash
npm ci
cp .env.example .env    # set LLM_*, MYJOBBOT_DB_* (an existing MariaDB 10.11+ database and user),
                        # MYJOBBOT_BASE_URL=http://localhost:8080, and any optional parts below
mkdir -p data && cp examples/config.json data/   # resume.md is optional: upload one on Settings
npm start -- account init you@example.com        # the first admin; creates the tables too
npm run web                                       # http://localhost:8080
```

Sign in, add a source on **Settings → Sources** as above, then run the agent with `npm start -- run`
(see [Command line](docs/cli.md)). To run the app's Docker image against your own database, use
`compose.yaml`; for Kubernetes, the Helm chart. Both are in [Deploying](docs/deploying.md).

## The parts

| Part | What it does | Needed? | Without it | Settings |
|---|---|---|---|---|
| **The app** | Two processes: the agent run (on a schedule in Docker, or `npm start -- run`) and the web UI, where you sign in, browse jobs and change settings | Yes | | `MYJOBBOT_BASE_URL`, `MYJOBBOT_HOSTS`, `MYJOBBOT_PORT`; behind a proxy, `MYJOBBOT_TRUSTED_PROXIES` ([why it matters](docs/deploying.md#proxies-and-the-sign-in-limits)) |
| **MariaDB** | Jobs, companies, scores and their history, your sources, settings, resume and accounts | Yes, 10.11 or later | | `MYJOBBOT_DB_*`; tables are made on first start ([Database structure](docs/database.md)) |
| **LLM** | Scores each job, and picks careers pages in the lookup | Yes | | `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` |
| **Playwright browser** | Renders careers pages that are built by JavaScript | No | Such pages read as empty | `MYJOBBOT_BROWSER_URL`; exactly version 1.64.1 ([setup](docs/deploying.md#the-browser-service)) |
| **SearXNG** | Web search for the careers lookup and for companies' websites | No | No careers lookup or company search | `MYJOBBOT_SEARXNG_URL`; must answer JSON ([setup](docs/deploying.md#searxng)) |
| **Email in: Gmail** | Reads your LinkedIn job-alert emails, read-only over IMAP | No | No "Gmail alerts" source | Connected on Settings with an app password, sealed by `MYJOBBOT_SECRET_KEY` ([Gmail alerts](docs/sources.md#gmail-alerts)) |
| **Email out: account mail** | Sends sign-in links, password resets and security notices over SMTP | No | No "Email me a link", no "Forgot password", no notices | `MYJOBBOT_SMTP_*`, `MYJOBBOT_MAIL_FROM` ([Account settings](docs/deploying.md#account-settings)) |
| **JSearch** | An API over Google for Jobs (LinkedIn, Indeed and more) for saved searches | No | No saved searches; alert jobs get no JSearch description | `JSEARCH_API_KEY` ([JSearch](docs/sources.md#jsearch)) |
| **`data/` folder** | Runtime settings (`config.json`), a fallback `resume.md` (user 1's only), run traces and logs | Yes | | `MYJOBBOT_DATA_DIR`, `MYJOBBOT_LOG_DIR`. The Docker containers won't start without `data/config.json` and `data/resume.md` (any file will do once a resume is uploaded); with `npm`, `resume.md` is optional once a resume is uploaded |

**The LLM** is reached through the OpenAI chat-completions API with tool calling, so it must be a
server that speaks that API. It is tested with llama.cpp's `llama-server`, started with `--jinja`
and a tool-calling model (`.env.example` names `qwen3-coder-30b`). Every request also sends
llama.cpp's sampling fields `top_k` and `repeat_penalty`; OpenAI's own hosted API rejects fields it
doesn't know, so it won't work as is, and other servers may ignore or refuse them.

**How they fit together.** Each run first fetches every source that is on, in plain code. Alert
jobs with no description are looked up on the employer's careers page (SearXNG to search, the
browser to render). Then the LLM scores each new job against your resume and preferences, through
a few tools the code controls; it never touches the internet or the database itself. The web UI
shows the results. [How it works](docs/how-it-works.md) has the whole story.

## Job sources

Add sources on **Settings → Sources**, by pasting a jobs page link or picking a module and filling
in its form.

| Source | Reads | Fetched |
|---|---|---|
| Greenhouse, Lever, Ashby, Gem | A company's whole job board | Every run |
| Workday | A company's Workday jobs site | Every run, at most 100 postings, continuing where the last run stopped |
| JSearch | A saved search of Google for Jobs | At most once per `jsearch.refresh_hours`, within the monthly budget |
| Gmail alerts | Your LinkedIn job-alert emails | Every run, once Gmail is connected |

### JSearch's limits

- **It needs an API key**, `JSEARCH_API_KEY` (a free key at openwebninja.com).
- **It has a monthly budget.** The free tier allows 200 requests a month;
  `jsearch.monthly_request_cap` (default 190) stops before that. Each saved search costs one request
  per refresh, and Gmail alert descriptions are looked up only from what's left.
- **Results are only as fresh as the refresh.** Each search calls JSearch at most once per
  `jsearch.refresh_hours` (default 24), for postings from the last `jsearch.date_posted` (default
  3 days).
- **Aggregators get through.** Results include job boards that repost other companies' jobs, so
  `jsearch.exclude_publishers` drops a board by name or by its links' domain.

All of it is in [Job sources](docs/sources.md).

## How scoring works

A job's score is decided in four stages; only the third involves the model.

1. **Filters decide what the model sees.** Excluded companies, the title filter and the body filter
   (terms in the description) are checked in code; a filtered job is stored but never scored.
2. **The model reads what looks promising.** It sees each job's title, company and location, and
   reads the description of those that could fit before scoring them.
3. **The model scores with a rubric, in two parts**: a base of 0–50 for fit with your resume
   (stack, level, kind of work) and a bonus of 0–50 for fit with your preferences (location, role,
   anything else you ask for). The score is their sum.
4. **Boosts adjust what's shown.** Terms you list add points when found in a job's title or
   description, at display time only. Recommended shows jobs whose boosted score reaches
   `match_threshold` (default 70).

Every scoring decision is kept, so re-scoring a job never loses what the model said before. Scores
come from a sampling model and vary a little between runs: treat a score as a sort order, not a
verdict. The rubric table and the details are in
[How it works](docs/how-it-works.md#how-scoring-works).

## Further reading

- [How it works](docs/how-it-works.md): the agent and its tools, scoring, the web UI, accounts,
  every setting, the careers lookup and company records.
- [Command line](docs/cli.md): runs, re-scores, accounts, and the scoring evals.
- [Job sources](docs/sources.md): each source, JSearch's budget, and Gmail alerts.
- [Database structure](docs/database.md): setting up MariaDB, the tables, and useful queries.
- [Deploying](docs/deploying.md): the full stack, Docker Compose, sign-in settings, proxies, the
  browser and search services, and Kubernetes.
- [Monitoring](docs/monitoring.md): what each run records, the Monitoring page, every metric
  served to Prometheus, and the alerts.
- [Developing](docs/developing.md): checks, tests, copying production, and where the code is.
- [The React walkthrough](docs/react-walkthrough.md): learning React and Next.js from this code.
- The design: `docs/superpowers/specs/2026-10-03-myjobbot-design.md`; each feature's spec is in
  `docs/specs/`.

Still to come: a step-by-step trace of how each job was categorized, an email digest, and Glassdoor
ratings.

## License
myjobbot is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License, version 3 only (`GPL-3.0-only`), as published by the Free Software
Foundation. It is distributed WITHOUT ANY WARRANTY. See [LICENSE](LICENSE) for the full text.
