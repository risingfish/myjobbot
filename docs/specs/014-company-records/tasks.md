---
description: "Tasks for feature 014: company records, delivered as small PRs"
---

# Tasks: Company records

**Input**: Design documents from `docs/specs/014-company-records/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/company-records.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file,
and the existing tests its change breaks, which are updated in that same test task, before the code.

**Organization**: by user story, in sittings. **Each sitting is one pull request** (plan
"Delivery"): a docs PR, then six code PRs. PR 1 is split into 1a (migration and schema) and 1b
(recording and backfill), at the owner's request (2026-10-24).

- **Per-PR flow** (each sitting's first and last tasks):
  1. Check `docker compose top myjobbot | grep -c "cli.ts run"` prints 0 (as its own command), then
     `docker compose stop`. Make sure `docker:watch` isn't running.
  2. `git switch main && git pull --ff-only && git switch -c <branch>`.
  3. Create `.specify/sitting-in-progress` naming the sitting; write the tests, then the code.
  4. Run `npm run check` and `npm run check:db`, check the size (`git diff --stat main`), and delete
     the marker.
  5. Commit and push with no attribution lines, and open the PR with no footer. Its description
     lists that PR's quickstart steps.
  6. **Stop, and wait for the owner to merge it.** Then `npm run docker:up`, and the owner tries
     the PR before the next sitting starts.
- **Size**: about 10 files per PR, tests included. Past about 12, tell the owner when opening it.
  Planned sizes are in the plan's Delivery table.
- **Limits to design for** (constitution Principle I): functions at most 20 lines and files at most
  200, tests included.
  - `src/db/store.ts` is at 195 lines, so the new interface goes in `src/db/companyStore.ts`.
  - `runWithStores` (`src/app/run.ts`) is at 9 lines, so the new run steps go in `beforeAgent` and
    `afterAgent` helpers (research R4).
  - The bundled contract case is split over `companyContract.ts` and `companySearchSteps.ts`, and
    calls one step group per sitting (research R11).
  - habit-hooks runs knip without the tests (`test-only-dead-code`), so every export needs a
    production importer in another file, in the sitting that adds it.
- **Libraries their own way** (constitution 2.3.0):
  - Kysely's schema builder for both migrations (`createTable`, `addColumn`, `addUniqueConstraint`,
    `addForeignKeyConstraint`, `createIndex`, `dropTable`, `modifyEnd`), with `` sql`...` `` only for
    a fragment the builder can't express.
  - The 010 data step uses `insertInto(...).expression(selectFrom(...))` through
    `db.withTables<...>()`.
  - Upserts use `onDuplicateKeyUpdate`, as `jobStore.ts` does.
  - No new library.
- **Integration tests are capped at 3 new** (research R12): one per migration, and one bundled
  company contract case that grows by a step group each sitting. Never add a second contract case.
- **No new comments** beyond each new function's one-line purpose doc comment, plus one comment per
  the existing "applied in order" pattern where research R5 calls for it. Update existing doc
  comments whose purpose changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US2 from spec.md

---

## Phase 1: Setup

### Sitting S0: planning docs PR (T001–T003), branch `014-company-records`

- [X] T001 Per-PR flow step 1 (done on 2026-10-23: the stack and the watcher are stopped). Create
  `.specify/sitting-in-progress` naming S0.
- [X] T002 Run `npm run check` and `npm run check:db`, and correct the ledger's baseline row below if
  the counts differ.
- [X] T003 Delete the marker, and commit only `docs/specs/014-company-records/` ("Plan company
  records (014)"). Push it and open a docs-only PR. **Wait for the owner to merge it.**

---

## Phase 2: Foundational

### Sitting S1a, PR 1a: the companies table (T004–T008), branch `014-pr1a-companies-table`

Nothing visible changes; the table exists and every job's `company_id` is null.

- [X] T004 Per-PR flow steps 1–3, for sitting S1a.
- [X] T005 [P] Integration test in `tests/integration/migrate.test.ts` (one new `test()`), on a
  database migrated to 008:
  - seed two jobs with a Kysely `insertInto("jobs")`, run 009, and check that `companies` exists and
    is empty and both jobs' `company_id` is null;
  - check `columnTypes(db, "companies", [...])` for every column in data-model.md (types,
    nullability, `utf8mb4_bin`), and `columnTypes(db, "jobs", ["company_id"])`.

  In the same task:
  - add `009_companies` to the exact migration lists at `tests/integration/migrate.test.ts:56`,
    `:77`, `:113` and `:131`;
  - add `"companies utf8mb4_bin"` to the exact collation list at `:58`;
  - add `companies` to `TABLES` in `tests/helpers/testDb.ts`, ordered so `emptyTables` empties
    `jobs` before `companies` (the foreign key).
- [X] T006 Add `src/db/migrations/009_companies.ts`, exported as `companies`:
  - `createTable("companies")` with the columns of data-model.md, an auto-increment primary key
    `id`, and a unique constraint on `company_key`;
  - the table options every table has (`001_initial.ts:4`'s `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    COLLATE=utf8mb4_bin`) through `.modifyEnd(sql`...`)`. It is the first table created with the
    builder, since 001–004 predate the rule;
  - `createIndex` on `last_found_date`;
  - then `alterTable("jobs").addColumn("company_id", "integer")`, an index on it, and
    `addForeignKeyConstraint("jobs_company", ["company_id"], "companies", ["id"])`.

  List it as `"009_companies"` in `src/db/migrations/index.ts`.
- [X] T007 Add `CompaniesTable` (data-model.md) to `Database`, and `company_id: Count` to
  `JobsTable`, in `src/db/schema.ts`.
- [X] T008 Per-PR flow steps 4–6 ("Add the companies table (014 PR 1a)").

---

## Phase 3: User Story 1 - Every company found is recorded once (Priority: P1) 🎯 MVP

**Goal**: one record per company, every stored job linked to it, excluded companies included.

**Independent Test**: after one run, no stored job with a company name (other than an empty key) is
unlinked, and no company key has two records (quickstart PR 1b).

### Sitting S1b, PR 1b: recording and the backfill (T009–T018), branch `014-pr1b-company-records`

- [X] T009 [US1] Per-PR flow steps 1–3, for sitting S1b.
- [X] T010 [P] [US1] Unit tests in a new `tests/companyKeys.test.ts` (five `test()`s) for
  `companyKeys(entries)` in `src/companies/keys.ts` (research R2). Each entry is `{ name, firstSeen,
  lastSeen }`:
  - "Acme", "ACME, Inc." and "Acme LLC" give one key, `acme`;
  - two companies give two keys;
  - a name with no letters or digits gives no key;
  - a key keeps the earliest first-seen and the latest last-seen of its entries;
  - a key's name is the name of the entry with the earliest first-seen, whatever the entries'
    order. On a tie, the earlier entry wins.
- [X] T011 [P] [US1] One bundled contract case in a new `tests/helpers/companyContract.ts`, wired
  into `tests/storeContract.test.ts` and `tests/integration/storeContract.test.ts` like
  `appliedContract`.
  - **The test:** one `test()` named "companies are recorded once, linked, kept through pruning and
    searched by the rules". It calls one step group per sitting, starting with `recordSteps`
    (data-model case 1).
  - **The hooks:** it takes `{ listCompanies, seedUnlinked }` (research R11). The memory wiring builds
    `memoryStores(tables)` over its own `newTables()` and implements them on those tables; the
    MariaDB wiring uses Kysely.
  - **`recordSteps`:**
    - a board, a JSearch search and the alert source upserting jobs from "Acme", "ACME, Inc." and
      "Acme LLC" give one record, and every job's `company_id` is its id;
    - a later upsert moves `last_found_date`, but not `created_date` or `name`;
    - `markSeen` on an Acme job moves `last_found_date` too;
    - a job named "!!!" gets no record and a null `company_id`;
    - `seedUnlinked` jobs are linked by `linkUnlinkedJobs()`, which returns the count linked. The
      company's `created_date` is the earliest `first_seen` and `last_found_date` the latest
      `last_seen`, and its name is the oldest job's. A second call returns 0;
    - `pruneLastSeenBefore` deletes the jobs and keeps the records.
- [X] T012 [P] [US1] Extend two existing unit tests, with no new `test()`, to check that excluded
  companies are recorded (FR-005, SC-002):
  - `tests/fetchJobs.test.ts`, "fetch_jobs leaves out jobs at excluded companies" (`:25`): Stripe
    also has a company record, read from the test's memory `Tables`;
  - `tests/alertFetch.test.ts`: an alert job from an `exclude_companies` company is stored and its
    company recorded. Add the excluded company to an existing case's email if none has one.
- [X] T013 [US1] Add `src/companies/keys.ts` with `companyKeys` (T010), built on `normalizeCompany`.
- [X] T014 [US1] Add `linkUnlinkedJobs(): Promise<number>` to `JobStore` in `src/db/store.ts`.
- [X] T015 [US1] Add `src/db/kysely/companyRows.ts` with `recordCompanies(db, keys)`. It returns an
  empty map at once when there are no keys. Otherwise it does:
  - one `insertInto("companies")` with `onDuplicateKeyUpdate`, keeping the earlier `created_date`
    and the later `last_found_date` (`LEAST`/`GREATEST` of the row's value and `VALUES(...)`);
  - then one `selectFrom` of the ids by `company_key`, giving a `Map<key, id>`.

  In `src/db/kysely/jobStore.ts`:
  - `upsertAll` calls it first, and `insertRow` writes `company_id` from the map. `REFRESHED`'s type
    widens to `Array<keyof JobFields | "company_id">`, with `company_id` added (`rows.ts` stays
    unchanged);
  - `markSeen` also updates the linked companies' `last_found_date`;
  - add `linkUnlinkedJobs()`, which reads the jobs with `company_id` null ordered by `first_seen,
    ats, job_id` (key, name and times) and links them through `recordCompanies`.

  Update `upsertAll`'s and `markSeen`'s doc comments.
- [X] T016 [US1] Mirror T015 in the memory stores:
  - add `companies` to `Tables` and an exported `newTables()` in `tests/helpers/memoryJobViews.ts`;
  - add `tests/helpers/memoryCompanies.ts` with the memory `recordCompanies(tables, keys)`;
  - in `tests/helpers/memoryStore.ts`, `upsert`, `markSeen` and `linkUnlinkedJobs` use it,
    `UNSCORED` gains `company_id: null`, and `memoryStores(tables = newTables())` takes the tables.

  Keep `memoryStore.ts` (131 lines) under 200.
- [X] T017 [US1] Add `beforeAgent(context)` to `src/app/run.ts`. It calls
  `context.store.linkUnlinkedJobs()` and writes `{ type: "companies_linked", jobs: n }` to the trace
  when `n > 0`. `runWithStores` calls it before the agent. Update `runWithStores`' doc comment.
- [X] T018 [US1] Per-PR flow steps 4–6 ("Record every company and link its jobs (014 PR 1b)"). It is
  about 14 files: tell the owner when opening it.

**Checkpoint**: User Story 1's core works: every company recorded, every job linked.

### Sitting S2, PR 2: the careers lookup's pages folded in (T019–T026), branch `014-pr2-fold-careers-pages`

- [X] T019 [US1] Per-PR flow steps 1–3, for sitting S2.
- [X] T020 [P] [US1] Integration test in `tests/integration/migrate.test.ts` (one new `test()`), on a
  database migrated to 009. Seed:
  - one company with a null `careers_url`;
  - one `careers_pages` row for that company's key;
  - one `careers_pages` row for a key with no record.

  Run 010 and check:
  - the existing company got the page with `careers_source = 'lookup'`, which shows the upsert's
    order (research R5) is right;
  - the other key got a new record, with its name and the row's `found_at` as both dates;
  - `careers_pages` no longer exists.

  In the same task:
  - add `010_fold_careers_pages` to the migration lists;
  - remove `"careers_pages utf8mb4_bin"` from the collation list at `:58`;
  - remove `careers_pages` from `TABLES` in `tests/helpers/testDb.ts`, but keep `"careers_pages"` in
    the drop loops at `:54`, `:74`, `:107` and `:128` as a legacy table, so a leftover from an
    interrupted run can't break 004.
- [X] T021 [P] [US1] Rewrite the tests around the remembered pages (no new `test()`):
  - **The company contract:** add `careersSteps` to `tests/helpers/companyContract.ts`. A lookup
    page never replaces or clears a board page seeded through a new `seedBoardPage(key, url)` hook,
    implemented in both wirings.
  - **The careers contract:** in `tests/helpers/careersStoreContract.ts`, rewrite the cases that
    call `rememberedPage`, `rememberPage`, `usePage` or `forgetPage`:
    - the page is read back, replaced and cleared with the new methods;
    - clearing adds the dead address to `careers_rejected`.
  - **Its memory wiring:** in `tests/storeContract.test.ts` (`:19`, `:23`), build
    `MemoryCareersStore` on the same `newTables()` as `memoryStores(tables)`.
  - **The other callers:** `tests/careersLookup.test.ts` at `:22`, `:91`, `:101` and `:106–116`
    (drop the `last_used_at` check at `:101`), and `tests/careersMarkers.test.ts:24`, move to the new
    methods.
- [X] T022 [US1] Add `src/db/migrations/010_fold_careers_pages.ts`:
  - a data step, typed with `db.withTables<...>()`, inserting into `companies` from
    `selectFrom("careers_pages")`;
  - its `onDuplicateKeyUpdate` assigns `careers_source` **before** `careers_url`, each set only
    where `careers_url` is null (an `eb.case()`, as `scoredAtAfterRefresh` does), with one comment on
    why the order matters (research R5);
  - then `dropTable("careers_pages")`.

  List it in `src/db/migrations/index.ts`, and remove `CareersPagesTable` from `src/db/schema.ts`.
- [X] T023 [US1] In `src/db/store.ts`, replace `CareersPageRow`, `RememberedPage` and the four page
  methods of `CareersStore` with `careersPage(key): Promise<string | null>`,
  `setLookupPage(page, at)` and `clearLookupPage(key)`. Implement them in
  `src/db/kysely/careersStore.ts` over `companies`:
  - **`setLookupPage`** inserts a record when none exists. It then sets the page where
    `careers_source IS NULL OR careers_source <> 'board'`, clearing `careers_reason` and
    `careers_rejected`.
  - **`clearLookupPage`**, where `careers_source` is `lookup` or `search`:
    - nulls both `careers_url` and `careers_source`;
    - appends the dead address to `careers_rejected`;
    - leaves `searched_at` alone (FR-009, FR-010).

  Update the doc comments.
- [X] T024 [US1] Do the same in `tests/helpers/memoryCareersStore.ts`. Its constructor takes `tables:
  Tables = newTables()`, so the six places that build it on its own still work, and `memoryStores()`
  passes its tables.
- [X] T025 [US1] In `src/careers/lookUpJob.ts`:
  - `offerRemembered` reads `careers.careersPage(key)` and audits `remembered` as before, without
    `usePage`;
  - `recordOutcome` calls `setLookupPage`;
  - `forget` calls `clearLookupPage`.

  Update their doc comments.
- [X] T026 [US1] Per-PR flow steps 4–6 ("Keep the careers lookup's pages on company records (014 PR
  2)"). It is about 16 files: tell the owner when opening it.

### Sitting S3, PR 3: board addresses (T027–T033), branch `014-pr3-board-pages`

- [ ] T027 [US1] Per-PR flow steps 1–3, for sitting S3.
- [ ] T028 [P] [US1] Unit tests in a new `tests/boardPage.test.ts` (four `test()`s) for
  `boardPageUrl(company)` in `src/companies/boardPage.ts`:
  - Greenhouse gives `https://job-boards.greenhouse.io/<slug>`;
  - Lever gives `https://jobs.lever.co/<slug>`;
  - Ashby gives `https://jobs.ashbyhq.com/<slug>`;
  - each address is recognized by `parseBoardLink` with the same slug.
