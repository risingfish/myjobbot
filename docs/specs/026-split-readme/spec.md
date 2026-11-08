# Feature Specification: Split the README

**Feature Branch**: `026-split-readme`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "The README has grown to enormous dimensions, lets break it up. We'll move a lot of the fine detail into their own files. README: 1. Summary: what it does. 2. Quickstart: at least two ways to start: a full docker compose stack that can spin right up, and starting the app by itself if the other components are hosted elsewhere. 3. The parts: the app and its database, the LLM interface (currently only OpenAI-based APIs are supported), Playwright, SearXNG, Email, are there other parts I am missing? 4. Available job posting sources: JSearch and its limitations, Greenhouse, Ashby, Lever, etc. 5. High level overview of how scoring works. Sub pages: 1. How it works + UI, 2. CLI (eval), 3. Sources, 4. Database structure, 5. Developing."

## Background

`README.md` is 1,281 lines (at `693a827`, after features 024 and 025 merged). It mixes a first-time reader's questions (what is this, how do I start it,
what do I need) with reference detail (every config knob, the job row's columns, the agent loop's
diagrams, eval commands, copying production). A newcomer has to scroll past 600 lines of setup detail
before learning how the pieces fit, and the quickstart they need is spread over Setup, Storage, Run,
Web UI and Deploy with Docker.

### Parts the owner listed, and the ones missing from that list

The owner listed: the app and its database, the LLM interface, Playwright, SearXNG, Email. The
current README and `compose.yaml` show these others, which the Parts section must also name:

- **The scheduled agent run**: the `myjobbot` container runs the agent on `SCHEDULE` in `TZ`; the
  web UI is a separate service. A reader needs to know there are two processes.
- **JSearch (RapidAPI)**: an outside paid/free-tier API with its own key and monthly budget; it is a
  part as well as a source.
- **The `data/` folder**: runtime settings (`config.json`), the fallback resume, run traces and logs.
- **The server key** (`MYJOBBOT_SECRET_KEY`), which seals the Gmail app password.
- **The browser network's isolation** (the `browser` Docker network and the optional LAN-blocking
  rule), which belongs with Playwright.
- **Kubernetes (Helm chart)**, a deployment option rather than a part, but it needs a home.
- **Accounts (feature 024)**: every page needs a sign-in. Starting the app now needs
  `MYJOBBOT_BASE_URL` (the web container refuses to start without it), a first admin made with
  `npm start -- account init <email>`, and, behind proxies, `MYJOBBOT_TRUSTED_PROXIES`
  (`web.trustedProxies` in the chart) for the per-address sign-in limits.

"Email" covers two parts: reading LinkedIn alert emails from Gmail over IMAP (an input), and
**account mail** over SMTP (`MYJOBBOT_SMTP_*`, `MYJOBBOT_MAIL_FROM`; sign-in links, password resets,
security notices), optional. The email digest is not built (`emailed_at` is reserved).

## Clarifications

### Session 2026-11-07

- Q: compose has no database service and SearXNG and the browser sit behind profiles; what does the
  full-stack quickstart use? → A: A separate full-stack compose file (e.g. `compose.full.yaml`) with
  MariaDB, SearXNG and the browser alongside the app; `compose.yaml` stays as it is.
- Q: Where do Kubernetes (Helm) and Docker operations go? → A: A sixth sub page, Deploying.
- Owner input: the proxy setting needs fuller documentation. The owner supplied the text
  ("Proxies and the sign-in limits", a fuller `values.yaml` comment for `web.trustedProxies`, and why
  it matters: too high lets a password guesser forge a new address each try and dodge the
  per-address limit; too low makes everyone behind a proxy share one limit, so one person failing
  20 sign-ins in 15 minutes locks everyone out; the chart's default of 1 is only a guess; the
  Sign-ins list is a cheap check). See FR-015.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A newcomer understands and starts myjobbot from the README alone (Priority: P1)

Someone who has never seen the project opens the README. Within one screen they learn what it does;
in the Quickstart they pick the path that matches what they have (nothing, or an existing database,
LLM and search service) and follow it to a running web UI with a first source added.

