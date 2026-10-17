---
description: "Tasks for feature 010: read careers pages built by JavaScript"
---

# Tasks: Read careers pages built by JavaScript

**Input**: Design documents from `docs/specs/010-rendered-careers-pages/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/page-reading.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file.

**Organization**: by user story, planned in sittings.

- **Where the work happens**: a sitting may span turns. Work happens in the main checkout on
  `010-rendered-careers-pages`, with the Docker stack stopped. The stack runs production from this
  checkout, so its scheduled runs pause until the merge.
  - The branch sits on `fix/careers-empty-job-page` (commit 9de3535). If that merges first, rebase
    onto `main` before S1.
- **How a sitting ends**:
  - `npm run check` and `npm run check:db` are green.
  - Delete `.specify/sitting-in-progress`.
  - Commit only that sitting's files, when the owner asks. `docs/specs/009-prompt-injection-delimiters/`
    and the `.gitignore` line for `compose.override.yaml` are never part of a 010 commit.
- **Wiring**: every new module is reached from `open_link` (through `readPage`), the run
  (`src/app/run.ts`), or `src/tools/careersStep.ts` within the sitting that creates it.
- **Signatures**:
  - Services take one deps object first (eslint `max-params: 3`).
  - Test bodies stay within 20 lines, using helpers.
- **File size**: `src/careers/tools.ts` (125 lines) and `tests/careersLookup.test.ts` (137 lines)
  are near the limit. Page reading goes in `readPage.ts`, and its tests in
  `tests/careersReadPage.test.ts`, never in those two files.
- **Fixtures**:
  - Synthetic board JSON and HTML only, shaped like research R2/R4.
  - No real page, job or email text is ever committed, printed, or recorded here. Live checks
    record counts only.
- **Paths**:
  - `src/careers/` never imports from `src/gmail/` (FR-021).
  - Board recognition and reading live in `src/sources/` (FR-022).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4 from spec.md

---

## Phase 1: Setup

### Sitting S0: stop the stack and get a green baseline (T001–T002)

- [X] T001 First, have the owner merge `fix/careers-empty-job-page` and rebase this branch onto
  `main`; the stack runs that fix for production until 010 merges. Then run
  `docker compose top myjobbot` and confirm no run is in progress, then run
  `docker compose stop` (no `docker:watch`). Create `.specify/sitting-in-progress` naming S0.
- [X] T002 Run `npm run check` and `npm run check:db` and record the counts in the ledger below.
  Delete the marker, then commit only `docs/specs/010-rendered-careers-pages/` ("Plan reading
  careers pages built by JavaScript (010)").

---

## Phase 2: Foundational (blocks all stories)

### Sitting S1: one reading path and migration 005 (T003–T013)

Create `.specify/sitting-in-progress` naming S1 before T003.

**Purpose**:
- Every open goes through `readPage`, which so far has only the plain step.
- The budget step is shared, so board pages can use it in S3.
- The audit gains `page_source`, `fallback` and `board`. `page_source = 'html'` is written from
  this sitting on, so the columns are reachable straight away.

- [X] T003 [P] Unit test `tests/careersFitPage.test.ts`:
  - `fitPage({ text, links }, { maxChars, sought })` ranks the link matching `sought` first.
  - Links take at most half the budget.
  - The total stays ≤ `maxChars`.
  - `cut` is true when text or links were dropped.
  - An empty input gives empty text and `cut: false`.

  Keep the existing `tests/careersTrim.test.ts` cases passing unchanged.
- [X] T004 Split the budget step out of `src/careers/trim.ts` into `src/careers/fitPage.ts`
  (`fitPage`, plus the `LINK_OVERHEAD` budget moved with it). `trimPage` now walks HTML with
  `walkPage` and then calls `fitPage`. Run `tests/careersTrim.test.ts` and
  `tests/careersFitPage.test.ts`.
- [X] T005 Confirm the existing `tests/careersFetchPage.test.ts` cases (private names, the
  `mixed.example` public-and-private name, loopback, redirects) cover the check being renamed in
  T006; they must pass unchanged after it. No new test.
- [X] T006 In `src/careers/fetchPage.ts`, rename the private `checkPublic(deps, url)` to
  `assertPublic(lookup: HostLookup, url: string)`, **still private** in this sitting (knip runs in
  production mode: an export used only by its own file and tests is unused). T028 exports it when
  `boardPages.ts` becomes its second production caller.
- [X] T007 [P] Unit test `tests/careersReadPage.test.ts`. `readPage(deps, { url, kind, sought })`
  returns the plain download trimmed exactly as `trimPage` would, with `source: "html"`,
  `fallback: null` and `board: null`. A `FetchRefused` from the download is rethrown unchanged.
- [X] T008 Create `src/careers/readPage.ts` (`PageRead`, `readPage`) holding the plain step that is
  in `lookUpJob.ts` `openPage` today. Make `lookUpJob.ts` pass `readPage` as the `open` port, and
  remove `openPage`. `ToolPorts.open` now returns `PageRead` (`TrimmedPage` plus `source`,
  `fallback` and `board`). Update the test helpers that build `open` results in the same task:
  `page()` in `tests/careersTools.test.ts` and `fakePages`/`lookupSetup` in
  `tests/helpers/careersLookup.ts`, via one `asRead(page)` helper in `tests/helpers/careersPages.ts`
  that adds `source: "html"`, `fallback: null` and `board: null`.
- [X] T009 Integration test `tests/integration/migrate.test.ts`:
  - 005 runs after 004.
  - `careers_audit` has `page_source VARCHAR(16) NULL`, `fallback VARCHAR(32) NULL`,
    `board VARCHAR(160) NULL` and `retry_once TINYINT NOT NULL DEFAULT 0`, all `utf8mb4_bin`.
  - Pre-existing `finish` rows with reason `careers_page_unreadable`, `job_page_unreadable` or
    `gave_up` get `retry_once = 1`; other rows stay 0.
- [X] T010 Create `src/db/migrations/005_page_sources.ts` (export `pageSources`) and list it in
  `src/db/migrations/index.ts`:
  - `ALTER TABLE careers_audit` adds the four columns exactly as data-model.md defines them.
  - Then `UPDATE careers_audit SET retry_once = 1 WHERE step = 'finish' AND reason IN
    ('careers_page_unreadable', 'job_page_unreadable', 'gave_up')`.
  - Update `CareersAuditTable` in `src/db/schema.ts`: `page_source`, `fallback` and `board` as
    `Text`, and `retry_once` as `Generated<number>`.
- [X] T011 Add a contract case to `tests/helpers/careersStoreContract.ts` (runs on memory and
  MariaDB): an audit entry with `pageSource: "html"`, `fallback: null` and `board: null`
  round-trips, and so does `fallback: "board_failed,render_off"`. Extend `AuditEntry` in `src/db/store.ts` with optional `pageSource`, `fallback` and
  `board`, and write them in `src/db/kysely/careersStore.ts` and `tests/helpers/memoryCareersStore.ts`.
- [X] T012 In `src/careers/tools.ts` `openLink`, write `pageSource`, `fallback` and `board` from the
  `PageRead` on the `open_careers` / `open_job` audit row. Add a unit case to
  `tests/careersLookup.test.ts`'s audit-trail test: both open rows have `pageSource: "html"`.
- [X] T013 Run `npm run check` and `npm run check:db`, fix every finding, delete the marker, and
  commit ("Read every careers page through one path; migration 005 (010 S1)").

**Checkpoint**: behaviour is unchanged, every open goes through `readPage`, and the audit says how
each page was read.

### Sitting S2: retry earlier unreadable lookups once, FR-023 (T014–T020)

Create `.specify/sitting-in-progress` naming S2 before T014.

- [X] T014 [P] Contract cases in `tests/helpers/careersStoreContract.ts`:
  - A `finish` row with `retry_once = 1` is not returned by `attempted()`, and its key is returned
    by `retries()`.
  - A later `finish` row for the same job (`retry_once = 0`) makes it attempted again and drops it
    from `retries()`.
  - A later `finish` row whose reason is `lookup_error` or `search_unavailable` does **not** drop it
    from `retries()` (the same exclusion `attempted()` uses), so a retry interrupted by a model or
    search failure is tried again on the next run.

  Planting `retry_once = 1` is not a production operation, so the contract takes a per-store
  `plantRetryOnce(entry)` hook: the MariaDB suite (`tests/integration/storeContract.test.ts`) writes
  the row with a raw Kysely insert into `myjobbot_test`; the memory suite sets a test-only field on
  `MemoryCareersStore`.
- [X] T015 Add `retries(): Promise<JobKey[]>` to `CareersStore` in `src/db/store.ts`: the keys that
  have a `retry_once = 1` finish row and no later finish row other than `lookup_error` or
  `search_unavailable` (share the exclusion list with `attempted()`, `RETRYABLE_REASONS` in
  `src/db/kysely/careersStore.ts`). Implement it in
  `src/db/kysely/careersStore.ts` and the memory store, and make `attempted()` ignore rows with
  `retry_once = 1` in both.
- [X] T016 Contract case in `tests/helpers/descriptionContract.ts` (memory and MariaDB):
  `setDescription` on a job that has `scored_at` set clears `scored_at`, so the agent scores it
  again; score and verdict columns are left as they are until then. Change `setDescription` in
  `src/db/kysely/jobStore.ts` and `tests/helpers/memoryStore.ts` to also set `scored_at = NULL`, and
  update its doc comment and 008's contract line ("changes no others") in
  `docs/specs/008-careers-page-lookup/data-model.md`.
- [X] T017 [P] Unit test in `tests/careersLookup.test.ts`: a `SoughtJob` with `retry: true` writes
  `{ step: "retry", outcome: "ok" }` as its first audit row, before `search`.
- [X] T018 Add `retry?: boolean` to `SoughtJob` in `src/careers/session.ts`. Add `"retry"` to
  `AuditStep` in `src/db/store.ts`. Write the row at the start of `lookUpJob` in
  `src/careers/lookUpJob.ts`, next to `offerRemembered`.
- [X] T019 [P] Unit test in a new `tests/careersStep.test.ts` (use `tests/helpers/context.ts`):
  - An alert job that is **already scored**, has no description, and has a `retry_once` finish row
    is looked up with `retry: true`.
  - One with a normal finish row is not looked up.
  - A retried job that is found ends unscored with the careers description, so the agent scores it
    in the same run (it is listed by `unscoredJobs` after the lookup).

  Then, in `src/tools/careersStep.ts` `lookUpAlertJobs`: candidates are the unscored, undescribed,
  unattempted alert jobs as today, plus the jobs from `retries()` that are alert jobs with no
  description and pass the title and company filters (loaded with `store.findJob`), marked
  `retry: true`, oldest first. Check that `fetchJobs` lists unscored jobs after the careers step.
- [X] T020 Run `npm run check` and `npm run check:db`, delete the marker, and commit ("Retry
  earlier unreadable lookups once (010 S2)").

---

## Phase 3: User Story 1 - Jobs on data-publishing job boards are found (Priority: P1) 🎯 MVP

**Goal**: Ashby, Greenhouse, Lever and Workday links are read from the boards' data.

**Independent Test**: with board JSON served by a fake `JsonGetter`, a lookup whose search result
is an Ashby job page stores that posting's description. Its open row has `page_source = 'board'`
and `board = 'ashby:<slug>'`.

### Sitting S3: board data (T021–T031)

Create `.specify/sitting-in-progress` naming S3 before T021.

- [X] T021 [P] [US1] Unit test `tests/careersBoardLink.test.ts`, table-driven:
  - `parseBoardLink` returns kind, slug and postingId for:
    - `jobs.ashbyhq.com/Vetcove` and `.../Vetcove/<uuid>`
    - `boards.greenhouse.io/affirm`, `job-boards.greenhouse.io/affirm/jobs/7815948003`
    - `jobs.lever.co/acme` and `.../acme/<uuid>`
    - `cisco.wd5.myworkdayjobs.com/Cisco_Careers`, `.../en-US/Cisco_Careers/job/San-Jose/Engineer_R1`
      (postingId `/job/San-Jose/Engineer_R1`, `host`, `site`)
  - It returns `null` for:
    - `boards.greenhouse.io/embed/job_app?for=x`
    - a custom Workday domain
    - `jobs.ashbyhq.com/` with no slug
    - `http://evil.wd1.myworkdayjobs.com.attacker.example/x`
    - `https://x.wd1.myworkdayjobs.com:8443/s`
