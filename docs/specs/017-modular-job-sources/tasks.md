---
description: "Tasks for feature 017: modular job sources, delivered as small PRs"
---

# Tasks: Modular job sources

**Input**: Design documents from `docs/specs/017-modular-job-sources/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/source-module.md, contracts/sources-ui-and-run.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file.
Existing tests a change breaks are updated in that same sitting, before the code. A test moved to a
new file or rewritten for the new shape counts as rewritten, not new.

**Organization**: by user story, in sittings. **Each sitting is one pull request** (plan
"Delivery"): a docs PR, then eight code PRs.

- **Per-PR flow** (each sitting's first and last tasks):
  1. Check `docker compose top myjobbot | grep -c "cli.ts run"` prints 0 (as its own command), then
     `docker compose stop`. Stop a running `docker:watch` by listing its PIDs in one command and
     killing them in the next (never a `pgrep -f` loop whose pattern is in the same command).
  2. `git switch main && git pull --ff-only && git switch -c <branch>`.
  3. Create `.specify/sitting-in-progress` naming the sitting; write the tests, then the code.
  4. Run `npm run check` and `npm run check:db`, have a reviewer agent check the diff (habit-hooks
     asks for one), check the size (`git diff --stat main`), and delete the marker. S4b and S5 also
     run `tests/docker.sh`.
  5. Commit and push with no attribution or `Co-authored-by` lines (this repo's `user.email` is
     `risingfish@users.noreply.github.com` on purpose). Open the PR with no footer; its
     description lists that PR's quickstart steps.
  6. **Stop, and wait for the owner to merge it.** Then `npm run docker:up`, and the owner tries
     the PR before the next sitting starts.
- **Size**: about 10 files per PR, tests included. Past about 12, tell the owner when opening it.
  S4b (~22), S5 (~22) and S6 (~13) are over the limit (plan, Delivery).
- **Limits to design for** (constitution Principle I): functions at most 20 lines, files at most
  200, at most 3 parameters (`SourceStore` methods take a `SourceKey` object). habit-hooks runs knip
  without the tests (`test-only-dead-code`), so every export needs a production caller in another
  file, in the sitting that adds it.
- **Libraries their own way** (constitution 2.3.0):
  - Kysely's schema builder for migrations 012 and 013, and `db.withTables<…>()` for 013's data step;
  - Kysely's query builder for the store;
  - zod for each module's params and the actions' requests;
  - React's `useState` and `useActionState` for the forms.

  No new library.
- **Integration tests are capped at 2 new** (research R9): migrations 012 and 013 in one test, and
  the saved-source contract on MariaDB. **One UI test** (the Sources section).
- **Modules keep the rules** (contracts/source-module.md):
  - requests only through `ctx.http` (`sourceHttp`);
  - no storing;
  - fixed failure reasons (`failureReason`);
  - outside text only through `outsideText: true` tools.
- **No new comments** beyond each new function's one-line purpose doc comment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5 from spec.md

---

## Phase 1: Setup

### Sitting S0: planning docs PR (T001–T003), branch `017-modular-job-sources`

- [ ] T001 Per-PR flow step 1: check the stack is stopped (it was stopped on 2026-10-28). Create
  `.specify/sitting-in-progress` naming S0.
- [ ] T002 Run `npm run check` and `npm run check:db`, and correct the ledger's baseline row below if
  the counts differ.
- [ ] T003 Delete the marker, and commit any changes under `docs/specs/017-modular-job-sources/` (the
  spec and plan are already committed). Push it and open a docs-only PR ("Plan modular job sources
  (017)"). **Wait for the owner to merge it.**

---

## Phase 2: Foundational - the module interface

### Sitting S1, PR 1: the interface, the checked client, and Greenhouse, Lever and Ashby on it (T004–T012), branch `017-pr1-source-modules`

No behaviour changes: a run fetches the same boards the same way (quickstart PR 1).

- [x] T004 Per-PR flow steps 1–3, for sitting S1.
- [x] T005 [P] Unit tests in a new `tests/sourceModules.test.ts` (eight `test()`s) for
  `src/sources/module.ts`, `src/sources/registry.ts`, `src/sources/sourceHttp.ts` and the three
  modules (contracts/source-module.md):
  - `MODULES` lists `greenhouse`, `lever` and `ashby`, with unique ids;
  - `moduleFor` finds a module by id, and gives `null` for an unknown one;
  - each module's `params` accepts `{ slug: "stripe" }` and refuses an empty slug;
  - `greenhouse.fromUrl` recognises `boards.greenhouse.io/<slug>` and `job-boards.greenhouse.io/<slug>`,
    including a posting link;
  - `lever.fromUrl` and `ashby.fromUrl` recognise theirs, including a posting link, and each gives
    `null` for another module's link;
  - `target` gives `greenhouse:stripe` for any letter case of the slug, and `suggestName` gives
    "Stripe";
  - `fetch` yields exactly one page, with `next: null` and `cost: 0`;
  - a module's request to a non-public address through `sourceHttp` is refused, and a redirect is
    not followed.

  Rewrite `tests/boardPage.test.ts` (4 tests) into this file as the modules' `company()` tests, and
  delete it.
- [ ] T006 [P] (Moved to S5, done with T047: nothing in S1 calls `failureReason` until the fetch phase
  records outcomes.) Unit test in a new `tests/sourceFailure.test.ts` (one `test()`): `failureReason` maps
  an `HttpStatusError` 404 to "not found", 401 and 403 to "refused", other statuses and a zod failure
  to "unexpected answer", a `NetworkError` to "unreachable", and a missing requirement to "not set
  up". It never returns an error's own message.
- [x] T007 [P] Rewrite `tests/sources.test.ts` (6 declarations, including one `test.each`; no new
  `test()`) to fetch through each module's `fetch`, not `fetcherFor`.
- [x] T008 Add `src/sources/module.ts`: `SourceModule`, `SourcePage`, `SourceField`, `SourceContext`,
  `Cursor` and `CompanyHint` (research R1). `kind` includes `web`, with no module.
- [x] T009 Add `src/sources/sourceHttp.ts` (`checked()`, moved from `src/careers/boardPages.ts`, which
  reuses it). `src/sources/failure.ts` (T006) and the typed errors below move to S5, with T047. Make `src/http/client.ts` throw `HttpStatusError`
  and `NetworkError`.
- [x] T010 (Done with two changes: the `company` zod object stays in `src/config/schema.ts` until
  S4b removes `companies` from the settings, and the modules share `src/sources/modules/slugBoard.ts`
  in place of `defineBoard`.) Move the readers into `src/sources/modules/greenhouse.ts`, `lever.ts` and `ashby.ts`. Each
  is a `SourceModule<{ slug }>` built with `defineBoard`, and has:
  - `params`, with the `company` zod object moved from `src/config/schema.ts`;
  - `fields`: one "Board id" text field;
  - `fromUrl`, through `parseBoardLink`;
  - `target`, `suggestName` and `limits` (`every_run`, no job limit);
  - `company`, folding `src/companies/boardPage.ts` into the modules.
- [x] T011 Add `src/sources/registry.ts` with `MODULES` and `moduleFor` (T005). `MODULES` stays
  unexported until S6's `sourceChoices` reads it, so T005's first test checks each module through
  `moduleFor`.
  - Switch every caller of `fetcherFor` and `boardPageUrl` to the modules: `src/tools/boardFetch.ts`,
    `src/careers/boardPages.ts` and `beforeAgent` in `src/app/run.ts`.
  - Give the run's board fetch `sourceHttp`.
  - Delete `src/sources/index.ts`, `src/sources/types.ts` and `src/companies/boardPage.ts` once
    nothing imports them.
- [ ] T012 Per-PR flow steps 4–6 ("Put the job board readers behind a source module interface (017
  PR 1)").

---

## Phase 3: User Story 1, part 1 - Workday (Priority: P1)

### Sitting S2, PR 2: the Workday module, and the careers lookup on modules (T013–T018), branch `017-pr2-workday-module`

- [ ] T013 [US1] Per-PR flow steps 1–3, for sitting S2.
- [ ] T014 [P] [US1] Unit tests in a new `tests/workdayModule.test.ts` (four `test()`s) for
  `src/sources/modules/workday.ts`, with a fake HTTP client (research R6):
  - `fromUrl` recognises `<tenant>.wd<N>.myworkdayjobs.com/<site>`, with or without a locale, and a
    posting link, giving `{ host, tenant, site }`;
  - `fetch` posts `{ limit: 20, offset }` to the site's `/jobs` address, yields 20 jobs a page with
    `next: { offset }`, and starts from a given cursor;
  - a last page of fewer than 20 jobs, and an empty page after exactly 20, both yield `next: null`;
  - each job takes its description from its posting's detail, as Markdown within the stored limit.
    Its `ats` is `"workday"`, and its job id is `<tenant>/<site>/<posting id>`, or a SHA-256 digest
    when that would pass 255 characters.
- [ ] T015 [P] [US1] Rewrite `tests/careersBoardPages.test.ts` (6 tests) and `tests/careersWorkday.test.ts`
  (4 tests) to read through the modules' `postings` (no new `test()`; the existing test at :55
  becomes the module-read case).
- [ ] T016 [US1] Add `src/sources/modules/workday.ts` (T014). Move `searchWorkday` and
  `workdayPosting` into it as `postings.search(params, text, http)` and `postings.one(params, id,
  http)`, and delete `src/sources/workday.ts`. Give Greenhouse, Lever and Ashby
  `postings.list(params, http)`. Add `workday` to the `Job` type's `ats`, but not to `ATS_NAMES`
  (research R6). List Workday in `MODULES`.
- [ ] T017 [US1] In `src/careers/boardPages.ts`, read every board through `moduleFor(link.kind)` and
  its `postings`, passing the lookup's own checked client.
- [ ] T018 [US1] Per-PR flow steps 4–6 ("Add a Workday source module, and read careers boards through
  the modules (017 PR 2)").

---

## Phase 4: User Story 2 - Existing boards and searches keep working (Priority: P1)

### Sitting S3, PR 3: the saved sources table and store (T019–T024), branch `017-pr3-user-sources`

- [ ] T019 [US2] Per-PR flow steps 1–3, for sitting S3.
- [ ] T020 [P] [US2] Update the exact migration lists (no new `test()`; migration 012's own test comes
  with 013's in S4b):
  - add `012_user_sources` to every exact migration list in `tests/integration/migrate.test.ts` and
    `companyMigrations.test.ts`;
  - add `user_sources` to the collation list, in the order MariaDB returns it;
  - add `user_sources` to `TABLES` in `tests/helpers/testDb.ts`, before `users` and `companies`
    (foreign keys).
- [ ] T021 [P] [US2] One bundled contract case in a new `tests/helpers/sourceContract.ts` (one
  `test()`; data-model "Store contract" steps 1–7), wired into `tests/storeContract.test.ts` and
  `tests/integration/storeContract.test.ts`, whose `afterAll` already empties the tables.
- [ ] T022 [US2] Add `src/db/migrations/012_user_sources.ts` (the table, its unique keys, and
  `jobs.source_id` with `ON DELETE SET NULL`; data-model.md). List it in
  `src/db/migrations/index.ts`, and add `UserSourcesTable` and `jobs.source_id` to `src/db/schema.ts`.
- [ ] T023 [US2] Add the store:
  - `src/db/sourceStore.ts`: `SourceStore`, `SavedSource`, `SourceOutcome` and `SourceKey`;
  - `sources` in `Stores`;
  - `src/db/kysely/sourceStore.ts`, wired into `src/db/kysely/stores.ts`;
  - `tests/helpers/memorySourceStore.ts`, wired into `memoryStores()`.

  Give it a production caller: `getSettingsState` in `web/lib/uiState.ts` lists the owner's saved
  sources (still empty).
- [ ] T024 [US2] Per-PR flow steps 4–6 ("Add the saved sources table (017 PR 3)").

### Sitting S4a, PR 4a: jobs and companies linked to sources (T025–T029), branch `017-pr4a-source-links`

No behaviour changes yet: every caller still passes a plain name.

- [ ] T025 [US2] Per-PR flow steps 1–3, for sitting S4a.
- [ ] T026 [P] [US2] Extend the store contracts (no new `test()`):
  - in `tests/helpers/storeContract.ts`, a job stored with `{ id, name }` is offered under that
    source's id, and a job from another source with the same name isn't;
  - in `tests/helpers/companyContract.ts`, `setBoardPage` returns the company's id.
- [ ] T027 [US2] In `src/db/store.ts`, `src/db/kysely/jobStore.ts` and the memory store:
  - `upsertAll(jobs, seen, source: JobSource)` takes a plain name or `{ id, name }`, setting
    `source_id`;
  - the unscored queries, `boardCompaniesWithTitle` and `companiesWithTitleOutside` key on
    `source_id` when one is given;
  - a rename updates `jobs.source`.
- [ ] T028 [US2] Make `CompanyStore.setBoardPage` return the company's id, in the Kysely and memory
  stores.
- [ ] T029 [US2] Per-PR flow steps 4–6 ("Link jobs and companies to saved sources (017 PR 4a)").

### Sitting S4b, PR 4b: the move (T030–T040), branch `017-pr4b-move-sources`

This lands whole: once migration 013 moves `companies` and `searches` out of the settings document,
every reader reads saved sources (plan, Delivery).

- [ ] T030 [US2] Per-PR flow steps 1–3, for sitting S4b.
- [ ] T031 [P] [US2] Integration test in `tests/integration/companyMigrations.test.ts` (one new
  `test()`; rename the file `laterMigrations.test.ts` only if it would pass 200 lines) for migrations
  012 and 013. After `migrateBefore(db, "012")`:
  - `columnTypes` for `user_sources` and `jobs.source_id` matches data-model.md;
  - a stored settings document with two boards, a duplicate board and a search, plus jobs from each
    and from `Gmail alerts`, gives four saved sources (the duplicate merged into the first). Names,
    fields and order stay the same, and the document has no `companies` or `searches`. Every job's
    `source_id` is set, except a job from a removed source, which stays null;
  - a database with no `user_settings` row (a fresh install) gives no saved sources and no error.

  Add `013_move_sources` to the exact migration lists.
- [ ] T032 [P] [US2] Unit tests (six `test()`s), in the files named:
  - `tests/searchSettings.test.ts`: `companies` and `searches` in `config.json` or the stored
    document give one `retired` notice, never an error;
  - `tests/run.test.ts`: a run with no source on finishes at once with "no sources are on";
  - `tests/run.test.ts`: before the agent, each company source's company record gets its module's
    careers page, and the source is linked through `linkCompany`;
  - `tests/run.test.ts`: a run with a `jsearch` source on and no `JSEARCH_API_KEY` still starts
    (H6);
  - `tests/pageData.test.ts`, or the file that tests `sourceNames`: page filters list every saved
    source's name, including sources that are off;
  - `tests/gmailConnection.test.ts`, or the Gmail actions' test file: connecting Gmail ensures the
    Gmail alerts source.
- [ ] T033 [US2] Update the tests the move breaks, in its own pass (not [P]: it edits the same files
  as T032). These 17 unit tests are **deleted** and counted in the ledger:
  - `tests/config.test.ts`: :26, :70, :91, :97, :101, :105, :109, :115, :122 and :128;
  - `tests/settingsView.test.ts`: :44, :48 and :52;
  - `tests/settingsForm.test.ts`: :47;
  - `tests/settingsProblems.test.ts`: :50;
  - `tests/searchSettings.test.ts`: :73 and :77.

  These are **rewritten** (no count change) to use other lists or the new shapes:
  - `tests/settingsApply.test.ts`, `settingsProblems.test.ts` and `settingsSave.test.ts`, whose
    SC-003 table drops its Sources rows;
  - `tests/settingsSections.test.ts`, with eight fields over six keys;
  - `tests/runSettings.test.ts`: :17;
  - `tests/resolveSettings.test.ts`: :17, :21, :27 and :50;
  - `tests/searchSettings.test.ts`: :19;
  - `tests/client/settings.test.tsx` (:10, :18), `client/settingsScoring.test.tsx` (:14) and
    `client/settingsNotices.test.tsx` (:8);
  - `FULL_CONFIG` and `SAMPLE_CONFIG` lose `companies` and `searches`;
  - `storesWithSettings` seeds saved sources.
- [ ] T034 [US2] Add `src/db/migrations/013_move_sources.ts` (data-model "The data step"), typed with
  `db.withTables<…>()`, with its own frozen target rules. List it in `migrations/index.ts`.
- [ ] T035 [US2] Take `companies` and `searches`, the four cross-source rules and `requireSearchKey`
  out of:
  - `src/config/schema.ts` and `parse.ts`;
  - `searchSettings.ts`: `SANITIZERS`, and the new `retired` notice;
  - `resolve.ts`;
  - `src/web/settingsSections.ts`, `settingsView.ts`, `settingsForm.ts`, `settingsApply.ts` and
    `settingsProblems.ts`.

  Show the `retired` notice in `web/components/settings/SettingsNotices.tsx`.
- [ ] T036 [US2] Rewrite `web/components/settings/SourcesSection.tsx` as a read-only list of saved
  sources, keeping `<h4>Sources</h4>` (research R7).
- [ ] T037 [US2] Move `beforeAgent` into `src/app/beforeAgent.ts`. Switch every reader to the owner's
  saved sources (research R8):
  - `configuredSources` in `src/tools/sources.ts`;
  - the company sources' board pages, through `module.company()`, `setBoardPage` and `linkCompany`;
  - `sourceNames` in `src/web/pageData.ts`, including sources that are off;
  - the alert lookups' allowance in `src/tools/alertSource.ts`, counting `jsearch` sources that are
    on;
  - a run with no source on finishes with "no sources are on";
  - every production `upsertAll` call passes `{ id, name }`.

  The model still fetches through `fetch_jobs` until S5.
- [ ] T038 [US2] In `web/lib/gmailActions.ts`, connecting Gmail calls
  `SourceStore.ensureAccountSource` for Gmail alerts.
- [ ] T039 [US2] Check every file is within 200 lines, and run `tests/docker.sh`: its web check loads
  `/settings`.
- [ ] T040 [US2] Per-PR flow steps 4–6 ("Move boards and searches into saved sources (017 PR 4b)").
  It is about 22 files: tell the owner when opening it.

**Checkpoint**: User Story 2 works: the owner's boards and searches are saved sources, and their jobs
keep their history.

---

## Phase 5: User Stories 4 and 5 - every source fetched by the run (Priority: P2, P3)

### Sitting S5, PR 5: the fetch phase, JSearch and Gmail as modules, next_jobs (T041–T051), branch `017-pr5-fetch-phase`

- [ ] T041 [US4] Per-PR flow steps 1–3, for sitting S5.
- [ ] T042 [P] [US4] Unit tests in a new `tests/fetchPhase.test.ts` (nine `test()`s) for
  `fetchSources(context)` in `src/sources/fetchPhase.ts` (research R5):
  - it fetches only sources that are on, available and due, one at a time: company sources, then
    Gmail alerts, then JSearch. It skips the others with a `source_skipped` reason;
  - a source whose module isn't in `MODULES`, or whose fields fail its rules, is skipped as "unknown
    module" or "invalid fields";
  - JSearch is due from `last_fetched_at`, less the 15-minute leeway;
  - a source that reaches `maxJobsPerRun` before its last page is recorded `partial` with its cursor,
    and the next run continues from it;
  - after the last page the cursor is cleared, so the next run starts from the first page;
  - a failing source is recorded `failing` with `failureReason`, and every other source is still
    fetched (SC-005);
  - JSearch is skipped when the month's requests plus the page's cost would pass the cap;
  - each fetch writes `source_fetch` with its pages, jobs, cost and outcome;
  - after the Gmail alerts source, the alert state is recorded and the careers lookup runs for alert
    jobs.
- [ ] T043 [P] [US4] Unit test in a new `tests/ingest.test.ts` (one `test()`): a page is stored under
  its source's id and name.
- [ ] T044 [P] [US4] Rewrite these tests for the new shape (no new `test()`):
  - `tests/searchSources.test.ts` (12) becomes the `jsearch` module and `ingest` tests: the budget,
    board copies, and excluded publishers and domains;
  - `tests/jsearch.test.ts` (6) imports the module;
  - `tests/fetchJobs.test.ts` (10) becomes `tests/nextJobs.test.ts`;
  - `tests/listSources.test.ts` (5) reports outcomes and unscored counts;
  - `tests/prompt.test.ts` (4) checks the new steps;
  - `tests/toolDeclarations.test.ts` lists `next_jobs`;
  - the alert tests that call `fetchAlerts` read its yielded jobs and mail state;
  - the run tests, `e2e`, `searchE2e`, `recovery`, `runIds` and `llm` use `next_jobs`, with the
    fetch phase run first.
- [ ] T045 [US5] Unit tests in its own pass (not [P]: it edits `nextJobs.test.ts` after T044) (three
  `test()`s):
  - `tests/nextJobs.test.ts`: `next_jobs` fetches nothing;
  - `tests/nextJobs.test.ts`: it offers a company source's jobs from this run's fetch, and a skipped
    or failing source's jobs from earlier runs;
  - `tests/gmailAlerts.test.ts`: the `gmail_alerts` module is unavailable, and skipped, until Gmail
    is usable.
- [ ] T046 [US4] Add the two modules, and list both in `MODULES`:
  - `src/sources/modules/jsearch.ts`, from `src/sources/jsearch.ts` and `src/tools/searchFetch.ts`,
    with the `search` zod object moved from `src/config/schema.ts`;
  - `src/sources/modules/gmailAlerts.ts`.

  Restructure `src/gmail/alertFetch.ts` to yield jobs and its mail state, storing nothing (research
  R2). Delete `src/sources/jsearch.ts`.
- [ ] T047 [US4] Add `src/sources/failure.ts` and make `src/http/client.ts` throw `HttpStatusError` and
  `NetworkError` (moved from T009, with T006's test). Add `src/sources/ingest.ts` (T043; research R4) and `src/sources/fetchPhase.ts`
  (T042). Call `fetchSources` from `src/app/beforeAgent.ts`. It records each outcome with
  `SourceStore.recordFetch`, writes alert state through `AlertStore.recordRead`, and runs
  `lookUpAlertJobs` after the alerts source.
- [ ] T048 [US4] Replace `fetch_jobs` with `next_jobs` (`src/tools/nextJobs.ts`, `outsideText: true`).
  - Rework `list_sources`.
  - Update `src/tools/registry.ts`, and `src/agent/prompt.ts`'s steps, `NUDGE` and
    `COMPACTION_NOTICE` (contracts/sources-ui-and-run.md).
  - Delete `fetchJobs.ts`, `boardFetch.ts`, `searchFetch.ts` and `alertSource.ts` once nothing
    imports them.
- [ ] T049 [US4] Check every file is within 200 lines.
- [ ] T050 [US4] Run `tests/docker.sh`.
- [ ] T051 [US4] Per-PR flow steps 4–6 ("Fetch every source that is on before the model scores (017
  PR 5)"). It is about 22 files: tell the owner when opening it, and offer to split the tools and
  prompt into their own PR.

---

## Phase 6: User Stories 1 and 3 - the Sources section (Priority: P1, P2)

### Sitting S6, PR 6: the Sources section made editable (T052–T061), branch `017-pr6-sources-section`

- [ ] T052 [US1] Per-PR flow steps 1–3, for sitting S6.
- [ ] T053 [P] [US1] Unit tests in a new `tests/sourceRules.test.ts` (five `test()`s) for `sourceRules`
  in `src/web/sourceRules.ts`. They bring back, as source rules, the checks S4b deleted:
  - a name matching another ignoring case is refused;
  - "Gmail alerts" is refused as a name;
  - a second source with the same `target` is refused, naming the first;
  - a `jsearch` source that would pass the monthly budget at `refresh_hours` is refused with today's
    message;
  - turning a `jsearch` source on is refused the same way.
- [ ] T054 [P] [US1] Unit tests in a new `tests/sourceForm.test.ts` (five `test()`s) for
  `recognizeLink` in `src/sources/registry.ts`, and for `sourceChoices` and `sourceFormView` in
  `src/web/sourceForm.ts`:
  - each ATS link, including a posting link, gives its module, params and a suggested name (SC-003);
  - an unsupported link gives `null`;
  - `sourceChoices` gives each module's id, name, description, fields and availability, as plain
    data;
  - a module's form lists its fields with their values and problems;
  - a module whose `requires` aren't met is shown as unavailable, with why.
- [ ] T055 [P] [US3] Unit tests in a new `tests/sourceRows.test.ts` (four `test()`s) for `sourceRows`
  in `src/web/sourceRows.ts`:
  - rows show each outcome's text: "ok", "stopped at the limit (continues next run)" and
    "failing: <reason>";
  - Gmail alerts is listed only once Gmail is connected, with the switch only;
  - a source whose module is gone shows "unavailable", and one whose fields fail shows "needs
    fixing";
  - the JSearch line shows this month's requests out of the cap.
- [ ] T056 [P] [US1] Unit tests in a new `tests/saveSource.test.ts` (three `test()`s) for
  `saveSourcePlan` in `src/web/sourceRules.ts`:
  - a source whose test fetch fails is saved and marked `failing` (FR-017);
  - editing a source's fields clears its cursor;
  - a JSearch test records one request, and a Workday test reads the listing only.
- [ ] T057 [P] [US1] UI test in a new `tests/client/sourcesSection.test.tsx` (one `test()`), with
  `web/lib/sourceActions.js` mocked:
  - pasting a Greenhouse link opens its form, filled in;
  - saving shows "Saved. Test found N jobs.";
  - a refused name shows its problem beside the field;
  - the list's switch calls `setSourceEnabled`.
- [ ] T058 [US1] Add `src/web/sourceRules.ts`, `src/web/sourceForm.ts`, `src/web/sourceRows.ts` and
  `recognizeLink` (T053–T056).
- [ ] T059 [US1] Add `web/lib/sourceActions.ts`, with `recognizeSourceLink`, `saveSource`,
  `setSourceEnabled` and `deleteSource` (contracts/sources-ui-and-run.md). The save test builds its
  `SourceContext` with `sourceHttp`, as a run does.
- [ ] T060 [US1] Extend `web/components/settings/SourcesSection.tsx` with switches, edits and
  deletes. Add `SourceForm.tsx`: the link box, the module picker fed by `sourceChoices`, and a
  module's form.
- [ ] T061 [US1] Per-PR flow steps 4–6 ("Add and manage sources on the Settings page (017 PR 6)"). It
  is about 13 files: tell the owner when opening it.

**Checkpoint**: User Stories 1 and 3 work: the owner adds a source by pasting a link, and manages
them all in one list.

---

## Phase 7: Polish

### Sitting S7, PR 7: docs (T062–T065), branch `017-pr7-docs`

- [ ] T062 Per-PR flow steps 1–3, for sitting S7.
- [ ] T063 [P] Update `README.md`:
  - sources as modules and saved sources, with the module table;
  - adding a source by pasting a link;
  - the fetch phase, and the model only scoring;
  - the tool list: `next_jobs` replaces `fetch_jobs`;
  - the data model: `user_sources` and `jobs.source_id`;
  - Configuration knobs: `companies` and `searches` are gone.
- [ ] T064 Update `CLAUDE.md`:
  - a Conventions line for the module interface and its rules: requests only through `sourceHttp`,
    no storing, fixed reasons, registered in `MODULES`;
  - fix the lines about "the board readers" and `src/tools/careersStep.ts`;
  - fill the ledger's last row.
- [ ] T065 Per-PR flow steps 4–6 ("Document modular job sources (017 PR 7)").

---

## Dependencies & Execution Order

- **S0 → S1 → S2 → S3 → S4a → S4b → S5 → S6 → S7**, each merged and tried before the next.
- **S2** needs S1's interface.
- **S3** stands alone, but goes after S2 to keep PRs in order.
- **S4a** needs S3's `jobs.source_id`.
- **S4b** needs S4a's links, and lands the move and every reader together.
- **S5** needs S4b's saved sources.
- **S6** needs S5's fetch path for the test on save.

### Within each sitting

- The per-PR flow's first task, then the test tasks (marked [P] when their files don't overlap), then
  the code in task order, then the closing flow task.
- Every new export has a production caller in another file, in the sitting that adds it:
  - S1: the interface types, `MODULES`, `moduleFor`, `sourceHttp` and `failureReason` (from
    `boardFetch.ts`, `boardPages.ts` and `run.ts`);
  - S2: the Workday module and `postings` (from `boardPages.ts`);
  - S3: the store (from `stores.ts` and `uiState.ts`);
  - S4a: `JobSource` and the returned company id (from `jobStore.ts` and `run.ts`);
  - S4b: `linkCompany`, `ensureAccountSource`, the `retired` notice and `beforeAgent.ts`;
  - S5: `fetchSources` (from `beforeAgent.ts`), `ingest` (from `fetchPhase.ts`) and `next_jobs`
    (from `registry.ts`);
  - S6: `sourceRules`, `saveSourcePlan`, `sourceChoices`, `sourceFormView`, `sourceRows` and
    `recognizeLink` (from `sourceActions.ts` and the page).

## Parallel Example: User Story 4 (S5)

```text
T042 fetch phase  tests/fetchPhase.test.ts
T043 ingest       tests/ingest.test.ts
T044 rewrites     tests/searchSources.test.ts, nextJobs.test.ts, listSources.test.ts, prompt.test.ts, …
```

## Implementation Strategy

- **MVP**: S1–S5. Every source is a module, the owner's sources are saved rows, and the run fetches
  them all.
- **Increments**: S6 lets the owner add sources by pasting a link, and S7 documents it.

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (after 016, T002) | 698 (85.64%) | 58 (7.12%) | 59 (7.24%) |
| Planned new | 50 (T005 8, T006 1, T014 4, T021's memory run 1, T032 6, T042 9, T043 1, T045 3, T053 5, T054 5, T055 4, T056 3) | 2 (T021's MariaDB run, T031) | 1 (T057) |
| Planned removed | 17 (T033) | 0 | 0 |
| Planned after | 731 (85.90%) | 60 (7.05%) | 60 (7.05%) |
| After PR 7 (T064) | | | |