**Why this priority**: This is the reason for the change. The README's job is to orient and start;
everything else is reference.

**Independent Test**: Give the new README alone to a reader who hasn't used the project; they can say
what it does, which parts they need, and follow one quickstart path to the Settings page without
opening a sub page.

**Acceptance Scenarios**:

1. **Given** the new README, **When** a reader reads only its first section, **Then** they know
   what myjobbot does (fetches postings from sources, scores them against a resume with an LLM,
   shows them in a web UI) in no more than about 10 lines.
2. **Given** a machine with Docker and an OpenAI-compatible LLM endpoint, **When** the reader follows
   the full-stack quickstart, **Then** the stack starts and the web UI opens, with each command shown
   in order.
3. **Given** a database, LLM, SearXNG and browser service hosted elsewhere, **When** the reader
   follows the app-only quickstart, **Then** they know which `.env` settings point at each one and
   which parts are optional.
4. **Given** the Parts section, **When** a reader checks what they must provide, **Then** each part
   says whether it is required or optional, what it does for myjobbot, and which setting points at it.

---

### User Story 2 - A reader finds the detail they need in one sub page (Priority: P2)

A user who wants to know how the job panel works, what a config knob does, how a source is fetched,
what a column means, or how to run evals goes from the README to the one sub page that holds it.

**Why this priority**: Moving the detail out must not lose it; every fact in today's README has to
stay findable.

**Independent Test**: Pick any fact from today's README (e.g. "`careers_lookup.render_seconds`
defaults to 15", "Clicking the check asks 'Mark as not applied?'", "`eval report --against
observed`"); it appears in exactly one sub page reached by a link from the README.

**Acceptance Scenarios**:

1. **Given** every section of today's README, **When** the split is done, **Then** each section's
   content lives in the README or exactly one sub page, unless it is out of date (then corrected) or
   a duplicate (then kept once and linked).
2. **Given** a link in the README or a sub page to another section, **When** a reader follows it,
   **Then** it lands on the right heading (no broken anchors).

---

### User Story 3 - Contributors and Claude find the developer detail (Priority: P3)

A contributor (or a Claude session) looks for how to run checks, the test database rules, copying
production, the real-browser test, CI and the Docker image's development mode, and finds them in the
Developing page; the project instructions point at the new places.

**Why this priority**: The project's own instructions (`CLAUDE.md`) cite README sections by name;
they must keep pointing somewhere real.

**Independent Test**: Every README reference in `CLAUDE.md` and the constitution resolves to an
existing page and heading.

**Acceptance Scenarios**:

1. **Given** `CLAUDE.md`'s references to README "Evals" and "Develop", **When** the split is done,
   **Then** they name the sub page that now holds that content.

---

### Edge Cases

- A fact today repeated in two README sections (e.g. the JSearch budget in Sources, Gmail and Saved
  searches; the Docker browser network in Careers lookup and Deploy with Docker): kept once, the
  other place links to it.
- Content that is out of date (e.g. the Roadmap's "Built so far" list, the claim that the LLM must be
  llama.cpp started with `--jinja`, the tab count, the five tools table): checked against the code
  and corrected, not copied as is.
- Historical specs in `docs/specs/` link to old README anchors: left alone (they are records of
  their time).
- The existing `docs/react-walkthrough.md` stays where it is and is linked from the How it works + UI
  page.
- GitHub renders Mermaid diagrams in any Markdown file; diagrams move with their text.

## Requirements *(mandatory)*

### Functional Requirements

**README**

- **FR-001**: The README MUST open with a summary of what myjobbot does, then have, in this order:
  Quickstart, The parts, Job sources, How scoring works (overview), Further reading (links to every
  sub page), License.
- **FR-002**: The Quickstart MUST give at least two complete paths: (a) the full Docker Compose
  stack, and (b) the app alone (agent and web UI, from a checkout or the image) with the other parts
  hosted elsewhere. Each path MUST set `MYJOBBOT_BASE_URL`, make the first admin
  (`account init`), sign in, and end at adding a first source on the Settings page.