- [ ] T029 [P] [US1] Unit test in `tests/run.test.ts` (one new `test()`): after `runOnce` with
  `ONE_COMPANY` (Stripe on Greenhouse) over `memoryStores(tables)`, Stripe's record has its
  Greenhouse board page with `careers_source = 'board'` (FR-007, FR-011). Add `boardSteps` to the
  company contract (no new `test()`): `setBoardPage` sets the page, clearing the careers reason and
  list, and a later `setLookupPage` doesn't replace it.
- [ ] T030 [US1] Add `src/companies/boardPage.ts` (T028).
- [ ] T031 [US1] Add the company store and wire it everywhere it is needed:
  - **The interface:** `src/db/companyStore.ts`, with `CompanyStore` and its first method,
    `setBoardPage(page, at)`. Add `companies: CompanyStore` to `Stores` in
    `src/db/store.ts`.
  - **Kysely:** a new `src/db/kysely/companyStore.ts`. It inserts the record when none exists, then
    sets the page and its source and clears the careers reason and list. Wire it into `storesOver`
    (`src/db/kysely/stores.ts`).
  - **Memory:** a new `tests/helpers/memoryCompanyStore.ts` over the shared `Tables`, wired into
    `memoryStores()`.
  - **The run's tools:** add `companies: CompanyStore` to `ToolContext` (`src/tools/context.ts`), set
    in `buildContext` (`src/app/run.ts`) and in `testContext` (`tests/helpers/context.ts`).
  - **Hand-built `Stores`:** fix the test files that build one, if the typecheck names any.
