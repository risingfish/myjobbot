# Tasks: SOLID conformance across the whole app

**Input**: Design documents from `docs/specs/028-solid-conformance/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, inventory/

**Tests**: required by constitution Principle II. Each sitting writes its tests first: guard tests
(FR-005) for the fixes, contract and report tests for the follow-ups.

**Organization**: by user story. US2, the 027 follow-ups, is done first, because it is small,
independent and holds the one database step (research R4). US1, the review's fixes, follows in
sittings S2–S7. S8 closes the feature.

**Finding IDs** (A1, D3, W7, …) refer to the inventory files under `inventory/`. Each finding's
**Fix** line is the specification for its task: what moves where, the new type or table, and the
callers it touches. A task that names a finding implements that Fix exactly, unless its task says
otherwise.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (the SOLID fixes) or US2 (the 027 follow-ups)

## Sittings

Every sitting:
- starts by creating `.specify/sitting-in-progress` naming it
- runs with the Docker stack stopped, except S7b, which changes only components (constitution 2.5.0,
  UI work)
- ends with `npm run check` and `npm run check:db` green, the ledger recorded, a review against
  Principle VI, each fixed finding marked in its inventory file (`- **Done**: <sitting>`), and the
  marker deleted
- ends with a commit (owner decision 2026-11-09)

**Delivery** (research R9, owner decision 2026-11-09): every sitting part is worked through
without stopping for confirmation, committed when it ends green, and followed straight away by the
next. One pull request is opened at the end, with a commit per part. The three largest sittings
(S2, S3, S6) are split into two parts, `a` then `b`, and S7 into a stack-stopped part and a UI-only
one. Each part is a sitting of its own: it creates the marker naming the part, writes its own tests
first and ends with the steps above. The split of each sitting's tasks is given under its heading.
The start and end tasks (for example T012 and T023) are done once for each part.

Every fix keeps every existing test's expectations, except a test that asserts the structure being
changed (FR-004). The run prompt snapshot must not change.

---

## Phase 1: Setup

- [X] T001 Record the baseline on the branch: `npm run check` and `npm run check:db` green, and the
  counts in the ledger below (expected unit 1142, integration 89, UI 78). Note them in this file.
  - 2026-11-09: both green. Unit and UI 1220 (1142 + 78) in 228 files; integration 89 (88 passed,
    the real-browser case skipped without `MYJOBBOT_TEST_BROWSER_URL`).

---

## Phase 2: User Story 2 — the 027 follow-ups (Priority: P2) — Sitting S1

**Goal**: FR-008, FR-009, FR-010.

**Independent Test**: quickstart §S1. Step 024 drops the digest mark, or refuses when a posting holds
one. Eval reports name their user and warn when compared runs differ.

### Sitting S1: the digest mark, the eval run's user, the unused log method

- [X] T002 Create `.specify/sitting-in-progress` naming S1.

**Tests first (S1)**

- [X] T003 [P] [US2] Write one integration test in a new
  `tests/integration/digestMarkMigration.test.ts`, in the style of
  `tests/integration/userJobsMigration.test.ts`. It covers both outcomes of step
  `024_jobs_without_digest_mark` in one database setup, so the step costs one integration case:
  - with one posting's `emailed_at` set, the step fails with an error containing
    `1 postings have an email-digest mark, which nothing should have written; restore or clear it before upgrading`,
    and the column is still there. `migrateToLatest` wraps it as
    `schema step 024_jobs_without_digest_mark failed: …` (`src/db/migrate.ts`).
  - with the mark cleared, the step runs, drops `jobs.emailed_at`, and leaves the posting, view and
    verdict counts unchanged

  Call `migrateBefore(db, "024")` (`tests/helpers/migrationSteps.ts`), seed the rows, then
  `migrateUpTo(db, "025")`: first expect the refusal, then clear the mark and expect it to run
  `["024_jobs_without_digest_mark"]`. `migrateUpTo` runs only the steps whose names sort before the
  one given.
- [X] T004 [P] [US2] Write unit tests (9). The wording is in `contracts/eval-report.md`.

  Seven are in `tests/evalRunUser.test.ts`, with the memory file port
  (`tests/helpers/memoryFilePort.ts`):
  - `executeRun` with `RunDeps.userId` 2 writes `"userId": 2` in `run.json`. The default of user 1
    comes from `storesFor`, which `tests/cliUser.test.ts` already covers.
  - a `run.json` without `userId` parses
  - `eval report` prints the header line ending `· user 2`, and `· user not recorded` for the old file
  - `--against` prints `note: these runs were scored for different users (1 and 2)` just before the
    comparison lines
  - `--against` with an old run prints
    `note: a run's user wasn't recorded, so the users can't be checked`. There is no note for two
    runs of the same user.
  - `--against observed` prints `note: some cases were captured from another user's scores` when
    the run's user differs from a compared case's `userId`, and
    `note: a run's or case's user wasn't recorded, so the users can't be checked` when either is
    missing
  - `eval series report` names each test's user, and a test with no run shows no user

  One is in `tests/importPlan.test.ts`: `splitJob` leaves `emailed_at` out of the posting it builds
  from an old SQLite row.

  One is in `tests/storeMethodsUsed.test.ts` (D8, D10): every method of every `…Store`, `…Log` and
  `…Views` interface in `src/db/*.ts` is called somewhere in `src/` or `web/` outside `src/db/`.
  - A distinctive name matches on `.<method>(`.
  - A generic name (`record`, `spend`, `lookup`, `left`, `replace`, `make`, `list`, `save`, `run`)
    must be called on a receiver named after a store: a property of `SharedStores` or
    `UserStores`, or a name ending in `store` or `log` (`apiCalls.record(`, `store.run(`). That
    way an unrelated `z.record(` or `this.record(` can't satisfy it.

**Implementation (S1)**

