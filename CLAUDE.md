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
the Docker stack is running (it runs the main checkout live). Spec-kit feature work is planned in
sittings and done in the main checkout, or in a git worktree when another session is working in
the main checkout (its own `npm ci`, `.env` and checks), on the feature branch, with the Docker stack stopped
(`docker compose stop`, no `docker:watch`) until the feature merges, except UI work (components,
styles, page wiring; no migration, no change to the agent run), which may keep the stack running
so the owner watches it live (constitution 2.5.0), each turn then ending clean: a sitting may span
turns and
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
- `.claude/hooks/solid-review-stop.sh` (Stop) blocks a turn's end once for each `src/`/`web/` file
  that differs from `main` and wasn't reviewed in its current content, asking the session itself to
  review it for SOLID (no separate model call; owner decision, 2026-11-10). What was asked is kept
  in the checkout's git directory (`solid-reviewed`), so each file is asked about once per content.
- `.githooks/pre-commit` blocks commits with enforced findings (`git config core.hooksPath .githooks`).
- `knip.json` replaces habit-hooks' shipped knip config (copied 2026-10-13). It adds `web/` to
  `project` and gives knip's `next` plugin the Next.js entry files (`web/next.config.ts`,
  `web/proxy.ts` and the `page`/`layout`/`not-found`/`error` files under `web/app/`). When
  upgrading habit-hooks, diff it against the shipped `habit_hooks_typescript/knip.json` and carry
  over changes.
- `eslint.config.mjs` replaces habit-hooks' shipped eslint config (copied 2026-10-14 from 1.5.0)
  only to raise the function limit from 12 to 20 lines, since Prettier (`npm run format`) lays out
  JSX and object literals one item per line, and the parameter limit from 3 to 4 (owner decision,
  2026-11-07). Diff it against the shipped
  `habit_hooks_typescript/eslint.config.mjs` when upgrading habit-hooks.

Key limits from the project's eslint config: functions ≤ 20 lines,
≤ 4 parameters, complexity ≤ 10, nesting ≤ 4, files ≤ 200 lines, `===` only,
no `var`, `const` where possible, no inferrable type annotations, no unused code
(knip: unused files, exports, dependencies).

## Conventions

- Follow the SOLID principles at all times (constitution Principle VI, owner decision 2026-11-08):
  one responsibility per module, class and function, never unrelated jobs grouped in one file or
  interface; new variants added through a registry or interface, not per-variant branches; every
  implementation of an interface honours its shared contract; callers depend on narrow interfaces,
  and containers hold stores, not operations; decisions take their dependencies, so they can be
  unit-tested. SOLID is checked in every review: specs, plans, task lists, analyses (each
  `/speckit-*` step) and every code review, where a breach is a finding like any other.
- Every function and method in `src/` and `web/` gets a succinct one-line `/** … */` doc comment
  stating its purpose: what it is for, not how it works, as a full sentence. Write it with
  the function and update it when the purpose changes. Tests stay uncommented.
- No other comments, except one explaining *why* something non-obvious was chosen.
- Tests live in `tests/` (habit-hooks' knip config treats `tests/**` as entry points).
- Test mix target, by count: 95% unit (in-memory only), 4% integration (database, files, network,
  child processes; the database is the checkout's own test database on the MariaDB server), 1% UI (component
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
  `src/db/migrations/index.ts`, update the table's area file in `src/db/schema/` (jobs, users,
  gmail, careers, rescore; a new area gets its own file) and its entry in `src/db/schema.ts`'s
  `Database`, and add or adjust a case in
  the store's contract (`tests/helpers/storeContract.ts`, or a store's own file such as
  `tests/helpers/gmailStoreContract.ts`) if its behaviour changes. Steps run once per database,
  even when the agent and the web app start together.
