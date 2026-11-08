---

description: "Tasks for feature 027: each user's own data"
---

# Tasks: Each user's own data

**Input**: Design documents from `docs/specs/027-assign-data-to-first-user/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R13, R11b), data-model.md, contracts/cli.md,
quickstart.md. Revised 2026-11-08 after two passes of `/speckit-analyze-deep`.

**Tests**: required by the constitution (Principle II). Each test task names its kind and count.

The existing suite holds user 1's behaviour fixed. A test may change:
- how it builds its stores (`ownerStores()` or `forUser`), or which store a method that moved now
  lives on (for example `postings.setDescription` instead of `jobStore.setDescription`)
- how it seeds data, now that per-user columns sit in `user_jobs`
- for migration tests that read moved columns, where they stop (before `020`) and how they read
  (`withTables`)

It never changes what user 1 sees (FR-018).

**Organization**: four sittings, one commit each, and one PR at the end (as in 025). The stories:
- **US1**: the owner keeps everything
- **US2**: each user sees only their own
- **US3**: runs for every user
- **US4**: each user's Gmail
- **US5**: the CLI and evals for one user

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1–US5

## Sittings

| Sitting | Stories | Stack | Why |
|---|---|---|---|
| S1 data and stores | US1 | stopped | migrations `020`–`023`; `PostingStore`; `Stores` a container of shared stores + `forUser`; every caller on user 1 |
| S2 the web | US2, US4 | stopped | loaders, actions and routes on the signed-in user (server code) |
| S3 runs | US3, US4 | stopped | the run's code path |
| S4 tools and docs | US5 | stopped | CLI, evals, docs |

- **Each sitting** starts by creating `.specify/sitting-in-progress` naming it. It ends by running
  `npm run check` and `npm run check:db` until green, then deleting the marker. Commit only when the
  owner asks.
- **Swap behind an interface (rule 4)**: S1 gives every caller user 1's `UserStores`, so behaviour
  is unchanged. S2 and S3 then change which user it is.
- **No default user (R4)**: `Stores` has no per-user members. A caller that didn't choose a user
  fails typecheck.
- **SOLID review at each sitting's end** (constitution Principle VI): before the closing checks,
  review the sitting's change against SOLID, through a reviewer if one is available. A breach is
  fixed in the same sitting, like a habit-hooks finding.
- **Never print** a `--user` email, a resume, or another user's data in a trace or a log line.
  Users appear by id only (FR-015).
- **File sizes**: `jobStore.ts` (193 lines), `storeContract.ts` (188), `src/db/store.ts` (181),
  `memoryStore.ts` (179) and `jobViews.ts` (149) are near the 200-line limit. Split them as named in the tasks rather than
  growing them.

---

## Phase 1: Setup

- [ ] T001 Stop the stack (`docker compose stop`, no `docker:watch`). Create `.specify/sitting-in-progress` naming S1. Run `npm run check` and `npm run check:db` on `027-assign-data-to-first-user`, and write the counts into the ledger's baseline row below.

---

## Phase 2: User Story 1 — The owner keeps everything (P1) — Sitting S1

**Goal**: FR-001–FR-006 and FR-018: the data model, the upgrade, shared and per-user stores, every
caller on user 1.

**Independent Test**: quickstart §2. The suite is green, and user 1's pages and run behave as before.

### Tests (S1)

- [ ] T002 [US1] Write an integration test (1), `tests/integration/userJobsMigration.test.ts`.
  - **Setup**: migrate a database to `019_session_details` (`migrateBefore`). Seed three jobs: one
    scored, one hidden, one applied, each with a `source` and `source_id` from a `user_sources`
    row. Add their verdicts, one re-score run, and a Gmail connection and alert state. Then apply
    `020_user_jobs`, check the copy while the old columns are still there, and apply `021`–`023`.
  - **`user_jobs`**: it has three rows, all `user_id = 1`, each with the job's `source_id`,
    `source`, `first_seen`, `last_seen`, `scored_at`, `score`, `base_score`, `bonus_score`,
    `reasons`, `gaps`, `hidden`, `applied` and `applied_on`. Its primary key is
    `(user_id, ats, job_id)`, with indexes `(user_id, scored_at)`, `(user_id, applied)` and
    `(user_id, last_seen)`. Its FK to `user_sources` is `ON DELETE SET NULL`. Every new table is
    `utf8mb4_bin`.
  - **`jobs`**: it no longer has those columns, FK `jobs_source_fk` or index `jobs_source`. It
    keeps `first_seen`, `last_seen`, `source`, `description`, `company_id`, `injection_seen_at` and
    `emailed_at`.
  - **`verdicts` and `rescore_runs`**: `user_id` is 1, `int` not null, with FKs to `users`.
  - **Gmail**: `gmail_connection` and `gmail_alert_state` have `user_id = 1`, type `int(11)`, as
    primary key, with FKs to `users`.

  Index `jobs_by_source (source, scored_at)` (from `001_initial`) is dropped by the step, and T002
  asserts it is gone.

  Also update the other migration tests:
  - Add the four step names to the step-name lists in `tests/integration/migrate.test.ts`,
    `lookupIndexes.test.ts`, `companyMigrations.test.ts`, `resumeMigration.test.ts`,
    `boostMigration.test.ts` and `accountsMigration.test.ts`. Add `user_jobs` to the collation
    list in `migrate.test.ts`.
  - Make `migrate.test.ts`'s step-008 test and `companyMigrations.test.ts`, which read
    `jobs.applied`, `applied_on` or `source_id`, stop before `023` (a filtered `MIGRATIONS`) and read
    through `withTables`.
  - Add `user_jobs` to `TABLES` in `tests/helpers/testDb.ts`, before `jobs`.
- [ ] T003 [P] [US1] Add `tests/helpers/userJobContract.ts`. Register `userJobContract(make)` in `tests/storeContract.test.ts` and `userJobStrictCases(make)` in `tests/integration/storeContract.test.ts`.

  Unit cases (10, every case on memory):
  - user 2's `jobViews` lists none of user 1's jobs
  - hiding or applying as user 2 leaves user 1's row unchanged
  - one posting upserted for both users is one posting with two views and two labels; `recordVerdict` for each gives each its own score and history
  - a second user's upsert of a posting without a description keeps the description already found
  - user 2's alert for a posting user 1 already has gives user 2 their own view, while the shared `postings.known` reports it as already having a description, so no second lookup is needed
  - a refresh that turns a posting's description from plain text to Markdown clears `scored_at` on both users' views, and any other refresh clears neither
  - user 2's `rescoreLog` finds none of user 1's runs
  - user 2's `gmail` and `alerts` see none of user 1's connection or alert state; disconnecting as user 2 leaves user 1's
  - `postings.prune` drops a stale unapplied view, keeps an applied one, and removes the posting only when no view remains
  - two users' JSearch sources share the month's `api_calls` count

  Strict cases (3, integration):
  - two users upserting the same posting at once give one posting and two views
  - `rescoreLog.begin` for the same job by two users both start, while a second `begin` by one user is refused
  - `postings.prune` never deletes a posting another user still has
- [ ] T004 [P] [US1] Write a unit test (1), `tests/forUser.test.ts`. `memoryStores().forUser(2)` binds `jobStore`, `jobViews`, `gmail`, `alerts`, `rescoreLog`, `sources`, `searchSettings` and `resume` to user 2, and passes `companies`, `careers`, `apiCalls`, `postings`, `sourcePlans` and the account stores through as the same objects.

### Implementation (S1)

- [ ] T005 [US1] Create four migration steps, one change each (R11), and list them in order in `src/db/migrations/index.ts`.
  - **Rules**: Kysely's schema and query builders only, with data steps typed with `db.withTables<…>()` under `Kysely<unknown>`. `sql` is only for `tinyint` and table options.
  1. **`src/db/migrations/020_user_jobs.ts`**:
     - Make sure user 1 exists (insert `{ id: 1, name: "owner", created_at }`, doing nothing on a duplicate).
     - Create `user_jobs` per data-model.md:
       - `user_id` integer not null, FK `users.id`
       - `ats` and `job_id` not null, with a FK to `jobs(ats, job_id)`
       - `source_id` integer null, FK `user_sources.id` `ON DELETE SET NULL`
       - `source` not null, the same type as `jobs.source`
       - `first_seen` and `last_seen` varchar(32) not null; `scored_at` varchar(32) null
       - `score`, `base_score` and `bonus_score` integer null; `reasons` and `gaps` text null
       - `hidden` and `applied` tinyint not null default 0; `applied_on` varchar(32) null
       - primary key `(user_id, ats, job_id)` and the three indexes
     - Copy with `insertInto("user_jobs").columns([...]).expression(selectFrom("jobs").select([..., eb.lit(1).as("user_id")]))`.
  2. **`021_history_owners.ts`**: add `user_id` integer not null default 1 to `verdicts` and `rescore_runs`, then drop the default and add the FKs. Index `verdicts (user_id, ats, job_id, scored_at)`.
  3. **`022_gmail_by_user.ts`**: for `gmail_connection` and `gmail_alert_state`, rename `id` to `user_id`, modify it to integer not null, and add a FK to `users.id`.
  4. **`023_jobs_without_user_columns.ts`**: drop FK `jobs_source_fk`, then indexes `jobs_source` and `jobs_by_source`, then `source_id`, `scored_at`, `score`, `base_score`, `bonus_score`, `reasons`, `gaps`, `hidden`, `applied` and `applied_on` from `jobs`, with any other index on them.

  T002 passes.
- [ ] T006 [US1] Update the schema:
  - `src/db/schema/jobs.ts`: `JobsTable` drops the moved columns; add `UserJobsTable` (with `source` and `source_id`); `VerdictsTable.user_id`
  - `src/db/schema/rescore.ts`: `RescoreRunsTable.user_id`
  - `src/db/schema/gmail.ts`: `id` becomes `user_id`
  - `src/db/schema.ts`: add `user_jobs: UserJobsTable`
- [ ] T007 [US1] Bind the Kysely job stores to a user: `KyselyJobStore(db, userId)` and `KyselyJobViews(db, userId)`. Move the posting half of `upsertAll` (the old-format read and the upsert into `jobs`) into `src/db/kysely/postingWrites.ts`, an internal helper that `KyselyJobStore` calls inside its own transaction. It has no interface of its own and nothing else calls it. That keeps `jobStore.ts` under 200 lines. `PostingStore` (T008) remains the one public owner of posting operations.
  - **`upsertAll`**: one transaction, in this order (R7):
    1. Read the stored `description_format` of the incoming keys.
    2. Write the postings to `jobs`, no longer refreshing `jobs.source`, and keeping an existing non-null description over an incoming null (`description`, `description_format`, `description_source`, `description_url`).
    3. Upsert `user_jobs (userId, ats, job_id, source_id, source, first_seen, last_seen)`.
    4. Clear `user_jobs.scored_at`, for every user, only for the keys whose stored format was `text` or null and whose incoming format is `markdown`. That is today's rule exactly; `scoredAtAfterRefresh` and its same-row `VALUES()` trick are removed.
  - **Other writes**:
    - `markSeen` updates both `last_seen`s.
    - `recordVerdict` locks and updates the user's `user_jobs` row, and inserts verdicts with `user_id`.
    - `setHidden`, `setApplied` and `clearScore` write the user's row, keeping 013's applied rules.
  - **Reads**: these join the user's `user_jobs`, and take `first_seen`, `last_seen` and `source` from `user_jobs` (`JOB_COLUMNS`, `newestFirst`):
    - `unscoredSince`, `unscoredForSource`, `boardCompaniesWithTitle`, `companiesWithTitleOutside` and `findJob`
    - every `JobViews` method; `scoredFrom`'s source filter reads `user_jobs.source`
    - `fromSource` and `outsideSource` (in `jobStore.ts`) read `user_jobs.source` and `source_id`
  - **Removed from `JobStore`**: `setDescription`, `flagInjection`, `linkUnlinkedJobs`, `earliestSeen` and `pruneLastSeenBefore`. They work on the shared posting, so they move to `PostingStore` (T008, R14). `JobStore` is the user's view only.
- [ ] T008 [P] [US1] Create the shared `PostingStore` (R14): the interface in `src/db/postingStore.ts`, Kysely in `src/db/kysely/postingStore.ts`. It owns the posting and its lifecycle:
  - `known(keys)`: for each key, whether the posting exists and whether it has a description
  - `setDescription(key, found)`: writes the posting and clears `scored_at` on every user's view of it, as today
  - `flagInjection`, `linkUnlinkedJobs` and `earliestSeen` (which reads `jobs.first_seen`), moved from `KyselyJobStore`
  - `prune(cutoff)`, per R9:
    1. delete every user's stale unapplied `user_jobs` rows
    2. delete verdicts and re-score runs whose `(user_id, ats, job_id)` view is gone
    3. delete postings no view points at

  Its contract cases (the moved `descriptionContract` and injection cases, plus T003's prune cases) reach it through `stores.postings`.
- [ ] T009 [P] [US1] Bind the other per-user stores:
  - `KyselyRescoreLogStore(db, userId)`: runs carry `user_id`, `begin` locks the user's `user_jobs` row, and reads filter by user.
  - `KyselyGmailStore(db, userId)` and `KyselyAlertStore(db, userId)`: key by `user_id` instead of `ROW`.
  - `src/db/kysely/sourceStore.ts`: `replaceSource` relabels `user_jobs.source` for that user. Removing a source relies on `user_jobs.source_id`'s `ON DELETE SET NULL`. Create `SourcePlans` (interface `src/db/sourcePlans.ts`, Kysely `src/db/kysely/sourcePlans.ts`) with one method, `scheduledOnForAll()`: every user's scheduled sources that are on, for the budget checks. It is read-only and is not part of `SourceStore`.
  - `src/db/kysely/accountStore.ts`: add `userIds()`, every `users.id` in order.
- [ ] T010 [US1] Split what the store factory returns (R4, R14):
  - **`Stores`** (`src/db/store.ts`, `src/db/kysely/stores.ts`): a container of the shared stores only (`companies`, `careers`, `apiCalls`, `accounts`, `postings`, `sourcePlans` and the sign-in stores; never the per-call `SourceStore`, `SearchSettingsStore` or `ResumeStore`, whose methods take any user), plus `forUser(userId): UserStores` and `close`. It has no operations of its own.
  - **`UserStores`**: composed in a new `src/db/userStores.ts` (which holds nothing else): the bound stores, plus the shared ones passed through.
  - **Bound wrappers, each beside its own store**:
    - `UserSourceStore` in `src/db/sourceStore.ts`
    - `UserSearchSettingsStore` in `src/db/searchSettingsStore.ts`
    - `UserResumeStore` in `src/db/resumeStore.ts`

    Each is the same methods without the `userId` argument, and each wrapper function sits with its own store, not together.
  - **Contracts**: `searchSettingsContract`, `sourceContract` and `resumeContract` reach those stores through `forUser(n)`.

  There is no default user. T004 passes.
- [ ] T011 [US1] Rebuild the memory stores to match.
  - `Tables` gains `userJobs`, and jobs keep only posting fields.
  - The bound memory stores take a `userId`: `memoryStore.ts` (split the job store into `memoryJobStore.ts`), `memoryJobViews.ts`, `memoryRescoreLog.ts`, `memoryGmailStore.ts` and `memoryAlertStore.ts`.
  - The memory `PostingStore` goes in `tests/helpers/memoryPostingStore.ts`. The memory `SourcePlans` goes in `tests/helpers/memorySourcePlans.ts`, reading the memory source rows, and `userIds` goes in `memoryAccountStore.ts`, each with its owner.
  - `memoryStores()` returns shared stores plus `forUser`, and a new `ownerStores()` returns `memoryStores().forUser(1)`.

  T003's unit cases pass on memory.
- [ ] T012 [US1] Hand every caller user 1's `UserStores`, changing no behaviour. Afterwards nothing reads a per-user store from `Stores` (it no longer has them), and S1 typechecks.
  - **The run**: `src/app/run.ts`, `runSettings.ts` and `beforeAgent.ts` take the user's `UserStores` from their caller. `runOnce(environment, seams, userId)` builds `stores.forUser(userId)`, and `src/cli.ts` passes `OWNER_ID`, so `src/app/` never names it. `pruneOldJobs` calls `stores.postings.prune` instead of the removed `pruneLastSeenBefore`.
  - **Posting operations** (R14): the six callers of `setDescription`, `flagInjection`, `linkUnlinkedJobs` and `earliestSeen` use `postings` instead of the job store:
    - `src/careers/lookUpJob.ts` (`deps.postings`)
    - `src/rescore/oneJobStore.ts`
    - `src/app/beforeAgent.ts`, `src/app/lookalikes.ts` and `src/tools/jobSummary.ts` (`context.postings`, added to `src/tools/context.ts`)
    - `src/evals/captureCommand.ts`
  - **The tools' context**: `src/tools/context.ts` types `saved.store` and the other store fields as the bound interfaces, and gains `postings` and `sourcePlans` (the shared stores the run needs), set in `run.ts`'s `storeParts`.
  - **Fetching and settings**: `src/sources/fetchPhase.ts` and `src/app/beforeAgent.ts` call the bound `recordFetch` and `linkCompany` without `OWNER_ID`. `src/config/resolve.ts` takes the bound `searchSettings`.
  - **Gmail**:
    - `src/gmail/connection.ts` calls the bound `sources.ensureAccountSource({ module, name }, …)`.
    - `src/gmail/alertStore.ts` `sortAlertJobs` keeps using the user's own `findJob` for "seen again" (R7).
    - `src/gmail/alertLookupStep.ts` skips the description lookup for postings `postings.known` reports as already described.
  - **Resume profile**: `src/resumeProfile/open.ts` passes `UserStores` to `settingsForRun`.
  - **`src/web/saveSource.ts`**: it takes a `UserSourceStore` in its `deps` and drops `OWNER_ID` from its calls. It never chooses a user; its callers hand it the user's store.
  - **Web helpers**: these use `stores.forUser(OWNER_ID)` in this sitting and switch to `myStores()` in S2:
    - `web/lib/uiState.ts`: `getStores()`, the `OpenStores` type, `sourcesView` and `metNeeds`
    - `web/lib/settingsActions.ts` and `sourceActions.ts` (which hands `saveSource` the user's `sources`)
    - `web/lib/resumeRows.ts` (`Pick<UserStores, "resume">`, with no `OWNER_ID` in the calls)
    - `web/lib/gmailDeps.ts`
    - `web/app/api/rescores/[id]/route.ts` (`(await openedStores()).forUser(OWNER_ID).rescoreLog`)
  - **Re-score and evals**: `src/rescore/open.ts`, `src/evals/command.ts`, `src/evals/captureCommand.ts`, and `src/cli.ts` `rescoreWith`, which takes `UserStores`. `cli.ts` chooses user 1.
  - **`import-sqlite`**: `src/app/importSqlite.ts` splits each old row into a posting plus a `user_jobs` row for the user it is given, and sets `verdicts.user_id`. `cli.ts` passes `OWNER_ID`.
  - **Integration tests**: the `storesOver(db)` call sites move to the new shape.

  Afterwards `OWNER_ID` appears only in:
  - the migration
  - `ensureOwner` (`kysely/searchSettingsStore.ts`, `sourceStore.ts`) and `kysely/accountStore.ts`
  - `src/config/resumeFile.ts`, once T021 adds it
  - `src/cli.ts`
  - the `web/` files listed above, which S2 removes

  Confirm with `grep -rn OWNER_ID src web`.
- [ ] T013 [US1] Update the tests that seed jobs or Gmail rows directly to the per-user tables, changing set-up only. Run `npm run check` and `npm run check:db` until green, record the ledger, and delete the marker.

**Checkpoint**: The data is per user, and the app and run are unchanged for user 1.

---

## Phase 3: User Stories 2 and 4 (web) — Each user sees only their own (P1) — Sitting S2

**Goal**: FR-007–FR-010, the web half of FR-002, and FR-014's switch-on check.

**Independent Test**: quickstart §3, and §5 for connecting.

### Tests (S2)

- [ ] T014 Create `.specify/sitting-in-progress` naming S2.
- [ ] T015 [P] [US2] Write unit tests (7) in `tests/webIsolation.test.ts`, mocking the session as `tests/actionGuards.test.ts` does, with memory stores holding two users:
  - `getUiState()` as user 2 shows none of user 1's jobs, and default settings
  - user 2's Settings shows no resume, even with `data/resume.md` present
  - the hide, applied and re-score actions as user 2 on user 1's job answer as for a missing job
  - the Settings, source and resume actions as user 2 change only user 2's rows
  - connecting and disconnecting Gmail as user 2 change only user 2's connection
  - the re-score stream route as user 2 for user 1's run answers as for a missing run

  Mock `web/lib/session.js` with `requireSession` (and `currentSession`) returning user 2's account, or reuse `tests/helpers/signedIn.ts`; `actionGuards.test.ts`'s mock only gives `currentSession`.
  - an admin who isn't user 1 sees none of user 1's data
- [ ] T016 [P] [US2] Write a unit test (1), `tests/ownerIdScan.test.ts`: no `.ts`/`.tsx` under `web/` or `src/app/` (skipping `.next*`) names `OWNER_ID`.
- [ ] T017 [P] [US2] Write unit tests (3) for the budget checks across users:
  - `enableProblem` (`src/web/sourceRules.ts`) checks a JSearch source's planned calls against every user's scheduled sources that are on
  - `saveSourcePlan` refuses a new JSearch source, saved on, that doesn't fit beside every user's
  - `lookupDeps` (`src/sources/alertAccess.ts`) reserves alert-lookup budget for every user's scheduled searches

### Implementation (S2)

- [ ] T018 [US2] Create `web/lib/myStores.ts` holding only `myStores()`. It uses `session.ts` (who is signed in) and `database.ts` (the open stores), and adds nothing to either (R5, R14). It calls `requireSession()`, then `(await openedStores()).forUser(account.id)`. `getStores()`, `getUiState()` and `getSettingsState()` in `web/lib/uiState.ts` replace their `forUser(OWNER_ID)` with it.
- [ ] T019 [US2] Every action that opens stores swaps S1's `forUser(OWNER_ID)` for `myStores()`, directly or through `getStores()`: `web/lib/actions.ts`, `settingsActions.ts`, `sourceActions.ts`, `resumeActions.ts`, `resumeRows.ts`, `gmailActions.ts` and `gmailDeps.ts`.
  - Actions keep their `guarded` wrapper, answers, types and `revalidatePath`. They do not move onto `signedInAction`.
  - `tests/actionGuards.test.ts` passes unchanged.
- [ ] T020 [US2] `web/app/api/rescores/[id]/route.ts` swaps `forUser(OWNER_ID)` for `myStores()`. Another user's run id gets the missing-run answer.
- [ ] T021 [US2] The resume file is the owner's (R11b). Create `ownsResumeFile(userId)` in `src/config/resumeFile.ts`, a pure function and the one place the rule lives. `resumeShown` (`src/web/resumeView.ts`) and `resumeInUse` (`src/app/runSettings.ts`) take the user id and use `data/resume.md` only when it says so. Neither file names `OWNER_ID`.
- [ ] T022 [US2] Plan the budget across users (R8):
  - `enableProblem` and `saveSourcePlan` take `stores.sourcePlans.scheduledOnForAll()`, every user's, in place of the user's own list for the budget check. Same-board repeats are still checked against the user's own sources only.
  - `sourceActions.ts` and `src/web/saveSource.ts` pass it in.
  - `lookupDeps` (`src/sources/alertAccess.ts`) counts every user's scheduled searches through `context.sourcePlans.scheduledOnForAll()`.

  T017 passes.
- [ ] T023 [US4] Gmail on Settings (`src/gmail/connection.ts` through `web/lib/gmailDeps.ts` and `gmailActions.ts`): connecting stores the connection under the signed-in user and adds their own "Gmail alerts" source. Disconnecting removes only theirs.
- [ ] T024 [US2] Run `npm run check` and `npm run check:db` until green, record the ledger, and delete the marker. T015–T017 pass.

**Checkpoint**: Two accounts are fully separate in the UI.

---

## Phase 4: User Stories 3 and 4 (run) — Runs for every user (P1) — Sitting S3

**Goal**: FR-011–FR-016, and the run half of FR-002.

**Independent Test**: quickstart §4 and §5.

### Tests (S3)

- [ ] T025 Create `.specify/sitting-in-progress` naming S3.
- [ ] T026 [P] [US3] Write unit tests (4): two in `tests/usersToRun.test.ts` for `usersToRun` (`src/app/usersToRun.ts`, a pure function over each user's sources-on and resume presence), and two in `tests/runLines.test.ts` for `src/app/runLines.ts`:
  - users are in id order, including one without an email
  - a user with no source on is skipped as `no sources are on`, and one with no resume as `no resume`; only user 1's `data/resume.md` counts
  - `runLine` gives the lines in contracts/cli.md: `user <id>: run <runId> <status> after <N> steps: <reason>`, the skip lines, and `user <id>: failed`
  - `runExitCode` gives 1 when any user failed, and 1 when the only user asked for was skipped
- [ ] T027 [P] [US3] Write unit tests (3) in `tests/runAll.test.ts`, using the run's seams (`chat`, `http`, `openStores`) and a temporary data dir (`tests/helpers/dataDir.ts`), as `tests/run.test.ts` already does, with two users:
  - each user's jobs are scored with their own settings and resume, and each user's trace starts with their `userId`
  - a posting both find, including through an alert copy, gives each user their own view with one careers or description lookup, and keeps its description
  - one user's failure is reported, the next user still runs, and the exit is 1

### Implementation (S3)

- [ ] T028 [US3] Create `src/app/usersToRun.ts`, `src/app/runLines.ts` and `src/app/runAll.ts`, and narrow `src/app/run.ts` to one user's run (R6, R14):
  - `runAll(environment, seams, only?)` in `runAll.ts` replaces `runOnce`: open the stores once, run `usersToRun` over `stores.accounts.userIds()`, then call `runForUser(stores.forUser(id))` (in `run.ts`) for each runner.
  - Each user's part calls `openRunLogs` as now (its own random run id, today's file names), writes a first trace event `{ type: "user", userId }`, and runs its own `settingsForRun` and `gmailState`. `runForUser` is the old `runWithStores`.
  - `stores.postings.prune`, the API-call prune and the careers-audit prune run once in `runAll`, after every user.
  - `runLine` and `runExitCode` go in `src/app/runLines.ts`. `src/cli.ts` (there is no `src/index.ts`) calls `runAll`, prints `runLine` for each user followed by that user's summary line as today, and exits with `runExitCode`.
  - `runOnce`'s `userId` parameter from S1 is gone; `cli.ts` passes `--user`'s user to `runAll` in S4.

  T026 and T027 pass.
- [ ] T029 [US3] Share lookups and descriptions across users (R7) in `src/tools/careersStep.ts` and `src/sources/ingest.ts`: a posting `postings.known` reports as having a description is not looked up again. The duplicate checks read the user's own postings.
- [ ] T030 [US4] Verify only: S1 already passes the user's bound `gmail` and `alerts` through the run context (`src/app/run.ts`, `gmailState.ts`, `src/sources/alertAccess.ts`). T027 confirms a user without a connection is skipped quietly.
- [ ] T031 [US3] Run `npm run check` and `npm run check:db` until green, record the ledger, and delete the marker.

**Checkpoint**: Every user with a source on gets their own scored jobs on each run.

---

## Phase 5: User Story 5 — CLI and evals for one user (P3) — Sitting S4

**Goal**: FR-017, plus the docs.

**Independent Test**: quickstart §6.

- [ ] T032 Create `.specify/sitting-in-progress` naming S4.
- [ ] T033 [P] [US5] Write unit tests (3) in `tests/cliUser.test.ts` for `src/cliUser.ts`:
  - `--user` is parsed out of the arguments; no flag means user 1
  - an unknown email gives `--user: no account with that email`, and a malformed one gives `--user: not a valid address`, neither repeating the email
  - `storesFor(stores, args)` gives the resolved user's `UserStores`; `run`, `rescore`, `eval capture` and `eval run` all call it
- [ ] T034 [US5] Create `src/cliUser.ts` and wire `--user`:
  - `src/cli.ts`: replace `positional()` for `run` and `rescore` with a parser that allows `--user`, and update the `USAGE` line
  - `src/rescore/open.ts`
  - `src/evals/command.ts` and `src/evals/captureCommand.ts`: captured cases record an optional `userId`, so old cases still parse
  - the eval run's resume and profile read

  T033 passes.
- [ ] T035 [P] Update README:
  - accounts are now separate users
  - runs go through every user, with one trace each
  - `--user` on `run`, `rescore` and the evals
  - `data/resume.md` is the owner's
  - back up before the upgrade, and restore rather than re-run if it fails partway
- [ ] T036 [P] Add a feature 027 entry to CLAUDE.md:
  - `user_jobs` vs `jobs`
  - `Stores`/`forUser`/`UserStores` with no default user, and `ownerStores()` in tests
  - `PostingStore` (the shared posting) vs the user-bound `JobStore`
  - `myStores()` (`web/lib/myStores.ts`)
  - `runAll`/`runForUser`/`usersToRun`/`runLines`
  - the four migration steps and why the drop comes last
  - one responsibility per module (R14): each cross-user listing sits on its owning store, and `Stores` is only a container
  - `--user`
  - where `OWNER_ID` remains (T012's list)

  Fix earlier entries that name moved columns: 013's `jobs.applied`/`applied_on`, and 017's `jobs.source_id`. Update the Commands lines for `run`, `rescore`, `eval` and `import-sqlite`.
- [ ] T037 Check `scripts/copy-prod.sh` against the new tables: `user_jobs` is copied, and the skipped list is unchanged. Adjust `tests/integration/copyProd.test.ts` if it lists tables.
- [ ] T038 Run `npm run check` and `npm run check:db` until green, record the ledger, and delete the marker.

---

## Phase 6: Polish

- [ ] T039 After merge, the owner backs up production, deploys, and walks quickstart §2–§6 on the real stack with a second account. That includes §4's timing check: user 1's run takes no more than 10% longer than before (SC-005).

---

## Dependencies & Execution Order

- S1 → S2 → S3 → S4. Each needs the previous one's stores and callers.
- **Within S1**: T002–T004 first; then T005 → T006 → T007, T008 and T009 → T010 → T011 → T012 → T013.
- **Within S2**: the tests first; T018 before T019–T023.
- **Within S3**: the tests first; T028 before T029–T030.
- **Within S4**: T033 before T034; T035–T037 in parallel.

## Parallel Example: S1

```text
T003 userJobContract.ts   T004 forUser.test.ts   (after T002)
T007 job store (user view)   T008 PostingStore   T009 rescore/gmail/alert/source/account stores   (after T006)
```

## Implementation Strategy

US1 (S1) is the MVP: the data is per user and nothing changes for the owner. But a second account
would still see user 1's data until S2, so S1–S2 together are the first point worth deploying. S3
is what makes other users useful.

## Test ledger (constitution Principle II)

| Point | Unit | Integration | UI |
|---|---|---|---|
| Baseline (T001) | | | |
| S1 planned | +11 (T003 ×10, T004) | +4 (T002, T003 strict ×3) | +0 |
| S2 planned | +11 (T015 ×7, T016, T017 ×3) | +0 | +0 |
| S3 planned | +7 (T026 ×4, T027 ×3) | +0 | +0 |
| S4 planned | +3 (T033) | +0 | +0 |
| Planned after | +32 | +4 | +0 |
| Actual | | | |