- [X] T005 [US2] Add step `src/db/migrations/024_jobs_without_digest_mark.ts`:
  - count `jobs` rows with `emailed_at IS NOT NULL` through `selectFrom`
  - with any, throw `new Error(\`${n} postings have an email-digest mark, which nothing should have written; restore or clear it before upgrading\`)`.
    The migrator adds the step's name.
  - otherwise `alterTable("jobs").dropColumn("emailed_at")`

  Type the step with `db.withTables<...>()`, and list it in `src/db/migrations/index.ts`. Then:
  - remove `emailed_at` from `JobsTable` in `src/db/schema/jobs.ts`
  - remove it from the memory twin's rows (`tests/helpers/memoryJobStore.ts`)
  - append `"024_jobs_without_digest_mark"` to the step list that
    `tests/integration/migrate.test.ts` expects (FR-004's structure exception)
  - in `src/app/importPlan.ts`, add `RETIRED = new Set(["emailed_at"])`, which `splitJob` leaves out
    of the posting, and remove `emailed_at` from `LIMITS`, so `import-sqlite` still reads an old
    database that has the column
- [X] T006 [US2] Record the run's user: add `userId: z.number().int().min(1).optional()` to `runs` in
  `src/evals/format.ts`. Add `userId: number` to `RunDeps` (`src/evals/runCases.ts`), and set it in
  `started()`. `withRunDeps` in `src/evals/command.ts` passes `mine.userId`. Series runs go through
  `executeRun`, so they record theirs too.
- [X] T007 [US2] Show it:
  - `headerLine` in `src/evals/reportText.ts` appends `· user <id>` or `· user not recorded`, after
    the view and before `· unfinished`
  - a plain module `src/evals/userNote.ts` holds `runsNote(a: Run, b: Run)` and
    `observedNote(run: Run, cases: EvalCase[])`. Each gives the note or null.
  - `reportLines` takes the note as a parameter and places it right before `comparisonLines`.
    `reportCommand.ts` passes the note for `--against`.
  - `src/evals/seriesReport.ts` names each test's user in the same words. A test with no run shows
    none.

  Under FR-004's output exception, update the assertions whose expected header or series line FR-009
  changes:
  - `tests/evalReport.test.ts:76` and `:81`: their fixture run has no `userId`, so they gain
    `· user not recorded`
  - `tests/evalSeriesReport.test.ts:15`: its anchored line
- [X] T008 [US2] D8 and D10, the store methods nothing calls:
  - remove `lastCallAt` from `ApiCallLog` (`src/db/store.ts`), `src/db/kysely/apiCalls.ts` and
    `MemoryApiCallLog` (`tests/helpers/memoryStore.ts`). Drop its calls from the
    `tests/helpers/storeContract.ts` expectation and keep the `countSince` check.
  - remove `isAdmin` from `AccountStore`, `KyselyAccountStore` and `MemoryAccountStore`. Change
    `tests/helpers/accountContract.ts:32-33` and `tests/adminFlow.test.ts:34,47` to read
    `(await accounts.account(id))?.isAdmin` (FR-004's structure exception).
- [X] T009 [US2] Docs:
  - `docs/cli.md` (Evals): reports name the user, and comparisons note different users
  - `docs/database.md`: `jobs` loses `emailed_at` in the diagram
  - `docs/deploying.md`, "Upgrading to per-user data": one line that the release with step 024
    needs a backup first, linking `docs/upgrade-to-accounts.md`'s backup step
- [X] T010 [US2] Walk quickstart §S1 by hand and record the result here:
  - one real `eval run --tag baseline` for user 1 and one with `--user` for a second account, then
    `eval report --against`
  - step 024 on a copy of production's database: `scripts/copy-prod.sh myjobbot_dev`, then start the
    app against it (quickstart §S1 step 1). The dev database login works again (checked
    2026-11-09).
  - 2026-11-09 result:
    - `eval run --case greenhouse-6637207` against the real model wrote `"userId": 1`, and
      `eval report 20261109-083650-4436 --against 20261105-211626-815a` printed the header ending
      `· user 1` and `note: a run's user wasn't recorded, so the users can't be checked` right
      before the `against` line. The dev database has no second account, so the `--user` half rests
      on `tests/evalRunUser.test.ts`.
    - `scripts/copy-prod.sh myjobbot_dev --yes` failed: the server refuses the read-only
      `myjobbot_copy` login (1045). The script drops the target's tables before reading production,
      so it left `myjobbot_dev` empty. Starting the app then ran every step from 001 to
      `024_jobs_without_digest_mark` on it, ending with no `jobs.emailed_at`. Step 024 on a populated
      027 database, refused and then run, is `tests/integration/digestMarkMigration.test.ts`.
- [X] T011 [US2] Run both checks until green, record the ledger, review S1 against Principle VI, mark
  D8 and D10 done in `inventory/06-stores-database.md`, and delete the marker.

**Checkpoint**: S1 can ship on its own (with its backup note).

---

## Phase 3: User Story 1 — every part of the app conforms to SOLID (Priority: P1)

**Goal**: FR-001–FR-007. All 61 fix findings fixed, guard tests in place (D8 and D10 are done in S1).

**Independent Test**: per sitting, quickstart "Every sitting". At the end, quickstart "At the end".

### Sitting S2: stores and database (D1–D7, D9)

Stores first: every later sitting imports these interfaces.

Two parts:
- **S2a**, moving the types (D9, D6): T013, T014's D6 case, T016, T017
- **S2b**, the store splits and one user list (D1–D5, D7): T014's D4 and D5 cases, T015, T018–T022

S2a also fixed a deadlock that was already on `main` (found 2026-11-09): two users storing the same
new posting at once deadlocked in `upsertAll` (`plainPostings` reads the keys `FOR UPDATE`, and
both transactions then insert into the same gap), failing the race contract case 4 times in 5 when
run alone. `withRetry` (`src/db/retry.ts`) takes a `retryable` test, and `upsertAll` runs its
transaction again on a deadlock only (`isDeadlock`, error 1213), as MariaDB advises. One unit test
in `tests/retry.test.ts` covers it (+1 unit beyond the plan).

- [X] T012 Create `.specify/sitting-in-progress` naming S2.

**Tests first (S2)**

- [X] T013 [P] [US1] Write 1 unit test in `tests/storesShape.test.ts`: the `Stores` and `UserStores`
  objects from `memoryStores()` and `storesOver(db)` have no function members other than `forUser`
  and `close`. The research R7 guard: a container holds stores, not operations. It passes today, so it
  is a regression guard rather than a failing-first test.
- [X] T014 [P] [US1] Write unit tests (3) in `tests/storeVariantScan.test.ts`, in the style of
  `tests/wayBranches.test.ts`:
  - D4: no `src/db/**/*.ts` file (applied steps excepted) or `tests/helpers/memory*.ts` file compares
    against a registered module id from `MODULES` (`src/sources/registry.ts`) or `"linkedin"`.
    That means `[!=]==\s*"<id>"`, or the id inside a `"not in", [...]` list. A row literal such as
    `ats: "greenhouse"` in `tests/helpers/memoryCompanies.ts` is data, not a branch, and passes.
  - D5: no token store compares a `LinkPurpose` literal
  - D6: `OWNER_ID` is declared only in `src/db/owner.ts`, and `ensureOwner…` is defined only in
    `src/db/kysely/owner.ts`. The D8/D10 guard is S1's (T004).
- [X] T015 [P] [US1] D7: add contract cases. Each runs on memory (unit) and on MariaDB
  (integration):
  - "a write for a user that doesn't exist is refused", in `tests/helpers/resumeContract.ts` and
    `tests/helpers/sourceContract.ts` (2 cases)
  - in `tests/helpers/searchSettingsContract.ts`, the existing test "search settings round-trip
    exactly, create the one owner with the first save, …" also expects
    `stores.accounts.userIds()` to be `[OWNER_ID]` after the first save. It already checks on
    MariaDB that the first save creates user 1, so this is one more assertion in that test, not a
    new case. It fails on memory until T022 gives the memory stores one users table.

**Implementation (S2)**

- [X] T016 [US1] D9: move the types out of `src/db/store.ts`, members unchanged:
  - `JobStore`, `JobRow`, `Verdict` and `VerdictStamp` to `src/db/jobStore.ts`
  - `JobViews` and its view types to `src/db/jobViews.ts`
  - `ApiCallLog` to `src/db/apiCallLog.ts`
  - `GmailStore`, `AlertStore` and their rows to `src/db/gmailStore.ts`

  `store.ts` keeps `JobKey`, `CompanyPage`, `FoundDescription` and the containers. Update the
  importers.
- [X] T017 [US1] D6: move `OWNER_ID` to `src/db/owner.ts` and `ensureOwner` to
  `src/db/kysely/owner.ts` as `ensureOwnerFor(trx, userId, at)`. The settings, source, resume and
  account stores call it, and so does the SQLite import, whose own insert of the owner's row
  (`src/app/importSqlite.ts:84`) is a fourth copy of the rule. Update every `OWNER_ID` importer
  (`src/cli.ts`, `src/cliUser.ts`, `src/config/resumeFile.ts`, the stores, the tests).
- [X] T018 [US1] D1: `AttemptStore` (`recordAttempt`, `countAttempts`, `AttemptKind`, `AttemptKey`)
  in `src/db/attemptStore.ts`, with `src/db/kysely/attemptStore.ts` and
  `tests/helpers/memoryAttemptStore.ts`. Add `attempts` to `SharedStores`, and wire it in
  `src/db/kysely/stores.ts` and `memoryStores`. Move the callers and the attempt contract cases.
- [X] T019 [US1] D2: `SecurityEventLog` (`record`, `recent`, `SecurityEvent`) in
  `src/db/securityEventLog.ts`, with its Kysely and memory implementations. Add `events` to
  `SharedStores`. Callers: `src/accounts/flows/securityEvents.ts`, `web/lib/accountState.ts`, the flow
  context's `Pick`, and `tests/helpers/accountContract.ts`.
- [X] T020 [US1] D3 then D5:
  - split `TokenStore` into `AccountCodeStore`, `EmailLinkStore` and `RecoveryCodeStore`, each with
    its Kysely and memory implementation
  - replace `tokens` in `SharedStores` with `accountCodes`, `emailLinks` and `recoveryCodes`
  - update the callers and the flow context's `Pick`, and split `tests/helpers/tokenContract.ts` by
    store
  - then D5: export `boundToSession(purpose)` from a `SESSION_BOUND: Record<LinkPurpose, boolean>`
    beside `LIFETIME_MINUTES`, and both email link stores use it instead of naming `"step_up"`
  - the email link store's interface module keeps no runtime imports, as `tokenStore.ts` has none
    today, because a client component (`web/components/account/LinkButton.tsx`) imports
    `LinkPurpose` from it
- [X] T021 [US1] D4: `boardCompaniesWithTitle(normalizedTitle, notBoards: readonly string[])` in
  `JobStore`, both stores filtering on the list given. The caller `src/sources/ingest.ts` passes
  `nonBoardAts()`, a new function in `src/sources/registry.ts`. It is built from each module's kind,
  plus a new optional `SourceModule.jobAts`, which is the ats a module's jobs carry when it differs
  from the module id. Only `gmailAlerts.ts` sets it, to the alert jobs' `"linkedin"`, taken from one
  exported constant (`ALERT_ATS`) beside `alertJobId` in `src/gmail/alertStore.ts`. T033's
  `isAlertJob` sits there too and uses it, and so do the Gmail code's own `"linkedin"` literals
  (`alertStore.ts`, `alertFetch.ts`).
- [X] T022 [US1] D7: `memoryStores` gets one users table (`AuthTables.users`), shared by
  `MemorySearchSettingsStore`, `MemoryResumeStore` and `MemorySourceStore`, and the private list is
  dropped. An owner write creates user 1; a write for an unknown user is refused, as in MariaDB.
  Make the test setup create users the way MariaDB has them:
  - `PerCallStores` takes the shared users table, built before the per-call stores in `memoryStores`
  - `storesWithSettings`, whose `put` and `seed` bypass owner creation, creates user 1 itself
  - the memory `seedUsers` and `seedUser` hooks in `tests/storeContract.test.ts` (today
    `async () => {}`) add their users to `AuthTables.users`

  - the memory `owners` hook (`tests/storeContract.test.ts`, today reading `searchSettings.users`)
    reads `AuthTables.users`
  - the tests that build the per-call stores directly seed their users: `tests/saveSource.test.ts`,
    `tests/searchSources.test.ts` and `tests/runSettings.test.ts`

  Keep `initOwner` in `tests/runAll.test.ts` where it is still needed, to give user 1 the email that
  `createAccount`'s code check relies on. Remove only the seeding that no longer has a purpose.
- [X] T023 [US1] Run both checks until green, record the ledger, review S2 against Principle VI, mark
  D1–D7 and D9 done in `inventory/06-stores-database.md`, and delete the marker.

### Sitting S3: the run, tools and sources (A1–A4, S1–S5, S9, C3, C4)

Two parts:
- **S3a**, the run's contexts (A4, A1, A2, C3): T025's A4 case, T026, T028, T029, T030
- **S3b**, sources and their hooks (S1–S5, S9, A3, C4): T025's other three cases, T027, T031–T034

- [X] T024 Create `.specify/sitting-in-progress` naming S3.

**Tests first (S3)**

- [X] T025 [P] [US1] Write unit tests (4, one per bullet) in `tests/sourceVariantScan.test.ts` (A3, S1, S5, C4):
  - no `src/**/*.ts` file outside `src/sources/modules/`, `src/sources/hooks/` and `src/gmail/`
    compares `module` to a string, or `ats` or `kind` to a registered module id or `"linkedin"`
  - shared files directly under `src/sources/` import nothing from `src/gmail/`. That includes
    `module.ts` and `fetchPhase.ts` once T032 removes `SourcePage.alerts` and `Read.alerts`.
  - nothing under `src/gmail/` imports from `src/sources/modules/`
  - A4: `src/agent/rubric.ts` does not import `AppConfig`
- [X] T026 [P] [US1] Write 1 unit test in `tests/toolContextScan.test.ts` (A1, A2, C3), its three bullets checks of one scan:
  - no function in `src/tools/`, `src/sources/`, `src/companies/` or `src/app/beforeAgent.ts` takes
    a parameter typed `ToolContext`, or the full three-part intersection that replaces it, except
    the tool builders named in inventory A1's check
  - `lookUpAlertJobs` is not among them: T029 narrows it
  - nothing under `src/companies/` or `src/careers/` imports `src/tools/context.ts`
- [X] T027 [P] [US1] Write unit tests (3, one per bullet) in `tests/runHooks.test.ts` (S1):
  - `hookFor("gmail_alerts")` gives the alerts hook
  - every board module has no hook
  - a fetch of a board source with no Gmail stores set up still stores its jobs

**Implementation (S3)**

- [X] T028 [US1] A4: `rubricValues` and `scoringRubric` take
  `Pick<Settings, "match_threshold" | "preferences">` (`src/agent/rubric.ts`). The prompt snapshot
  must not change.
- [X] T029 [US1] A1, then A2:
  - A1: give each `src/tools/` helper its narrow context type, after the `DetailsContext` pattern
  - A2: split `ToolContext` (`src/tools/context.ts`) into `RunStores`, `RunPorts` and
    `RunIdentity` (`run`, `runId`, `markers`, `config`, `jsearchApiKey`). The existing `RunState`
    type of `run` keeps its name. `ToolContext` is their intersection, assembled only in
    `src/app/run.ts#buildContext` and `tests/helpers/context.ts`.
  - move every function the T026 scan reaches to the parts it reads:
    - `beforeAgent`, `fetchSources` and its eight private helpers in `src/sources/fetchPhase.ts`
    - `alertAccess`, and `lookUpAlertJobs` with `careersParts` in `src/tools/careersStep.ts`
    - `linkBoardPage`
    - `searchCompanies`' helpers
  - `sourcesOn`'s Gmail check (`src/tools/sources.ts:13`, `requires.includes("gmail")`) becomes a
    table. Add `OFF_WHILE_UNMET: Record<Requirement, boolean>` beside `Requirement` in
    `src/sources/module.ts`: `gmail: true` (the source is off), `jsearch_key: false` (the fetch
    phase skips it as not set up, as today). `sourcesOn` keeps a source unless one of its
    `OFF_WHILE_UNMET` requirements is unmet. Move the `Met` type (`Record<Requirement, boolean>`)
    from `src/web/sourceChoices.ts` to `src/sources/module.ts`. Each place builds its own value, as
    today:
    - `sourcesOn` with `gmail` meaning Gmail is connected (`gmail.connected`)
    - the fetch phase's `FetchFacts.met` with `gmail` meaning Gmail is usable (`gmail.usable`)

    Which sources count as on doesn't change. Recorded under A1 in inventory 01.
- [X] T030 [US1] C3: `searchCompanies` takes `CompanySearchDeps` (`src/companies/searchCompanies.ts`),
  built in `afterAgent` (`src/app/run.ts`).
- [X] T031 [US1] S3 and S4 (`src/sources/`):
  - add `limits.spends` to `SourceLimits`, and move `recordCost` to `src/sources/cost.ts`, recording
    against it
  - add `limits.skipWhenBudgetUsed` (`jsearch: true`, every other module `false`).
    `fetchPlan.ts`'s budget skip reads it instead of `includes("jsearch_key")` (S3's second half),
    so Gmail alerts are still never skipped for the budget
  - add `SourceFailure` in `failure.ts`, with `NotSetUp` and `AlertsUnavailable` extending it, and
    `reasonOf` dropping its Gmail imports

  The rows written and the reasons given are unchanged.
- [X] T032 [US1] S1, S2 and S9:
  - add the run hook registry `src/sources/runHooks.ts` (`access`, `afterPage`, `afterFetch`)
  - add `src/sources/hooks/gmailAlerts.ts`, holding today's `alertAccess`, `recordAlerts` and the
    `lookUpAlertJobs` call
  - `fetchPhase.ts` calls `hookFor(saved.module)`
  - `SourceContext` keeps `http`, `sourceName` and `preview`, plus an `access` typed by the module.
    `jsearch` and `gmailAlerts` declare theirs, and the web test-on-save (`src/sources/testFetch.ts`)
    supplies it too
  - the alert read travels inside the hook's own access object:
    - the Gmail hook's `access(context, saved)` returns an `AlertSession` that the module's fetch
      writes each page's `AlertRead` into
    - `afterPage(context, page, access)` records that read (`recordAlertRead`) and adds it to the
      summary the session keeps across pages
    - `afterFetch(context, access)` returns the `Partial<SourceRun>` and starts the careers lookup

    `SourcePage.alerts` and `Read.alerts` are removed, so `module.ts` and `fetchPhase.ts` no longer
    import from `src/gmail/`.
  - S9: in `src/gmail/alertLookupStep.ts`'s `LookupDeps` (not the careers lookup's),
    `search(query)` replaces the raw JSearch fields for the search; the hook builds it with
    `fetchJsearch`

  The trace, stored rows and `SourceRun` are unchanged.
