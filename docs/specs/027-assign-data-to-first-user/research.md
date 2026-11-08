# Research: Each user's own data (027)

Decisions behind the plan, checked against `main` at 693a827 (024 and 025 merged). Revised
2026-11-08 after two passes of `/speckit-analyze-deep` (the first deep analysis and its delta).
Where a decision changed because of them, the entry says so.

## R1. Split a posting from a user's view of it

- **Decision**: `jobs` keeps what a source said about a posting (shared). A new table, `user_jobs`,
  holds one user's view of it. Its key is `(user_id, ats, job_id)`.
  - It holds `source_id` (FK `user_sources.id`, `ON DELETE SET NULL`, as `jobs.source_id` had) and
    `source`, that user's source label.
  - It holds `first_seen` and `last_seen` for that user.
  - It holds `scored_at`, `score`, `base_score`, `bonus_score`, `reasons` and `gaps`.
  - It holds `hidden`, `applied` and `applied_on`.
- **What moves off `jobs`**: those per-user columns move in step `020_user_jobs`, which copies them
  to `user_jobs` for user 1 and then drops them from `jobs`.
- **What `jobs` keeps**:
  - `first_seen` and `last_seen`, the posting's, across all users. `earliestSeen` keeps reading
    the posting's age.
  - the description and its format, source and url
  - `company_id`
  - `injection_seen_at`, set when the posting's text was flagged
  - `emailed_at`, unused and left alone
  - the old `source` column, now unused, which nothing refreshes any more. Dropping it is left for
    later.
- **Rationale**: the owner's decision (Clarifications Q2). Postings are facts about employers.
  - **The label is per user**: each user names their own sources, so Recommended's
    source filter and `replaceSource`'s relabel both work on `user_jobs`. That way one user never
    sees another's source name, and renaming a source moves only that user's rows.
  - **FR-013 by construction**: a user sees a posting only through their own `user_jobs` row.
- **Alternatives**: rejected by the owner, as duplication:
  - adding a `user_id` column to `jobs`
  - keeping per-user columns on `jobs` for user 1

## R2. Verdicts, re-score runs and their steps get a user

- **Decision**: step `020_user_jobs` adds `user_id` (integer, not null, FK `users.id`) to `verdicts`
  and to `rescore_runs`, set to 1 on existing rows.
  - **Open re-scores**: one per user per job. `begin` locks that user's `user_jobs` row.
  - **`rescore_steps`**: hangs off its run, so it needs no column.
- **Rationale**: FR-001 and FR-003.

## R3. Gmail keyed by user

- **Decision**: `gmail_connection.id` and `gmail_alert_state.id` (today `TINYINT`, one row with
  `id = 1`) are renamed to `user_id` and changed to `integer` not null, matching `users.id`.
  They stay primary keys and gain FKs to `users.id`.
  - **The stores**: they take their user instead of the fixed `ROW`.
  - **Connecting**: adds the user's own "Gmail alerts" source through their bound sources store
    (`ensureAccountSource({ module, name }, …)`, no user argument).
- **Rationale**: FR-002 needs no new table, only a key that means something. MariaDB refuses a FK
  between `TINYINT` and `INT`, hence the type change.

## R4. Shared stores and a user's stores

- **Decision**: split what `openStores` gives into two parts:
  - **`Stores`**: a container of the shared stores only (`companies`, `careers`, `apiCalls`,
    `accounts`, `postings`, `sourcePlans`, the sign-in stores), `forUser(userId): UserStores` and
    `close`. It has no operations of its own; every cross-user operation belongs to the store that
    owns that data (R14).
  - **`UserStores`**: bound to one user (`jobStore`, `jobViews`, `gmail`, `alerts`, `rescoreLog`,
    `sources`, `searchSettings` and `resume`), plus the shared ones passed through.

  There is no default user. Code that used `stores.jobViews` without choosing a user fails
  typecheck, so no page or tool can quietly serve user 1's data (FR-007).
  - **Kysely**: the per-user stores take their `userId` at construction (`KyselyJobStore(db,
    userId)`). The sources, search-settings and resume stores keep their per-call `userId`
    methods underneath, and `forUser` wraps them in bound interfaces named after them:
    `UserSourceStore`, `UserSearchSettingsStore` and `UserResumeStore`, the same methods without
    the `userId` argument. Each lives beside its own store interface (`src/db/sourceStore.ts`,
    `searchSettingsStore.ts`, `resumeStore.ts`), not together (R14).
  - **Their contracts**: `searchSettingsContract`, `sourceContract` and `resumeContract` reach the
    per-call stores through `forUser(n)` for each user they test.
  - **Where the types live**: `UserStores` (the container) goes in a new `src/db/userStores.ts`,
    since `src/db/store.ts` is near the 200-line limit.
  - **Tests**: `memoryStores()` returns the same split. A test helper, `ownerStores()`, gives user
    1's `UserStores` for tests that only care about the owner.
