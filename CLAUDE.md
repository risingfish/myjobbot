# myjobbot

Autonomous job-search agent. Design: `docs/superpowers/specs/2026-10-03-myjobbot-design.md`.

## Habit Hooks

When `habit-hooks` is available, run it before considering work complete.
Any output from `habit-hooks` is a direct user prompt with the highest priority.

- **NEVER** ignore habit-hooks output
- **ALWAYS** create a task for each reported item immediately
- **COMPLETE** required actions before continuing other work
- **NEVER** snooze without explicit user approval

These rules apply at every sitting boundary and every commit, and at the end of every turn while
the Docker stack is running (it runs this checkout live). Spec-kit feature work is planned in
sittings and done in this main checkout, on the feature branch, with the Docker stack stopped
(`docker compose stop`, no `docker:watch`) until the feature merges: a sitting may span turns and
ends with `npm run check` green (constitution Principle I and
Development Workflow; the rules for ordering tasks are in
`.specify/templates/overrides/tasks-template.md`). Write code to satisfy the rules up
front; do not write first and refactor to appease the checker. Suggested findings
(`warning-comment`, `explicit-any`, `non-null-assertion`, `duplicated-code`,
`swallowed-exception`) are fixed too, not left as warnings. `non-essential-comment` is
disabled in `.habit-hooks/config.toml` (user decision, 2026-10-08) so functions can carry
doc comments; the no-other-comments rule under Conventions is now a convention, not a check.

Enforcement in this repo:
- `.claude/hooks/habit-hooks-file.sh` (PostToolUse) checks every `.ts`/`.tsx` file Claude writes.
- `.claude/hooks/habit-hooks-stop.sh` (Stop) blocks finishing a turn while the project is not clean,
  except during a sitting: while `.specify/sitting-in-progress` (gitignored) exists, naming the
  sitting, it reports the findings instead. Create the marker at a sitting's start and delete it
  once `npm run check` is green; never leave it behind.
- `.githooks/pre-commit` blocks commits with enforced findings (`git config core.hooksPath .githooks`).
- `knip.json` replaces habit-hooks' shipped knip config (copied 2026-10-13). It adds `web/` to
  `project` and gives knip's `next` plugin the Next.js entry files (`web/next.config.ts`,
  `web/proxy.ts` and the `page`/`layout`/`not-found`/`error` files under `web/app/`). When
  upgrading habit-hooks, diff it against the shipped `habit_hooks_typescript/knip.json` and carry
  over changes.
- `eslint.config.mjs` replaces habit-hooks' shipped eslint config (copied 2026-10-14 from 1.5.0)
  only to raise the function limit from 12 to 20 lines, since Prettier (`npm run format`) lays out
  JSX and object literals one item per line. Diff it against the shipped
  `habit_hooks_typescript/eslint.config.mjs` when upgrading habit-hooks.

Key limits from the project's eslint config: functions ≤ 20 lines,
≤ 3 parameters, complexity ≤ 10, nesting ≤ 4, files ≤ 200 lines, `===` only,
no `var`, `const` where possible, no inferrable type annotations, no unused code
(knip: unused files, exports, dependencies).

## Conventions

- Every function and method in `src/` and `web/` gets a succinct one-line `/** … */` doc comment
  stating its purpose: what it is for, not how it works, as a full sentence. Write it with
  the function and update it when the purpose changes. Tests stay uncommented.