- [X] T033 [US1] A3: add `descriptions: "included" | "careers_lookup"` to `SourceModule`, set to
  `"careers_lookup"` only in `gmailAlerts.ts`. `careersStep.freshJobs` picks sources by it.
  `recordMatches` uses one exported `isAlertJob(row)` owned by the Gmail alert code (the constant from
  T021) instead of `ats === "linkedin"`.
- [X] T034 [US1] S5 then C4:
  - each board module declares its link reader (`SourceModule.boardLink?(url)`), moved from
    `src/sources/boardLink.ts` into the board files
  - a new `src/sources/boardModules.ts` exports `BOARD_MODULES` (the board modules only), and
    `src/sources/registry.ts` builds `MODULES = [...BOARD_MODULES, jsearch, gmailAlerts]` from it, so
    a new board is listed once
  - `parseBoardLink` moves to `src/sources/boardLinks.ts`, with the same signature. It loops over
    `BOARD_MODULES` and imports only `boardModules.ts`, so the careers lookup and the company search
    never import the Gmail alerts module
  - the returned `BoardLink` carries `board`, the name `boardName` built (`greenhouse:<slug>`,
    `workday:<tenant>/<site>`, …), and `src/careers/boardPages.ts` uses `link.board`

  The strings are identical, so audit rows and cache keys don't change.
