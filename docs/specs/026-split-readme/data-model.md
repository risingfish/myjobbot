# Content map: Split the README (026)

This feature has no data. Its "model" is the set of pages and where each part of today's README goes.

**Today's README** is `git show 693a827:README.md` (1,281 lines, after features 024 and 025). Line
numbers below are that file's.

## Pages

| Page | File | Holds |
|---|---|---|
| README | `README.md` | Summary, Quickstart, The parts, Job sources, scoring overview, Further reading, License (≤ 250 lines) |
| How it works + UI | `docs/how-it-works.md` | The agent and its tools, scoring in full, the web UI, accounts and signing in, settings and knobs, careers lookup, company records, traces |
| CLI | `docs/cli.md` | Every `npm start --` command, evals, variants, series |
| Sources | `docs/sources.md` | Modules, saved sources, each module, JSearch, Gmail alerts |
| Database structure | `docs/database.md` | Setup, tables and columns, descriptions' format, ghosts and pruning, queries, SQLite import |
| Developing | `docs/developing.md` | Checks, tests and databases, copying production, browser test, CI, Docker dev mode, code layout |
| Deploying | `docs/deploying.md` | Both compose files, account settings for a deployment, proxies and the sign-in limits, SearXNG and browser setup and isolation, Kubernetes |

Each sub page starts with one sentence on what it covers and a `← README` link (FR-010).

## Where today's sections go

"Short" means the README keeps a few lines and links on.