- [X] T022 [US1] Create `src/sources/boardLink.ts` (`BoardLink`, `parseBoardLink`) per research R3.
- [X] T023 [P] [US1] Unit test in `tests/httpClient.test.ts`: `postJson(url, body)` sends
  `POST` with `content-type: application/json` and the JSON body. It retries 503 like `getJson`,
  goes through the host limiter, and tags errors with the url.
- [X] T024 [US1] In `src/http/client.ts`, add `JsonPoster { postJson(url, body): Promise<unknown> }`
  and `HttpClient.postJson`. The private `request(url, init)` already takes `init`, so pass
  `method: "POST"` and the body. The error text says the method (`POST <url> failed …`).
- [X] T025 [P] [US1] Unit test `tests/careersWorkday.test.ts` using a fake getter/poster and
  synthetic JSON shaped like research R4:
  - `searchWorkday` posts `{ appliedFacets: {}, limit: 20, offset: 0, searchText }` to
    `https://<host>/wday/cxs/<tenant>/<site>/jobs` and maps `jobPostings` to `{ title,
    location: locationsText, url: https://<host>/<site><externalPath>, postingId: externalPath }`.
  - `workdayPosting` gets `<base><externalPath>` and returns title, location and the description as
    text from `jobDescription` HTML.
  - A response of the wrong shape throws.