- **FR-003**: The full-stack path MUST bring up everything the app needs except the LLM with
  commands copied from the README, using a separate full-stack compose file (e.g.
  `compose.full.yaml`) that runs the agent, the web UI, MariaDB (with its databases created on first
  start and its data in a named volume), SearXNG and the browser. `compose.yaml` MUST stay
  unchanged. Images in the new file MUST be pinned to exact versions, and its secrets (database
  passwords, `SEARXNG_SECRET`, `MYJOBBOT_SECRET_KEY`) MUST come from `.env`, never be written in the
  file. The database MUST NOT publish a port by default.
- **FR-004**: The Parts section MUST cover each part: the app (agent run on a schedule, and the web
  UI), its MariaDB database, the LLM interface (OpenAI-compatible chat completions with tool calling;
  the only kind supported), Playwright (browser service, its pinned version, its isolated network),
  SearXNG, Email in (Gmail alert reading, with the app password and server key), account mail out
  (SMTP, optional), JSearch, and the `data/` folder. The app's row names its sign-in settings
  (`MYJOBBOT_BASE_URL`, `MYJOBBOT_TRUSTED_PROXIES`). For each: what it does, required or optional, what is lost without it, and the settings
  that point at it.
- **FR-005**: The Job sources section MUST list every module that exists (Greenhouse, Lever, Ashby,
  Gem, Workday, JSearch, Gmail alerts) with one line each on what it reads and how often, and
  JSearch's limitations (monthly request budget, refresh interval, the API key, results from
  aggregators and `exclude_publishers`), linking to the Sources page for the rest.
- **FR-006**: The scoring overview MUST state the four stages (filters, the model reads promising
  jobs, the two-part rubric, boosts at display time) and that every verdict is kept, in no more than
  about 25 lines, linking to the How it works page for the rubric table and details.
- **FR-007**: The README MUST be no more than 250 lines.

**Sub pages** (in `docs/`)