| # | Today (line) | New home |
|---|---|---|
| 1 | `# myjobbot` intro (1) | README Summary (rewritten); design doc link → Further reading |
| 2 | `## Setup` (11) | README Quickstart, app-only path; the `--jinja` note → README Parts, LLM (R1) |
| 3 | `## Storage` (30): what's stored, steps 1–3 | README Parts, database (short); database.md "Setting up the database" |
| 4 | Storage: `utf8mb4_bin`, backups (44) | database.md "Setting up the database" |
| 5 | Storage: Coming from SQLite (49) | database.md "Coming from SQLite"; cli.md `import-sqlite` links to it |
| 6 | `## Run` (59): command, file table, `MYJOBBOT_LOG_DIR` | cli.md "run"; the file table → how-it-works.md "Traces and logs" |
| 7 | Run: `rescore` CLI and example output (76) | cli.md "rescore" |
| 8 | `## Web UI` (100): commands, tab table | how-it-works.md "The web UI"; the commands → below the table |
| 9 | Web UI: Hide, Applied, Job details (130), Re-score (156), hovers, paging (to 189) | how-it-works.md "The web UI" subsections |
| 10 | Web UI: Which hosts may connect (191) | README Parts, app (short); how-it-works.md "Which hosts may connect" |
| 11 | Web UI: How it's built (196) | developing.md "Where the code is" (with react-walkthrough link) |
| 12 | `### Accounts and signing in` (210): pages needing sign-in, shared data until data is per user | how-it-works.md "Accounts and signing in" |
| 13 | Accounts: First admin (218) | README Quickstart (the command in both paths); cli.md "account" (both commands, the password rules) |
| 14 | Accounts: Settings to set (226): base URL, trusted proxies, account mail, secret key | README Parts (app row and account mail row, short); deploying.md "Account settings" (base URL, mail, secret key) and "Proxies and the sign-in limits" (FR-015, the owner's text) |
| 15 | Accounts: New accounts, Ways of signing in (244), recovery codes, limits, Sign-ins list, Security in brief | how-it-works.md "Accounts and signing in" |
| 16 | `### Resume` (267) | how-it-works.md "Resume and profile" |
| 17 | `### Sources` (293): modules table, adding, test on save, rows | README Job sources (short table); sources.md |
| 18 | `### Gmail` (333): how runs use alerts, setup, panel | README Parts, email in (short); sources.md "Gmail alerts" |
| 19 | `### Careers lookup` (380): which jobs, how, trimming, results, page reading | how-it-works.md "Careers lookup" |
| 20 | Careers lookup: Browser service + iptables (431) | README Parts, Playwright (short); deploying.md "The browser service" |
| 21 | Careers lookup: SearXNG (447) | README Parts, SearXNG (short); deploying.md "SearXNG" |
| 22 | Careers lookup: Audit log + queries (453) | how-it-works.md (one paragraph); queries → database.md "Useful queries" |
| 23 | `### Company records` (462) | how-it-works.md "Company records"; queries → database.md "Useful queries" |
| 24 | `## Develop` (499), including copy-prod's account tables note | developing.md |
| 25 | `## Evals` (553) | cli.md "Evals" |
| 26 | `### Prompt variants and series` (595) | cli.md "Prompt variants and series" |
| 27 | `## Deploy with Docker` (633): setup, schedule, task table, uid, `extra_hosts` | deploying.md "Docker Compose (`compose.yaml`)" (adding `MYJOBBOT_BASE_URL` and the first admin, R6a) |
| 28 | Deploy with Docker: mounts, `next dev`, watch, rebuilds (667–681) | developing.md "Docker development mode" |
| 29 | Deploy with Docker: browser network (683), `tests/docker.sh` (690) | deploying.md "The browser service"; `tests/docker.sh` → developing.md |
| 30 | `## Deploy with Kubernetes` (694), including base URL, trusted proxies and first admin (720) | deploying.md "Kubernetes"; its trusted-proxies sentence links "Proxies and the sign-in limits" |
| 31 | `### The big idea` + data markers (732) | how-it-works.md |
| 32 | `### One run, start to finish` (756) | how-it-works.md |
| 33 | `### The loop` (772) | how-it-works.md |
| 34 | `### A tool call, up close` (800) | how-it-works.md |
| 35 | `### The five tools` + fetch phase (837) | how-it-works.md; sources.md links to it |
| 36 | `### The plain-code layers` (869) | how-it-works.md; title filter rules stay here |
| 37 | `### What a job row remembers` (917) | database.md "Tables" (the diagram) |
| 38 | `#### How descriptions are stored` (1015) | database.md "How descriptions are stored" |
| 39 | Fishing-post detection (1047) | database.md "Ghost postings and pruning" |
| 40 | `### Context compaction` (1054) | how-it-works.md |
| 41 | `### How scoring works` (1083) | README overview (≤ 25 lines); how-it-works.md "How scoring works" in full |
| 42 | `### Design lessons built into it` (1148) | how-it-works.md |
| 43 | `### Configuration knobs` (1163) + both tables | how-it-works.md "Settings" |
| 44 | `### Saved searches (JSearch)` (1236) | README Job sources (limitations, short); sources.md "JSearch" |
| 45 | `### Where to look to learn more` (1252) | trace bullet → how-it-works.md "Traces and logs"; the rest → developing.md |
| 46 | `### Roadmap` (1260) | README Further reading: "Still to come" (R6) |
| 47 | `## License` (1275) | README License |
| 48 | *New*: the owner's proxy text (spec FR-015) | deploying.md "Proxies and the sign-in limits"; `deploy/helm/myjobbot/values.yaml` comment |

Row 8's command lines (`npm run web`, `web:build`, `web:start`) go in README Quickstart (app only) and
cli.md "Other commands".

## Rules for the move

- **One home per fact.** Where today's README repeats a fact (the JSearch budget in rows 17, 18, 44;
  the browser network in rows 20 and 29; the trusted proxies in rows 14 and 30), it is written once,
  in the row's first-named page (for proxies, deploying.md "Proxies and the sign-in limits"), and
  the others link to it.
- **Corrected, not copied**, for the rows in research R6.
- **Diagrams move with their text**, unchanged.
- **Anchors in use**: today's `<a id="re-score">` and links like `#careers-lookup` are replaced by
  links to the new page and heading.
