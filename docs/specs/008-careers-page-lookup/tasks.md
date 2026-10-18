---
description: "Tasks for feature 008: job details from company careers pages"
---

# Tasks: Job details from company careers pages

**Input**: Design documents from `docs/specs/008-careers-page-lookup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/careers-lookup.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file.

**Organization**: by user story, planned in sittings.

- **Where the work happens**: a sitting may span turns. Work happens in the main checkout on
  `008-careers-page-lookup`, with the Docker stack stopped. The stack runs production from this
  checkout, so its scheduled runs pause until the merge.
- **How a sitting ends**: `npm run check` and `npm run check:db` are green. Then commit that
  sitting's files (owner rule: commit between sittings). `docs/specs/009-prompt-injection-delimiters/`
  is never part of an 008 commit.
- **Wiring**: every new module and store method is reached from a production entry point within
  its sitting. The entry point is the alerts source (`src/tools/alertSource.ts` via `fetch_jobs`),
  `get_job_details`, or the run's prune step.
- **Signatures**: services take one deps object first (eslint `max-params: 3`). Test bodies stay
  within 20 lines, using helpers.
- **File size**: `tests/careersLookup.test.ts` reaches 12 tests and `src/careers/tools.ts` three
  tools; keep both under 200 lines by putting the lookup test setup in
  `tests/helpers/careersLookup.ts` and the audit writes in `src/careers/audit.ts` (T036).
- **Fixtures**: synthetic HTML only, shaped like the pages measured in research R4. No real page,
  job or email text is ever committed, printed, or recorded here.
- **Paths**: the lookup lives in `src/careers/` and never imports from `src/gmail/`
  (FR-019). Only `src/tools/alertSource.ts` knows that alert jobs use it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3 from spec.md

---

## Phase 1: Setup

### Sitting S0: stop the stack and get a green baseline (T001–T002)

- [X] T001 Run `docker compose top myjobbot` and confirm no run is in progress, then run
  `docker compose stop` (no `docker:watch`). Create `.specify/sitting-in-progress` naming S0.
- [X] T002 Run `npm run check` and `npm run check:db` and record the baseline in the ledger below
  (expected node 283, dom 30, integration 29). Delete the marker, then commit only
  `docs/specs/008-careers-page-lookup/` ("Plan job details from careers pages (008)").

---

## Phase 2: Foundational (blocks all stories)

### Sitting S1: migration 004 and description provenance (T003–T008)

Create `.specify/sitting-in-progress` naming S1 before T003.

**Purpose**: the schema for the whole feature, plus `description_source` written by the existing
`upsertAll`. That makes the new columns reachable now. The tables are used from S2 on.

- [X] T003 **Unit and integration**: create `tests/helpers/descriptionContract.ts`
  (`descriptionContract(make)`; `tests/helpers/storeContract.ts` is at 181 of 200 lines) and
  register it in `tests/storeContract.test.ts` (unit, memory store) and
  `tests/integration/storeContract.test.ts` (MariaDB). 1 case: `upsertAll` of a job with a description gives
  `description_source = "source"` and `description_url = null`. A job without a description
  gives `description_source = null`.
- [X] T004 **Integration**: add `"careers_audit"` and `"careers_pages"` to `TABLES` in
  `tests/helpers/testDb.ts` (so `emptyTables` clears them and the migrate test drops them before
  re-migrating; without this, migration 004 fails with "table already exists"). In
  `tests/integration/migrate.test.ts`, the expected migrations gain `"004_careers_lookup"` and the
  expected collations become, in order: `api_calls`, `careers_audit`, `careers_pages`,
  `gmail_alert_state`, `gmail_connection`, `jobs`, `verdicts`, each `utf8mb4_bin`.
- [X] T005 Write `src/db/migrations/004_careers_lookup.ts` (export `careersLookup`) and list it
  in `src/db/migrations/index.ts` as `"004_careers_lookup"`. The step:
  - **On `jobs`**: adds `description_source VARCHAR(16) NULL` and
    `description_url VARCHAR(2048) NULL`, then runs
    `UPDATE jobs SET description_source = 'source' WHERE description IS NOT NULL`.
  - **Creates `careers_pages`**:
    - `company_key VARCHAR(255) NOT NULL` PRIMARY KEY
    - `company VARCHAR(255) NOT NULL`
    - `url VARCHAR(2048) NOT NULL`
    - `found_at VARCHAR(32) NOT NULL`
    - `last_used_at VARCHAR(32) NOT NULL`
  - **Creates `careers_audit`**:
    - `id BIGINT NOT NULL AUTO_INCREMENT` PRIMARY KEY
    - `run_id VARCHAR(36) NOT NULL`
    - `at VARCHAR(32) NOT NULL`
    - `ats VARCHAR(32) NOT NULL`
    - `job_id VARCHAR(255) NOT NULL`
    - `company VARCHAR(255) NOT NULL`
    - `step VARCHAR(16) NOT NULL`
    - `url VARCHAR(2048) NULL`
    - `chars INT NULL`
    - `cut TINYINT NOT NULL DEFAULT 0`
    - `more_pages TINYINT NOT NULL DEFAULT 0`
    - `outcome VARCHAR(16) NOT NULL`
    - `reason VARCHAR(32) NULL`
    - `warning TINYINT NOT NULL DEFAULT 0`
    - `detail VARCHAR(2000) NULL`
    - indexes on (`ats`, `job_id`), `company`, `reason` and `at`
  - **Table options**: both tables `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    in the style of `003_gmail_alerts.ts`.
