# Research: Company records

Every decision below follows the code on `main` after features 013 and the dependency patches
(`b20e959`). No new library is needed.

## R1. Where companies are recorded: inside the jobs upsert

- **Decision**: `JobStore.upsertAll` records the companies of the jobs it stores, in the same call,
  before writing the jobs: it upserts one `companies` row per company key, reads back their ids, and
  writes each job with its `company_id`.
- **Rationale**: all three sources already store jobs through `upsertAll`: configured boards
  (`src/tools/boardFetch.ts:12`), JSearch searches including the alert lookup's
  (`src/tools/searchFetch.ts:19`), and LinkedIn alert emails (`src/gmail/alertFetch.ts:74`).
  Recording there covers every source (FR-002), and excluded companies too (FR-005): their jobs are
  stored, only kept from scoring. No caller can forget the step. (Checked: boards store every job;
  JSearch drops only excluded *publishers* and board duplicates; the alert path uses
  `exclude_companies` only to skip the description lookup, and stores every fresh alert job except
  those `withoutCopies` (`src/gmail/alertStore.ts:37`) drops as copies of another source's job. Those
  copies' companies are recorded through that other job; their `last_found_date` doesn't move for
  the copy, which is accepted.)
- **Jobs seen again without an upsert**: an alert job already stored is not upserted.
  `sortAlertJobs` marks it seen through `JobStore.markSeen(keys, seen)`, which moves only its
  `last_seen`. `markSeen` therefore also moves its companies' `last_found_date` forward (FR-004),
  through the job's `company_id`, in the same call.
- **Alternatives**: a separate `recordCompanies` call at each of the three callers (three places to
  keep in step, and a fourth source added later could miss it); a pass at the end of each run over
  jobs without a link (a window in which jobs are unlinked, and SC-001 says "after any run", not
  "eventually").

## R2. The company key

- **Decision**: a company's key is `normalizeCompany(name)` (`src/jobs/company.ts`): lowercased,
  punctuation removed by `normalizeTitle`, and a trailing legal suffix (`inc`, `llc`, `ltd`, `corp`,
  `corporation`, `co`, `gmbh`, `plc`) dropped. It is stored in a unique `company_key` column. A name
  whose key is empty gets no record and no link (Edge Cases). The pure `companyKeys(entries)` groups
  entries by key. Each entry is a name with its first-seen and last-seen times. For a fetch, every
  entry has the fetch's time; for the backfill, each job's own times. A key keeps the earliest
  first-seen and the latest last-seen. **Its name is the name of the entry with the earliest
  first-seen, ties broken by the entries' order.** `linkUnlinkedJobs` reads jobs ordered by
  `first_seen, ats, job_id`, so a fetch keeps its first job's name and the backfill keeps the name
  of the company's oldest job, whatever order the rows come in.
- **Rationale**: the careers lookup already keys its remembered pages by this exact function, so
  folding them in (R5) keeps every key, and alert matching compares names the same way.

## R3. The `companies` table

- **Decision**: one table, `companies`, named as the issue asks, with its columns named after the
  issue's fields where it names them: `id`, `company_key`, `name`, `website_url`, `careers_url`,
  `created_date`, `last_found_date`; plus `careers_source`, `searched_at` and the last search's
  outcome (data-model.md). Times are ISO 8601 UTC strings in `varchar(32)`, like every other time in
  the schema. `jobs` gains `company_id` (nullable `int`, indexed, a foreign key to `companies.id`).
- **Rationale**: the owner named the fields; the rest of the schema stores times as ISO strings,
  so `created_date` holds a time, not only a date, which also lets the backfill keep the earliest
  first-seen exactly.
- **Alternatives**: `created_at` / `last_found_at` (the schema's usual suffix, but not the owner's
  names); storing the outcome in a separate `company_searches` table (history the spec doesn't ask
  for; FR-015 keeps only the last search).

## R4. The upgrade backfill (FR-011)