- Unit tests use the in-memory stores (`tests/helpers/memoryStore.ts`); the same contract runs
  against MariaDB in `tests/integration/`, which uses only the checkout's test database (from `.env`'s
  `MYJOBBOT_DB_*`, with the name forced to `MYJOBBOT_TEST_DB_NAME`, default `myjobbot_test`, which must hold `_test`
  at its end or before another `_`, and
  each of `MYJOBBOT_TEST_DB_HOST`/`_PORT`/`_USER`/`_PASSWORD` replacing its `MYJOBBOT_DB_*` one when
  set, in `testEnvironment`, `tests/helpers/testDb.ts`).
- Databases (constitution 2.5.0, Development Workflow): `myjobbot` is production's, on the
  Kubernetes cluster, and is never used locally. Each checkout has its own pair and user, created
  by the owner: the main checkout `myjobbot_dev` + `myjobbot_test`, a second session's worktree
  `myjobbot_dev_alt` + `myjobbot_test_alt`, all `utf8mb4` / `utf8mb4_general_ci`.
- Gmail access lives in `src/gmail/` (Settings' Gmail panel, feature 006): IMAP with an app
  password, through imapflow created with `logger: false` and mailboxes opened read-only. Runs read
  LinkedIn alert emails into jobs (feature 007): the pure logic is in `src/gmail/alertJobs/`, only
  each email's HTML part is downloaded, and only job fields are stored, never email text. The app
  password is sealed with `MYJOBBOT_SECRET_KEY` (`src/secrets/seal.ts`) before it reaches the
  database. Every IMAP call goes through `guarded()`, so only a fixed error code ever leaves it.
  Never print `.env`, sealed columns or app passwords.
- The careers lookup lives in `src/careers/` (feature 008) and knows nothing about alerts; only
  `src/tools/careersStep.ts` decides which jobs use it (sources whose module declares
  `descriptions: "careers_lookup"`), and the Gmail alerts run hook (`src/sources/hooks/gmailAlerts.ts`)
  calls it after reading the alerts. Pages reach the model only through
  `trimPage`, with numbered links (the model never types an address), addresses must be public
  `http(s)` and are checked again on every redirect (`fetchPage.ts`), and `careers_audit` holds
  addresses and sizes only, never page text. Check compose changes with `docker compose config
  --quiet`; plain `docker compose config` prints `.env`. Pages are read in order (feature 010,
  `readPage.ts`): a job board's own data (each board module's `boardLink` reader, through `parseBoardLink` in
  `src/sources/boardLinks.ts`, which asks `BOARD_MODULES`; then the module's `postings`
  through `src/careers/boardPages.ts`; a downloaded careers page that names exactly one board only
  in its HTML is read from it too, `embeddedBoard.ts`),
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
  never `dangerouslySetInnerHTML` or `rehype-raw`. The model and description boosts read
  `readableDescription` (links reduced to their words). A board's HTML that arrives escaped
  (Greenhouse) is decoded once with `decodeEntities`; raw HTML (Workday, Ashby, Lever, Gem) never is.