- [X] T006 Mirror the schema in `src/db/schema.ts`: `JobsTable` gains `description_source: Text`
  and `description_url: Text`, and there are new `CareersPagesTable` and `CareersAuditTable`
  entries in `Database`. Add `description_source` and `description_url` to the job row schema in
  `src/db/rows.ts`, and set both in `toParams` there (`description_source` = `"source"` when the
  job has a description, else `null`; `description_url` = `null`), so the memory store's rows
  (built from `toParams`) parse too.
- [X] T007 Make `upsertAll` write `description_source` and `description_url` from `toParams` in
  `src/db/kysely/jobStore.ts` (insert and the on-duplicate update), and check that
  `tests/helpers/memoryStore.ts` carries them through. T003 passes.
- [X] T008 Run `npm run check` and `npm run check:db` and fix every finding. Update the ledger,
  delete the marker, and commit S1 ("Add careers lookup schema and description provenance (008 S1)").

**Checkpoint**: migration 004 applies cleanly to `myjobbot_test`. Production is untouched (the
stack is stopped).

---

## Phase 3: User Story 1, alert jobs get a real description and score (P1) 🎯 MVP

**Goal**: when the alerts source is fetched:
- every unscored alert job that passes the filters, has no description and has never been
  looked up, gets its own lookup conversation (search, careers page or job page, finish);