- **FR-008**: There MUST be six sub pages, each linked from the README:
  1. **How it works + UI**: the big idea and data markers, one run start to finish, the loop, a tool
     call, the tools, the plain-code layers, context compaction, full scoring detail, design lessons,
     traces and logs, the web UI (tabs, Hide, Applied, the job panel, Re-score, Resume section, which
     hosts may connect), accounts and signing in (ways, new accounts, limits, security in brief),
     the Settings page and every configuration knob (search and runtime
     settings), the careers lookup and company records.
  2. **CLI**: every `npm start --` command (`run`, `rescore`, `account init|reset`, `import-sqlite`,
     `eval …`), with the
     evals, prompt variants and series in full.
  3. **Sources**: what a module and a saved source are, the module table, adding a source, test on
     save, each module's specifics, JSearch saved searches and budget, Gmail alerts and their one-time
     setup (how each source's descriptions are stored is in Database structure, linked).
  4. **Database structure**: storage setup, the tables and their columns (the diagram), descriptions'
     storage format, fishing-post detection and pruning, the audit queries, the SQLite import.
  5. **Developing**: checks, tests and the test database, copying production, the real-browser test,
     CI, Docker development mode (mounts, watch, rebuilds), `tests/docker.sh`.
  6. **Deploying**: Docker operations (schedule and time zone, the task table, updating after a pull,
     uid, `extra_hosts`, the browser network's LAN-blocking rule), the full-stack compose file in
     detail, account settings for a deployment (base URL, mail), "Proxies and the sign-in limits"
     (FR-015), and Kubernetes (image tags, the Helm chart, its values, the first admin).
- **FR-009**: Every fact in today's README MUST end up in the README or exactly one sub page, except
  facts found out of date, which are corrected against the code.
- **FR-010**: Each sub page MUST start with one sentence on what it covers and a link back to the
  README.
- **FR-011**: Every internal link (README to sub page, sub page to sub page, anchors) MUST resolve.

**Elsewhere**

- **FR-012**: `CLAUDE.md`'s README references (Evals, Develop) MUST point at the new pages; the
  constitution needs no change unless it names README sections.
- **FR-013**: No change to the app's code, settings or behaviour. The only non-documentation
  changes are the new full-stack compose file, the `.env.example` entries it needs, and the
  `web.trustedProxies` comment in `deploy/helm/myjobbot/values.yaml` (FR-015).
- **FR-014**: The full-stack compose file MUST pass `docker compose -f <file> config --quiet`, and
  bringing it up from a fresh clone with `.env` filled from `.env.example` MUST serve the sign-in
  page, record every migration step in the database, and let `account init` make the first admin,
  who can then sign in.
- **FR-015**: The Deploying page MUST hold "Proxies and the sign-in limits" with the owner's text
  (kept verbatim in [owner-proxy-text.md](owner-proxy-text.md)):
  the limits count clients by the address read from `X-Forwarded-For`, taken `web.trustedProxies`
  (`MYJOBBOT_TRUSTED_PROXIES` outside the chart) places from the right; the chart's default (1 with
  the ingress, 0 without); how to count (every proxy that appends, the ingress included; Cloudflare
  or an HTTP-mode load balancer adds one; a TCP pass-through such as MetalLB adds none); what too
  high and too low do and why each matters (forged addresses dodge the per-address limit, which is
  the defence against one client trying many accounts, while the per-email limit protects one
  account at a time; shared limits lock everyone out after 20 failures in 15 minutes); that the
  default is a guess; and the check (the Account tab's Sign-ins list shows your real public IP). It
  MUST also say what the check can't show, as the code behaves: with a count too high, or 0, the
  list shows the leftmost entry, which is your real address unless the client forged one, so a
  correct-looking list proves only that the count isn't too low (when it is 1 or more). The same
  counting rule MUST be given for `compose.yaml` and `compose.full.yaml` (0 when nothing sits in
  front: every client then shares one limit). `values.yaml`'s comment on `web.trustedProxies` MUST
  be replaced with the owner's fuller comment.

### Key Entities

- **README**: the entry page; orients and starts.
- **Sub page**: one Markdown file in `docs/` holding one area's reference detail.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The README is at most 250 lines (today 1,281).
- **SC-002**: A reader reaches the first quickstart command within the first 40 lines of the README.
- **SC-003**: 100% of today's README has a home: the content map's 48 rows (every heading, and the
  blocks inside the large sections) each name a new page and heading, and each is found there.
- **SC-004**: 0 broken internal links or anchors across the README and the sub pages.
- **SC-005**: A sample of 20 facts picked from today's README is each found in exactly one place by
  one text search, recorded with the search used and the page and heading it found.

## Assumptions

- Sub pages live in `docs/` as `docs/how-it-works.md`, `docs/cli.md`, `docs/sources.md`,
  `docs/database.md`, `docs/developing.md` and `docs/deploying.md`; the design doc and `docs/react-walkthrough.md` stay
  where they are.
- The LLM part is described as an OpenAI-compatible chat-completions server with tool calling that
  accepts llama.cpp's sampling fields (`top_k`, `repeat_penalty`), tested with llama.cpp; OpenAI's
  hosted API rejects those fields (research R1).
- Email has two parts: Gmail alert reading (in) and account mail over SMTP (out, optional). The
  unbuilt email digest stays under "Still to come".
- The Roadmap is trimmed to "Still to come" in the README's Further reading, with a link to
  `docs/specs/` for what is built (features through 025).
- No app code changes, so no new tests: 0 unit, 0 integration, 0 UI. Link checking is a one-off
  script during the work; the full-stack file is checked with `docker compose config --quiet` and one
  bring-up from a fresh clone (a manual check, recorded in the sitting).
- The full-stack file's MariaDB is for trying myjobbot out and single-host use; production keeps
  its own database server. The MariaDB image version is chosen at plan time (10.11 or later, per
  Storage).
- The Docker stack running the main checkout can stay up for the docs work; the fresh-clone
  bring-up uses its own project name and port so it doesn't collide with it.