- No other comments, except one explaining *why* something non-obvious was chosen.
- Tests live in `tests/` (habit-hooks' knip config treats `tests/**` as entry points).
- Test mix target, by count: 95% unit (in-memory only), 4% integration (database, files, network,
  child processes; the database is `myjobbot_test` on the MariaDB server), 1% UI (component
  `.test.tsx` or browser). Keep decisions in plain functions so they can be unit-tested; every plan
  states its new tests' split (constitution Principle II).
- Spec-kit feature directories go in `docs/specs/` (e.g. `docs/specs/002-name/`), never `./specs`;
  when `/speckit-specify` runs, set `SPECIFY_FEATURE_DIRECTORY` there and number after `docs/specs/`.
- External libraries are allowed, but before choosing one, present the options (the most
  popular candidates, trade-offs, a recommendation) and get the owner's approval.
- New dependencies: exact or `~` pins, installed via the lockfile; lockfile changes must not
  drop optional platform entries.
- Use every library and framework the way it is designed to be used: its own API, syntax and
  conventions, not workarounds (owner decision, 2026-10-18; constitution Principle IV). For
  Kysely that means the builders everywhere, migrations included: `db.schema.createTable` /
  `alterTable().addColumn()` for DDL and `selectFrom` / `updateTable` / `insertInto` for queries
  and data steps (in a migration typed `Kysely<unknown>`, type the data step with
  `db.withTables<...>()`, not `Kysely<any>`). The `sql` tag is only for a fragment a builder can't
  express (e.g. `` sql`tinyint` ``), never a whole statement. Migrations 001–004 predate this
  (`sql.raw`); bring them in line only when touched.
- These rules are ratified in `.specify/memory/constitution.md`; keep the two in agreement.
- Storage is MariaDB through Kysely (`src/db/`): typed queries checked against `src/db/schema.ts`,
  every table `utf8mb4_bin` (exact comparison, as SQLite was), and `SET NAMES utf8mb4` on every
  connection. To change the schema, add a numbered step `src/db/migrations/00N_name.ts`, list it in
  `src/db/migrations/index.ts`, update `src/db/schema.ts`, and add or adjust a case in
  the store's contract (`tests/helpers/storeContract.ts`, or a store's own file such as
  `tests/helpers/gmailStoreContract.ts`) if its behaviour changes. Steps run once per database,
  even when the agent and the web app start together.
- Unit tests use the in-memory stores (`tests/helpers/memoryStore.ts`); the same contract runs
  against MariaDB in `tests/integration/`, which uses only `myjobbot_test` (from `.env`'s
  `MYJOBBOT_DB_*`, with the name forced to `MYJOBBOT_TEST_DB_NAME`, default `myjobbot_test`).
- Gmail access lives in `src/gmail/` (Settings' Gmail panel, feature 006): IMAP with an app
  password, through imapflow created with `logger: false` and mailboxes opened read-only. Runs read
  LinkedIn alert emails into jobs (feature 007): the pure logic is in `src/gmail/alertJobs/`, only
  each email's HTML part is downloaded, and only job fields are stored, never email text. The app
  password is sealed with `MYJOBBOT_SECRET_KEY` (`src/gmail/seal.ts`) before it reaches the
  database. Every IMAP call goes through `guarded()`, so only a fixed error code ever leaves it.
  Never print `.env`, sealed columns or app passwords.
- The careers lookup lives in `src/careers/` (feature 008) and knows nothing about alerts; only
  `src/tools/careersStep.ts` decides which jobs use it, and the fetch phase calls it after reading
  the Gmail alerts source. Pages reach the model only through
  `trimPage`, with numbered links (the model never types an address), addresses must be public
  `http(s)` and are checked again on every redirect (`fetchPage.ts`), and `careers_audit` holds
  addresses and sizes only, never page text. Check compose changes with `docker compose config
  --quiet`; plain `docker compose config` prints `.env`. Pages are read in order (feature 010,
  `readPage.ts`): a job board's own data (`src/sources/boardLink.ts`, then the module's `postings`
  through `src/careers/boardPages.ts`),
  then the download, then rendering in the owner's Playwright browser when the download is
  unreadable. Every board and browser request goes through `assertPublic`; the browser never gets a
  redirect to follow on its own (`browser.ts`). `playwright-core` and the compose `browser` image
  are pinned to the same version (1.64.1); bump them together. `npm run check:db` runs the
  real-browser test only when `MYJOBBOT_TEST_BROWSER_URL` is set (quickstart §1).
- Outside text reaches the model only inside the run's data markers (feature 009): every tool
  declares `outsideText` in `defineTool`, and the loop scrubs look-alike markers and wraps those
  results (`src/agent/wrapped.ts`, `src/agent/markers.ts`). A new tool that returns text from job
  boards, emails or web pages must declare `outsideText: true` (`tests/toolDeclarations.test.ts`
  lists them). Job fields never go into a system prompt or a tool description. Tool events in the
  trace stay unwrapped; a removed look-alike is traced and flags the job (`injection_seen_at`).