- a found job page's trimmed text is stored as its description (`description_source =
  'careers'`), and the agent scores it as usual;
- each lookup writes a `finish` audit row, so a job is tried once.

**Independent Test**: with a scripted chat, a fake SearXNG and synthetic pages, one
`fetch_jobs("Gmail alerts")` stores the description of a job found through its careers page and
of one found straight from the search results. `get_job_details` then shows the description with
`description_from: "careers page"`.

### Sitting S2: the lookup, end to end (T009–T033)

Create `.specify/sitting-in-progress` naming S2 before T009.

#### Tests first

- [X] T009 [US1] Write `tests/helpers/careersPages.ts`: synthetic HTML builders with made-up
  companies, titles and hosts (`*.example`):
  - `listingPage(jobs, options)`: a careers listing with one `<a>` per job. The options are:
    `singleQuotes` (attributes in single quotes, as on the measured Vetcove page),
    `hiddenBlock` (an element with `hidden` and one with `style="display:none"`, each holding a
    decoy job link), `nextLink` (a `rel="next"` link), `chrome` (`<head>`, `<script>` with a `<`
    inside, `<style>`, `<nav>`, `<header>`, `<footer>` holding decoy text) and `relativeLinks`.
  - `jobPage(title, paragraphs)`: one posting.
  - `scriptOnlyPage()`: an app shell with no links, like `jobs.ashbyhq.com`.
  - `searxngJson(results)`: the JSON shape from research R1.

  Also write `tests/helpers/fakeDns.ts`: `fakeDns(map)` returns a `HostLookup` that resolves
  each host to the given addresses (and rejects unknown hosts).
- [X] T010 [P] [US1] **Unit**: write `tests/careersTrim.test.ts` for `trimPage(html, { baseUrl,
  maxChars, sought?, links? })` from `src/careers/trim.ts`. 10 tests:
  - chrome elements and their text are dropped
  - hidden elements are dropped, all three kinds: `hidden`, `aria-hidden="true"`,
    `display:none`
  - block elements become line breaks and whitespace is collapsed
  - links come back unnumbered (`{ text, url }`, the registry numbers them), deduplicated,
    fragments are removed, and `mailto:`/`javascript:` links are dropped; with `links: false`
    no links are returned and the text gets the whole cap
  - relative links are resolved against `baseUrl`
  - single-quoted and unquoted attributes are read
  - a link with no text uses its `title` or `aria-label`
  - `more_pages` is true for `rel="next"` and for link text "Next" or "»", and false otherwise
  - the output never exceeds `maxChars` and says `cut: true` when it hit the cap
  - with `sought`, links sharing words with the sought title come first, so cutting keeps them
    (from `src/careers/rank.ts`)
- [X] T011 [P] [US1] **Unit**: write `tests/careersAddresses.test.ts` for `src/careers/addresses.ts`.
  4 tests:
  - `isPublicAddress` refuses `0.0.0.0`, `0.1.2.3`, `127.0.0.1`, `10.x`, `172.16.x`,
    `192.168.x`, `169.254.x`, `100.64.x`, multicast, `::`, `::1`, `fc00::`, `fe80::` and the
    IPv4-mapped `::ffff:127.0.0.1` and `::ffff:10.0.0.1`, and accepts public IPv4, public IPv6
    and a public IPv4-mapped address
  - `allowedUrl` refuses schemes other than `http`/`https`
  - `allowedUrl` refuses ports other than the default 80/443
  - `allowedUrl` accepts a plain `https` address

  And write `tests/careersFetchPage.test.ts` for `fetchPublicPage(deps, url)` in
  `src/careers/fetchPage.ts`, with `fakeDns` and a fake `TextGetter`. 4 tests:
  - a host resolving to a private address (any of its addresses) is refused with
    `FetchRefused`, and nothing is fetched
  - a redirect to a host resolving to a private address is refused
  - a 6th redirect is refused
  - a fetch whose abort `cause` is a `TimeoutError` becomes `FetchTimedOut`
- [X] T012 [P] [US1] **Unit**: extend `tests/httpClient.test.ts` with 5 `getText` tests, using
  the fake fetch already there:
  - returns the body of a `text/html` response
  - retries a 503 exactly as `getJson` does (shared path)
  - refuses a non-HTML content type
  - stops reading at `maxBytes` and reports `cut`
  - returns a redirect (`redirect: "manual"`) as `{ redirect: location }` without following it
- [X] T013 [P] [US1] **Unit**: write `tests/careersSearxng.test.ts` for `src/careers/searxng.ts`.
  3 tests:
  - `searchUrl(base, company)` builds `…/search?q=<company>%20careers&format=json`, with or
    without a trailing slash on `base`
  - `parseResults(json, max)` keeps `url`, `title` and `content` (as `snippet`), drops duplicate
    addresses and non-`http(s)` ones, cuts titles to 120 characters and snippets to 200, and
    keeps the first `max`; the whole list, as handed to the model, stays within a given
    `maxChars` (SC-002), dropping results past it
  - `searchCareers(http, { base, company, max, maxChars })` throws a `SearchUnavailable`
    carrying a fixed note when the JSON is in the wrong shape **or** the underlying `getJson`
    fails (network error or HTTP error such as 403); zero results is not an error and returns
    `[]`
- [X] T014 [US1] Write `tests/helpers/careersStoreContract.ts` (`careersStoreContract(make)`) and
  `tests/helpers/memoryCareersStore.ts`, add `careers` to `memoryStores()` in
  `tests/helpers/memoryStore.ts`, and register the contract in `tests/storeContract.test.ts`
  (unit) and `tests/integration/storeContract.test.ts`. 2 cases for now:
  - `attempted(keys)` returns exactly the keys with a `finish` row whose reason is neither
    `lookup_error` nor `search_unavailable`: `search`/`open_*` rows alone, a `lookup_error`
    finish, and a `skipped` row (`ats = ''`, `job_id = ''`) don't count
  - `pruneAuditBefore(cutoff)` deletes only the rows before the cutoff

  Also add 1 case to `tests/helpers/descriptionContract.ts`: `setDescription(key, { description,
  url, source: "careers" })` sets those three columns and changes no others (score,
  `last_seen`).
- [X] T015 [P] [US1] **Unit**: write `tests/careersTools.test.ts` for the tools in
  `src/careers/tools.ts`, built over a `LinkRegistry` (`src/careers/registry.ts`), with a fake
  page fetcher. 8 tests:
  - `search_careers` numbers the results from 1 and registers them
  - `open_link` with an unknown number is a tool error naming the valid range, and a 4th
    `open_link` in one lookup is a tool error (at most 3 opens)
  - `open_link` on a refused address is a tool error with a fixed message, and nothing is
    fetched
  - `open_link` `as: "careers_page"` returns `looking_for`, the text and links with numbers
    only (no addresses), and registers the page's links; the serialized tool content stays
    within `page_chars` plus 10% (JSON escaping)
  - `open_link` `as: "job_page"` returns no links
  - `open_link` `as: "careers_page"` on a page with zero links returns
    `note: "no job links on this page"`
  - `finish_lookup({ found: true })` before any job page is a tool error
  - `finish_lookup({ found: false })` needs a `reason`, and either finish ends the lookup
- [X] T016 [P] [US1] **Unit**: write `tests/careersLookup.test.ts` for `lookUpJob(deps, job)` in
  `src/careers/lookUpJob.ts`, with `scriptedChat` from `tests/helpers/chat.ts`, a fake SearXNG
  and fake pages. 6 tests:
  - found through a careers page: the description is the last job page's trimmed text, its
    address is stored, and there is a `finish`/`found` audit row
  - found straight from a search result, without a careers page
  - not found: `finish_lookup` with `job_not_found` gives `{ found: false, reason }`, and no
    description is written
  - gave up: the scripted chat never finishes, and `max_steps` gives reason `gave_up`
  - unreadable careers page: the model opens a zero-link careers page and never finishes, giving
    reason `careers_page_unreadable`; the `finish` row's `url` is that careers page
  - LLM error: the chat throws, and the outcome is `lookup_error`, not `gave_up`
- [X] T017 [P] [US1] **Unit**: write `tests/careersLookUpJobs.test.ts` for `lookUpCareers(deps,
  sought)` in `src/careers/lookUpJobs.ts`. 7 tests:
  - jobs are looked up in order and the summary counts `looked_up`, `found` and `failed` by
    reason
  - it stops at `max_per_run`, and the rest count as `skipped_for_limit`
  - it stops starting lookups once `max_total_minutes` has passed (fake clock)
  - two jobs at the same company in one run make one SearXNG request (per-run cache, FR-015)
  - with `searxngUrl` null, it returns at once with `note: "careers search not configured"` in
    the summary and the `careers` trace event (US1 scenario 4)
  - when a search throws `SearchUnavailable`, no further lookups start and the note names
    SearXNG's `json` format setting
  - when one lookup throws (a store write fails), it counts as `lookup_error` and the next job's
    lookup still runs
- [X] T018 [P] [US1] **Unit**: extend `tests/config.test.ts` with 2 tests:
  - `careers_lookup` defaults are `max_per_run 10`, `max_total_minutes 30`, `max_minutes 5`,
    `page_chars 12000`, `search_results 10` and `max_download_kb 2048`, and out-of-range values
    are rejected
  - `MYJOBBOT_SEARXNG_URL` is optional and must be a URL
- [X] T019 [P] [US1] **Unit**: add 2 tests:
  - in `tests/fetchJobs.test.ts`, a Gmail alerts fetch with a job missing its description runs
    a lookup (scripted chat and fakes through `tests/helpers/alertContext.ts`); the page carries
    the `careers` summary, and `store.findJob` (the page itself has no description field) shows
    the description with `description_source = "careers"`. A job that already has a
    description, and a job already attempted, are not looked up
  - in `tests/getJobDetails.test.ts`, a job with `description_source = "careers"` shows
    `description_from: "careers page"`, and a source job shows nothing extra

#### Implementation

- [X] T020 [US1] Install `htmlparser2` at exactly `12.0.0` with `npm install --save-exact
  htmlparser2@12.0.0`. Check that `package-lock.json` keeps every optional platform entry it
  had (`git diff package-lock.json`), and that no floor-only range was added.
- [X] T021 [US1] In `src/http/client.ts`, move `getJson`'s retry loop into a private
  `request(url, headers, init)` shared by `getJson` and a new `getText(url, { maxBytes, headers })`
  (`TextGetter` interface). `getText`:
  - uses `redirect: "manual"`; a 3xx returns `{ redirect: location }`
  - accepts only `text/html` and `application/xhtml+xml`
  - reads the body stream up to `maxBytes`, decodes it as UTF-8, and returns `{ url, html, cut }`
  - sends `User-Agent: myjobbot (+careers lookup)`

  The file stays ≤ 200 lines. T012 passes.
- [X] T022 [P] [US1] Write `src/careers/addresses.ts`: `isPublicAddress(ip)` over a module-level
  `BlockList` (`node:net`), covering the ranges in T011 (including `0.0.0.0/8`, `::/128` and
  `::ffff:0:0/96`, or turn a mapped address back into IPv4 before checking), and
  `allowedUrl(url)` for scheme and port. Then write `src/careers/fetchPage.ts`, `fetchPublicPage(deps, url)`:
  - checks the URL, resolves the host through injected `lookup` (production:
    `node:dns/promises` `lookup` with `all: true`), and refuses when any address isn't public
  - calls `getText`, following at most 5 redirects and checking each hop again
  - throws `FetchRefused`, or `FetchTimedOut` when the error's `cause` is a `TimeoutError`,
    with fixed messages (both are used with `instanceof` in `src/careers/outcome.ts`, so they
    are not test-only exports)

  T011 passes, both files.
- [X] T023 [P] [US1] Write `src/careers/trim.ts`, `trimPage(html, { baseUrl, maxChars, sought?,
  links? })` (links unnumbered; `links: false` skips them), using `htmlparser2`'s `Parser` with `onopentag`, `ontext` and `onclosetag`
  callbacks. Keep a skip-depth counter for dropped and hidden elements, and keep the helpers
  small. Write `src/careers/rank.ts`, `rankLinks(links, soughtTitle)`, using `normalizeTitle`
  from `src/jobs/normalize.ts` and keeping page order for ties. T010 passes.
- [X] T024 [P] [US1] Write `src/careers/searxng.ts`: `searchUrl`, `parseResults` (a zod schema
  for `{ results: [{ url, title, content? }] }`), `SearchUnavailable`, and
  `searchCareers(http, request)`, which wraps both a failed `getJson` (network or HTTP) and a
  failed parse in `SearchUnavailable`. T013 passes.
- [X] T025 [US1] In `src/db/store.ts`, add the `CareersStore` interface (`audit`, `attempted`,
  `pruneAuditBefore`) with an `AuditEntry` type, and the data-model fields. `step` is one of
  `search · remembered · open_careers · open_job · finish · skipped`; `outcome` is one of
  `ok · found · failed`; `reason` is one of the nine fixed reasons (data-model.md, including
  `lookup_error`). Also add `Stores.careers` and
  `JobStore.setDescription`.
  - Implement them in `src/db/kysely/careersStore.ts`, in `src/db/kysely/jobStore.ts`
    (`setDescription` updates only `description`, `description_source` and `description_url`),
    and in `src/db/kysely/stores.ts`.
  - Cap `detail` at 2000 characters before writing.
  - `attempted` counts only `finish` rows whose reason is not `lookup_error` or
    `search_unavailable` (data-model, "Which jobs count as attempted").

  T014 passes on both stores.
- [X] T026 [US1] Write `src/careers/registry.ts` (`LinkRegistry`: `add(urls) → numbers`,
  `get(n)`, `range()`) and `src/careers/outcome.ts`. `outcome.ts` maps the lookup's state and the
  loop's `AgentResult` to a `LookupOutcome`: `{ found: true, description, url, careersUrl }` or
  `{ found: false, reason }`. A lookup that ended without a finish takes the first reason that
  applies, in the contract's order: `lookup_error` (LLM error, or a store-error `stop`);
  `fetch_refused` / `timed_out` (the last tool call was one); `careers_page_unreadable` (the last
  careers page had zero links and no job page was opened after it); `no_careers_page` (the
  search had no results and nothing was opened); else `gave_up`. The registry is what numbers
  links (`trimPage` returns them unnumbered).
- [X] T027 [US1] Write `src/careers/prompt.ts` (the system prompt and first message exactly as in
  `contracts/careers-lookup.md`, with the sought job filled in) and `src/careers/tools.ts`
  (`lookupTools(session)` → `search_careers`, `open_link`, `finish_lookup` through `defineTool`).
  Results are trimmed by `trimPage`, so there is one trimming step for both page kinds (FR-007).
  `open_link` for `job_page` trims with `links: false`. `open_link` for a `careers_page` with
  zero links adds `note: "no job links on this page"`. `open_link` refuses a 4th open.
  `search_careers` with zero results returns `"no results"`. A tool that hits
  `SearchUnavailable` or a store error sets the session's `stop` to it before rethrowing
  (`dispatch` would otherwise turn it into a plain tool error). T015 passes.
- [X] T028 [US1] Add `taggedTrace(trace, fields)` to `src/agent/trace.ts`. Write
  `src/careers/lookUpJob.ts`, `lookUpJob(deps, job)`:
  - runs `runAgent` with the lookup tools and limits `{ max_steps: 8, max_wall_clock_min:
    settings.max_minutes, max_consecutive_tool_errors: 2, context_chars: 56000 }`, and
    `isFinished` true once the lookup finished or the session's `stop` is set, using the
    lookup's own nudge and compaction notice, and `taggedTrace(trace, { lookup:
    "<ats>:<job_id>" })`
  - after `runAgent`: rethrows a `SearchUnavailable` stop (no `finish` row for this job), and
    turns a store-error stop into `lookup_error`
  - on `found`, calls `setDescription`
  - writes the `finish` audit row (`outcome` `found` or `failed`, `reason`, `warning = 1` when
    not found, and `url` = the last careers page opened, if any)

  T016 passes.
- [X] T029 [US1] Write `src/careers/lookUpJobs.ts`, `lookUpCareers(deps, sought)`: a loop over
  the jobs with the `max_per_run` and `max_total_minutes` caps and a per-run `Map` of company
  key → search results. It returns the summary `{ looked_up, found, failed, skipped_for_limit }`
  and writes the trace event `{ type: "careers", ...summary }`.
  - When `searxngUrl` is null, it returns at once with `note: "careers search not configured"`.
  - It catches `SearchUnavailable` (rethrown by `lookUpJob`), stops starting lookups, and sets the note
    "SearXNG search failed; check that search.formats includes json". This is the production
    importer of `SearchUnavailable` in this sitting, so the export is not test-only (constitution
    Principle I).
  - It wraps each `lookUpJob` call: anything thrown becomes outcome `lookup_error` (one
    best-effort `finish` audit row, itself guarded), and the loop moves on to the next job.

  T017 passes.
- [X] T030 [US1] Add `careers_lookup` to `fileConfigSchema` in `src/config/schema.ts`, with
  `prefault({})` and the defaults:
  - `max_per_run` int ≥ 1, default 10
  - `max_total_minutes` ≥ 1, default 30
  - `max_minutes` ≥ 1, default 5
  - `page_chars` int ≥ 2000, default 12000
  - `search_results` int 1–20, default 10
  - `max_download_kb` int ≥ 64, default 2048

  Add `MYJOBBOT_SEARXNG_URL: z.url().optional()` to `envSchema`. T018 passes.
- [X] T031 [US1] Wire the run:
  - In `src/tools/context.ts`, add `chat: ChatFn` and `careers: { store: CareersStore;
    searxngUrl: string | null; lookup: HostLookup; pages: TextGetter }` (`ToolContext.http`
    stays a `JsonGetter`, so the `fakeBoard` overrides in existing tests keep working; production
    passes the same `HttpClient` as both).
  - In `src/app/run.ts`, create the chat before `buildContext` and pass it in, set `searxngUrl`
    from env and `lookup` from `node:dns/promises`, and have `pruneOldJobs` also call
    `careers.store.pruneAuditBefore(cutoff)`.
  - Update `tests/helpers/context.ts` (`chat` defaults to a chat that throws, `careers` to the
    memory store with `searxngUrl: null` and a `pages` getter that rejects).
- [X] T032 [US1] Move `unscoredJobs` from `src/tools/fetchJobs.ts` to a new
  `src/tools/unscored.ts` (both files import it from there, so `alertSource.ts` and
  `fetchJobs.ts` don't import each other). In `src/tools/alertSource.ts`, after `fetchAlerts`,
  choose the sought jobs: `unscoredJobs(context, ALERTS_SOURCE, outcome)` where
  `description === null`, minus `careers.store.attempted(keys)`, oldest `first_seen` first,
  mapped to `SoughtJob`. Call `lookUpCareers`, and return its summary as `careers` on the
  outcome (`FetchOutcome` in `src/tools/sources.ts` gains `careers?`). In
  `src/tools/fetchJobs.ts`, add `careers` to the alerts page. In
  `src/tools/getJobDetails.ts`, add `description_from: "careers page"` when `description_source
  === "careers"`. T019 passes.
- [X] T033 [US1] Run `npm run check` and `npm run check:db` and fix every finding (suggested
  ones too). Update the ledger, delete the marker, and commit S2 ("Look up alert jobs on
  careers pages (008 S2)").

**Checkpoint**: US1 works with search configured. With `MYJOBBOT_SEARXNG_URL` unset, runs behave
exactly as before (SC-005).

---

## Phase 4: User Story 2, failed lookups are visible and explainable (P2)

**Goal**: every step leaves an audit row, every failure has one of the fixed reasons, and a
missing careers page records the addresses it saw.

**Independent Test**: a lookup whose search results hold no careers page leaves a trail
`search` → `finish` (`no_careers_page`, `warning = 1`) with the result addresses in `detail`. A
run with search off leaves one `skipped` / `search_unavailable` row.

### Sitting S3: the step-by-step audit trail (T034–T038)

Create `.specify/sitting-in-progress` naming S3 before T034.

- [X] T034 [P] [US2] **Unit**: add 3 tests to `tests/careersLookup.test.ts`:
  - a found lookup's audit rows are, in order, `search` (`ok`, `chars`), `open_careers` (`url`,
    `chars`, `cut`, `more_pages`), `open_job`, `finish` (`found`)
  - `no_careers_page` stores the result addresses (and only addresses) in `detail`, capped at
    2000 characters
  - a refused `open_link` writes a `failed` step row, and a lookup that then ends unfinished has
    reason `fetch_refused`; with a fetch that times out instead, the reason is `timed_out`
- [X] T035 [P] [US2] **Unit**: add 2 tests to `tests/careersLookUpJobs.test.ts` (the stopping
  and the notes already exist from S2; these assert the audit rows):
  - with `searxngUrl` null, exactly one `skipped` row with reason `search_unavailable`, and
    `ats`, `job_id` and `company` all `''`
  - when a SearXNG request fails (HTTP 403), exactly one `skipped` row with reason
    `search_unavailable`, written once however many jobs were waiting, and the interrupted job
    has no `finish` row (so it is tried again next run)
- [X] T036 [US2] Write a step audit row from each tool in `src/careers/tools.ts`, through a small
  `auditStep(session, step)` helper in a new `src/careers/audit.ts`:
  - `search_careers` writes a `search` row; `open_link` writes `open_careers` or `open_job`
  - every row carries `url`, `chars`, `cut` and `more_pages`, and the `outcome` is `failed` with
    the refusal for refused fetches
  - the `finish` row of a `no_careers_page` lookup puts the search-result addresses from the
    registry in `detail` (empty when the search had no results)
  - never any page text

  T034 passes.
- [X] T037 [US2] In `src/careers/lookUpJobs.ts`, write one `skipped` audit row with reason
  `search_unavailable`, `ats = ''`, `job_id = ''` and `company = ''`, in the two places S2
  already sets a note (not configured; a `SearchUnavailable` was caught). T035 passes.
- [X] T038 [US2] Run `npm run check` and `npm run check:db` and fix every finding. Update the
  ledger, delete the marker, and commit S3 ("Audit every careers lookup step (008 S3)").

---

## Phase 5: User Story 3, careers pages are remembered (P3)

**Goal**: a careers page that led to a found job is remembered per company. Later lookups are
offered it first, and a page that fails is forgotten.

**Independent Test**: the second lookup for a company starts with a `remembered` audit row,
makes no SearXNG request, and finds the job. When the remembered page fails, it is deleted and a
search follows.

### Sitting S4: remembered careers pages (T039–T043)

Create `.specify/sitting-in-progress` naming S4 before T039.

- [X] T039 [P] [US3] **Unit and integration**: add 2 cases to
  `tests/helpers/careersStoreContract.ts`:
  - `rememberPage` then `rememberedPage(companyKey)` returns it, and remembering again replaces
    the `url`; `usePage` updates `last_used_at` only
  - `forgetPage` deletes it
- [X] T040 [P] [US3] **Unit**: add 3 tests to `tests/careersLookup.test.ts`:
  - with a remembered page, the first message offers `[1]`, the audit starts with a
    `remembered` row (`url`, `outcome = ok`), and no SearXNG request is made when the model
    opens link 1
  - when the remembered page fails to load, it is forgotten (`forgetPage`), its failed
    `open_careers` row has `detail: "forgotten"`, and `search_careers` still works
  - when the remembered page opens with zero job links, it is forgotten too
- [X] T041 [US3] Add `rememberedPage`, `rememberPage`, `usePage` and `forgetPage` to
  `CareersStore` in `src/db/store.ts`, `src/db/kysely/careersStore.ts` and
  `tests/helpers/memoryCareersStore.ts`. The key is `normalizeCompany(company)` from
  `src/jobs/company.ts`. T039 passes.
- [X] T042 [US3] In `src/careers/lookUpJob.ts`, `src/careers/prompt.ts` and
  `src/careers/tools.ts`:
  - **Before the lookup**: offer the remembered page as link 1 (`usePage`) and write a
    `remembered` audit row (`url`, `outcome = ok`).
  - **On a `found` finish after an `open_careers`**: `rememberPage` with that careers page.
  - **On a failed open of the remembered page, or one that opens with zero links**: `forgetPage`,
    and that `open_careers` row gets `outcome = failed` and `detail: "forgotten"`.

  T040 passes.
- [X] T043 [US3] Run `npm run check` and `npm run check:db` and fix every finding. Update the
  ledger, delete the marker, and commit S4 ("Remember careers pages (008 S4)").

---

## Phase 6: Polish and cross-cutting concerns

### Sitting S5: bundled SearXNG and docs (T044–T047)

Create `.specify/sitting-in-progress` naming S5 before T044.

- [X] T044 [P] Add an optional `searxng` service to `compose.yaml` under `profiles: ["search"]`:
  - image `searxng/searxng` pinned to the newest dated tag at implementation time (never
    `latest`)
  - no published port (reachable as `http://searxng:8080` inside the stack)
  - `restart: unless-stopped`
  - a read-only mount of `docker/searxng/settings.yml`, which sets `use_default_settings: true`,
    `search.formats: [html, json]`, `server.limiter: false`, and a `server.secret_key` read from
    `SEARXNG_SECRET` in `.env`

  Check with `docker compose --profile search config --quiet` (validates and prints nothing)
  and `docker compose --profile search config --services`. Never run plain `docker compose
  config`: it prints the `env_file` values, which would print `.env`. Before relying on the
  read-only mount, check whether the pinned image's entrypoint writes to `settings.yml`; if it
  does, mount the file without `:ro`, or mount it at the path the image documents for
  overrides.