- [ ] T032 [US1] In `beforeAgent` (`src/app/run.ts`), after linking, call `setBoardPage` once for
  every configured board, with `normalizeCompany(company.name)` and `boardPageUrl(company)`.
  `fetchBoard` doesn't repeat it (research R6). Update `beforeAgent`'s doc comment.
- [ ] T033 [US1] Per-PR flow steps 4–6 ("Use a configured board's address as its careers page (014 PR
  3)"). The PR description notes that `data/config.json` needs a board in `companies` to show it
  (quickstart PR 3).

---

## Phase 4: User Story 2 - New companies get their website and careers page found (Priority: P2)

**Goal**: up to 50 due companies a run are searched by fixed rules; every miss is kept with its
reason.

**Independent Test**: after a run with SearXNG up, new companies have addresses or a reason; a
second run the same day searches none of them (quickstart PR 4).

### Sitting S4, PR 4: the search (T034–T046), branch `014-pr4-company-search`

- [ ] T034 [US2] Per-PR flow steps 1–3, for sitting S4.
- [ ] T035 [P] [US2] Unit tests in a new `tests/pickAddresses.test.ts` for
  `src/companies/pickAddresses.ts` (research R7). There are 23 `test()`s:
  - **`mainName`** (5):
    - `www.acme.com` gives `acme`;
    - `www.acme.co.uk` gives `acme`;
    - `jobs.acmecorp.io` gives `acmecorp`;
    - `acme.de` gives `acme`;
    - `localhost` gives `null`.
  - **`storableUrl`** (4):
    - an `https` address passes;
    - `ftp:` fails;
    - an IP-address host or a single-label host fails;
    - an address with credentials or a port fails.
  - **`pickWebsite`** (6):
    - takes the first result whose main name contains the key, stored as its origin;
    - removes the key's spaces to match `acmewidgets.com`;
    - skips `skip_hosts`;
    - skips non-storable results;
    - gives `no_results` for an empty list;
    - gives `no_match` with up to five turned-down addresses.
  - **`pickCareers`** (8):
    - takes a careers page on the website's host, skipping one listed in `careers_rejected`;
    - takes `careers.acme.com` for the website `https://www.acme.com`;
    - takes one on another subdomain;
    - takes one with `jobs` in its title;
    - takes a Lever board page whose slug matches;
    - turns down a board page for another slug;
    - turns down a careers-looking page on an unrelated host or on a `skip_hosts` host;
    - finds a board page when there is no website.