- **Decision**: in two parts:
  - **Migration 009** creates `companies` and `jobs.company_id`. It can't compute company keys,
    because keys need `normalizeCompany`, and a migration must not import application code, which
    may change after the migration has run.
  - **The first step of every run**, `linkUnlinkedJobs`, reads the jobs whose `company_id` is null
    (all of them after the upgrade, none afterwards) and records and links them through the same
    company upsert as R1. Each record's `created_date` is set to the earliest `first_seen` of its
    jobs and its `last_found_date` to the latest `last_seen`. On an existing record the upsert
    keeps the earlier `created_date` and the later `last_found_date`.
- **Rationale**: "at upgrade" in practice means "before anything else uses the records": the first
  run after the migration links every stored job before it fetches anything. Later the step finds
  only jobs whose key is empty, which stay unlinked for good, at the cost of one indexed query.
- **Where it runs**: `runWithStores` (`src/app/run.ts`) is at 9 lines of a 20-line limit, so the
  steps around the agent go in two helpers there: `beforeAgent(context)` (linking, then board pages,
  R6) and `afterAgent(context)` (the search, R8, then pruning).
- **Alternatives**: copying `normalizeCompany` into the migration (a frozen duplicate that jscpd
  flags, and that drifts from the real one); a one-off CLI command like `import-sqlite` (an extra
  step the owner must remember).

## R5. Folding in the careers lookup's remembered pages (FR-006, FR-009)

- **Decision**: **migration 010** copies each `careers_pages` row into `companies` by its
  `company_key`: it inserts a record when none exists, with `name`, `careers_url`, `careers_source =
  'lookup'`, and the row's `found_at` as both dates. It then drops `careers_pages`. `CareersStore`
  loses `rememberedPage`, `rememberPage`, `usePage` and `forgetPage`, and gains `careersPage(key)`,
  `setLookupPage(page, at)` (with `page` a `CompanyPage { key, name, url }`, which keeps every method within 3 parameters) and `clearLookupPage(key)`, which read and write the company
  record. `last_used_at` is dropped: nothing reads it.
- **Rule**: a page the lookup finds replaces a `search` or `lookup` careers page, never a `board`
  one. The SQL condition is `careers_source IS NULL OR careers_source <> 'board'`, because `NULL <>
  'board'` is not true.
- **Clearing** a dead page (`clearLookupPage`) only touches a `lookup` or `search` page. It nulls
  `careers_url` and `careers_source` together (null exactly when the URL is), adds the dead address
  to `careers_rejected`, and leaves `searched_at` alone. The company is then due under the usual
  24-hour rule (FR-010), and the search skips any address already in `careers_rejected` (R7), so
  the dead page is never stored again.
- **Migration 010's upsert order**: MariaDB applies `ON DUPLICATE KEY UPDATE` assignments left to
  right. That's why `jobStore.ts:18` notes it for `scoredAtAfterRefresh`. So `careers_source` is
  assigned before `careers_url`, while the CASE can still see the old null URL.
- **The memory store**: `MemoryCareersStore` keeps its pages on the shared memory `Tables`, taking
  them as a constructor argument that defaults to a fresh set (`newTables()`). The six places that
  build it on its own keep working.
- **Rationale**: the keys are already normalized in `careers_pages.company_key`, so this data step
  needs no application code (a builder `insertInto ... select`, then `dropTable`).

## R6. A configured board's address as its careers page (FR-007)

- **Decision**: a pure `boardPageUrl(company)` (`src/companies/boardPage.ts`) gives the public board
  address for a configured company: `https://job-boards.greenhouse.io/<slug>`,
  `https://jobs.lever.co/<slug>` or `https://jobs.ashbyhq.com/<slug>`. `parseBoardLink` already
  recognizes each of these. At the start of each run, `beforeAgent` calls
  `companies.setBoardPage(page, at)` for every configured board. That inserts the record if
  there is none, sets `careers_url` with `careers_source = 'board'`, and clears the careers reason
  and list. It overwrites any `search` or `lookup` page, and nothing overwrites a `board` page
  afterwards. The configured boards are fixed for a run, so this one call covers boards fetched
  later in the run and the upgrade backfill alike; `fetchBoard` doesn't repeat it.