- [X] T026 [US1] Create `src/sources/workday.ts` (`searchWorkday`, `workdayPosting`). Convert the
  HTML with the existing `src/sources/htmlText.ts` helper, reusing it rather than writing a new one.
- [X] T027 [P] [US1] Unit test `tests/careersBoardPages.test.ts` with `tests/helpers/boardData.ts`
  (synthetic Ashby, Greenhouse, Lever and Workday payloads):
  - Careers page: text `"<N> open jobs at <company> on <Board>"`, links `"<title> — <location>"`
    with the sought title first, fitted to `page_chars`.
  - Job page: title, location and description.
  - A posting not in the board's data: empty text plus the note "this posting is no longer listed".
  - Two reads of the same board make one request (cache).
  - Workday careers page: one search for the sought title.

  Also add the `assertPublic` cases to `tests/careersFetchPage.test.ts`, importing it as an export
  (T028 exports it): non-default port, credentials, `ftp:`, a name resolving to `10.0.0.5`, and
  public-only names accepted.
- [X] T028 [US1] Create `src/careers/boardPages.ts` (`boardPage(deps, { link, kind, sought })` and
  a per-run cache keyed by `kind:slug`, plus the search text for Workday):
  - Ashby, Greenhouse and Lever go through `fetcherFor(kind)` from `src/sources/index.ts`, matching
    a posting by `jobId` or by `url`.
  - Workday goes through `src/sources/workday.ts`.
  - The result goes through `fitPage`.
  - Every request first passes `assertPublic` (FR-006). Export `assertPublic` from
    `src/careers/fetchPage.ts` now that `boardPages.ts` is its second production caller (its tests
    are in T027).
