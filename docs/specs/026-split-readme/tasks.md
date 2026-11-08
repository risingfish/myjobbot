---

description: "Task list for 026: split the README"
---

# Tasks: Split the README

**Input**: Design documents from `docs/specs/026-split-readme/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md) (the content map, rows #1–#48), [contracts/](contracts/),
[quickstart.md](quickstart.md)

**Tests**: None. The feature changes no code in `src/`, `web/` or `tests/`; validation is
[quickstart.md](quickstart.md). New tests: 0 unit, 0 integration, 0 UI (ledger below).

**Source text**: "today's README" means `git show 693a827:README.md` (1,281 lines, features 024 and
025 included), line numbers as in [data-model.md](data-model.md). Always read it from that commit,
not the working copy.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Sittings (myjobbot project rule, constitution Principle I and Development Workflow)

Four sittings, all in this checkout (`myjobbot_alt`) on `026-split-readme`. **Stack: may run in every
sitting**: no sitting touches `src/` or `web/`, and the full-stack bring-up (S3) uses its own project
name and port. Each sitting starts by creating `.specify/sitting-in-progress` (naming the sitting) and
ends with `npm run check` green, then deletes the marker. `npm run check:db` is not run in this
feature: it is documentation only (owner decision, 2026-11-07; see the plan's Constitution Check). Commit only at a sitting's end, and only
when the owner asks.

Rules for every task that writes a page:

- **Move, don't paraphrase.** Copy the block's text from today's README, keeping its wording,
  tables, code blocks and Mermaid diagrams. Change only: heading levels, links (retarget to the new
  page and heading), and the corrections in [research.md](research.md) R6, R6a.
- **One home per fact.** Where today's README repeats a fact, write it in the page the content map
  names first and link to it elsewhere ([data-model.md](data-model.md), "Rules for the move").
- **Page header** (FR-010): line 1 `# <Title>`, then a one-sentence summary of what the page covers,
  then `[← README](../README.md)`.
- **Links between pages** are relative (`sources.md#jsearch`, `../README.md#the-parts`); anchors are
  GitHub heading slugs.
- **Never print `.env`**; `docker compose config` only with `--quiet`.

---

## Phase 1: Setup

**Purpose**: The one-off checking tools, kept out of the repository.

### Sitting S1: How it works and Database pages (stack: may run)

- [X] T001 Create `.specify/sitting-in-progress` containing `026 S1`.
- [X] T002 Write a one-off link checker in the session scratchpad (`<scratchpad>/check-links.mjs`, not committed, research R7): for `README.md` and every `docs/*.md` directly in `docs/` (not `docs/specs/`, not `docs/superpowers/`), list each Markdown link `[text](target)`; skip `http(s):` and `mailto:` targets; for a relative target, check the file exists (relative to the linking file); for a `#anchor` (alone or after a file), check it equals a heading slug in the target file by GitHub's rules (strip leading `#`s and whitespace, lower-case, drop every character that is not a letter, digit, space, `-` or `_`, spaces → `-`, a repeated slug gets `-1`, `-2`…) or an `<a id="…">` in that file; print each broken link with file and line, then `N broken`. Run it on `git show 693a827:README.md` (saved to the scratchpad) to confirm it works (expected: 0 broken).

---

## Phase 2: Foundational (the six pages)

**Purpose**: Every block of today's README gets its new home before the README is cut. Blocks the
README rewrite (US1, T021).

**⚠️ CRITICAL**: Do not edit `README.md` in this phase.