- **Reaching the store**: `ToolContext` (`src/tools/context.ts`) gains `companies: CompanyStore`, set
  in `buildContext` (`src/app/run.ts`) and in `testContext` (`tests/helpers/context.ts`), so the run
  steps reach it.
- **Rationale**: the board's address is where myjobbot reads that company's jobs; it is certain and
  costs no search.

## R7. Choosing addresses from SearXNG results (FR-007, FR-008)

- **Decision**: pure functions in `src/companies/pickAddresses.ts`:
  - **`mainName(host)`**: the host's labels without `www`, without the last label, and without a
    common second-level label (`co`, `com`, `org`, `net`, `ac`, `gov`, `edu`) when the last label is
    two letters. The last remaining label is the main name, for example `acme` in
    `www.acme.co.uk` and `acmecorp` in `jobs.acmecorp.io`.
  - **`pickWebsite(results, key, skipHosts)`**: the first result whose `mainName` contains the key
    with its spaces removed (`acme widgets` → `acmewidgets`), that passes `storableUrl`, and that
    is not on a `skip_hosts` host. The website is stored as the result's origin (`https://acme.com`).
  - **`pickCareers(results, { website, key, skipHosts })`**: the first result that passes
    `storableUrl` and either:
    - is on the website's host without a leading `www.`, or one of its subdomains (so
      `careers.acme.com` counts for `www.acme.com`), with `career` or `jobs` in its address or title;
      or
    - is a recognized board page (`parseBoardLink`: Greenhouse, Lever, Ashby, Workday) whose slug,
      with dashes and underscores removed, equals the key with its spaces removed.
  - **`storableUrl`**: `allowedUrl` (http(s), default port, no credentials), and a host that is
    neither an IP address nor a single label like `localhost`. Nothing is fetched, so no DNS check
    is made here; the careers lookup checks every address again when it opens one (`assertPublic`).
  - `pickCareers` also skips any address in the company's `careers_rejected` list. That is how a dead
    page cleared by the careers lookup (R5) is never stored again.
  - Each function also returns up to five addresses it turned down, and why the result was empty
    (`no_results` or `no_match`), for FR-015.
- **Rationale**: these are the owner's rules. Every decision is a plain function, which makes the
  rules cheap to test against realistic result lists (SC-005).
- **Alternatives**: the public suffix list through a library such as `tldts` (exact for every
  suffix, but a new dependency the owner would have to approve, for an edge the short list
  covers).

## R8. The search step

- **Decision**: `searchCompanies(context)` (`src/companies/searchCompanies.ts`) runs in `afterAgent`,
  after the agent and before pruning. Its `searchWeb` calls use the careers lookup's
  `search_results` (10) and `page_chars` (12,000) as `max` and `maxChars`. An error it doesn't expect
  is traced as `company_search_failed` and doesn't fail the run (SC-004):
  1. The store lists companies **due** for a search, the most recently found first, up to
     `company_search.max_per_run` (default 50). A company is due when it lacks a website or a
     careers page, and its `searched_at` is null or more than 24 hours old.
  2. For each one, the step searches `"<name>"` for the website when it has none, then `"<name> careers"`
     for the careers page when it has none. That is at most two SearXNG requests per company.
  3. It stores what it found, the outcome (FR-015) and `searched_at = now`, and writes one
     `company_search` trace event (FR-014).
- **SearXNG is generalized**: `searchCareers(http, request)` becomes `searchWeb(http, { base, query,
  max, maxChars })`. The careers lookup passes `"<company> careers"` as before, so its behaviour is
  unchanged.
- **When SearXNG is unavailable**: if `MYJOBBOT_SEARXNG_URL` is unset, or a search throws
  `SearchUnavailable`, the step stops searching. It marks every company still due within this run's
  limit with the reason `search_unavailable` and `searched_at = now`, so each is retried in a day
  (FR-010), and writes one `company_search_unavailable` event. The run carries on.