- [X] T045 [P] Document `MYJOBBOT_SEARXNG_URL` and `SEARXNG_SECRET` in `.env.example` (commented,
  no real values) and add a "Careers lookup" section to `README.md`:
  - what it does and when it runs
  - the `careers_lookup` config and its defaults
  - the bundled versus external SearXNG
  - the `json` format requirement
  - the audit queries from `quickstart.md`
  - the "model never types an address" rule

  Update the README's "big idea" paragraph and its tool count to mention the lookup
  conversation.
- [X] T046 [P] Add a careers note to `CLAUDE.md` next to the Gmail note:
  - the lookup lives in `src/careers/` and knows nothing about alerts
  - pages reach the model only through `trimPage`, with numbered links
  - addresses must be public `http(s)` and are re-checked on every redirect
  - no page text goes in `careers_audit`
- [X] T047 Run `npm run check` and `npm run check:db`. Update the ledger, delete the marker, and
  commit S5 ("Bundle SearXNG and document careers lookup (008 S5)").

### Sitting S6: live validation (T048–T050)

- [ ] T048 Run quickstart §2 (SearXNG answers JSON) and §3 (one run against `myjobbot_test`),
  including §3's preparation: connect Gmail on the test database through the web UI (this needs
  a Gmail app password from the owner), leave `JSEARCH_API_KEY` unset for the run, and don't run
  `check:db` in between.
  Record only counts here: lookups, found, failures by reason, and the largest `chars`
  (≤ 12000, SC-002). Never record page, job or email text.