- **Clean-up across users**: `JobStore.pruneLastSeenBefore` is removed. `postings.prune(cutoff)`
  on the shared `PostingStore` replaces it (R9, R14), and the run calls it from S1 on.
- **Budget across users**: the shared, narrow `SourcePlans` (`src/db/sourcePlans.ts`, one method,
  `scheduledOnForAll()`) lists every user's scheduled sources that are on, for the JSearch budget
  checks (R8). The per-call `SourceStore`, whose methods take any `userId`, is never on `Stores`:
  the only source store a caller can name is the bound `UserSourceStore` (`UserStores.sources`).
  That keeps "no store without a chosen user" true for sources too, and leaves no two members
  named `sources`.
- **Every user**: `AccountStore.userIds()` lists every `users.id` (R6).
- **`OWNER_ID` afterwards**: it stays only where user 1 is truly meant:
  - the migration
  - `ensureOwner` (`kysely/searchSettingsStore.ts`, `sourceStore.ts`)
  - the 024 `initOwner` and account rules (`kysely/accountStore.ts`)
  - the CLI default (`src/cliUser.ts`)
  - `import-sqlite`'s target (passed in from `cli.ts`)
  - the resume-file rule, `ownsResumeFile` in `src/config/resumeFile.ts` (R11b), outside
    `src/app/` and `web/`

## R5. The web uses the signed-in user's stores

- **Decision**: one function, `myStores()`, in its own file `web/lib/myStores.ts`. It does
  `requireSession()` and then `(await openedStores()).forUser(account.id)`.
  - **Why its own file**: `session.ts` answers "who is signed in" and `database.ts` "how do I reach
    the database"; `myStores.ts` uses both. That gives it one job, and the imports run one way
    (`myStores` → `session` → `database`), so there is no cycle.
  - **Pages and actions**: `getStores()`, `getUiState()` and `getSettingsState()` in `uiState.ts`,
    and every action that today opens stores, use it.
  - **Action shapes are unchanged**: actions keep their own `guarded` wrapper, answers and
    types. Moving them onto `signedInAction` would change their refusals, so they don't move.
  - **The re-score stream route**: it calls `myStores()` itself. The proxy's check isn't the
    only thing between another user and the run.
  - **Another user's ids**: a job, run or source id belonging to someone else finds nothing in the
    bound store, so it answers exactly as a missing one (FR-008).
- **Enforcement**: R4 is what makes this hold. `getStores()` returning `UserStores` is the only way a
  loader can reach job data.

## R6. A run per user

- **Decision**: `runOnce` becomes `runAll(environment, seams, only?)`.
  1. Open the stores once.
  2. List every user with `stores.accounts.userIds()`: every `users.id`, email or not.
  3. Decide each with `usersToRun`: skip a user with no source on (`no sources are on`) or
     with no resume (`no resume`). Only user 1 can use `data/resume.md`.
  4. Run `runForUser(stores.forUser(id), …)` for each runner in id order. It is today's
     `runWithStores`.
  5. Call `stores.postings.prune` once, after every user.
- **Where it lives**: `runAll` goes in its own `src/app/runAll.ts`, since looping over users is a
  separate job from running one user's session. `run.ts` keeps `runForUser`.
- **Run ids and logs**: each user's part calls `openRunLogs` as now, so it has its own random
  run id and its own trace, LLM and job-log files. The files keep today's names
  (`<timestamp>-<runId>.jsonl` in `data/runs`, with `.llm.jsonl` and `.jobs.jsonl` in
  `MYJOBBOT_LOG_DIR`), with no suffix. The trace's first event records `userId`. `rescore_runs.id`
  and the route's UUID check are unaffected.
- **Failures**: one user's failure is reported and the next user runs. The exit code is 1 when any
  user failed.
- **Where the lines come from**: `runLine(result)` and `runExitCode(results, only)` live in their
  own `src/app/runLines.ts`. Deciding who runs (`usersToRun.ts`) and wording the outcome are
  separate jobs. Both files are pure and tested; `cli.ts` can't be, because it runs `main()` when
  imported. `cli.ts` prints each user's line, followed by that user's summary line as today.
- **The command**: `npm start -- run` runs everyone; `--user <email>` runs one (R10).
- **Rationale**: FR-011 and FR-015. Running users one after another keeps the shared budget, the
  careers browser and the model's rate limits as they are.

## R7. Shared postings and lookups