- [ ] T036 [P] [US2] Unit tests in a new `tests/searchCompanies.test.ts` (seven `test()`s) for
  `searchCompanies(context)` in `src/companies/searchCompanies.ts`, with a fake SearXNG and the
  memory stores:
  - a due company with neither address gets two queries (`"<name>"`, then `"<name> careers"`), both
    addresses, and one `company_search` event with `website: "found"` and `careers: "found"`;
  - a board company gets only the website query;
  - the limit is honoured, most recently found first;
  - a `no_match` is stored with its reason and turned-down addresses;
  - SearXNG failing midway marks the remaining due companies `search_unavailable` and writes one
    `company_search_unavailable` event;
  - no `MYJOBBOT_SEARXNG_URL` searches nothing and marks them the same way, with reason
    `not_configured`;
  - `max_per_run: 0` does nothing, not even marking.
- [ ] T037 [P] [US2] Unit test in `tests/run.test.ts` (one new `test()`): when the search step throws
  an error it doesn't expect, the run still completes and the trace has `company_search_failed`
  (SC-004).
- [ ] T038 [P] [US2] Unit test in `tests/config.test.ts` (one new `test()`):
  `company_search.max_per_run` defaults to 50 and refuses `-1`. In `tests/careersSearxng.test.ts`,
  update the existing `searchCareers` tests to `searchWeb`. The first one checks that the query it
  is given is sent (no new `test()`).