- [ ] T049 Run quickstart §4 (remembered page) and §5 (search off, SC-005) against
  `myjobbot_test`. Record the outcome in one line each.
- [ ] T050 After the owner merges: run `npm run docker:up` (migration 004 reaches production on
  first start), confirm the next scheduled run's `careers` trace event, record the merge date
  here, and schedule the SC-001 check one week after the merge (quickstart §6, using that
  date).
  Merged 2026-10-16 (#13). Stack rebuilt from main; the 2026-10-16 18:00 run logged a `careers`
  event (0 looked up: both unscored alert jobs fail the title filter). SC-001 check due
  2026-10-23.

---

## Test ledger (constitution Principle II, target 95/4/1)

| Point | node (unit) | integration | dom (UI) | Unit share |
|---|---|---|---|---|
| Baseline (T002) | 283 | 29 | 30 | 82.7% |
| S1: +1 contract case (both stores), migration test in place | 284 | 30 | 30 | |
| S2: +10 trim, +4 addresses, +4 fetchPage, +5 getText, +3 searxng, +3 contract cases, +8 tools, +6 lookup, +7 lookUpCareers, +2 config, +2 tools wiring | 338 | 33 | 30 | |
| S3: +3 lookup audit, +2 search-unavailable rows | 343 | 33 | 30 | |
| S4: +2 contract cases, +3 remembered | 348 | 35 | 30 | ≈ 84.3% |

This matches the plan's split: 65 unit, 6 integration (each contract case counts once on the
memory store and once on MariaDB).