- [X] T035 [US1] Run both checks until green, record the ledger, review S3 against Principle VI, mark
  the sitting's findings done in their inventory files (01, 02, 03), and delete the marker.

### Sitting S4: Gmail, the careers lookup, re-score (S6–S8, C1, C2, C5–C7)

- [X] T036 Create `.specify/sitting-in-progress` naming S4.

**Tests first (S4)**

- [X] T037 [P] [US1] Write unit tests (4, one per bullet) in `tests/rootsScan.test.ts`:
  - S8: `imapApi` is referenced only in `src/gmail/imap.ts`, `src/app/` and `web/lib/`
  - S7: nothing under `src/accounts/`, nor `web/lib/authDeps.ts`, imports from `src/gmail/`
  - C5, C6: no `Date.now` or argument-less `new Date()` in `src/careers/` or `src/rescore/`, except
    the composition roots `src/rescore/open.ts` and `src/app/runParts.ts`
  - C1, C2: a type-level case (`expectTypeOf`) that the careers lookup's store is the four-method
    `LookupCareers`, and that `RescoreDeps.views` is `Pick<JobViews, "clearScore">`
- [X] T038 [P] [US1] Write 1 unit test in `tests/lanCheck.test.ts` (C7), both outcomes in one case: `checkBrowserLan` gives the
  `LAN check not configured` note when the probe isn't configured, and null otherwise, with a fake
  port and the memory careers store.