- [ ] T039 [P] [US2] Add `searchSteps` to the company contract, in a new
  `tests/helpers/companySearchSteps.ts` (no new `test()`):
  - `dueForSearch(limit, cutoff)` returns companies missing an address, never searched or searched
    before the cutoff, the most recently found first, up to the limit, and never a company with both
    addresses;
  - `recordSearch` stores the found addresses, reasons, turned-down lists and `searched_at`, and
    clears a reason once its address is found;
  - `markUnavailable(ids, at)` sets both missing reasons to `search_unavailable` and `searched_at`;
  - a dead page cleared by `clearLookupPage` is still in `careers_rejected` after a later
    `recordSearch` that finds nothing.
- [ ] T040 [US2] In `src/careers/searxng.ts`, rename `searchCareers` to `searchWeb` and give
  `SearchRequest` a `query` in place of `company`. `src/careers/lookUpJobs.ts:57` passes
  `` `${company} careers` ``, so its behaviour is unchanged. Update the doc comments.
- [ ] T041 [US2] Add `src/companies/pickAddresses.ts` (T035): `mainName`, `storableUrl`,
  `pickWebsite` and `pickCareers`.
  - `storableUrl` is built on `allowedUrl` from `src/careers/addresses.ts`;
  - the picks use `dropSkipped`'s host rule and `parseBoardLink`;
  - `pickCareers` also takes the company's `careers_rejected` list to skip;
  - each pick returns `{ url, reason, rejected }`.