- [X] T003 [P] Write `docs/how-it-works.md` (title "How it works"). Sections, in order, from the content map rows named: "The big idea" (#31, with data markers); "One run, start to finish" (#32); "The loop" (#33); "A tool call, up close" (#34); "The five tools" (#35, with the fetch phase paragraph and paging diagram); "The plain-code layers" (#36, with the title filter rules); "Context compaction" (#40); "How scoring works" (#41, all four stages, the rubric table, "Every verdict is kept", "What to expect from the model"); "Design lessons built into it" (#42); "Traces and logs" (#6's file table and `MYJOBBOT_LOG_DIR`, and #45's trace bullet); "The web UI" (#8 tab table, then #9 as subsections "Hide", "Applied", "Job details", "Re-score", "Scores, titles and paging", and #10 "Which hosts may connect"; replace `<a id="re-score">` with the "Re-score" heading); "Accounts and signing in" (#12 and #15: which pages need a sign-in, shared data until data is per user, new accounts, the ways table, recovery codes, "Forgot password", the email and address limits, "Confirm it's you", the Sign-ins list and recent events, "Security in brief"; for the first admin link `cli.md#account`, for settings link `deploying.md#account-settings` and `deploying.md#proxies-and-the-sign-in-limits`); "Resume and profile" (#16); "Settings" (#43: the two places, the Settings page's sections, fallbacks, both tables "Search settings (stored in the database)" and "Runtime settings (`data/config.json`)"); "Careers lookup" (#19: which jobs, how, trimming, results, how a page is read; for the browser service and SearXNG write one line each linking `deploying.md#the-browser-service` and `deploying.md#searxng`; #22's audit log as one paragraph linking `database.md#useful-queries`); "Company records" (#23, queries replaced by a link to `database.md#useful-queries`). Link `sources.md` wherever today's text links `#sources`, `#gmail` or `#saved-searches-jsearch`; link `cli.md#evals` for `#evals`; link `database.md#how-descriptions-are-stored` for that anchor.
- [X] T004 [P] Write `docs/database.md` (title "Database structure"). Sections: "Setting up the database" (#3 and #4: MariaDB 10.11 or later, `utf8mb4`, a database and a user with rights on it, the `MYJOBBOT_DB_*` settings, tables made on first start by numbered steps in `src/db/migrations/`, `utf8mb4_bin`, backups; per R6, say "one database, any name" and leave the test database to `developing.md`); "Tables" (#37: the ER diagram unchanged, then its following paragraph about which sources fill descriptions, requirements and skills, and the `verdicts` table, linking `how-it-works.md#how-scoring-works`; add one line that the accounts tables (users' sign-in fields, `sign_in_methods`, sessions, tokens, keys, `security_events`) are described in `how-it-works.md#accounts-and-signing-in`, naming only tables that exist in `src/db/schema/`); "How descriptions are stored" (#38, whole, including the per-source table); "Ghost postings and pruning" (#39); "Useful queries" (the SQL blocks from #22 and #23, each under a one-line caption: careers lookup audit, company records); "Coming from SQLite" (#5).
- [X] T005 Run the link checker (T002) on `docs/how-it-works.md` and `docs/database.md`; links into pages not yet written (`cli.md`, `sources.md`, `developing.md`, `deploying.md`, `../README.md` anchors) are expected to fail now and are listed in the sitting notes to recheck in T029. Fix any other broken link.
- [X] T006 Run `npm run check`; when green, delete `.specify/sitting-in-progress`. End of S1.

### Sitting S2: CLI, Sources, Developing and Deploying pages (stack: may run)

- [X] T007 Create `.specify/sitting-in-progress` containing `026 S2`.
- [X] T008 [P] Write `docs/cli.md` (title "Command line"). Intro: commands run as `npm start -- <command>` from a checkout with `.env`, or `docker compose run --rm myjobbot <command>` in Docker. Sections: "run" (#6 command and run id paragraph; link `how-it-works.md#traces-and-logs` for the files); "rescore" (#7 whole, linking `how-it-works.md#re-score`); "account" (#13: `account init <email>` and `account reset <email>`, the hidden password prompt, the password rules; in Docker `docker compose exec web npm start -- account init <email>`, in Kubernetes `kubectl exec -it deploy/myjobbot-web -- npm start -- account init <email>`); "import-sqlite" (one line, linking `database.md#coming-from-sqlite`); "Evals" (#25 whole); "Prompt variants and series" (#26 whole); "Other commands" (`npm run web`, `npm run web:build && npm run web:start`, `npm run check`, `npm run check:db` with a link to `developing.md`, `scripts/copy-prod.sh` with a link to `developing.md#copying-production`).
- [X] T009 [P] Write `docs/sources.md` (title "Job sources"). Sections: "Modules and saved sources" (#17's first paragraph and the module table); "Adding a source" (#17); "Test on save" (#17); "The source list" (#17's row and Gmail-alerts paragraph); "How sources are fetched" (two or three sentences: before the agent, boards then Gmail alerts then due searches, linking `how-it-works.md#the-five-tools` for the fetch phase detail); "JSearch" (#44 whole: Google for Jobs, duplicates, `exclude_publishers` and domains, the budget, refresh, retries; this is the one home of the budget rules, so #17's and #18's mentions link here); "Gmail alerts" (#18 whole: how runs use the alerts, one-time setup, connect, Check now, Disconnect, senders, access notes; its careers-page bullet links `how-it-works.md#careers-lookup`); "Descriptions" (one line linking `database.md#how-descriptions-are-stored`).
- [X] T010 [P] Write `docs/developing.md` (title "Developing"). Sections: "Checks" (#24's two commands and the CI paragraph); "Tests and the test database" (#24: in-memory stores, the store contract, `MYJOBBOT_TEST_DB_*` rules); "Copying production" (#24 whole: the script, the account tables it leaves empty, the read-only login SQL, rights, clients, the secret key note); "The real-browser test" (#24's last block); "Docker development mode" (#28: source mounts, `next dev`, `MYJOBBOT_HOSTS`, the writable `web/` mount, dependencies baked into the image, `npm run docker:watch` and its two limits); "`tests/docker.sh`" (#29's paragraph); "Where the code is" (#11's "How it's built" bullets, with the `react-walkthrough.md` link, plus #45's bullets on the tests and `src/agent/prompt.ts`).
- [X] T011 [P] Write `docs/deploying.md` (title "Deploying"). Sections, in order:
  - "Choosing a setup" (three lines: `compose.full.yaml` runs everything but the LLM; `compose.yaml` runs the app against your own database; Kubernetes).
  - "The full stack (`compose.full.yaml`)" (a placeholder line "Filled in sitting S3." replaced by T019).
  - "Docker Compose (`compose.yaml`)" (#27: setup commands, adding `MYJOBBOT_BASE_URL` to the `.env` step and, after `up`, the first admin with `docker compose exec web npm start -- account init you@example.com` (R6a); the schedule and time zone; "Both containers reach the database over the network, so there is no database container" kept and scoped to this file per R6; the task table; uid 1000; `extra_hosts`; the "Update after `git pull`" and watch rows link `developing.md#docker-development-mode`).
  - "Account settings" (#14 except trusted proxies: `MYJOBBOT_BASE_URL` (one of `MYJOBBOT_HOSTS`, `https://` unless localhost, why), account mail (all five or none, ports, `MYJOBBOT_MAIL_FROM`, what is lost without it), `MYJOBBOT_SECRET_KEY` also sealing authenticator secrets).
  - "Proxies and the sign-in limits" (#48, spec FR-015): the owner's paragraph from [owner-proxy-text.md](owner-proxy-text.md), word for word (its bold lead-in becomes the section heading); then "Why the count matters" with the owner's four points from the same file, word for word; then the one-sentence caveat that file describes (research R6b); then "Outside Kubernetes": the same rule for `MYJOBBOT_TRUSTED_PROXIES` (0–10, default 0) with either compose file: 0 when browsers reach the web service directly (every client then shares one limit), else one per appending reverse proxy in front.
  - "The browser service" (#20 whole: the bundled service, Playwright 1.64.1 pinned with `playwright-core`, its own network `172.31.250.0/24`, the `iptables` rule, `careers_lookup.lan_probe_url`; plus #29's sentence that both services join the `browser` network).
  - "SearXNG" (#21 whole: own server or bundled, `SEARXNG_SECRET`, JSON format required, 403 otherwise).
  - "Kubernetes" (#30 whole, its trusted-proxies sentence linking "Proxies and the sign-in limits").
  - Per R5, wherever a setup copies `examples/resume.md`, say the container start requires `data/resume.md` even when a resume is uploaded.
- [X] T012 [P] In `deploy/helm/myjobbot/values.yaml`, replace the two comment lines above `trustedProxies: ""` (under `web:`) with the owner's comment from [owner-proxy-text.md](owner-proxy-text.md), verbatim, at the same indentation. Change nothing else. If `helm` is installed, `helm template t deploy/helm/myjobbot >/dev/null` must still succeed.
- [X] T013 Run the link checker on the four new pages and recheck `docs/how-it-works.md` and `docs/database.md`; only links to `../README.md` anchors (and `deploying.md#the-full-stack-composefullyaml` if referenced) may still fail; record them for T029.
- [X] T014 Run `npm run check`; when green, delete `.specify/sitting-in-progress`. End of S2.

**Checkpoint**: Every content-map row except README-only rows (#1, #2, #46, #47 and the short README
parts) has a home in `docs/`. `README.md` is still unchanged.

---

## Phase 3: User Story 1 - A newcomer understands and starts myjobbot from the README alone (Priority: P1) 🎯 MVP

**Goal**: The new README (≤ 250 lines) and a full stack that comes up from a fresh clone.

**Independent Test**: [quickstart.md](quickstart.md) §1, §5 and §7: the README's shape, the
corrections, `config --quiet` and the fresh-clone bring-up.

### Sitting S3: Full stack and the new README (stack: may run)

- [X] T015 Create `.specify/sitting-in-progress` containing `026 S3`.
- [X] T016 [US1] Pick the MariaDB image tag: `docker pull mariadb:11.8`, then read the exact version (`docker image inspect mariadb:11.8 --format '{{index .Config.Labels "org.opencontainers.image.version"}}'`, or the image's `MARIADB_VERSION` env) and confirm `docker pull mariadb:<that 11.8.N>` works. Record the tag in the sitting notes. (Constitution IV: the owner approves this image; if not yet approved, ask before T017.)
- [X] T017 [US1] Write `compose.full.yaml` exactly as [contracts/compose-full.md](contracts/compose-full.md): services `myjobbot` (`build: .`, `image: myjobbot:latest`, `restart: unless-stopped`, default command), `web` (same image, `command: ["serve"]`, `MYJOBBOT_WEB_MODE: production`, `ports: "${MYJOBBOT_PORT:-8080}:${MYJOBBOT_PORT:-8080}"`), both with `env_file: .env`, `environment` `MYJOBBOT_DATA_DIR: /data`, `MYJOBBOT_LOG_DIR: /data/log`, `MYJOBBOT_DB_HOST: mariadb`, `MYJOBBOT_DB_PORT: "3306"`, `MYJOBBOT_SEARXNG_URL: http://searxng:8080`, `MYJOBBOT_BROWSER_URL: ws://browser:3000/`, `volumes: ./data:/data`, `networks: [default, browser]`, `depends_on: mariadb: condition: service_healthy`; `mariadb` (`image: mariadb:<T016 tag>`, `restart: unless-stopped`, `command: ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_general_ci"]`, `environment` `MARIADB_DATABASE: ${MYJOBBOT_DB_NAME:?set MYJOBBOT_DB_NAME in .env}`, `MARIADB_USER: ${MYJOBBOT_DB_USER:?set MYJOBBOT_DB_USER in .env}`, `MARIADB_PASSWORD: ${MYJOBBOT_DB_PASSWORD:?set MYJOBBOT_DB_PASSWORD in .env}`, `MARIADB_RANDOM_ROOT_PASSWORD: "1"`, `volumes: mariadb-data:/var/lib/mysql`, `healthcheck` test `["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]` with `interval: 5s`, `timeout: 5s`, `retries: 20`, `start_period: 30s`, no `ports`); `searxng` and `browser` copied from `compose.yaml` without `profiles`, with `SEARXNG_SECRET: ${SEARXNG_SECRET:?set SEARXNG_SECRET in .env}`; `networks.browser` with the same subnet `172.31.250.0/24`; `volumes: mariadb-data: {}`. `MYJOBBOT_BASE_URL`, `MYJOBBOT_HOSTS` and `MYJOBBOT_TRUSTED_PROXIES` come from `.env`, not the file. No source mounts, no `develop` block, no secret values.
- [X] T018 [US1] Add to `.env.example`, after the MariaDB block, a commented block "Full stack (compose.full.yaml) only" (research R4): it needs `LLM_*`, `MYJOBBOT_HOSTS`, `MYJOBBOT_BASE_URL` (`http://localhost:8080` for a first look), `MYJOBBOT_DB_NAME`/`_USER`/`_PASSWORD` (the database and user it creates, any values), `SEARXNG_SECRET`, and optionally `MYJOBBOT_SECRET_KEY`, `MYJOBBOT_TRUSTED_PROXIES`, the account mail settings and `JSEARCH_API_KEY`; it sets `MYJOBBOT_DB_HOST`/`_PORT`, `MYJOBBOT_SEARXNG_URL` and `MYJOBBOT_BROWSER_URL` itself. Change "(README, Develop)" in the `MYJOBBOT_TEST_BROWSER_URL` comment to "(docs/developing.md)". Add no new variable names.
- [X] T019 [US1] Replace the placeholder in `docs/deploying.md`'s "The full stack (`compose.full.yaml`)" section: what it runs (the five services), what `.env` needs (as T018), the start command, the first admin (`docker compose -f compose.full.yaml exec web npm start -- account init you@example.com`), signing in at `MYJOBBOT_BASE_URL`, that the database lives in the `mariadb-data` volume (`down` keeps it, `down -v` deletes it) and has no published port, that it runs the image's own code (rebuild with `up -d --build` after `git pull`), `MYJOBBOT_TRUSTED_PROXIES` linking "Proxies and the sign-in limits", and that it is for trying myjobbot out or a single host.
- [X] T020 [US1] Validate the file: `docker compose -f compose.full.yaml config --quiet` (with `.env` present; never without `--quiet`), then run [quickstart.md](quickstart.md) §7's fresh-clone bring-up in the scratchpad (project `myjobbot-fulltest`, port 8099, `MYJOBBOT_BASE_URL=http://localhost:8099`, throwaway database values; the clone needs this branch's uncommitted files, so copy `compose.full.yaml` and `.env.example` into it after `git clone`). Expected: `/sign-in` answers 200, `kysely_migration` holds as many rows as steps in `src/db/migrations/index.ts`, `account init` makes the first admin (the owner types the throwaway password: suggest they run it with `!` in the prompt) and signing in works; finish with `down -v` and remove the clone. Fix the file and repeat until it passes.
- [X] T021 [US1] Rewrite `README.md` to [contracts/readme-outline.md](contracts/readme-outline.md): "# myjobbot" summary (≤ 10 lines); "## Quickstart" with "### Option 1: The full stack (Docker Compose)" (its first command within the first 40 lines) and "### Option 2: The app alone", each setting `MYJOBBOT_BASE_URL`, making the first admin with `account init`, signing in, and ending at adding a first source on Settings → Sources, then one line each for `compose.yaml` and Kubernetes linking `docs/deploying.md`; "## The parts" as a table (part · what it does · required? · without it · settings) for: the app (agent run and web UI; sign-in required; `MYJOBBOT_BASE_URL`, `MYJOBBOT_HOSTS`, `MYJOBBOT_PORT`, and `MYJOBBOT_TRUSTED_PROXIES` behind proxies linking `docs/deploying.md#proxies-and-the-sign-in-limits`), the MariaDB database, the LLM (research R1 wording: OpenAI-compatible chat completions with tool calling that accepts llama.cpp's `top_k` and `repeat_penalty`; tested with llama.cpp `llama-server --jinja` and a tool-calling model; OpenAI's hosted API rejects those fields), Playwright browser service, SearXNG, Email in (Gmail alerts; app password sealed by `MYJOBBOT_SECRET_KEY`), account mail out (SMTP; optional; without it no emailed sign-in links, password resets or notices), JSearch, the `data/` folder (per R5: Docker requires `data/config.json` and `data/resume.md`; with `npm`, `resume.md` is optional once a resume is uploaded), then 3–5 lines on how they connect linking `docs/how-it-works.md`; "## Job sources" (module table, one line each, then "### JSearch's limits" linking `docs/sources.md#jsearch`); "## How scoring works" (≤ 25 lines, the four stages, linking `docs/how-it-works.md#how-scoring-works`); "## Further reading" (one line per sub page, `docs/react-walkthrough.md`, the design doc, `docs/specs/`, and "Still to come": a step-by-step trace of how each job was categorized, an email digest, Glassdoor ratings); "## License" unchanged.
- [X] T022 [US1] Check the README against [quickstart.md](quickstart.md) §1 and §5: `wc -l README.md` ≤ 250; the six `## ` headings in order; the first `docker compose -f compose.full.yaml` command at line ≤ 40; the LLM row and `resume.md` wording as R1 and R5; `MYJOBBOT_BASE_URL` and `account init` in both paths; the "How scoring works" section at most 25 lines (FR-006). Trim or fix until all hold.
- [X] T023 Run `npm run check`; when green, delete `.specify/sitting-in-progress`. End of S3.

**Checkpoint**: US1 is testable on its own: a newcomer can read the README and bring the stack up.

---

## Phase 4: User Story 2 - A reader finds the detail they need in one sub page (Priority: P2)

**Goal**: Nothing from today's README is lost, every link works.

**Independent Test**: [quickstart.md](quickstart.md) §2, §3, §4, §5a.

### Sitting S4: Proof and pointers (stack: may run)

- [X] T024 Create `.specify/sitting-in-progress` containing `026 S4`.
- [X] T025 [US2] Walk the content map ([data-model.md](data-model.md), rows #1–#48): for each row, pick a distinctive phrase or value from that block of `git show 693a827:README.md` (for #48, from the owner's text in the spec) and `grep -l` it across `README.md docs/*.md` (excluding `docs/specs/`, `docs/superpowers/`); it must be found in the row's new home and (unless the row says the README keeps a short version) nowhere else. Record each row's phrase and result in the sitting notes; move or add any missing text.
- [X] T026 [US2] Sample 20 facts (SC-005) spread across all rows, including the four spot checks in [quickstart.md](quickstart.md) §4 (`render_seconds`, `Mark as not applied`, `against observed`, `mysqldump --single-transaction`) and one from the proxies section (`MetalLB`); find each with one `grep -l` and record the search used and the page and heading it found. Fix any found in two places.
- [X] T027 [US2] Run [quickstart.md](quickstart.md) §2 and §5a: all six pages exist, each is linked from `README.md`, each starts with its summary sentence and `[← README](../README.md)`; the proxies section and the `values.yaml` comment are in place.

**Checkpoint**: US2 holds: every fact has one home.

---

## Phase 5: User Story 3 - Contributors and Claude find the developer detail (Priority: P3)

**Goal**: Project instructions point at the new pages.

**Independent Test**: [quickstart.md](quickstart.md) §6.

- [X] T028 [US3] In `CLAUDE.md`, change the evals command's "(README "Evals")" to "(`docs/cli.md`, Evals)" and the copy-prod line's "(README, Develop)" to "(`docs/developing.md`)"; then `grep -n 'README' CLAUDE.md .env.example .specify/memory/constitution.md` shows no pointer to a README section that moved. Leave `docs/specs/` and `docs/superpowers/` untouched (historical records).

**Checkpoint**: US3 holds.

---

## Phase 6: Polish

- [X] T029 Run the link checker (T002) over `README.md` and all six pages, including the links recorded in T005 and T013. Expected: `0 broken` (SC-004).
- [X] T030 Read `README.md` top to bottom as a newcomer (US1's independent test): a summary in one screen, a quickstart path to Settings without opening a sub page, each part's required/optional and setting. Fix what doesn't hold.
- [X] T031 Confirm no app code changed (FR-013): `git diff --stat 693a827 -- src web tests docker` prints nothing (`git status --short -- src web tests docker` too). Then run `npm run check` (quickstart §8; no `npm run check:db`, owner decision 2026-11-07: documentation only); when green, delete `.specify/sitting-in-progress`. End of S4. Report the follow-ups in [plan.md](plan.md) (the Sign-ins check's blind spot; entrypoint's `resume.md` check; the LLM sampling fields) to the owner.

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T014)** → **US1 (T015–T023)** → **US2 (T024–T027)** → **US3 (T028)** → **Polish (T029–T031)**.
- T021 (README rewrite) depends on every page from T003, T004, T008–T011 existing, since the README
  drops text only once its new home exists.
- T019 depends on T011 and T017; T020 on T017–T018; T022 on T021.
- US2 and US3 depend on US1's README (they check its links and pointers). US3's T028 can run any time
  after S2 and is placed in S4 only to keep pointer edits together.

### Parallel Opportunities

- T003 and T004 (different files).
- T008, T009, T010, T011 and T012 (different files).
- In S3, T017–T020 (compose) and T021 (README) touch different files and can proceed side by side;
  T019 edits `docs/deploying.md`, which nothing else in S3 touches.

## Parallel Example: Foundational pages

```text
Task: "Write docs/cli.md (T008)"
Task: "Write docs/sources.md (T009)"
Task: "Write docs/developing.md (T010)"
Task: "Write docs/deploying.md (T011)"
Task: "Replace the trustedProxies comment in values.yaml (T012)"
```

## Test ledger

| Kind | New tests | Notes |
|---|---|---|
| Unit | 0 | No code changes |
| Integration | 0 | The fresh-clone bring-up (T020) is a manual check recorded in the sitting, not a test |
| UI | 0 | |

## Implementation Strategy

- **MVP**: S1–S3 deliver US1 (the new README and full stack) with every fact already moved, so even
  stopping after S3 loses nothing; S4 proves it and fixes pointers.
- The old README stays intact until T021, so any sitting before S3 can stop safely.

## Sitting notes (2026-11-07/08)

- **T016**: `mariadb:11.8` resolved to `11.8.9`; owner approved the image 2026-11-08.
- **T020**: `config --quiet` passed. A fresh clone came up under project `myjobbot-fulltest` on port
  8099, with a scratch override moving the browser subnet to `172.31.251.0/24`: the running
  `compose.yaml` stack holds `172.31.250.0/24`, and the two can't share it (now said in
  Deploying). `/sign-in` answered 200; `account init` (run in a pseudo-terminal) recorded 19
  migration steps, matching the 19 files, and made the admin. Signing in through a browser was
  not tried. The first build retagged the main stack's `myjobbot:latest`; the tag was restored to
  the running containers' image, the test image deleted, and `compose.full.yaml` now builds
  `myjobbot-full:latest`. Torn down with `down -v`.
- **T025**: all 48 content-map rows found in their new home only.
- **T026**: 20 sampled facts, each in exactly one place (`render_seconds`, `Mark as not applied`,
  `against observed`, `mysqldump --single-transaction`, `MetalLB adds nothing`, and 15 more).
- **Corrections beyond research R6**: three statements that predated sign-in (024) said the UI has
  no login (Web UI, Gmail) or listed its only writes without the account pages; all corrected.
- **T029**: 0 broken links. **T031**: no change under `src/`, `web/`, `tests/`, `docker/`;
  `npm run check` green.