**Implementation (S4)**

- [X] T039 [US1] S7: move `src/gmail/seal.ts` and `src/gmail/secretKey.ts` unchanged to
  `src/secrets/`. Update every import, and the `src/gmail/seal.ts` mentions in CLAUDE.md. The field
  names and the sealed format stay the same.
- [X] T040 [US1] S6 and S8:
  - `check` and `disconnect` (`src/gmail/check.ts`) take the `Pick`s they use
  - `imap: ImapFactory` is required in `AlertDeps`, `GmailDeps` and the run context's `gmail`, and
    passed at the roots (`src/app/run.ts`, `web/lib/gmailDeps.ts`, the Gmail actions)
  - drop the `?? imapApi` fallbacks
- [X] T041 [US1] C1 and C2:
  - `LookupCareers` (four methods) for the careers lookup's store, and `loggedCareers` wraps four
    (`src/careers/lookUpJob.ts`, `src/careers/deps.ts`, `src/rescore/traceSteps.ts`)
  - `RescoreDeps` (`src/rescore/rescore.ts`) takes the `Pick`s it uses
- [X] T042 [US1] C5 and C6: `clock` on `OneJobSession` (`src/rescore/session.ts`; `scoreOne` passes
  `() => deps.now().getTime()`) and on `RenderRequest` (`src/careers/render.ts`). `oneJobAgentDeps`'
  other caller, `src/evals/session.ts:35`, passes `Date.now` until S5's T050 gives it the session's
  clock. Production passes the same time as before.
- [X] T043 [US1] C7: the LAN probe moves to `src/careers/lanCheck.ts` (`checkBrowserLan`), and
  `RendererDeps` takes `checkLan` in place of `careers`, `trace` and `runId`. It is built in
  `pageRenderer` (`src/app/runParts.ts`) and in the test builders `tests/helpers/careersLookup.ts`
  and `tests/helpers/context.ts`. `tests/careersRenderState.test.ts:17`, which builds a `PageRenderer`
  and tests the probe, moves its probe case to `tests/lanCheck.test.ts`.
- [X] T044 [US1] Run both checks until green, record the ledger, review S4 against Principle VI, mark
  the findings done (inventories 02, 03), and delete the marker.

### Sitting S5: evals, resume, profile (E1–E9)

- [X] T045 Create `.specify/sitting-in-progress` naming S5.

**Tests first (S5)**

- [X] T046 [P] [US1] Write unit tests (3, one per bullet) in `tests/evalsScan.test.ts`:
  - E5, E6: no `Date.now`, argument-less `new Date()`, `randomUUID`, `Math.random`, `process.env`,
    `node:fs` import or `execFileSync` in `src/evals/`, `src/resume/` or `src/resumeProfile/`. The
    exceptions are `src/evals/command.ts` and `src/resumeProfile/open.ts` (the composition roots),
    and `src/evals/filePort.ts` for `node:fs`. This is inventory 04's check.
  - E1: no file in `src/evals/` other than `judge.ts` compares a verdict literal
  - E2, E3: no `src/` file outside `src/config/schema.ts` holds the literal `resume_and_profile`,
    except `src/agent/ownerMessage.ts`, whose branch stays (A5, accepted). `view === "resume"`
    comparisons are not part of this scan.
