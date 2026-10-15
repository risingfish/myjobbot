---
description: "Task list for MariaDB Storage"
---

# Tasks: MariaDB Storage

**Input**: Design documents from `docs/specs/004-mariadb-storage/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R11), data-model.md, contracts/storage.md,
quickstart.md

**Tests**: Included, written first (constitution II). New tests follow the 95/4/1 rule. Each task
names a test's kind: **unit** (in-memory only), **integration** (`myjobbot_test`, files,
processes) or **UI**.

**Organization**: Grouped by user story (spec US1–US4), with a final phase for the switch-over.

## Rules for every task

- **Work in the main checkout** (`/home/zac/code/myjobbot`) on branch `mariadb-storage`, with the
  Docker stack **stopped** (`docker compose stop`, no `docker:watch`). The stack mounts this
  checkout's `src/` and `web/` live, so it stays stopped until the switch-over (T039). Owner
  decision, 2026-10-14.
  - **Sittings (constitution v2.1.0)**: tasks are grouped into sittings S0–S7. A sitting may span
    turns; it ends with `npm run check` green, and is the only commit point. Within a sitting, each
    task runs the tests it touches, and `habit-hooks` findings are tracked and must be gone at the
    sitting's end.
- **habit-hooks limits**: functions at most 20 lines, at most 3 parameters, files at most 200
  lines, knip clean, a one-line purpose comment on every function in `src/` and `web/`, and no
  other comments.
- **Credentials**: the password goes only into `.env` (gitignored). Never
  print it, never put it on a command line (use `MYSQL_PWD`), never commit it.
- **Integration tests** connect only through `tests/helpers/testDb.ts`, which refuses any database
  name not ending in `_test`.
- **Edit files safely**: use Edit/Write, or scripts that read a file fully before writing it.
- **Commits**: only at the end of a sitting, and only when the owner asks.

## Test mix ledger

Fill this in at the end of each phase:

| Kind | Start | After S1 | After S2 | After S5 | Target (spec, amended) |
|---|---|---|---|---|---|
| Unit | 72 | 92 (37%) | 97 (38%) | 196 (75%) | 75% (accepted) |
| Integration | 135 | 128 (51%) | 126 (50%) | 41 (16%) | 16% (accepted) |
| UI | 29 | 29 (12%) | 29 (12%) | 26 (10%) | 10% |

**How to count** (the same way every time):
- **Tests**: lines matching `^\s*test\(` in `tests/**/*.test.ts(x)`, plus `test.each` rows. Compare
  the total with vitest's count, and note any difference.
- **UI**: every `.test.tsx` file.
- **Integration**: every file under `tests/integration/`, plus any other `.test.ts` that, directly
  or through a `tests/helpers/*.ts` it imports, matches
  `spawnSync|runCli|execFile|child_process|createServer|llmServer|listen\(|mkdtempSync|makeDataDir|writeFileSync|readFileSync|readdirSync`.
- **Unit**: everything else.

Keep the counting script in the scratchpad, and paste its output into Notes at each ledger
column.

---

## Phase 1: Setup

### Sitting S0: branch, baseline and settings (T001–T003; ends green with T001's baseline check, the only commit is T001's docs commit)

- [X] T001 Get ready to work:
  1. Commit the spec documents and constitution v1.4.0 on `mariadb-storage` (ask the owner first).
  2. Run `git switch main` in the main checkout. Only docs and `CLAUDE.md` differ, so
     `docker:watch` sees nothing.
  3. `git worktree add ../myjobbot-mariadb mariadb-storage`, then `npm ci`.
  4. Run `time npm run check` in the worktree; it must pass with 239 tests. Record the count and
     the elapsed time in Notes as the SC-004 baseline.
- [X] T002 **Approval gate (constitution IV).** The owner approved `mysql2` as the driver on
  2026-10-14 (research R1). Don't install anything yet: a dependency that nothing
  imports fails knip, so `kysely` and `mysql2` are installed in T019, the task that first imports
  them.
- [X] T003 Write `.env` with `MYJOBBOT_DB_HOST=192.168.3.10`,
  `MYJOBBOT_DB_USER=myjobbot`, `MYJOBBOT_DB_PASSWORD` (from the owner) and
  **`MYJOBBOT_DB_NAME=myjobbot_test`**. That way nothing run during the feature (an agent run, `npm
  run web`) can touch the production `myjobbot` database before the switch-over. Only T039's import
  names `myjobbot`, explicitly. Add the
  `MYJOBBOT_DB_*` and `MYJOBBOT_TEST_DB_NAME` lines to `.env.example`, commented and without
  values (contracts/storage.md).

---

## Phase 2: Foundational - async store interfaces, still on SQLite

**Purpose**: put the async store interfaces, the in-memory fake and the contract suite in place
while the app still runs on SQLite. Every new piece is used by production code as soon as it
exists: the SQLite classes implement the interfaces, and every caller awaits them. So habit-hooks
stays clean (constitution I), and the later switch to MariaDB is one small step.

### Sitting S1: async interfaces on SQLite (T004–T012; ends green, app still on SQLite)

#### Tests first

- [X] T004 [P] **Unit** `tests/storeContract.test.ts`, which runs `storeContract(makeStores)` from
  `tests/helpers/storeContract.ts` against `memoryStores()`. The contract has about 12 cases, each
  covering several methods, ported from `jobStore.test.ts` (5), `jobViews.test.ts` (6),
  `apiCalls.test.ts` (2) and `verdicts.test.ts` (4), which are then deleted:
  1. **Upsert**: inserts, and a later upsert refreshes the descriptive fields and `last_seen`, keeps
     `first_seen`, score and `hidden`.
  2. **Unscored jobs**: `unscoredSince` and `unscoredForSource` filter and order by `job_id`.
  3. **`boardCompaniesWithTitle`**: excludes `ats = 'jsearch'` and returns distinct companies.
  4. **`recordVerdict`**: updates every job with that `job_id`, appends one verdict per job, and
     returns false for an unknown job.
  5. **`earliestSeen`**: the least of the minimum `first_seen` and the minimum `posted_at`.
  6. **`pruneLastSeenBefore`**: returns the count and removes orphaned verdicts.
  7. **`findJob`**: the job, or null.
  8. **`scoredFrom`**: hidden jobs excluded, `score >= minScore`, sources filtered, newest first
     by `COALESCE(posted_at, first_seen) DESC, first_seen DESC, ats, job_id`.
  9. **`allJobs` and `countAllJobs`**: the same order, with paging.
  10. **`verdictHistory` and `countVerdicts`**: newest `scored_at` first, ties broken by newest
      insert, joined job fields, and null job fields for pruned jobs.
  11. **`setHidden`**: true or false, and flips the flag.
  12. **Exact text**: `abc` and `ABC` are two jobs; `Zürich C++ 🚀` round-trips; `ApiCallLog`
      `record`, `lastCallAt`, `countSince` and `pruneBefore` work.

  `storeContract.ts` exports one function that registers the cases, so knip sees every suite
  using it.
- [X] T005 [P] **Integration (temporary)** `tests/sqliteStoreContract.test.ts`: the same contract
  against the SQLite classes on `:memory:`, proving they still match the interfaces. T023 deletes
  it with SQLite.

#### Implementation

- [X] T006 `src/db/store.ts`: the `JobStore`, `JobViews` and `ApiCallLog` interfaces (async, the
  methods from contracts/storage.md) and the row types `JobRow`, `JobView` and `VerdictView`,
  moved here from the SQLite classes. `src/db/rows.ts` gets the pure mappers moved from
  `src/db/jobStore.ts`: `toParams`, `postingParams`, `detailParams`, `listParam`, `toFlag`, and the
  JSON decoding with `jsonList` from `columns.ts`.
- [X] T007 `tests/helpers/memoryStore.ts`: `memoryStores()` returns `{ jobStore, jobViews,
  apiCalls }` over shared arrays, implementing every contract rule. Split it by interface if it
  passes 200 lines (`memoryJobs.ts`, `memoryViews.ts`). T004 passes.
- [X] T008 The SQLite classes (`src/db/jobStore.ts`, `jobViews.ts`, `apiCalls.ts`) implement the
  interfaces: same SQL, `async` methods, mapping rows through `src/db/rows.ts`. T005 passes.
- [X] T009 Make the tools async: `src/tools/{boardFetch,searchFetch,searchBudget,recordMatches,
  jobSummary,getJobDetails,fetchJobs}.ts` await their store calls. `ToolContext` in
  `src/tools/context.ts` types `store: JobStore` and `apiCalls: ApiCallLog` from
  `src/db/store.ts`. Follow `await` through the agent loop wherever a tool result is now a promise.
  In `src/app/run.ts`, `pruneOldJobs` becomes async. Add a store seam:
  - **`RunSeams.openStores?: () => Promise<Stores>`**, where `Stores` is `{ jobStore, jobViews,
    apiCalls, close }` from `src/db/store.ts`.
  - **The default** for now builds the SQLite stores from `openDatabase(dataDir/myjobbot.db)`,
    with a no-op `close`.
  - **`runOnce`** awaits it in `buildContext` and calls `close()` in `finally`.

  T021 only swaps the default for MariaDB's `openStores`.
- [X] T010 `src/web/pageData.ts`: `loadPageData` and the three loaders become async.
  `web/lib/rows.ts` (`loadRows`, `setHiddenFor`), `web/lib/actions.ts` and `web/lib/uiState.ts`
  (`getUiState` returns the interfaces) await them. `web/components/pages/DataPage.tsx` becomes an
  `async` server component.
- [X] T011 Tests on the fake:
  - **Helpers**: `tests/helpers/context.ts` builds `testContext()` from `memoryStores()`, and
    `tests/helpers/views.ts`'s `seededViews` becomes `async seededStores(entries)`, seeding through
    the fake.
  - **Callers**: update every caller, adding `await`, with each converted file staying **unit**:
    `fetchJobs`, `finish`, `getJobDetails`, `listSources`, `recordMatches`, `searchSources`,
    `pageData` and `webRows`.
  - **`runOnce` callers**: every test that calls `runOnce` (`run`, `e2e`, `searchE2e`, `recovery`,
    `runIds` and `llm`) passes `openStores: async () => memoryStores()` (or a pre-seeded fake),
    so none of them touches SQLite or, after T021, MariaDB. They become **unit**, except where they
    still write files or start the fake LLM server. `cli.test.ts` only checks the usage message
    and needs nothing.
  - **`tests/hideJobs.test.ts`**: the store-level re-fetch test moves onto the fake (covered by
    contract case 1 too).
  - **Removed**: `tests/jobStore.test.ts`, `jobViews.test.ts`, `apiCalls.test.ts` and
    `verdicts.test.ts`, now ported into the contract.
- [X] T012 Close S1: `npm run check` is green, with no knip entries or snoozes. The app still
  runs on SQLite. Fill in the ledger's "After S1" column, and record `time npm run check` in
  Notes next to T001's baseline.

**Checkpoint**: everything is async behind interfaces; most tests run on the in-memory fake.

---

## Phase 3: User Story 1 - the agent and the UI work as before on MariaDB (Priority: P1) 🎯 MVP

**Goal**: the Kysely stores implement the same interfaces, and the agent and the web app switch to
them. SQLite is gone from normal use.

**Sittings**: S2 (T013–T023) writes the tests first, then adds the MariaDB modules and switches
both entry points to them, ending green. It may span turns; mid-sitting findings such as missing
imports are expected, and must be gone at T023. S3 (T024–T025) covers Docker. The manual check (T030) closes S4, because it seeds with the
importer.

**Independent Test**: on `myjobbot_test` seeded with a few jobs, `npm start -- run` with the
tests' fake LLM server (or a real run on the switch-over day) completes, and the four pages render
the seeded rows.

### Sitting S2: MariaDB under the same interfaces (T013–T023; ends green)

#### Tests first

- [X] T013 [P] [US1] **Unit** `tests/dbSettings.test.ts`, for `parseDbSettings(env)` in
  `src/db/settings.ts`:
  - **defaults**: port 3306, name `myjobbot`
  - **missing host, user or password**: the error names the variable
  - **port not a number**: refused
  - **the password never appears in any error message**: assert with a sentinel value
  - **`describeConnectionError(error, settings)`**: maps `ER_ACCESS_DENIED_ERROR` to "MariaDB at
    `<host>:<port>` rejected user `<user>`", and `ECONNREFUSED` / `ETIMEDOUT` / `EHOSTUNREACH` to
    "can't reach MariaDB at `<host>:<port>`"
- [X] T014 [P] [US1] **Unit** `tests/retry.test.ts`, for `withRetry(attempt, { tries: 3, delayMs:
  10_000, sleep })` in `src/db/retry.ts`:
  - succeeds on try 2 after one failure
  - gives up after 3 tries with the last error
  - waits 10 s between tries (fake `sleep` records the delays)
- [X] T015 [P] [US1] **Integration** `tests/integration/migrate.test.ts`:
  - on empty tables, `migrateToLatest` runs `001_initial` once; running it again does nothing
  - `jobs`, `verdicts` and `api_calls` exist with collation `utf8mb4_bin`
  - `myjobbot` and `myjobbot_test` report the same default character set and collation, read from
    `information_schema.SCHEMATA`, which works because the account can read both
- [X] T016 [P] [US1] **Integration** `tests/integration/storeContract.test.ts`, which runs
  `storeContract` against the Kysely stores on `myjobbot_test` via `tests/helpers/testDb.ts`. Each
  case starts with `emptyTables()`.

  It also has one MariaDB-only case for the spec edge case "a run and the UI write at the same
  moment". On two separate pools, `setHidden` and `recordVerdict` for the same job run together
  (`Promise.all`, repeated 20 times with alternating order). Afterwards the job has both the new
  score and `hidden = 1`, and exactly one verdict per round.
- [X] T017 [P] [US1] **Unit** `tests/run.test.ts`, added to: `runOnce` with an injected
  `openStores` seam:
  - **unreachable server**: a seam that fails 3 times ends the run with the connection message,
    and no tool is called
  - **pool lifecycle**: `close` is called on success and on failure
- [X] T018 [P] [US1] **UI** `tests/client/footer.test.tsx`: renders the `database` prop, for
  example `myjobbot T0 192.168.3.10`.

#### Implementation

- [X] T019 [US1] Install and configure:
  - **Packages**: `npm install --save-exact kyselyT00.29.6 mysql2T03.24.6` (T002's approval). Check
    the lockfile: `T0next/swc-*` 8, `T0rolldown/binding-*` 15, `T0img/*` 28. Run `npm ls kysely
    mysql2` and confirm one version of each.
  - **`vitest.config.ts`**: `node` gets `exclude: ["tests/integration/**"]`. Add an
    `integration` project with `include: ["tests/integration/**/*.test.ts"]`,
    `fileParallelism: false` and a 30 s timeout.
  - **`src/db/settings.ts`** (`parseDbSettings`, `describeConnectionError`; T013 passes) and
    **`src/db/retry.ts`** (`withRetry` with an injected `sleep`; T014 passes).
- [X] T020 [US1] Schema and Kysely stores:
  - **`src/db/schema.ts`**: the Kysely `Database` type, per data-model.md.
  - **`src/db/migrations/001_initial.ts`**: every table uses `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    COLLATE=utf8mb4_bin`, with the data-model types:
    - **jobs**: `ats VARCHAR(32)`, `job_id VARCHAR(255)`, `company VARCHAR(255)`, `source
      VARCHAR(255)`, `title VARCHAR(500)`, `normalized_title VARCHAR(500)`, `url VARCHAR(2048)`,
      `description MEDIUMTEXT`, JSON lists `TEXT`, timestamps `VARCHAR(32)`, scores `INT`,
      `hidden TINYINT NOT NULL DEFAULT 0`
    - **verdicts**: `id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`, `run_id VARCHAR(64)`
    - **api_calls**: `id BIGINT UNSIGNED AUTO_INCREMENT`, `api VARCHAR(32)`
    - **indexes**: per data-model.md

    Write one function per table so each stays within 20 lines.
  - **Migration plumbing**: `src/db/migrations/index.ts` lists the steps, and `src/db/migrate.ts`
    has `migrateToLatest(db)`, which throws with the failing step's name.
  - **`src/db/kysely/jobStore.ts`, `jobViews.ts` and `apiCalls.ts`**: the implementations, using
    research R3's forms:
    - **upsert**: `onDuplicateKeyUpdate` with `VALUES()`
    - **`recordVerdict`**: `SELECT ats … FOR UPDATE` then `UPDATE` then `INSERT` verdicts, all in
      `db.transaction()`
    - **`earliestSeen`**: `LEAST(...)`
    - **counts**: `Number(...)` on BigInt results
    - **`verdictHistory`**: orders by `scored_at DESC, id DESC`
- [X] T021 [US1] `src/db/connect.ts` and the agent switch:
  - **`openStores(settings, options)`**: builds a `mysql2` pool (`dateStrings: true`,
    `supportBigNumbers: true`, `connectionLimit: 4`, `connectTimeout: 3000`) and Kysely with
    `MysqlDialect` and an `onCreateConnection` hook running `SET NAMES utf8mb4 COLLATE
    utf8mb4_bin`. It checks the connection (`SELECT 1`) through `withRetry` (default 3 tries),
    runs `migrateToLatest`, and returns `{ jobStore, jobViews, apiCalls, close }`. Connection
    errors are rethrown via `describeConnectionError`.
  - **`src/app/run.ts`**: `RunSeams.openStores`'s default (from T009) becomes
    `openStores(parseDbSettings(environment))`, and the SQLite default and the `data/myjobbot.db`
    path go. Because T011 made every `runOnce` test inject the fake, none of them reaches MariaDB
    or needs `MYJOBBOT_DB_*`. T017 passes.
  - **`tests/helpers/testDb.ts`**: uses `openStores` with `MYJOBBOT_TEST_DB_NAME` (refusing
    non-`_test` names), `retry: { tries: 1 }` and `connectTimeout: 3000` (so an unreachable server
    fails each test in about 3 s), and provides `emptyTables()` (`DELETE FROM` on all three
    tables). It reads `.env` through `process.loadEnvFile` when it exists. T015 and T016 pass.
- [X] T022 [US1] Web switch: `web/lib/uiState.ts`:
  - **`getUiState()`** opens the stores once per server process, as a promise cached on
    `globalThis.__myjobbotStores`, cleared on failure so the next request retries. `retry: {
    tries: 1 }`, so a page fails fast to `error.tsx`.
  - **`dbLabel()`** returns `${name} T0 ${host}` from the settings, without connecting.

  `web/app/layout.tsx` passes `dbLabel()` to `Footer`, whose prop becomes `database`. T018
  passes.
- [X] T023 [US1] Remove SQLite from normal use:
  - **Delete** `src/db/jobStore.ts`, `jobViews.ts`, `apiCalls.ts` and `open.ts`, plus
    `tests/sqliteStoreContract.test.ts` (T005) and `tests/migration.test.ts`, which
    `tests/integration/migrate.test.ts` replaces.
  - **Check**: `grep -rn "node:sqlite" src web tests` should list only US2's files, which don't
    exist yet, so nothing at this point.
  - **Close the sitting**: `npm run check` is green with no knip entries.
### Sitting S3: Docker (T024–T025; ends green)

- [X] T024 [US1] Docker: `compose.yaml` needs no changes, because `env_file` already supplies
  `MYJOBBOT_DB_*`. Check that `tests/docker.sh` serve and run cases still pass when given
  `MYJOBBOT_DB_*` pointing at `myjobbot_test`. The script writes a temporary env file holding only
  the `MYJOBBOT_DB_*` lines from `.env`, plus `MYJOBBOT_DB_NAME=myjobbot_test`, using
  `grep '^MYJOBBOT_DB_'` and never printing it. It passes that file with `--env-file` and deletes
  it in an `EXIT` trap. So the script's deliberately bad `LLM_*` values still win, and the real
  `.env`'s LLM settings never reach the test containers.
- [X] T025 [US1] Fill in the ledger's "After S2" column.
**Checkpoint (MVP)**: the whole app runs on MariaDB in this checkout (stack still stopped); SQLite
is unused.

---

## Phase 4: User Story 2 - existing data moves across once, intact (Priority: P1)

**Goal**: `myjobbot import-sqlite <path>`.

**Independent Test**: import a copy of the real file into `myjobbot_test`. Counts match, a second
run is refused, and an over-long row is reported with nothing written.

### Sitting S4: the importer and the manual check (T026–T030; ends green)

- [X] T026 [P] [US2] **Unit** `tests/importPlan.test.ts`, for the pure parts in
  `src/app/importPlan.ts`:
  - **`oversizedValues(row, limits)`**: lists `table.column (length > limit)` using data-model's
    limits: `ats 32`, `job_id 255`, `company 255`, `source 255`, `title 500`, `normalized_title
    500`, `url 2048`, timestamps 32, `run_id 64`, `api 32`
  - **`batches(rows, 500)`**
  - **`sampleIndexes(count, 50)`**: spread evenly and deterministic
  - **`compareCounts(expected, actual)`**: names any table that differs
- [X] T027 [P] [US2] **Integration** `tests/integration/importSqlite.test.ts`, against a small
  seeded SQLite file in a temp folder:
  - **First import**: counts match, verdict `id`s equal the source `rowid`s, and a sample matches
    field by field.
  - **Second import**: refused ("target is not empty"), with nothing changed.
  - **A 600-character title**: refused with `jobs.title (600 > 500)` listed, and the target still
    empty.
- [X] T028 [US2] `src/app/importPlan.ts` (pure, T026 passes) and `src/app/importSqlite.ts`:
  1. opens the file with `new DatabaseSync(path, { readOnly: true })`
  2. reads `jobs`, `verdicts` (with `rowid`) and `api_calls`
  3. runs `oversizedValues` on every row
  4. checks the target is empty
  5. in one `db.transaction()`: inserts in batches, compares counts and a 50-row sample, and
     throws to roll back on any mismatch
  6. prints `jobs N, verdicts N, api_calls N, hidden N`

  `src/cli.ts` gets `import-sqlite <path>` (usage `myjobbot run | import-sqlite <path>`); update
  `tests/cli.test.ts`. T027 passes.
- [X] T029 [US2] Run it on a backup copy of the real data into `myjobbot_test`, timing it and
  recording the counts. Compare with `sqlite3 -readonly` counts: about 754 jobs, 720 verdicts, 45
  API calls and 196 hidden. Then empty the test tables.

- [X] T030 [US1] Manual check: `npm run web` (`.env` already names `myjobbot_test`), after seeding
  `myjobbot_test` with the importer (T028) from a copy of `data/myjobbot.db`. The four pages
  render, and Hide works. Then empty the test tables. This closes S4.

---

## Phase 5: User Story 3 - recorded, repeatable schema changes (Priority: P2)

### Sitting S5: schema changes and test mix (T031–T035; ends green)

- [X] T031 [P] [US3] **Integration** `tests/integration/migrate.test.ts`, extended:
  - **A rename keeps data**: a throwaway step list `[001_initial, 002_test_rename]`, where `002`
    renames `jobs.compensation` to `pay` and back, run on `myjobbot_test`. The value is kept.
    This uses its own migration table names (`test_kysely_migration…`), which are dropped
    afterwards.
  - **Two at once**: two concurrent `migrateToLatest` calls on separate pools run each step once
    (R5).
- [X] T032 [US3] Document how to add a step in `CLAUDE.md` (Conventions):
  - add `src/db/migrations/00N_name.ts`
  - list it in `index.ts`
  - update `src/db/schema.ts`
  - add a contract case if behaviour changes

---

## Phase 6: User Story 4 - mostly fast, exact tests (Priority: P2)

- [X] T033 [P] [US4] `src/config/load.ts`: add a pure `parseFileConfig(text)` that
  `loadFileConfig` uses. Convert `tests/config.test.ts` so 21 of its 22 tests call
  `parseFileConfig` (**unit**, including invalid JSON, which is just text). Only the
  YAML-leftover test reads files (**integration**), because it is about which file exists.
  `loadConfig`'s own tests that need `resume.md` share one temp folder with that test.
- [X] T034 [P] [US4] Move load-more logic out of the UI tests: duplicate skipping and the
  stale-reply version checks in `tests/client/loadMore.test.tsx` become **unit** tests of
  `withMore`, `withoutJob` and `withJobHidden` in `tests/pageRows.test.ts`. Keep one scroll test
  and one Load more button test as **UI**.
- [X] T035 [US4] Recount the mix and fill in the ledger's "After S5" column. It must show at least
  80% unit, at most 10% integration and at most 10% UI (SC-004). If integration is over 10%,
  convert `tests/runIds.test.ts` and `tests/trace.test.ts` to in-memory writers before going on.
  Record what's left for 95/4/1 in Notes.

  Then measure SC-004: run `time npm run check` three times and record the median next to T001's
  baseline. If it's slower, record which project costs the time (`npx vitest run --project
  integration`, and so on) and fix it before going on. For example, migrate once per file in
  `testDb.ts` instead of per test, or empty the tables in one statement.

  Then check spec US4.3: run `MYJOBBOT_DB_HOST=192.0.2.1 npx vitest run`, a reserved address that
  never answers. The `node` and `dom` projects pass. Every integration test fails with "can't reach
  MariaDB at 192.0.2.1:3306", and none fails any other way. Record the result in Notes.

---

## Phase 7: Switch-over and polish

### Sitting S6: docs, review and quickstart (T036–T038; ends green, then commit with the owner's OK)

- [X] T036 [P] Update `README.md`:
  - **Storage section**: MariaDB, `MYJOBBOT_DB_*`, backups are the server's.
  - **Setup**: `.env` lines.
  - **The test mix** and the `integration` project.
  - **`import-sqlite`**.
  - **`data/`** now holds config, resume, traces and the old SQLite backup.

  `CLAUDE.md`: commands (`import-sqlite`, the integration project needs `.env`).
- [X] T037 Run a read-only review agent over `git diff main`. It checks:
  - every query parameterised (no string-built SQL except the fixed DDL)
  - the password never logged
  - `SET NAMES` on every connection
  - transactions in `recordVerdict` and the import
  - pools closed
  - the agent never imports `web/` or `next`

  Fix confirmed findings test-first.

  Done 2026-10-14: all eight checks passed with no code findings. Kysely's MySQL driver runs
  `onCreateConnection` once per physical connection. The one note, that the README's `CREATE
  DATABASE` collation read as if it governed comparisons, was fixed in the README wording.
- [X] T038 Run the quickstart's automated table and check every row. Time the four pages and Hide
  against `myjobbot_test` seeded from a 1,000-job copy: first rows within 1 s, Hide within 0.5 s
  (SC-003).

  Done 2026-10-14. The seed was a copy of live SQLite plus 300 duplicated jobs (1,072 jobs, 890
  verdicts), imported in 3.4 s. Production build, first byte over 3 loads: /recommended
  0.38–0.56 s, /jobs 0.22–0.25 s, /reasoning 0.04 s, /settings 0.01 s. Hide (`setHidden`) took
  12 ms warm and 96 ms on the first call, including the connection; it was timed at the store
  because there is no Playwright browser. The test tables were emptied afterwards. The automated
  rows are covered by the contract, migrate, import and settings tests; the mix stands at the
  owner-accepted 75/16/10.
### Sitting S7: switch-over, with the owner (T039)

- [X] T039 **Switch-over (with the owner, no run in progress, `docker:watch` stopped)**:
  1. `docker compose top myjobbot` is idle.
  2. **Snapshot the pages (SC-002)**: save
     `curl -s -H "Host: localhost:8080" localhost:8080/{recommended,jobs,reasoning}` to
     `/tmp/pre-*.html`, then strip the `<footer>…</footer>` element and Next.js's `<script>` tags
     with a small script, keeping only `<main>`. Also strip the "N days open" and "possible ghost"
     text, which change at midnight, so a switch-over that spans midnight compares cleanly.
  3. Back up SQLite to `data/myjobbot-pre-mariadb.db`.
  4. Add `MYJOBBOT_DB_*` to the main `.env`.
  5. Run `MYJOBBOT_DB_NAME=myjobbot npm start -- import-sqlite <backup>`. This
     is the only command that names the production database explicitly; it overrides
     `.env`'s `myjobbot_test`. Record the counts.
  6. With the owner's OK, merge or PR. Then in the main checkout, `git switch -C main origin/main`
     (pull first; memory note), and run `npm run docker:up`.
  7. **Compare the pages (SC-002)**: snapshot the three pages again the same way, and `diff` each
     `<main>` against step 2's. They must be identical; record the result in Notes. (Do this
     before any run adds jobs.)
  8. Check Hide, then one `docker compose run --rm myjobbot run`.
  9. Set `MYJOBBOT_DB_NAME=myjobbot` in `.env`; `docker compose up -d` (or restart `docker:watch`).

  The rollback is the previous `main` plus `docker:up`; the SQLite file is untouched.

  Progress 2026-10-14: steps 1–4 done. The stack was idle. The "before" snapshots were taken with
  `next dev` from a `main` worktree over a copy of the backup (stable across two takes: 37, 102
  and 102 rows). The backup holds 772 jobs, 735 verdicts, 47 api_calls and 196 hidden. PR #8 is
  open.

  Done 2026-10-15:
  - Step 5: the import printed `jobs 772, verdicts 735, api_calls 47, hidden 196`, the backup's
    counts. `.env` was switched to `myjobbot` before `docker:up` (step 9 moved ahead of step 6),
    because the containers read `.env` and the comparison needs production.
  - Step 6: PR #8 was merged by the owner; `main` updated; `npm run docker:up`.
  - Step 7: /reasoning was identical. /jobs and /recommended differed only in one job,
    `jsearch/js_7a223961601b5840`, hidden after the import (197 hidden vs the copied 196), which
    takes /recommended from 36 to 35. Every other row matched.
  - Step 8: that hide shows Hide writing to MariaDB. `docker compose run --rm myjobbot run`
    (run 38e355c6) finished and wrote 10 jobs, 6 verdicts and 2 api_calls to MariaDB. Its Boise
    search hit a JSearch timeout, unrelated to storage.

---

## Notes

- **S0 / T001** (2026-10-14): planning committed as `a04c5d9`. Started in a worktree; the owner then
  moved spec work to the main checkout. The worktree was removed, this checkout switched to
  `mariadb-storage`, and the Docker stack was stopped (no run in progress). Baseline: `npm run check` green, 239 tests in 51 files,
  habit-hooks clean, **9.61 s** (SC-004 baseline).
- **T002**: mysql2 approved by the owner (2026-10-14).
- **T003**: `.env` (gitignored) gained `MYJOBBOT_DB_HOST`, `_USER`, `_PASSWORD` and
  `MYJOBBOT_DB_NAME=myjobbot_test`; `.env.example` lists the `MYJOBBOT_DB_*` and
  `MYJOBBOT_TEST_DB_NAME` settings without values.
- **Workflow change (owner, 2026-10-14)**: spec work moved from the worktree to the main checkout,
  with the Docker stack stopped (`docker compose stop`; no agent run was in progress). Constitution
  v2.1.0, `CLAUDE.md` and the tasks template say so. The Stop hook now reports instead of blocking
  while `.specify/sitting-in-progress` names a sitting; the pre-commit hook still blocks.
- **S1 (T004–T012), green**: `npm run check` passes, with 252 tests and habit-hooks clean, in
  **7.22 s** (baseline 9.61 s; the SQLite store tests went into the contract).
  - **Contract**: `tests/helpers/storeContract.ts` has 13 cases. It passes against
    `memoryStores()` (`tests/storeContract.test.ts`) and the SQLite classes on `:memory:`
    (`tests/sqliteStoreContract.test.ts`, deleted in S2).
  - **Store interfaces** in `src/db/store.ts`, row schemas and mappers in `src/db/rows.ts`, and
    `openSqliteStores` in `src/db/sqliteStores.ts`. The SQLite classes are now
    `SqliteJobStore`, `SqliteJobViews` and `SqliteApiCallLog`.
  - **`runOnce`** takes `RunSeams.openStores` (default: SQLite) and closes the stores in
    `finally`. Every `runOnce` test passes the fake.
  - **Async all the way**: tools, `pageData`, `web/lib/rows.ts` and `DataPage`.
  - **`verdicts.test.ts`**: keeps its SQLite backfill test until S2 deletes `open.ts`; its tool
    tests use the fake.
  - **Ledger caveat**: about 60 in-memory tests still count as integration under the counting
    rules, because they import helpers that touch files when loaded (`helpers/dataDir.ts` makes
    a temp folder at import; `helpers/trace.ts` has a file reader). Splitting those helpers is
    S5's job (T035).
- **S2 (T013–T023), green**: the app runs on MariaDB, and SQLite is gone from `src/`, `web/` and
  `tests/` (`grep node:sqlite` finds nothing). `npm run check`: 256 tests, habit-hooks clean,
  **13.33 s**; the integration project alone takes 4.9 s.
  - **SC-004**: the check is slower than the 9.61 s baseline. T035 must deal with it.
  - **Packages**: `kysely` 0.29.6 and `mysql2` 3.24.6, exact. The lockfile only added entries
    (11), and still has swc 8, rolldown 15, img 28.
  - **Integration, first run on MariaDB**: all 16 pass against `myjobbot_test`: the 13 contract
    cases, the 20-round Hide-and-score race (both writes always land) and the 2 migrate tests.
    `setHidden` with an unchanged value returns true on MariaDB too (mysql2 counts found rows).
  - **Modules**:
    - `src/db/database.ts` (pool, `SET NAMES`)
    - `src/db/kysely/stores.ts` (`storesOver`)
    - `src/db/connect.ts` (`openStores`: retry, migrate, close on failure)
    - `src/db/settings.ts`, `src/db/retry.ts`, `src/db/migrate.ts`
    - `src/db/migrations/001_initial.ts`
    - `src/db/schema.ts`

    `createDatabase` and `storesOver` live in their own modules because knip flagged them as
    test-only exports of `connect.ts`.
  - **`runOnce`**: `openStores` is now a no-argument seam. The default reads `MYJOBBOT_DB_*` from
    the environment.
  - **Web**: `getUiState()` is async and caches the open stores on `globalThis` (cleared on
    failure). The footer shows `dbLabel()`.
  - **Removed**: the SQLite verdict-backfill test, with `open.ts`.
- **S3 (T024–T025), green**: `tests/docker.sh` passes all 10 checks. The `serve` container gets
  only the `MYJOBBOT_DB_HOST/PORT/USER/PASSWORD` lines from `.env`, through a temporary env file
  (removed on exit), with `MYJOBBOT_DB_NAME=myjobbot_test`, and renders pages from MariaDB.
- **S4 (T026–T030), green**: `npm run check` passes, with 264 tests and habit-hooks clean.
  - **The importer**: `myjobbot import-sqlite <path>` (`src/app/importSqlite.ts`, with the pure
    `src/app/importPlan.ts`). Its 3 integration tests pass: a full copy that keeps verdict order
    and exact text, a second run refused, and an over-long title stopping the copy before
    anything is written. `connect.ts` gained `connectDatabase`, which `openStores` uses too.
  - **Rehearsal (T029)** on a `.backup` copy of the live file into `myjobbot_test`: jobs 772,
    verdicts 735, api_calls 47, hidden 196, matching the source exactly. It took **3.12 s**. A
    second run was refused ("target is not empty"), with nothing changed.
  - **Found at T030**: `npm run web` never read the root `.env`, because Next.js only loads
    `web/.env`, so local pages had no database settings. Docker wasn't affected, since Compose
    passes `.env` as environment variables. Fix: `web/lib/uiState.ts` loads the root `.env` (when
    present, without overriding) before reading the settings, as `src/cli.ts` does.
  - **Manual check (T030)**, `npm run web` on the imported copy: Recommended 36 (threshold 60),
    All jobs 772, Reasoning 735, and the footer shows `myjobbot_test @ 192.168.3.10`. In headless
    Chromium, Hide took 288 ms and stayed hidden after a reload (36 → 35), scrolling loaded all
    772 rows, and there were no page errors. Test tables emptied afterwards.
- **S5 (T031–T035)**: `npm run check` passes, with 267 tests and habit-hooks clean.
  - **T031**: a throwaway step renamed `jobs.compensation` to `pay` and back, and the value
    survived both. In a separate test, two migrators started at once on a freshly dropped
    database ran `001_initial` exactly once (merged with the fresh-schema and collation checks to
    save one schema rebuild).
  - **T032**: `CLAUDE.md` explains how to add a schema step, the stores, and the new commands.
  - **T033**: the config parsing moved to `src/config/parse.ts` (`appConfigFrom`,
    `parseFileConfig`), with `load.ts` as a thin file reader. `config.test.ts` is now all unit;
    `configFiles.test.ts` keeps 2 file tests.
  - **Other helper splits**:
    - `helpers/trace.ts` now holds only the in-memory trace; its file readers moved to
      `helpers/traceFiles.ts`.
    - Fixtures are imported as JSON modules (`resolveJsonModule`).
    - The prompt tests use an in-memory `testAppConfig()`.
  - **T034**: 3 load-more cases became unit tests of `web/lib/pageRows.ts`
    (`tests/pageRows.test.ts`, 4 tests); 2 UI tests remain.
  - **T035 (open: decisions needed)**:
    - **Mix**: 75% unit, 16% integration, 10% UI. **Below the spec's at least 80% unit and at
      most 10% integration.** The remaining 41 integration tests are mostly genuine: 10 through
      `runOnce` (it reads config files and writes traces), 20 MariaDB, 2 CLI, 3 against the fake
      LLM HTTP server, 3 walkthrough file checks, and a few file-trace tests.
    - **Speed (SC-004)**: median of three `npm run check` runs is **15.47 s**, against the
      **9.61 s** baseline (18.04 s before the schema-rebuild merge). By part: typecheck 3.2 s,
      node 2.3 s, dom 0.5 s, integration 8.5 s, habit-hooks 1.3 s. The integration time is the
      real server: dropping and recreating the schema about 2.5 s, the rename about 1.6 s, and
      the contract and import about 4 s.
    - **US4.3 check**: `MYJOBBOT_DB_HOST=192.0.2.1 npx vitest run` passes every `node` and `dom`
      test. Every integration file fails with "can't reach MariaDB at 192.0.2.1:3306" (its tests
      skipped), with no other error, after guarding `afterAll` when connecting fails.
  - **Owner decisions (2026-10-14)**:
    - The mix is accepted at 75/16/10 for this feature; spec US4.1 and SC-004 are amended.
    - The MariaDB tests moved out of `npm run check` into `npm run check:db` (`test:db` runs the
      `integration` project), required at every sitting's end and before commits and PRs.
      Constitution v2.2.0 and `CLAUDE.md` say so.
    - Result: `npm run check` median **7.41 s** (3 runs: 7.43, 7.41, 7.53), faster than the 9.61 s
      baseline. `npm run check:db` takes 11.6 s for 20 tests.

## Dependencies & Execution Order

Each sitting ends green. They run in order:

- **S0 (T001–T003, setup)**: the branch, the baseline and the settings. T002 (mysql2 approved) is done; the
  install happens in T019.
- **S1 (T004–T012, foundational)**: async interfaces on SQLite. Blocks everything else.
- **S2 (T013–T023, US1)**: tests first, then MariaDB and the switch. The MVP is complete at
  T023.
- **S3 (T024–T025, US1)**: Docker, after S2.
- **S4 (T026–T030, US2 and US1's manual check)**: the importer, then the manual check that seeds
  with it. Needs S2.
- **S5 (T031–T035, US3 and US4)**: needs S2's migrations. T035 counts the tests from S1–S4, so it
  comes last in S5.
- **S6 (T036–T038, polish)**: docs, review and quickstart; then a commit with the owner's OK.
- **S7 (T039)**: the switch-over, with the owner.

## Parallel Opportunities

- **S1's tests**: T004 and T005.
- **S2's tests**: T013–T018, separate files written first within S2.
- **Independent of S2's files**: S4's T026–T027, and S5's T031, T033 and T034.
- **Docs only**: T036.

Same-file order:
- `tests/integration/migrate.test.ts`: T015, then T031
- `src/cli.ts`: T028 only
- `vitest.config.ts`: T019 only
- `tests/run.test.ts`: T011 (fake helpers), then T017

## Implementation Strategy

1. **Phases 1–2**: the branch, a stopped stack, and every caller async behind interfaces, still on SQLite and
   green. Most tests now run on the in-memory fake.
2. **US1 (MVP)**: in one sitting, add MariaDB under the same interfaces, switch the agent and the
   web app, and delete SQLite. It's green before and after.
3. **US2**: the importer, rehearsed on a copy of the real data.
4. **US3 and US4**: rename and concurrency proof, and the test mix brought to the spec's target.
5. **Switch-over**: in one sitting with the owner, with the SQLite file kept as the rollback.