---

## Dependencies & Execution Order

- **S0 → S1 → S2 → S3 → S4 → S5 → S6**, strictly in order. Each sitting ends green and is
  committed.
- **US1 (S2)** depends on S1 (the schema).
- **US2 (S3)** builds on US1's tools and loop. Its `finish` row already exists from S2.
- **US3 (S4)** builds on US1's lookup and the `careers_pages` table from S1.
- **Within S2**:
  - tests T010–T019 come first
  - then T020 (install), T021 (HTTP client), then T022, T023 and T024 in parallel
  - then T025 → T026 → T027 → T028 → T029 → T030 → T031 → T032
- **Not ready to merge** until S5 is committed and S6's T048–T049 are recorded.

## Parallel Examples

```bash
# S2 tests, all different files:
Task: "Unit tests for trimPage in tests/careersTrim.test.ts"
Task: "Unit tests for addresses in tests/careersAddresses.test.ts"
Task: "Unit tests for searxng in tests/careersSearxng.test.ts"
Task: "getText tests in tests/httpClient.test.ts"

# S2 pure modules after T021:
Task: "src/careers/addresses.ts + fetchPage.ts"
Task: "src/careers/trim.ts + rank.ts"
Task: "src/careers/searxng.ts"
```

## Implementation Strategy

- **MVP = S0–S2 (US1)**: alert jobs get descriptions from careers pages and are scored on them.
  That is the problem the owner raised.
- **Then S3 (US2)**: makes failures diagnosable. Do it before relying on the lookup in
  production.
- **Then S4 (US3)**: saves searches and GPU time.
- **S5–S6**: packaging, docs and the live check before the PR.