- [X] T047 [P] [US1] Write unit tests (2) in `tests/judgeBands.test.ts`:
  - `passingBand` gives each verdict's band at thresholds 0, 10, 70 and 100, and `judge()`, with a
    minimal answer key per verdict, passes a score at each band's edges and fails one just outside.
    It tests through the exported `judge`, so nothing is exported only for a test (knip).
  - (E7) an attempt that hits the wall clock, and one whose model fails, are classed `timed_out` and
    `model_error` from the loop's exported `WALL_CLOCK_REASON` and `MODEL_ERROR_PREFIX`

**Implementation (S5)**

- [X] T048 [US1] E1: one `PASS_BANDS` table and `passingBand` in `src/evals/judge.ts`, used by
  `src/evals/answerKeyRules.ts`.
- [X] T049 [US1] E2, E3 and E4:
  - build the series pattern from `RESUME_VIEWS` (`src/evals/series.ts`)
  - add `READS_PROFILE: Record<ResumeView, boolean>` beside `RESUME_VIEWS`, used in `viewRefusal`
    and in `ownerMessage`'s first branch
  - add a `READERS: Record<ResumeFileType, …>` in `src/resume/read.ts`
  - build the `eval run` USAGE string's view list in `src/evals/runCases.ts` from
    `RESUME_VIEWS.join("|")`, so the printed text is identical
- [X] T050 [US1] E5, E6 and E7:
  - `clock` and `markerTag` on the eval `SessionDeps`, and `RunDeps.uuid`, set in `withRunDeps`.
    `scoreCase`'s `now` for `reportLookalike` (`src/evals/session.ts:33`) becomes
    `() => new Date(deps.clock())`. `oneJobAgentDeps` takes the clock from the session it is given,
    so re-score keeps the clock T042 (C5) gave it.
  - `clock` on `ExtractDeps` (`src/resumeProfile/extract.ts`, passed in `open.ts`)
  - export `WALL_CLOCK_REASON` (`src/agent/budget.ts`) and `MODEL_ERROR_PREFIX`
    (`src/agent/loop.ts`), and import them in `src/evals/failure.ts`
- [X] T051 [US1] E8 and E9: each eval command's deps take the `Pick` of `EvalFiles` it uses, and
  `contextOf` moves to `src/evals/reportContext.ts`.
- [X] T052 [US1] Run both checks until green, record the ledger, review S5 against Principle VI, mark
  E1–E9 done (inventory 04), and delete the marker.

### Sitting S6: web rules and the web server side (U1–U7, W1–W10)

Two parts:
- **S6a**, the web rules (U1–U7): T054's U1/U2 and U5 cases, T055, T057, T058
- **S6b**, the web server side (W1–W10): T054's W7, W9, W4 and W1 cases, T056, T059–T061

- [X] T053 Create `.specify/sitting-in-progress` naming S6.

**Tests first (S6)**

- [X] T054 [P] [US1] Write unit tests (6, one per bullet) in `tests/webScan.test.ts`:
  - U1, U2: no bare `JobViews`, `UserSourceStore`, `SourceStore` or `Stores` parameter in
    `src/web/`
  - U5: no string comparison or `includes(...)` with a requirement literal (`"jsearch_key"`,
    `"gmail"`) outside `src/sources/` and the `Record<Requirement, …>` tables. The scan matches
    comparisons only, so the `gmail` settings keys (`settingsView.ts`, `settings/page.tsx`) pass.
  - W7: page-name comparisons only in `web/lib/pageRows.ts`
  - W9: no `"use server"` file in `web/lib/` calls `requireSession(` directly. That is inventory
    07's check. Today only `adminActions.ts` does, and W9's fix routes it through `signedInAction`.
    Actions built with `guarded(...)` and `myStores()` are already gated by `guarded` and pass.
  - W4: no clock in `web/lib/rows.ts` or `web/lib/resumeRows.ts`
  - W1: `web/lib/uiState.ts` exports only `getStores`, `getUiState` and their types, so no action
    can reach config reads (`dataDir`, `sourceConfig`, `runtimeSettings`, `alertSenders`) or
    `metNeeds` through it, and no `web/lib/*Actions.ts` file or `web/lib/sourceDeps.ts` imports
    `settingsState.js`
- [X] T055 [P] [US1] Write unit tests (2) in `tests/settingsShape.test.ts`:
  - U6: every `LINK_PURPOSES` entry parses from a `/link` fragment
  - U7: every Settings field is in exactly one section, and `settingsView(null).fields` has exactly
    the `SECTIONS` names. Both halves pass today, so these are regression guards. The real guard is
    the type derivation in T058, which makes a field outside `SECTIONS` fail to compile.
- [X] T056 [P] [US1] Write unit tests (4):
  - `tests/switchSource.test.ts` (W6), on memory stores: `switchSourceOn` refuses turning a search
    on past the budget, and `deleteSaved` refuses deleting the account source
  - `tests/rescoreFollow.test.ts` (W10), with a fake clock and sleep: a finished run ends the feed,
    and an open run sends a `ping` per interval

**Implementation (S6)**

- [X] T057 [US1] U1–U4:
  - `PageViews` in `src/web/pageData.ts`, and the source store's `Pick` in `src/web/saveSource.ts`
  - move `gmailSettings`, `sourceSettings` and `runtimePart` to `src/config/runtimeParts.ts`, with
    their tests moved to `tests/runtimeParts.test.ts`
  - move `localTime` to `src/web/localTime.ts`
  - (moved to S7a, 2026-11-09: exporting `NOT_SEARCH` here would leave it unused until K3, which
    knip refuses, and S7a runs with the stack stopped too)