- **Decision**:
  - **Storing**: `upsertAll` writes the posting to `jobs` (insert, or refresh as now), then the user's
    `user_jobs` row with `source_id`, `source` and `last_seen`.
  - **Keeping a found description**: a refresh keeps an existing non-null description
    (`description`, `description_format`, `description_source`, `description_url`) when the
    incoming one is null. A posting refreshed by an alert copy can't lose a looked-up description.
  - **Scoring again**: today a refresh clears `scored_at` only the first time a description turns
    from plain text, or no format, to Markdown (`scoredAtAfterRefresh`). That stays the rule,
    exactly. Today it is one `CASE` in the same `UPDATE`; with `scored_at` in `user_jobs` it has to
    be done differently:
    1. In one transaction, read the stored `description_format` of the incoming keys.
    2. Upsert the postings.
    3. Clear `user_jobs.scored_at`, for every user, of the keys whose stored format was `text` or
       null and whose incoming format is `markdown`.

    `setDescription` keeps clearing every user's `scored_at` for that posting, as it does today.
  - **"Known" stays per user; lookups are shared**: `sortAlertJobs` (`src/gmail/alertStore.ts`)
    still decides "seen again" against the user's own postings (the bound `findJob`). User 2's
    alert for a posting user 1 already has is therefore fresh for user 2: it is upserted and gives
    user 2 their own view (FR-012, FR-013).

    The shared `postings.known(keys)` (whether a posting exists and has a description) is used only
    to skip lookups. Two places use it:
    - the alert description lookup (`src/gmail/alertLookupStep.ts`)
    - the careers step (`src/tools/careersStep.ts`)

    So user 2 gets a view without a second lookup, and the upsert keeps the description already
    found.
  - **What runs once**: a careers lookup or description lookup for a posting runs at most once.
    Each user's board source still downloads its own board's listings.
  - **Duplicate checks**: `boardCompaniesWithTitle` and `companiesWithTitleOutside` read the user's
    own postings, since the duplicate rule is about what this user would see twice.
- **Rationale**: FR-012 and FR-013.

## R8. JSearch budget shared

- **Decision**: `api_calls` stays one table without a user. The run-time `budget used` check counts
  all of it, as now.
- **Planning the budget**: three checks count every user's scheduled sources that are on (from the
  shared `sourcePlans.scheduledOnForAll()`), not only the user's own:
  - turning a source on: `enableProblem`
  - saving a new source, which is saved on: `saveSourcePlan` → `sourceProblems`, in
    `src/web/saveSource.ts`
  - the run's reserve for alert description lookups: `lookupDeps` in `src/sources/alertAccess.ts`

  One user can't plan the whole budget, or spend another user's reserve.
- **Rationale**: owner's decision (Q4), FR-014.

## R9. Clean-up across users

- **Decision**: `postings.prune(cutoff)` on the shared `PostingStore` runs these in one go:
  1. Delete every user's `user_jobs` rows last seen before the cutoff, unless they are applied.
  2. Delete each user's verdicts and re-score runs whose `user_jobs` row is gone.
  3. Delete `jobs` rows that no `user_jobs` row points at.

  The API-call and careers-audit prunes stay as they are. `runAll` calls them once after every user.
  Company records are never deleted (014).
- **Rationale**: FR-016. A posting another user still sees is never removed.

## R10. Command line and evals

- **Decision**:
  - **The flag**: `run`, `rescore`, `eval capture` and `eval run` take an optional `--user <email>`.
    `src/cliUser.ts` parses it, normalising the email and looking it up with `accounts.byEmailKey`.
  - **Refusals** (exit 1): `--user: no account with that email` for an unknown email, and
    `--user: not a valid address` for a malformed one. Neither repeats the email.
  - **Default**: without the flag, the command acts for user 1.
  - **Parsing**: `positional()` refuses every flag, so `run` and `rescore` get a parser that allows
    `--user`. The eval subcommands open their stores in `src/evals/command.ts`, and that
    file takes the user too.
  - **Eval cases**: they record an optional `userId`.
- **Rationale**: FR-017.

## R11. The upgrade steps

- **Decision**: four migration steps, one per change to the data, using Kysely's schema and query
  builders. Data steps are typed with `db.withTables<…>()` under `Kysely<unknown>`, never
  `Kysely<any>`.
  1. **`020_user_jobs`**:
     - make sure user 1 exists
     - create `user_jobs` with its FKs and indexes
     - copy every `jobs` row into it for user 1, `source` included
  2. **`021_history_owners`**: add `user_id` to `verdicts` and `rescore_runs`, default 1, then drop
     the default and add the FKs.
  3. **`022_gmail_by_user`**: rename Gmail's `id` to `user_id`, change it to `integer` not null,
     and add the FKs.
  4. **`023_jobs_without_user_columns`**: drop FK `jobs_source_fk`, then indexes `jobs_source` and
     `jobs_by_source`, then the moved columns and any other index on them.