- **Rationale**: a step outside the agent keeps every search result away from the model (FR-008),
  and costs no model tokens.

## R9. The search outcome (FR-015)

- **Decision**: for each address the search set out to find and didn't, the record keeps a
  reason and the turned-down addresses:
  - `website_reason` and `careers_reason` (`varchar(32)`, null when found or not searched): one
    of `search_unavailable`, `no_results` or `no_match`.
  - `website_rejected` and `careers_rejected` (`text`): JSON lists of up to five addresses.
  A search that finds an address clears that address's reason and list. Setting the careers page
  another way (a board in R6, a lookup in R5) clears the careers reason and list.
- **Rationale**: the owner wants to list every company without a careers page, with why (SC-006):
  `SELECT name, careers_reason, careers_rejected FROM companies WHERE careers_url IS NULL`. Storing
  addresses only matches `careers_audit`'s rule.

## R10. Configuration

- **Decision**: a new config section, `company_search: { max_per_run: 50 }`, an integer of at least
  0, where 0 turns the search off. It can't go under `companies`, which is already the list of
  configured boards.

## R11. Stores and file limits

- **Decision**: `src/db/store.ts` is at 195 lines, so the new `CompanyStore` interface and its types
  go in `src/db/companyStore.ts`, reached through `Stores.companies`. The upsert's company part
  goes in `src/db/kysely/companyRows.ts`, called from `jobStore.ts` (138 lines). The memory version
  is in two files. `tests/helpers/memoryCompanies.ts` (PR 1b) holds the memory
  `recordCompanies`, which the jobs upsert in `tests/helpers/memoryStore.ts` (131 lines) calls.
  `tests/helpers/memoryCompanyStore.ts` (PR 3) holds `MemoryCompanyStore`. `memoryStores(tables =
  newTables())` takes the shared `Tables`, so a test can read them.
- **The store contract** is one bundled case in `tests/helpers/companyContract.ts`, run on both
  stores like `appliedContract`. Its S4 steps go in `tests/helpers/companySearchSteps.ts` so neither
  file passes 200 lines, and the single `test()` calls one group of steps per sitting (`recordSteps`,
  `careersSteps`, `boardSteps`, `searchSteps`). The case takes a hooks argument, as
  `careersStoreContract` takes `pageFields`:
  - `listCompanies()` reads every record;
  - `seedUnlinked(rows)` inserts jobs with no `company_id`;
  - `seedBoardPage(key, url)` sets a board page before `setBoardPage` exists (S2).

  The memory wiring implements them over the shared `Tables`, and the MariaDB wiring with Kysely.
  No store method exists only for the test.

## R12. Delivery and test split

- **Delivery**: six code PRs after the docs PR (plan, Delivery): PR 1 is split into 1a (migration
  009 and the schema) and 1b (recording and the backfill), at the owner's request. Each new module has a production
  caller in the PR that adds it. The address rules (R7) land with the search step (R8), because
  nothing calls them before then.
- **Test split (new tests, by count)**: 43 unit planned (37 is the floor), exactly 3 integration
  and 0 UI.
  - **Unit:** the memory run of the company contract; `companyKeys`, `boardPageUrl`, `mainName`,
    `pickWebsite`, `pickCareers`, `storableUrl`; due-for-search ordering; the outcome mapping; the
    step's handling of SearXNG being unavailable.
  - **Integration:** one test each for migrations 009 and 010, and one bundled company contract
    case on MariaDB (each step a helper, as 013's `appliedContract` is). Each contract case runs once
    per store, so a second case would be a fourth integration test.
  - From today's 575 / 52 / 57 (84.1 / 7.602 / 8.3%), 43 unit and 3 integration tests give 618 /
    55 / 57 (84.7 / 7.534 / 7.8%), so every share moves toward 95 / 4 / 1. With 3 integration tests,
    fewer than 37 unit tests (55 / 724 = 7.597%, just under 7.602%) or a fourth integration test
    would raise the integration share, which the constitution forbids.