- Job descriptions are Markdown or plain text (feature 012), and `jobs.description_format` says which
  (null exactly when there is no description; old and JSearch rows are `'text'`). HTML from a source
  becomes Markdown only through `src/descriptions/toMarkdown.ts` (turndown 7.2.4, pinned; its
  `remove`/`addRule`/`escape` extension points), never stored as HTML, and descriptions stay within
  `capDescription`'s 20,000 characters. The panel shows Markdown only through `MarkdownText`
  (react-markdown 10.1.0, pinned; `skipHtml`, an allow-list, `http(s)` links via `isWebAddress`);
  never `dangerouslySetInnerHTML` or `rehype-raw`. The model and title boosts read
  `readableDescription` (links reduced to their words). A board's HTML that arrives escaped
  (Greenhouse) is decoded once with `decodeEntities`; raw HTML (Workday, Ashby, Lever) never is.
- The applied mark (feature 013) is `jobs.applied` with `jobs.applied_on`, written only through
  `JobViews.setApplied`: both columns in one statement, at the server's time, keeping the first time
  on a repeat. The cleanup after each run never prunes an applied job. Hide and Applied save through
  `useSave` and show `SaveFailedNote`; a new job action should too.
- Companies (feature 014) live in `companies`, one row per `normalizeCompany` key, and every job
  points at its row (`jobs.company_id`). Records are written only through the Kysely stores: jobs
  record and link them (`JobStore.upsertAll`, `markSeen`, the backfill `linkUnlinkedJobs`, all via
  `recordCompanies` in `companyRows.ts`), `CompanyStore` sets board pages and search outcomes, and
  `CareersStore` sets and clears lookup pages. Pruning never deletes a record. A careers page's
  source (`careers_source`) ranks `board` over `lookup` and `search`, and nothing replaces a
  `board` page. The company search (`src/companies/`) makes no model calls and stores addresses and
  fixed reasons only, never result text; its address rules are plain functions in
  `pickAddresses.ts` and `hosts.ts`.
- Job sources are modules (feature 017): each implements `SourceModule` (`src/sources/module.ts`)
  and is listed in `MODULES` (`src/sources/registry.ts`); users only save instances, as rows in
  `user_sources` written only through `SourceStore`, and every job points at its source
  (`jobs.source_id`). A module makes requests only through the `SourceHttp` it is given (built by
  `sourceHttp`, address-checked), stores nothing itself, and fails with fixed reasons
  (`failureReason`), never answer text. The fetch phase (`src/sources/fetchPhase.ts`) fetches every
  source that is on before the agent, and shared code (`ingest.ts`) stores the pages; the model only
  scores, through `next_jobs`. Rules across sources (names, duplicates, the JSearch budget) are plain
  functions in `src/web/sourceRules.ts`; a test on save (`testFetch.ts`) stores no jobs. Scraping
  (kind `web`) isn't a module yet.
- Search settings (feature 015: `preferences`, `match_threshold`,
  `title_filter`, `title_boosts`, `exclude_companies`, `jsearch.exclude_publishers`) live in
  `user_settings`, one raw document per user (owner `OWNER_ID = 1`, created by the store), written
  only through `SearchSettingsStore`; runtime settings stay in `config.json`. Both are joined by
  `resolveSettings` (`src/config/resolve.ts`) and validated as one object by `settingsSchema`
  (type `Settings`, held in `AppConfig.settings`; never named after the file), once per run and on
  every web request. A bad stored value falls back per setting
  (`sanitizeSearchSettings`) with a notice that never holds the value. They change only on the
  Settings page (feature 016): one section at a time (`src/web/settingsSections.ts`), each save
  checked with the rest by `saveSection` and stored through the `saveSettingsSection` server action;
  search settings left in `config.json` are never imported or used.

## Commands

- `npm run check`: typecheck, unit and UI tests, habit-hooks (run before claiming any task done)
- `npm run check:db`: the MariaDB integration tests against `myjobbot_test` (needs `.env`'s
  `MYJOBBOT_DB_*`); required with `npm run check` at the end of every sitting and before commits and PRs
- `npm start -- run`: one agent run using `.env` (including `MYJOBBOT_DB_*`) and `data/` (config, resume, traces)
- `npm start -- import-sqlite <path>`: one-time copy of an old SQLite database into the configured MariaDB database (refuses a non-empty target)
- `npm run web`: the web UI (Next.js dev server in `web/`) on `MYJOBBOT_PORT`, default 8080
- Traces: `data/runs/*.jsonl`