- **Why four**: each step does one thing, and the one that drops data comes last, as its own step,
  after the copy has been committed. MariaDB commits DDL as it goes, so a failure now stops at a
  step boundary. Everything before it stays recorded as done, and only the failed step's part needs
  attention. Each step runs once per database (FR-006). A step that failed partway is still
  recovered from the backup (quickstart §1).
- **Tests**: the older migration tests that read moved columns stop before `023`, read through
  `withTables`, and list all four steps.
- **Rationale**: nothing is dropped before it is copied, and each step can be tested on its own.

## R11b. The deployment's resume file is the owner's

- **Decision**: one pure function, `ownsResumeFile(userId)` in `src/config/resumeFile.ts` (true only
  for user 1), is the one place this rule lives. Three callers use it:
  - `resumeShown` (`src/web/resumeView.ts`)
  - `resumeInUse` (`src/app/runSettings.ts`)
  - `usersToRun`

  They take the user id and fall back to `data/resume.md` only when it says so. Keeping it out of
  `src/app/` and `web/` lets the no-`OWNER_ID` scan hold there.
  - **Everyone else**: a user without an uploaded resume has none. Settings shows none, the run
    skips them, and re-scores and evals refuse.
- **Rationale**: FR-009. The file is the owner's resume.

## R12. `import-sqlite`

- **Decision**: `src/app/importSqlite.ts` keeps working: each old row is split into a `jobs`
  posting plus a `user_jobs` row for the target user, and verdicts get that `user_id`. `cli.ts`
  passes user 1 in.
- **Rationale**: its integration test stays green, and the command stays a one-time copy.

## R13. Delivery

- **Decision**: four sittings, one PR at the end, the stack stopped throughout. Each sitting ends
  green.
  1. **S1, data and stores**: everything still for user 1.
  2. **S2, the web**: on the signed-in user.
  3. **S3, the run**: for every user.
  4. **S4, the CLI, evals and docs.**

## R14. One responsibility per module

- **Decision**: the restructure keeps each module to one job (single responsibility), keeps
  `Stores` a container rather than a home for unrelated operations (interface segregation), and
  puts each cross-user operation on the store that owns that data. Revised 2026-11-08 at the owner's
  request.
  - **`PostingStore`** (new, shared, `src/db/postingStore.ts`, Kysely in
    `src/db/kysely/postingStore.ts`): the shared posting and its lifecycle.
    - `known(keys)`
    - `setDescription`, `flagInjection` and `linkUnlinkedJobs`, which work on the posting, not a
      user's view
    - `earliestSeen`, the posting's age across reposts
    - `prune(cutoff)`, retention across users

    These leave `JobStore`. `JobStore`, bound to a user, keeps that user's view:
    - `upsertAll`, which writes the posting and the view in one transaction
    - `markSeen`, the unscored reads, the duplicate checks, `findJob` and `recordVerdict`

    The six callers move from `context.store` / `deps.jobs` to `context.postings` /
    `deps.postings`: `src/careers/lookUpJob.ts`, `src/rescore/oneJobStore.ts`,
    `src/app/beforeAgent.ts`, `src/app/lookalikes.ts`, `src/tools/jobSummary.ts` and
    `src/evals/captureCommand.ts`.
  - **Cross-user listings on their owners**:
    - `AccountStore.userIds()`
    - `SourcePlans.scheduledOnForAll()`, a one-method shared interface for the read across users,
      implemented beside the source store (Kysely in `src/db/kysely/sourcePlans.ts`). It's
      deliberately not the per-call `SourceStore`, which could read or write any user's sources.
  - **Bound store interfaces beside their stores**: `UserSourceStore` in `src/db/sourceStore.ts`,
    `UserSearchSettingsStore` in `searchSettingsStore.ts`, `UserResumeStore` in `resumeStore.ts`.
    Each wrapper's Kysely and memory code lives with its own store. `src/db/userStores.ts` only
    composes `UserStores`.
  - **Separate files for separate jobs**:
    - `web/lib/myStores.ts`, apart from `session.ts` (R5)
    - `src/app/runAll.ts` (the loop over users) apart from `run.ts` (one user's run)
    - `src/app/runLines.ts` (how outcomes read) apart from `usersToRun.ts` (who runs)
    - the four migration steps (R11)
  - **Memory stores**: they follow the same split, `tests/helpers/memoryPostingStore.ts` in place of
    a mixed `memoryPostings.ts`.
- **Rationale**: the first plan would have grouped unrelated things. `postings.ts` held a posting
  lookup, retention and a source listing. `Stores` had operations of its own. `JobStore`, bound to
  a user, did posting-wide work. `myStores` would have sat in the session file. Run output sat with
  run selection. One migration did four things. Each of those makes a later change touch code it
  has nothing to do with.
- **Not split**: `src/cliUser.ts` keeps parsing `--user` and resolving it to a user's stores
  together, since both answer one question: which user a command acts for.