- [X] T029 [P] [US1] Unit tests in `tests/careersReadPage.test.ts`:
  - A board link reads board data: `source: "board"`, `board: "ashby:Vetcove"`, and no plain
    download.
  - A board read that throws (HTTP 404, wrong shape) falls back to the plain download with
    `fallback: "board_failed"`.
  - A board host failing `assertPublic` is refused, not fallen back from.
- [X] T030 [US1] Add the board step to `readPage` in `src/careers/readPage.ts`, ahead of the plain
  step. Give `LookupDeps` / `CareersDeps` (`src/careers/lookUpJob.ts`, `src/careers/lookUpJobs.ts`)
  the JSON getter and poster (the run's `HttpClient`) and the per-run board cache, created once in
  `lookUpCareers`.
- [X] T031 [US1] Unit test in `tests/careersLookup.test.ts`: a search result that is an Ashby job
  page, then `open(1, "job_page")` and `finish(true)`, stores the posting's description and url.
  The open row has `pageSource: "board"` and `board: "ashby:<slug>"`. Then run `npm run check` and
  `npm run check:db`, delete the marker, and commit ("Read job boards' own data in the careers
  lookup (010 S3)").

**Checkpoint**: US1 works with rendering off; the Vetcove-style failure now ends found.

---

## Phase 4: User Stories 2 and 3 - Render JavaScript-built pages, safely (Priority: P2)

**Goal**:
- Unreadable plain pages are rendered by the owner's browser service (US2).
- Every browser request passes the address rules (US3).

**Independent Test**:
- With a fake browser port, a careers page with no links is rendered and shows its links.
- A page requesting `http://192.168.1.1/` has that request aborted.
- With no browser URL, nothing is rendered and the summary says so.

### Sitting S4: rendering, from the browser port to the run (T032–T044)

Create `.specify/sitting-in-progress` naming S4 before T032.

- [ ] T032 [US2] Install `playwright-core` pinned exactly: `npm install --save-exact
  playwright-core@1.64.1`. Check that the lockfile still has every optional platform entry
  (`git diff package-lock.json`). It is first imported in T035, in this sitting.
- [ ] T033 [P] [US3] Unit test `tests/careersRender.test.ts`, part 1, through `renderPage` with
  `tests/helpers/fakeBrowser.ts`: the fake replays a list of requests through the route handler
  `renderPage` installed and records each verdict:
  - aborted for `image`, `font` and `media`;
  - aborted when the injected check throws `FetchRefused` (private address, port 8080,
    credentials, `file:`, `data:` documents), and for a WebSocket to a private address;
  - continued for a public `script`, `document`, `xhr` or `fetch`.
- [ ] T034 [P] [US2] Unit test `tests/careersRender.test.ts`, part 2, with `tests/helpers/fakeBrowser.ts`
  (a fake `BrowserPort` that records calls). `renderPage` must:
  - open a fresh context with `serviceWorkers: "block"` and `acceptDownloads: false`;
  - install the route and WebSocket handlers before navigating;
  - navigate with `domcontentloaded`, then wait for network idle within `render_seconds`;
  - return the content capped at `maxBytes`;
  - close the context when the page throws.

  It also maps errors:
  - a main navigation aborted by the route becomes `FetchRefused`;
  - a timeout still returns the content so far.
- [ ] T035 [US2] [US3] Create `src/careers/render.ts`:
  - `BrowserPort`, the minimal surface the renderer uses (`newContext`, and per context `route`,
    `routeWebSocket`, `newPage`, `close`).
  - `routeVerdict`, private (tested through `renderPage`, T033).
  - `renderPage(port, { url, check, seconds, maxBytes })`.
  - `connectBrowser(wsUrl)`, which wraps `chromium.connect` from `playwright-core` into a
    `BrowserPort`. This wrapper is the only Playwright-specific code.
- [ ] T036 [P] [US2] Unit test `tests/careersRenderState.test.ts`:
  - Unset url: `off = "page rendering not configured"` and never connects.
  - The first `connect` or render failure sets `off = "page rendering turned off: browser service
    failed"` and later calls don't connect again.
  - The LAN self-test runs once, at the first rendering, only when `lan_probe_url` is set. A
    response writes a `render_check` audit row with `warning: true` and a `render_check` trace
    event with `warning: true`; a connection error writes
    `outcome: "ok"` without a warning. An unset probe adds the note "LAN check not configured".
- [ ] T037 [US2] Create `src/careers/renderState.ts` (`RenderState`, `newRenderState(deps)`,
  `render(state, request)`) with the lazy connection, turning off on failure, and the self-test
  (`context.request.get(probe, { timeout: 3000 })` through `BrowserPort`). Add `"render_check"` to
  `AuditStep` in `src/db/store.ts`.
- [ ] T038 [US2] Unit tests in `tests/careersReadPage.test.ts`, then the rendering step in
  `src/careers/readPage.ts`:
  - A job page with no text, or a careers page with no links, is rendered and trimmed with
    `trimPage`: `source: "rendered"`.
  - A readable page is not rendered.
  - Rendering off: `fallback: "render_off"` and the plain page is returned.
  - A render failure: `fallback: "render_failed"` and the plain page is returned.
  - A board read that fails, then a blank plain page with rendering off: `fallback:
    "board_failed,render_off"` (fallbacks are listed in the order they happened).
  - A refused main navigation rethrows `FetchRefused`.
  - A board page is never rendered.

Still in S4: the renderer is wired into the run in the same sitting, so `render.ts` and
`renderState.ts` are reachable from `src/app/run.ts` before the sitting ends (knip).

- [ ] T039 [P] [US2] Unit tests in `tests/config.test.ts`:
  - `careers_lookup.render_seconds` defaults to 15 and rejects 4 and 61.
  - `careers_lookup.lan_probe_url` is an optional URL.
  - `MYJOBBOT_BROWSER_URL` accepts `ws://browser:3000/` and `wss://…`, and rejects `http://…`.
- [ ] T040 [US2] Add `render_seconds` (int, min 5, max 60, default 15) and `lan_probe_url` (optional
  URL) to `careersLookup` in `src/config/schema.ts`. Add `MYJOBBOT_BROWSER_URL` (optional, `ws:` or
  `wss:` only) to `envSchema`.
- [ ] T041 [US2] Create the run's `RenderState` in `src/app/run.ts` from `MYJOBBOT_BROWSER_URL`,
  with a seam `browser?: (url) => Promise<BrowserPort>` for tests. Add it to `ToolContext.careers`
  in `src/tools/context.ts` and the test default in `tests/helpers/context.ts` (off), and pass it
  through `careersDeps` in `src/tools/careersStep.ts`. Close the browser connection at the end of
  the run. Unit tests:
  - In `tests/run.test.ts` (which already drives `runOnce` through its seams): the run closes the browser
    connection, using the `browser` seam with a fake that records `close`.
  - In `tests/careersLookUpJobs.test.ts`: a fake render that takes longer than `max_minutes` ends
    that lookup at its wall-clock limit like any other step.
- [ ] T042 [P] [US2] Unit test in `tests/careersLookUpJobs.test.ts`: the summary note joins the
  search note and the rendering note with "; ". "page rendering not configured" appears when the
  browser is off, and nothing is said when it is on and worked.
- [ ] T043 [US2] Add the rendering notes to `report` / the summary in `src/careers/lookUpJobs.ts`.
- [ ] T044 [US2] Run `npm run check` and `npm run check:db`, delete the marker, and commit
  ("Render JavaScript-built careers pages through a checked browser (010 S4)").

**Checkpoint**: US2 and US3 work with a fake browser. With the browser unset, plain-readable pages
give the same lookup outcomes as before and nothing is rendered (SC-004).

---

## Phase 5: User Story 4 - The model's steps aren't wasted (Priority: P3)

**Goal**: no repeat searches, no aggregator results, and refused opens don't abort.

**Independent Test**: a scripted model that searches twice, gets an aggregator result, and opens
two refused links in a row is still running after them, sees no aggregator, and made one search.

### Sitting S5: tool behaviour (T045–T051)

Create `.specify/sitting-in-progress` naming S5 before T045.

- [ ] T045 [P] [US4] Unit test `tests/careersSkipHosts.test.ts`: `dropSkipped(results, hosts)` drops
  `www.glassdoor.com`, `glassdoor.com` and `uk.indeed.com` for hosts `glassdoor.com` and `indeed.com`.
  It keeps `notglassdoor.com` and `glassdoor.com.example`.
- [ ] T046 [US4] Create `src/careers/skipHosts.ts` (`dropSkipped`). Add `skip_hosts` (array of host
  names, default `["glassdoor.com", "ziprecruiter.com", "indeed.com", "linkedin.com", "builtin.com",
  "teamworkonline.com"]`) to `careersLookup` in `src/config/schema.ts`, with a case in
  `tests/config.test.ts`. Apply it in `cachedSearch` in `src/careers/lookUpJobs.ts` before caching.
- [ ] T047 [P] [US4] Unit test in `tests/careersTools.test.ts`: a second `search_careers` returns
  `{ note: "already searched; use the links above" }`, makes no request, and writes no audit row.
- [ ] T048 [US4] Implement the repeat-search note in `search` in `src/careers/tools.ts` (the
  `session.searched !== null` check).
- [ ] T049 [P] [US4] Unit tests:
  - `tests/careersTools.test.ts`: an open whose fetch fails returns `{ opened: false, reason:
    "fetch_refused", note }` instead of throwing, writes the failed audit row, sets `lastFailure`,
    and counts toward the open limit. An HTTP 404 returns `{ opened: false, reason: null, note }`
    the same way.
  - `tests/careersLookup.test.ts`: two refused opens in a row followed by `finish(false,
    "no_careers_page")` end as `no_careers_page`, not aborted. Update 008's test "a refused or
    timed-out fetch writes a failed step…" for the returned result.
- [ ] T050 [US4] In `openLink` in `src/careers/tools.ts`, return the failure result instead of
  rethrowing. Update the prompt line in `src/careers/prompt.ts` so the model knows a failed open
  comes back as `opened: false`. Update `docs/specs/008-careers-page-lookup/contracts/careers-lookup.md`'s
  "Refusals" bullet to point at 010's contract.
- [ ] T051 [US4] Run `npm run check` and `npm run check:db`, delete the marker, and commit ("Stop
  the careers lookup wasting steps (010 S5)").

---

## Phase 6: Polish & Cross-Cutting Concerns

### Sitting S6: the browser service, docs, and the real-browser test (T052–T057)

Create `.specify/sitting-in-progress` naming S6 before T052.

- [ ] T052 Add the `browser` service to `compose.yaml`:
  - image `mcr.microsoft.com/playwright:v1.64.1-noble`, `profiles: ["browser"]`,
    `restart: unless-stopped`, `init: true`, `user: pwuser`, `working_dir: /home/pwuser`,
    `shm_size: 1gb`;
  - command `["npx", "-y", "playwright@1.64.1", "run-server", "--port", "3000", "--host", "0.0.0.0"]`;
  - no published ports;
  - a `browser` network with subnet `172.31.250.0/24`. Join `myjobbot` to it, keeping its default
    network.

  Check with `docker compose config --quiet` (never plain `config`).
- [ ] T053 [P] Integration test `tests/integration/render.test.ts`, skipped unless
  `MYJOBBOT_TEST_BROWSER_URL` is set. The test browser runs on the developer machine with host
  networking (quickstart §1), so it reaches the test's `127.0.0.1` server without crossing the
  `browser` network or the §3 firewall rule:
  - Connect with `connectBrowser`.
  - Render a page served by a local `node:http` server through an injected check that allows only
    that server.
  - The page's script-built text is returned.
  - Its request to a second, disallowed local port is never received by that server.
- [ ] T054 [P] Docs:
  - `.env.example`: `MYJOBBOT_BROWSER_URL`, commented, with the bundled value `ws://browser:3000/`.
  - `README.md` Careers lookup section: board data, rendering, the browser service, the firewall
    rule, and the `skip_hosts` / `render_seconds` / `lan_probe_url` config rows.
  - `CLAUDE.md` careers note: page reading order; `playwright-core` and the image are pinned
    together; every browser request goes through `assertPublic`.
- [ ] T055 Run quickstart §1's real-browser check (a host-network test browser on port 3001,
  `MYJOBBOT_TEST_BROWSER_URL=ws://127.0.0.1:3001/ npm run check:db`). Record the result in one line.
- [ ] T056 Record the test ledger below.
- [ ] T057 Run `npm run check` and `npm run check:db`, delete the marker, and commit ("Bundle the
  browser service and document page reading (010 S6)").

### Sitting S7: live validation (T058–T060)

- [ ] T058 After the owner merges:
  - Add `MYJOBBOT_BROWSER_URL` to `.env`.
  - Run `docker compose --profile browser up -d browser` and `npm run docker:up`.
  - Optionally add the quickstart §3 firewall rule and `lan_probe_url`.
- [ ] T059 Run one production run (quickstart §4). Record counts only:
  - lookups, found, failures by reason;
  - opens by `page_source` / `fallback`;
  - `retry` rows;
  - largest `chars` (≤ `page_chars`, SC-006);
  - any `render_check` warning.

  Compare found with SC-001 (≥ 4 in 10).
- [ ] T060 Run quickstart §5 (rendering off) and record one line.

---

## Dependencies & Execution Order

- **S0 → S1**: S1 (one reading path, migration 005) blocks everything else.
- **S2 (retry)**: depends only on S1. It can run before or after S3.
- **S3 (US1)**: depends on S1. It is the MVP.
- **S4 (US2, US3)**: depends on S1. S3 is not required, but `readPage` must place the board
  step before rendering, so do S3 first when working in order.
- **S5 (US4)**: depends on S1 only, because T050 touches `openLink` after T012.
- **S6**: depends on S4 (the compose service and the real-browser test). **S7** comes after the
  merge.

## Parallel Opportunities

- S1: T003 and T007 (different test files) can be written together. So can T009 and T011
  (integration and contract).
- S3: T021, T023, T025 and T027 are independent test files. So are T022, T024 and T026 (different
  source files).
- S4: T033, T034 and T036 are independent tests.
- S5: T045, T047 and T049 are independent tests.

## Parallel Example: User Story 1

```text
Task: "T021 Unit test tests/careersBoardLink.test.ts"
Task: "T023 Unit test postJson in tests/httpClient.test.ts"
Task: "T025 Unit test tests/careersWorkday.test.ts"
Task: "T027 Unit test tests/careersBoardPages.test.ts"
```

## Implementation Strategy

1. **MVP**: S0, S1 and S3 (board data). That alone covers Ashby and Workday, where most production
   failures happened, with no new service.
2. **Then** S2 (retry), so the earlier failures get their one retry with board data in place.
3. **Then** S4 (rendering) and S5 (tools).
4. **Then** S6 (the stack and docs) and the merge.
5. **Last**, S7 on production.

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (T002) | 356 | 35 | 30 |
| Planned new | ~47 (T003, T007, T012, T017, T019, T021, T023, T025, T027, T029, T031, T033, T034, T036, T038, T039, T042, T045–T049) | ~5 (T009, T011, T014, T016 on MariaDB; T053 only when `MYJOBBOT_TEST_BROWSER_URL` is set) | 0 |
| After S6 (T056) | | | |