- [ ] T042 [US2] Add `dueForSearch`, `recordSearch` and `markUnavailable`, with the `CompanyRow` and
  `SearchRecord` types, in three places:
  - the interface, `src/db/companyStore.ts`;
  - Kysely, `src/db/kysely/companyStore.ts`, where the caller passes the 24-hour cutoff as an ISO
    time, so the query stays a plain `where`;
  - memory, `tests/helpers/memoryCompanyStore.ts`.
- [ ] T043 [US2] Add `company_search: z.object({ max_per_run: z.number().int().min(0).default(50)
  }).prefault({})` to `src/config/schema.ts`.
- [ ] T044 [US2] Add `src/companies/searchCompanies.ts` (T036). It reads `context.companies`,
  `context.http`, `context.careers.searxngUrl`, `skip_hosts`, `search_results`, `page_chars`,
  `company_search.max_per_run`, the clock and the trace.
  - It writes one `company_search` event per company (contract) and stops on `SearchUnavailable`.
  - Keep each function within 20 lines: one per company, one per address, one for marking the rest.
- [ ] T045 [US2] Add `afterAgent(context)` to `src/app/run.ts`: `searchCompanies`, with an error it
  doesn't expect traced as `company_search_failed`, then the existing `pruneOldJobs`.
  `runWithStores` calls it in place of `pruneOldJobs`.