- [X] T058 [US1] U5–U7:
  - `sourceRows(saved, met: Met)` with `ROW_NEEDS: Record<Requirement, string>`
    (`src/web/sourceRows.ts`)
  - `LINK_PURPOSES` and `isLinkPurpose` (`src/db/` email link store module after T020, and
    `src/web/linkFragment.ts`)
  - `SECTIONS` as the one source of `FieldName`, with `shownFields` mapped from it
    (`src/web/settingsView.ts`, `src/web/settingsSections.ts`). `FieldSpec.name` is typed `string`
    in the declaration, so `FieldName` can be derived from `SECTIONS` without a circular type.
  - (moved to S7a with K5, 2026-11-09: exporting `FilterField` before K5 uses it would leave an
    unused export)
- [X] T059 [US1] W1–W3:
  - split `web/lib/uiState.ts` into `web/lib/fileConfig.ts` and `web/lib/settingsState.ts`, with
    `uiState.ts` keeping `getStores` and `getUiState`
  - `metNeeds` reads the Gmail store and the environment, a job of its own, so it goes to its own
    `web/lib/sourceNeeds.ts`. Neither the file-config module nor the page loader holds it, and
    `web/lib/sourceDeps.ts` imports it from there.
  - `UiState` drops `gmail`, `alerts` and `key`, and `getSettingsState` returns a `GmailPanelView`
  - `WebSettings` and `webSettings` move to `web/lib/webSettings.ts`

  Update the callers of the Gmail view:
  - `web/app/(app)/settings/page.tsx` reads the view
  - `tests/client/settings.test.tsx` mocks the new module's shape instead of `uiState.js`'s `gmail`,
    `alerts` and `key`
  - in `tests/webIsolation.test.ts`, the case "a second user's Gmail is their own" connects and
    disconnects through the second user's `myStores()` Gmail store rather than through
    `getSettingsState()`, and keeps its assertion that the owner's connection is untouched
- [X] T060 [US1] W4–W6:
  - `now: Date` parameters in `web/lib/rows.ts`, passed from `actions.ts`
  - move `startRescoreFor` to `web/lib/rescoreStart.ts`, and its CLAUDE.md mention
  - the enable and delete rules move to `src/web/switchSource.ts` as `switchSourceOn` and
    `deleteSaved`, which avoids clashing with the action names. `web/lib/sourceActions.ts` builds
    their deps.
- [X] T061 [US1] W7–W10:
  - `LISTS: Record<PageName, …>` and one `changed(...)` in `web/lib/pageRows.ts`, with
    `usePageRows` using it
  - `web/lib/signInActions.ts` passes the flow itself
  - `signedInAction`'s third argument for the admin actions' refusals (`web/lib/accountAction.ts`,
    `web/lib/adminActions.ts`)
  - `follow` and `tick` move to `src/web/rescoreFollow.ts`, and the route passes `setTimeout`, the
    clock and `Date.now`

  Every refusal text and answer stays the same.
- [X] T062 [US1] Run both checks until green, record the ledger, review S6 against Principle VI, mark
  U1–U7 and W1–W10 done (inventories 05, 07), and delete the marker.

### Sitting S7: web components (K1–K5)

Two parts:
- **S7a**, display helpers out of components and the filter labels (K3, K4, K5), with the stack
  **stopped**: T064, T066, and T065's K5 part. It moves code into `src/web/`, `src/time/` and
  `src/mail/messages.ts`, which are not components, styles or page wiring, so it isn't UI work
  under constitution 2.5.0. It exports `NOT_SEARCH` (for K3) and `FilterField` (for K5) in the
  sitting that first uses them, so no export is ever unused.
- **S7b**, the components' tables (K1, K2), with the stack **running**: T065's K1 and K2 parts. It
  changes only the two components. The stack serves this checkout live,
  so every turn of S7b ends with habit-hooks clean, even while the sitting marker exists. That is
  the UI-work rule in CLAUDE.md and constitution 2.5.0.

- [ ] T063 Create `.specify/sitting-in-progress` naming S7a (then S7b).

**Tests first (S7a)**

- [X] T064 [P] [US1] Write unit tests (3):
  - `tests/settingsNoticeLines.test.ts` (K3): each notice kind gives today's lines
  - `tests/componentScan.test.ts` (K3, K4): no component compares against
    `src/config/searchSettings.ts`'s reason constants, and the timestamp format
    (`slice(0, 16).replace("T"`) appears only in `src/time/minutes.ts`

**Implementation (S7a, then S7b)**

- [ ] T065 [US1] (K1, K2 in S7b; K5 in S7a) K1, K2 and K5: `Record`-keyed tables in
  `web/components/account/LinkButton.tsx` (`PURPOSES`),
  `web/components/settings/SourceEditor.tsx` (`INPUTS`) and
  `web/components/settings/FiltersSection.tsx` (`LABELS: Record<FilterField, string>`, with
  `FilterField` exported from `src/web/settingsSections.ts` in S7a). The groups become
  `GROUPS: Record<FilterField, group>`, so a new filter field fails to compile until it has both a
  label and a group. Same markup.
- [X] T066 [US1] (S7a) K3 and K4:
  - `noticeLines` and `wholeFallback` move to `src/web/settingsNoticeLines.ts`, keyed by notice
    kind and comparing against `NOT_SEARCH`, exported from `src/config/searchSettings.ts` here
  - `minutes()` moves to `src/time/minutes.ts`, a neutral place, so mail doesn't depend on the web
    rules. It gets `utcMinutes(iso)`, used by `rowViews.ts`, the three components and
    `src/mail/messages.ts`.
- [ ] T067 [US1] Run both checks until green, record the ledger, review S7 against Principle VI, mark
  K1–K5 done (inventory 08), and delete the marker.

**Checkpoint**: every fix finding is marked done.

---

## Phase 4: Polish — Sitting S8