- The applied mark (feature 013) is `user_jobs.applied` with `user_jobs.applied_on`, written only through
  `JobViews.setApplied`: both columns in one statement, at the server's time, keeping the first time
  on a repeat. The cleanup after each run never prunes an applied job. Applied jobs are listed on the Applied tab (`JobViews.appliedJobs`) and left out of Recommended. Hide and Applied save through
  `useSave` and show `SaveFailedNote`; a new job action should too (Re-score is the one exception,
  below).
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
  (`user_jobs.source_id`). A module makes requests only through the `SourceHttp` it is given (built by
  `sourceHttp`, address-checked), stores nothing itself, and fails with fixed reasons
  (`failureReason`; a module's own failures extend `SourceFailure` with their reason), never answer
  text. A module declares what it needs and does as data: its `access` type (supplied by its run
  hook in `src/sources/runHooks.ts`, or by test-on-save), what its pages' cost is spent against
  (`limits.spends`), whether the budget skips it (`limits.skipWhenBudgetUsed`), and where its
  descriptions come from (`descriptions`). The fetch phase (`src/sources/fetchPhase.ts`) fetches every
  source that is on before the agent, calling each module's run hook generically and knowing nothing
  of Gmail, and shared code (`ingest.ts`) stores the pages; the model only
  scores, through `next_jobs`. Rules across sources (names, duplicates, the JSearch budget) are plain
  functions in `src/web/sourceRules.ts`; a test on save (`testFetch.ts`) stores no jobs. Scraping
  (kind `web`) isn't a module yet.
- Search settings (feature 015: `preferences`, `match_threshold`,
  `title_filter`, `body_filter`, `title_boosts`, `description_boosts`, `exclude_companies`, `jsearch.exclude_publishers`) live in
  `user_settings`, one raw document per user (owner `OWNER_ID = 1`, created by the store), written
  only through `SearchSettingsStore`; runtime settings stay in `config.json`. Both are joined by
  `resolveSettings` (`src/config/resolve.ts`) and validated as one object by `settingsSchema`
  (type `Settings`, held in `AppConfig.settings`; never named after the file), once per run and on
  every web request. A bad stored value falls back per setting
  (`sanitizeSearchSettings`) with a notice that never holds the value. They change only on the
  Settings page (feature 016): one section at a time (`src/web/settingsSections.ts`), each save
  checked with the rest by `saveSection` and stored through the `saveSettingsSection` server action;
  search settings left in `config.json` are never imported or used.
- Body filters (feature 018) are `body_filter.include` and `.exclude` in `user_settings`, matched
  by `passesBodyFilter` (`src/jobs/bodyFilter.ts`) as whole words or phrases on
  `readableDescription`; a job with no description passes both. One order of checks, company, then
  title, then body, lives in `filterMatch` (`src/jobs/filterMatch.ts`) with its `FILTER_NOTES`, and
  runs (`isWanted`, the one gate before the model), the All jobs note and Re-score all use it.
  Filters never change jobs already scored, but Recommended (`recommendedJobs` in
  `src/web/pageData.ts`) leaves out every job `filterMatch` hides under the current settings
  (owner decision, 2026-11-03).
- Re-score (feature 018) lives in `src/rescore/`, knows nothing about Next.js, and has two entry
  points: `npm start -- rescore <ats> <job_id>` and the panel's `startRescore` server action
  (`web/lib/actions.ts`, work in `startRescoreFor` in `web/lib/rescoreStart.ts`, input checked before any
  model call), which records the run, hands the work to `after()` and answers with the run's id. A filtered job loses its score through `JobViews.clearScore`, which keeps the marks
  and verdict history; a job with no description is looked up first, with the careers lookup built
  from `CareersParts` (`src/careers/deps.ts`) and capped at 2 minutes. Scoring is a one-job
  `runAgent` session (6 steps, 3 minutes) whose model reads the job only through `get_job`, inside
  the data markers, and saves it through `oneJobStore`; it shares the run's rubric
  (`src/agent/rubric.ts`), and the run prompt is pinned by `tests/__snapshots__/prompt.test.ts.snap`.
  The panel's messages come only from `rescoreNote`. The Re-score button uses `useRescore`, not
  `useSave`, the one exception to the job-action rule above. The `web` service is on the
  `browser` network for the lookup's rendering.
- The re-score log (feature 019): each re-score is a row in `rescore_runs` with its steps in
  `rescore_steps`, written only through `RescoreLogStore` (`RescoreLog` in `src/rescore/log.ts`
  numbers and stores them; the careers audit and the trace feed it through `src/rescore/traceSteps.ts`).
  A step is a kind with schema-checked fields (`src/rescore/steps.ts`), and every terminal or CLI
  line is built by `stepLine` from those fields alone, never from page or model text; a stored step
  that doesn't parse is never shown. A job has one open run at a time (`begin` locks the job row);
  a run not ended within 10 minutes counts as failed (`openSince`, `runEnd`). The panel follows a
  run over server-sent events from `web/app/api/rescores/[id]/route.ts` (`streamEvents` in
  `src/web/rescoreStream.ts`; `follow` in `src/web/rescoreFollow.ts` polls the stored log and sends
  a named `ping` heartbeat, with its timers and clock handed in by the route), shown by
  `RescoreTerminal` (`useRescoreLog`, `useRescoreTerminal`); History merges verdicts and runs in
  `historyRows` (`src/web/history.ts`), each re-score with its Log.
- Evals (feature 020) live in `src/evals/` and know nothing about Next.js. Their data is JSON files
  under `data/evals/` (profiles, cases, answer keys, prompts, runs with `results.jsonl` and
  `trace.jsonl`), read and written only through `EvalFiles` over a `FilePort` (`nodeFilePort` in
  production, `tests/helpers/memoryFilePort.ts` in tests); every file carries `schema: 1`, is
  parsed strictly (`parseFile`, `src/evals/format.ts`), and a bad file is named by its first zod
  issue's path and code, never its text. Writes go through a `.tmp` file and a rename. Capture only
  reads the database (`recentlyScored`, `descriptionFoundAt`); a case's age as scored is counted
  from `earliestSeen` as a run counts it. A run replays the re-score path (`rescoreMessages`,
  `oneJobAgentDeps`), with its own `get_job` returning the frozen job (`outsideText: true`, markers
  from `randomUUID()`) and `record_matches` into a one-case store that writes nothing. Pass rules
  are `judge` (`src/evals/judge.ts`); reports re-judge against current answer keys and never print
  description text. Evals call the real model and are never part of `npm run check`.
  Prompt variants (feature 022): the re-score's system message is one template
  (`rescoreSystemTemplate()`, its steps plus the shared rubric) filled by `fillTemplate` with
  `rubricValues` (`src/agent/rubric.ts`), the only place the `(none given)` rule lives; the code,
  runs and every variant fill through it, and the run prompt snapshot pins that production is
  unchanged. A variant (`data/evals/variants/<name>.md`, a versioned header then the text) must
  hold `{data}`, `{threshold}` and `{preferences}` and no other `{word}` (`loadVariant`,
  `src/evals/variantCheck.ts`), or it is refused before any model call. `executeRun`
  (`src/evals/runCases.ts`) is the one way a run starts, for `eval run` and every test of a series.
- Boosts (feature 021) are two search settings in `user_settings`: `title_boosts`, matched against
  the job's title only, and `description_boosts`, matched against `readableDescription` only, both
  matched only in `src/jobs/boosts.ts` (`appliedBoosts`, `maxBoost`). Each term counts once per
  job; terms are grouped by `normalizeTitle`, so a term in both lists found in both places counts
  once at the higher value, and the Settings save refuses a repeat within one list
  (`repeatedBoosts`). Boosts are applied at display time, never stored per job, never seen by the
  run, the model, re-score or evals; the table note and the panel's Boosts fact come from
  `src/web/boostViews.ts`. Step `016_description_boosts` copied the title list into the
  description list once. The Settings page has no reset-to-default buttons or "(default)"
  markers (owner decision, 2026-11-04); empty defaults come with the resume-import spec.
- The resume (feature 023) is uploaded on the Settings page's Resume section and stored in
  `resumes` (one row per user, the text only, with its `sha16` content id from `src/contentId.ts`),
  its extracted profile in `resume_profiles` (a summary and skills, each in one of
  `engineering`/`people`/`project`), both written only through `ResumeStore` (step `017_resume`).
  Files are read to text only, in memory, through `src/resume/read.ts`: Markdown and text as UTF-8,
  PDF through unpdf 2.1.0 and Word through mammoth 1.13.0 (pinned), with the limits and fixed
  messages in `src/resume/limits.ts` (5 MB, 100,000 characters; the server-action body limit is
  6 MB in `web/next.config.ts`). `settingsForRun` uses the uploaded resume, else `data/resume.md`
  (now optional), else refuses. The profile is extracted by a short session
  (`src/resumeProfile/extract.ts`: `get_resume`, `outsideText: true`, and a schema-checked
  `record_profile`), whose model-response log keeps only usage (`usageOnlyLog`); edits go through
  `editFor`, and "Use summary in Preferences" fills the box through `PreferencesDraft`, never
  saving it. What the scoring model reads about the owner is the search setting `resume_view`
  (`resume`, `resume_and_profile`, `profile`), and `ownerMessage` (`src/agent/ownerMessage.ts`)
  builds the first user message for runs, re-scores and eval runs from it, the resume and profile
  scrubbed and inside the data markers; the system prompt is unchanged. Eval runs choose theirs with
  `--view` (series `<label>=<variant|code>[+view][@model]`), never the stored setting. The resume
  and profile are shown as text only and never logged.

- Accounts (feature 024) live in `src/accounts/` (rules and flows, no Next.js) and ten stores
  (split by 028): `AccountStore` (users with `email`, `email_key`, `is_admin`),
  `SecurityEventLog` (`security_events`), `MethodStore` (each way's switch and set-up state in
  `sign_in_methods`, and the password), `AuthenticatorStore` (the authenticator's secret and last
  step, same table), `AccountCodeStore` (creation codes), `EmailLinkStore` (emailed links; a
  purpose's lifetime and session binding are tables beside `LINK_PURPOSES`), `RecoveryCodeStore`,
  `KeyStore` (hardware keys and challenges), `SessionStore` (sessions) and `AttemptStore` (the
  sign-in attempt counters). Each way of signing in has one module in
  `src/accounts/ways/` (feature 025: `password`, `emailLink`, `authenticator`, `hardwareKey`,
  `recoveryCode`); `catalog.ts` is the one list of ways (card and choice order, names, fields,
  mail rules) and is safe for client components; `registry.ts` (`PROOF_WAYS`) maps each way you
  can choose to how it reads and checks a proof, used by `signInByWay` and `confirmIdentity`.
  Nothing outside the way modules, their controls and the stores compares a way's kind by name
  (`tests/wayBranches.test.ts`). A change that could leave no usable way goes through
  `changeKeepingAWay` (`src/db/kysely/wayLock.ts`, locked), whether a way is usable through
  `wayUsable`, a new password through `newPasswordDigest`; the account and admin server actions
  open with `signedInAction` (`web/lib/accountAction.ts`), and every other action is gated by
  `guarded`. Their contracts
  run every case on the memory stores and only the strict (transaction, race, constraint) cases on
  MariaDB. `web/proxy.ts` gates every request through `src/web/security/` (host, origin,
  a `SameSite=Strict` forgery cookie tied to the session, the session, `private, no-store`, a
  nonce CSP and the security headers); a signed-out request gets only a redirect or a fixed 401,
  never job data, and every page loader calls `requireSession()` first. Every server action is
  wrapped by `guarded` (`web/lib/guard.ts`: public, admin, step-up), which decides actions even on
  public paths; `tests/actionGuards.test.ts` checks them all. Signed-in pages are in
  `web/app/(app)/`, public ones in `web/app/(public)/` (no nav, no database label). Refusals are
  fixed `MESSAGES` (`src/accounts/messages.ts`) and never say whether an email has an account;
  every sign-in way goes through `signInWith` (shared limits, refusal and recording); every
  security event through `recordSecurityEvent`, which queues its notice. One-time values (codes,
  links, recovery codes, key challenges, TOTP steps) are stored as digests and spent in the
  statement that checks them; passwords are Argon2id (`node:crypto`); authenticator secrets are
  sealed with `MYJOBBOT_SECRET_KEY` (`src/secrets/seal.ts` field `totp_secret`). Mail goes through
  `src/mail/` (nodemailer, queued, failures logged by fixed reason). Emailed links carry their
  token in the URL fragment, read once by `/link`. Device details (IP, OS, location: browser
  position rounded, else geoip-lite, kept out of the Next bundle) are stored per session. Never
  log a password, code, token, secret or typed email. New pages use Pico first (research R18); a
  primary button inside a `.panel` is a form's submit button with no `type`, since
  `.panel button[type="button"]` is styled small.
- Account status (feature 029): `users.deactivated_at` and `delete_after` (step
  `025_account_status`, which also makes the `account_codes` keys to users `set null`), read as
  `Account.deactivatedAt`/`deleteAfter` and written through `AccountStore.setStatus` (only the
  dates given) and `reactivate` (one conditional statement). Rules are plain functions in
  `src/accounts/accountLifecycle.ts` (`reactivateFirst`, `statusOf`, `deletionDate`,
  `mayRequestDeletion`); flows are `src/accounts/flows/accountStatus.ts` (deactivate, reactivate)
  and `flows/accountDeletion.ts` (request, cancel), each handed the Gmail removal as a step, never
  importing `src/gmail/`. Runs skip a deactivated user (`usersToRun`, re-checked in `runPlanned`)
  and first carry out due deletions (`src/app/accountDeletions.ts`), through `AccountRemoval`
  (`Stores.removal`, one locked transaction, never the only admin, re-checking the date), whose
  per-user table list is checked against every `user_id` table of `Database` at compile time;
  the notice is mailed only after the delete, with `sendMail` (awaited). Re-score, the rescore CLI
  and connecting Gmail refuse a deactivated account (`reactivateFirst`, `web/lib/scoringRefusal.ts`).
- Each account's own data (feature 027): `jobs` is the posting, stored once and shared; `user_jobs`
  is each user's view of it (`source_id`, `source`, `first_seen`, `last_seen`, the scores, `reasons`,
  `gaps`, `hidden`, `applied`, `applied_on`), keyed `(user_id, ats, job_id)`. `verdicts`,
  `rescore_runs` and the Gmail tables carry `user_id`. Steps `020_user_jobs` (copies every view to
  user 1), `021_history_owners`, `022_gmail_by_user`, then `023_jobs_without_user_columns`, which
  drops the moved columns last so a failed step never loses data before it is copied; MariaDB DDL
  isn't transactional, so a partial upgrade is restored from backup, not re-run. `Stores`
  (`src/db/store.ts`) is only a container: the shared stores (`postings`, `sourcePlans`, careers,
  companies, API calls, the account stores) and `forUser(id)`, which gives `UserStores`
  (`src/db/userStores.ts`) bound to that user; there is no default user. `PostingStore` is the
  shared posting (`known`, `setDescription`, `prune`, ...), `JobStore`/`JobViews` the user's views.
  Each cross-user listing sits on its owning store (`SourcePlans.sourcesOnForAll`,
  `AccountStore.userIds`), one responsibility per module (R14). The web reaches data only through
  `myStores()` (`web/lib/myStores.ts`, the signed-in user's), so nobody, admins included, sees
  another user's data. A run is `runAll` (`src/app/runAll.ts`): every user in id order, planned by
  `usersToRun` (no source on, no resume: skipped), each through `runForUser` (`src/app/run.ts`) with
  its own logs, settings and resume, a failure reported without stopping the next, one prune after
  all, and lines and exit code from `runLines.ts`. A description found for one user is never looked
  up again for another (`postings.known` in the alert read; the careers step reads the shared
  posting). The JSearch budget counts every user's searches. `data/resume.md` is user 1's only
  (`ownsResumeFile`). `run`, `rescore`, `eval capture` and `eval run` take `--user <email>`
  (`src/cliUser.ts`: `userOption`, `storesFor`), else user 1; captured cases record `userId`.
  `OWNER_ID` (declared once, in `src/db/owner.ts`) remains only where user 1 is meant: the stores
  making user 1 on an owner write (`ensureOwnerFor` in `src/db/kysely/owner.ts`),
  `ownsResumeFile`, `import-sqlite` and the `--user` default (`tests/ownerIdScan.test.ts` keeps it
  out of `web/` and `src/app/`). Tests use `withOwner`/`memoryStores` (user 1 merged in) and
  `forUser(2)` for a second user.

- Observability (feature 030): every run is recorded as it goes through `RunRecorder`
  (`src/monitoring/recorder.ts`): `agent_runs` with a heartbeat every minute (`runStatus`: no sign
  of life for 5 minutes is never finished), each user's part in `run_users` written as running before
  its work (its id made by `runAll` and handed to `openRunLogs`) and ended with counts a
  schema-checked `RunTally` reads from the part's trace and model log (`tallyEvents.ts`; a new
  counted event goes in that table, and workers never learn about monitoring). Failures keep only
  a fixed reason (`runFailureReason`); a failed write is a fixed log line and marks the run
  `incomplete`, never failing it. The fetch phase records each fetch and planned skip through
  `src/sources/fetchRecord.ts` (`source_fetches`), `recordedMailer` wraps the mailer `mailSlot`
  builds (`mail_sends`, by `MailKind`, never address or text), and re-scores store model use on
  `rescore_runs`. All of it is written only through `RunHistory`, `FetchHistory`, `MailLog` and
  read only through `MonitoringReads` (raw rows; plain functions in `src/web/monitoring*.ts` and
  `src/metrics/` aggregate), kept 90 days (`MONITORING_RETENTION_DAYS`) and removed with an
  account. The Monitoring page (`/monitoring`, `web/lib/monitoringState.ts`) is admin-only (404
  otherwise), reached through `myStores()`, and shows ids, module names, counts and fixed reasons
  only (`tests/monitoringPrivacy.test.ts`); charts are Chart.js 4.6.1 (pinned) in
  `MonitoringChart`. Each user's Settings shows their sources' last 10 fetches. `npm start --
  metrics` serves the same history to Prometheus with prom-client 15.1.3 (pinned), a fresh
  registry of gauges per scrape, on `MYJOBBOT_METRICS_PORT` and only with
  `MYJOBBOT_METRICS_TOKEN`; the chart's `monitoring.enabled` adds its container, Service,
  ServiceMonitor, PrometheusRule and dashboard.

## Commands

- `npm run check`: typecheck, unit and UI tests, habit-hooks (run before claiming any task done)
- `npm run check:db`: the MariaDB integration tests against the checkout's test database (needs
  `.env`'s `MYJOBBOT_DB_*` and `MYJOBBOT_TEST_DB_*`); required with `npm run check` at the end of every sitting and before commits and PRs
- `npm start -- run [--user <email>]`: one agent run for every user in turn (or the one named), using `.env` (including `MYJOBBOT_DB_*`) and `data/` (config, user 1's resume, traces); one line per user
- `npm start -- rescore <ats> <job_id> [--user <email>]`: re-score one job of user 1's (or the named user's) at once (prints each step as it runs, then scored, filtered or failed; `already running` and exit 1 when the job has a re-score open)
- `npm start -- eval check | capture <ats> <job_id> | capture --recent N [--user <email>] | answer-key <case-id> <verdict> | run [--variant name] [--view v] [--user <email>] | report <run-id> | prompt export|diff | series save|run|report`: the scoring evals and prompt variants (`docs/cli.md`, Evals); `run` and `series run` call the real model
- `scripts/copy-prod.sh myjobbot_dev|myjobbot_dev_alt [--yes]`: replaces every table in a dev database
  with a snapshot of production, read with the read-only `MYJOBBOT_COPY_DB_*` login (`docs/developing.md`),
  copying no rows of `sessions`, `email_tokens`, `auth_challenges`, `auth_attempts` or
  `account_codes`; refuses any other target
- `npm start -- account init|reset <email>`: make user 1 the first admin, or give an admin a new
  password, typed at a hidden prompt
- `npm start -- import-sqlite <path>`: one-time copy of an old SQLite database into the configured MariaDB database, as user 1's (refuses a non-empty target)
- `npm start -- metrics`: serve the stored history to Prometheus on `MYJOBBOT_METRICS_PORT` (default 9464), only with `MYJOBBOT_METRICS_TOKEN` (32+ characters)
- `npm run web`: the web UI (Next.js dev server in `web/`) on `MYJOBBOT_PORT`, default 8080
- Traces: `data/runs/*.jsonl`