- [ ] T046 [US2] Per-PR flow steps 4–6 ("Find companies' websites and careers pages by rule (014 PR
  4)"). It is about 14 files: tell the owner when opening it.
  - **After merging:** once the owner merges and rebuilds, they run quickstart PR 4 steps 3–5
    (SC-004 to SC-006) on the real stack.
  - **Rule misses:** any the owner wants changed become a follow-up; the rules stay as they are
    within S4.

**Checkpoint**: both stories work.

---

## Phase 5: Polish

### Sitting S5, PR 5: docs (T047–T051), branch `014-pr5-docs`

- [ ] T047 Per-PR flow steps 1–3, for sitting S5.
- [ ] T048 [P] Update `README.md`:
  - the `companies` table and `jobs.company_id` in the data model diagram;
  - the careers lookup's pages now living on the company;
  - the search step, and `company_search.max_per_run` in the config table;
  - the SC-006 query for listing misses.
- [ ] T049 [P] Add one line to `CLAUDE.md`'s Conventions: companies are recorded only through
  `JobStore.upsertAll` and `markSeen` (keyed by `normalizeCompany`); the search makes no model calls
  and stores addresses only; a configured board's page is never replaced.
- [ ] T050 Fill the ledger's last row with the final counts, and the SC-005 result from T046.
- [ ] T051 Per-PR flow steps 4–6 ("Document company records (014 PR 5)").

---

## Dependencies & Execution Order

- **S0 → S1a → S1b → S2 → S3 → S4 → S5**, each merged and tried before the next.
- **S1a** creates the table and the column.
- **S1b** records and links, and creates the contract case every later sitting extends.
- **S2** and **S3** both write `careers_url`. S3's board pages rely on S2's rule that a lookup never
  replaces a board page, so S3 follows S2.
- **S4** needs the records (S1b), the board rule (S3: a board company searches only its website),
  and `ToolContext.companies` (S3).

### Within each sitting

- The per-PR flow's first task, then the test tasks (all [P]: different files), then the code in
  task order, then the closing flow task.
- Every new export has a production importer in another file, in the sitting that adds it:
  - S1a: the migration (from `migrations/index.ts`);
  - S1b: `companyKeys` (from `companyRows`), `recordCompanies` (from `jobStore`),
    `linkUnlinkedJobs` (from `run`);
  - S2: the careers page methods (from `lookUpJob`);
  - S3: `boardPageUrl`, and `CompanyStore` with `setBoardPage` (from `stores`, `context` and `run`);
  - S4: `searchWeb`, the pick functions (from `searchCompanies`), the store methods, and
    `searchCompanies` (from `run`).

## Parallel Example: User Story 2 (S4)

```text
T035 address rules      tests/pickAddresses.test.ts
T036 search step        tests/searchCompanies.test.ts
T037 failed search      tests/run.test.ts
T038 config, searchWeb  tests/config.test.ts, tests/careersSearxng.test.ts
T039 contract steps     tests/helpers/companySearchSteps.ts
```

## Implementation Strategy

- **MVP**: S1a + S1b. Every company is recorded once and every job linked, which is the issue's
  first and third points.
- **Increments**: S2 and S3 fill careers pages from what myjobbot already knows, and S4 searches for
  the rest. Each is a PR the owner tries before the next.

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

New tests by count. Integration stays at exactly 3 and unit at 37 or more (research R12), so every
share moves toward 95 / 4 / 1.

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (after 013 and #41, T002) | 575 | 52 (1 skipped without a browser) | 57 |
| Planned new | 43 (T010 5, T011's memory run 1, T028 4, T029 1, T035 23, T036 7, T037 1, T038 1) | 3 (T005, T020, T011's MariaDB run) | 0 |
| Planned after | 618 (84.7%) | 55 (7.53%) | 57 (7.8%) |
| After PR 5 (T050) | | | |