- [ ] T068 Create `.specify/sitting-in-progress` naming S8.
- [ ] T069 [P] FR-007: update CLAUDE.md and the docs pages wherever S2–S7 moved or renamed something
  they name:
  - the store names (`TokenStore` → three stores, `attempts`, `events`)
  - `src/secrets/`
  - the run hooks
  - `rescoreStart.ts`, `fileConfig.ts`, `settingsState.ts`, `sourceNeeds.ts` and `webSettings.ts`
  - `src/sources/boardLink.ts` (CLAUDE.md, "Pages are read in order"), now the board modules'
    readers and `boardLinks.ts`
  - "the fetch phase calls it" for the careers lookup (CLAUDE.md, careers lookup), now the Gmail
    alerts hook
  - "the account and settings stores making user 1" (CLAUDE.md, feature 027), now `ensureOwnerFor`
    in `src/db/kysely/owner.ts`
  - the re-score stream's polling (CLAUDE.md, re-score log), now `src/web/rescoreFollow.ts`
  - "every signed-in server action opens with `signedInAction`" (CLAUDE.md, accounts), which says
    too much: the account actions open with it, and the others are gated by `guarded`
  - `uiState` and `rows.ts` in `docs/react-walkthrough.md` (the Gmail panel and the row loaders)
  - `src/time/minutes.ts`

  Grep CLAUDE.md, `docs/*.md` and `.specify/memory/constitution.md` for each old name.
- [ ] T070 [P] Close the inventory:
  - every finding is marked `Done` with its sitting, or accepted (A5, U8, K6)
  - add a closing line to `research.md` R2 with the final counts
  - confirm, with the coverage script from research R1, that no module was added outside an area
    during the feature
- [ ] T071 Quickstart "At the end":
  - a dev-stack run compared with one on `main` (time within 10%, same trace event types, same
    lines)
  - the web UI, every sign-in way and Re-score walked once
  - US1 AS4, the CLI and evals unchanged:
    - `eval report <an existing run>` and `eval check` print the same as on `main`, apart from
      FR-009's user line
    - `npm start -- rescore <ats> <job_id>` prints the same step lines as on `main`
  - SC-006: the columns of each shared table listed from `information_schema` on the test
    database, with none of them per-user. The shared tables are the ones 027's
    `data-model.md` ("Unchanged") lists as shared (`companies`, `careers_audit`, `api_calls`),
    plus `jobs` and `auth_attempts`. `auth_challenges` is excluded: its optional `user_id` is the
    user a challenge is for, by design (024).

  Record the result here.
- [ ] T072 Run both checks until green, record the final ledger, check SC-008
  (`git diff main -- package.json` adds no dependency), review the whole feature against Principle VI,
  and delete the marker.

---

## Dependencies

- T001 first.
- **S1 (US2)** depends only on T001. It ships first, with the backup note.
- **S2** before S3–S7: every later sitting imports the store interfaces it moves.
- **S3** before S4: S4's Gmail and careers changes build on S3's run hooks and `ToolContext` parts.
- **S5** after S4: both change `oneJobAgentDeps`'s clock (C5, then E5).
- **S6** needs S2 and S3. S6's U6 needs S2's email link store.
- **S7** after S6: K5 needs S6's U7.
- The order is S1, S2a, S2b, S3a, S3b, S4, S5, S6a, S6b, S7a, S7b, S8.
- **S8** comes last.
- **Within a sitting**: tests first, then the tasks in order. Tasks marked [P] may run together.

## Parallel examples

```text
S1: T003 (integration) and T004 (unit), then T005–T009
S2a: T013 and T014's D6 case together, then T016 → T017
S2b: T014's D4 and D5 cases and T015 together, then T018 → T019 → T020 → T021 → T022
S6a: T054's U cases and T055 together, then T057 → T058
S6b: T054's W cases and T056 together, then T059 → T060 → T061
```

## Implementation strategy

- **First**: S1 alone is a shippable increment. It closes #119's per-user gaps and carries the one
  database change.
- **Then**: S2 and S3 change the shared interfaces. After them, each sitting is an increment that
  leaves the app working and green.
- **Delivery**: a commit per sitting part (S1, S2a, S2b, S3a, S3b, S4, S5, S6a, S6b, S7a, S7b, S8),
  and one pull request at the end (research R9).

## Test ledger (constitution Principle II)

| Point | Unit | Integration | UI |
|---|---|---|---|
| Baseline (T001) | 1142 | 89 | 78 |
| S1 planned | +9 (T004: eval runs ×7, the import's retired column, store methods used) | +1 (T003) | +0 |
| S2 planned | +6 (T013, T014 ×3, T015 ×2 on memory) | +2 (T015 on MariaDB) | +0 |
| S3 planned | +8 (T025 ×4, T026, T027 ×3) | +0 | +0 |
| S4 planned | +5 (T037 ×4, T038) | +0 | +0 |
| S5 planned | +5 (T046 ×3, T047 ×2) | +0 | +0 |
| S6 planned | +12 (T054 ×6, T055 ×2, T056 ×4) | +0 | +0 |
| S7 planned | +3 (T064, in S7a) | +0 | +0 |
| **Planned after** | **+48** | **+3** | **+0** |
| Actual after S1 | 1142 + 9 (with UI: 1229) | 89 + 1 = 90 | 78 |
| Actual after S2a | + 2 planned + 1 retry (with UI: 1232) | 90 | 78 |
| Actual after S2b | + 4 (with UI: 1236) | 92 | 78 |
| Actual after S3a | + 2 (with UI: 1238) | 92 | 78 |
| Actual after S3b | + 6 (with UI: 1244) | 92 | 78 |
| Actual after S4 | + 5 (with UI: 1249) | 92 | 78 |
| Actual after S5 | + 5 (with UI: 1254) | 92 | 78 |
| Actual after S6a | + 4 (with UI: 1258) | 92 | 78 |
| Actual after S6b | + 8 (with UI: 1266) | 92 | 78 |
| Actual after S7a | + 3 (with UI: 1269) | 92 | 78 |

That is 94% unit and 6% integration among the new tests. All three shares move toward the target:
unit from 87.24% (1142 of 1309) to 87.50% (1190 of 1360), integration from 6.80% (89) to 6.76%
(92), and UI from 5.96% (78) to 5.74%. The three integration cases are there because only MariaDB
can show them:
- that step 024 refuses a set mark, then drops the column once it is cleared (one case)
- that the foreign keys refuse a write for an unknown user (D7), for the resume and the source
  stores

The owner case of D7 is an assertion added to an existing contract test, not a new case.
