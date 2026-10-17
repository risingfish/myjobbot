# Research: Read careers pages built by JavaScript

Inputs: the spec, the 008 code (`src/careers/`, `src/sources/`, `src/http/client.ts`), the audit
rows and traces of production runs `3aa17170` (2026-10-17 02:45Z) and `822f8c28` (14:58Z), and
live, read-only checks of the boards' public endpoints on 2026-10-17.

## R1. Why lookups fail today (evidence)

- **Decision**: treat empty pages as the main problem and model waste as the second.
- **Evidence** (run `822f8c28`, 10 lookups, 0 found): every page opened on `jobs.ashbyhq.com`,
  `*.myworkdayjobs.com`, `micron.eightfold.ai`, `careers.cisco.com`, `careers.micron.com` and
  `consider.com` trimmed to 0 characters. Plain-HTML pages (WSP 11–12K, Greenhouse 5–8K, company
  sites 3–8K) read fine. Of the 37 opens, 15 were 0-character pages and 4 were fetch refusals
  (Glassdoor, ZipRecruiter, Teamwork Online). The model searched again mid-lookup in 7 of 10
  lookups and reopened link 1 repeatedly.
- **Board addresses seen**: `jobs.ashbyhq.com/Vetcove/<uuid>`, `jobs.ashbyhq.com/welltheory`,
  `cisco.wd5.myworkdayjobs.com/Cisco_Careers`, `micron.wd1.myworkdayjobs.com/External`,
  `clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers`,
  `job-boards.greenhouse.io/affirm[/jobs/<id>]`.

## R2. Board data: reuse the job-board readers

- **Decision**: read Ashby, Greenhouse and Lever boards with the existing `fetcherFor(ats)`
  readers in `src/sources/` (they return `Job[]` with title, location, url, jobId and a plain-text
  description). Add a Workday reader in `src/sources/workday.ts`.
- **Rationale**: FR-004 and FR-022 (one reader per board). The readers already turn each board's
  JSON into the shared `Job`, including HTML-to-text for Greenhouse.
- **Checked live**: `api.ashbyhq.com/posting-api/job-board/Vetcove` lists 28 postings, each
  `jobUrl` = `https://jobs.ashbyhq.com/Vetcove/<id>`.
- **Alternatives**: separate "lookup" clients per board (rejected: a second copy of each reader).

## R3. Recognising board links

- **Decision**: one pure function `parseBoardLink(url)` in `src/sources/boardLink.ts` returning
  `{ kind, slug, postingId }` (plus `host` and `site` for Workday) or `null`:
  - Ashby: `jobs.ashbyhq.com/<slug>[/<uuid>]`
  - Greenhouse: `boards.greenhouse.io/<slug>[/jobs/<id>]`, `job-boards.greenhouse.io/<slug>[/jobs/<id>]`
  - Lever: `jobs.lever.co/<slug>[/<uuid>]`
  - Workday: host `<tenant>.wd<N>.myworkdayjobs.com`, path `[/<locale>]/<site>[/job/...|/details/...]`;
    the posting id is the path from `/job/` (Workday's `externalPath`).
  Anything else (embeds, custom Workday domains, query-string-only links) is `null` and read as an
  ordinary page.
- **Rationale**: pure and table-testable; lives with the readers so a future board source can use
  it (FR-022). Slugs are passed through `encodeURIComponent` by the readers, and Workday hosts must
  match the pattern, so a board link can never send a request to an arbitrary host.

## R4. Workday's public data

- **Decision**: two calls, both under `https://<host>/wday/cxs/<tenant>/<site>`:
  - search: `POST /jobs` with `{"appliedFacets":{},"limit":20,"offset":0,"searchText":"<sought title>"}`
    → `{ total, jobPostings: [{ title, externalPath, locationsText, postedOn }] }`
  - posting: `GET <externalPath>` → `{ jobPostingInfo: { title, jobDescription (HTML), location, externalUrl } }`
- **Checked live** (2026-10-17): Cisco's board (710 matches for "software engineer"; detail
  `jobDescription` 10.6K characters of HTML).
- **Rationale**: Workday boards hold thousands of jobs, so the careers listing asks Workday's own
  search for the sought title (20 results, one request) instead of paging the whole board. The
  description goes through the existing `escapedHtmlToText`-style conversion.
- **Consequence**: `HttpClient` needs a JSON POST. It gets `postJson(url, body)` sharing the
  private `request()` retry loop with `getJson` (the method and body become part of the request),
  so retries, rate limiting and timeouts stay in one place.
- **Not now**: a Workday `BoardFetcher` for regular sources (paging + one request per posting);
  the spec leaves board sources for later. The reader's two functions are what it would use.

## R5. Showing board data to the model

- **Decision**: board data becomes a `TrimmedPage`, so the tools, size limit and audit treat it like
  any page:
  - careers page: text `"<N> open jobs at <company> on <Board>"`; links = postings as
    `"<title> — <location>"` → posting url, ranked by `rankLinks` (sought title first) and cut to
    the same link budget.
  - job page: text `title`, `location`, then the description, cut to `page_chars`.
  - a job link whose posting is not in the board's data: empty text plus the note "this posting is
    no longer listed", so `finish_lookup(found)` is refused by 008's blank-page rule.
- **Refactor (DRY)**: `trim.ts` today walks HTML and fits the result to the budget in one go. Split
  the budget step out as `fitPage({ text, links }, options)` so HTML pages and board pages share
  ranking, link budget and `cut`.
- **Cache**: one board read per `(kind, slug)` per run (and per Workday search text), like
  `cachedSearch`, so opening a board's listing and then one of its jobs is one request.

## R6. Board fallback

- **Decision**: any failure reading board data (HTTP error, unexpected shape, unknown slug) falls
  back to the plain download of the same address, then rendering if that is blank. The audit row's
  `fallback` says `board_failed`. Address refusals are not fallen back from.

## R7. Rendering: playwright-core against the official Playwright server

- **Decision** (owner's choice, 2026-10-17): `playwright-core` **1.64.1** (exact pin, no
  dependencies, Node ≥ 20) connecting with `chromium.connect(<ws url>)` to the official image
  `mcr.microsoft.com/playwright:v1.64.1-noble` running `npx -y playwright@1.64.1 run-server
  --port 3000 --host 0.0.0.0`. The client and server versions must match exactly; the plan pins
  both to 1.64.1 and the quickstart says to bump them together.
- **Rationale**: the app image doesn't grow by Chromium (~1 GB); the browser can run on another
  host; `playwright-core` gives per-request routing (R8).
- **Alternatives** (presented 2026-10-17): puppeteer-core + browserless (licence limits);
  browserless's `/content` endpoint without a library (no per-request control).

## R8. Checking every browser request

- **Decision**: each rendering uses a fresh `browser.newContext({ serviceWorkers: "block",
  acceptDownloads: false, userAgent })` and:
  - `context.route("**/*")`: abort `image`, `font` and `media` resource types; for everything else
    run the same check as the plain download (`allowedUrl` + DNS resolution to public addresses
    only), then `continue()` or `abort("blockedbyclient")`.
  - `context.routeWebSocket(/.*/)`: same check, then connect or close.
  - the main navigation going to a refused address makes `page.goto` fail; that becomes
    `FetchRefused` so the lookup reports `fetch_refused` as today.
- **DRY**: `fetchPage.ts`'s private `checkPublic` becomes `assertPublic(lookup, url)`, exported once
  a second production caller exists (S3, `boardPages`), and used by the plain download, the board
  reader's requests and the browser routes.
- **Residual risk**: the agent resolves the name, then Chromium resolves it again; a host that
  answers differently the second time (DNS rebinding) could slip one request through. The firewall
  rule (R10) is the backstop the clarification asked for; the quickstart says so.
- **Decisions in plain functions**: `routeVerdict(resourceType, url, check)` → `abort | continue`
  stays private and is unit-tested through `renderPage`: the Playwright calls sit behind a small
  `BrowserPort` interface, and a fake replays requests through the installed route handler.

## R9. When to render, and limits

- **Decision**: render only after a successful plain download that is **unreadable**: a job page
  with no text, or a careers page with no links (the same condition 008 calls
  `careers_page_unreadable`; a careers page often has header text but builds its job list with
  JavaScript, e.g. `careers.cisco.com`). The spec's FR-009 is reworded to match.
- **Limits**: `goto` with `waitUntil: "domcontentloaded"`, then wait for network idle until
  `careers_lookup.render_seconds` (default **15**) is used up; take `page.content()` at that point,
  capped at `max_download_kb`; trim as usual. Rendering time counts toward `max_minutes` and
  `max_total_minutes` because it runs inside the lookup's wall clock.
- **Run state**: the first connection or rendering failure turns rendering off for the rest of the
  run (FR-013); the summary note says so. Unset `MYJOBBOT_BROWSER_URL` = off from the start.

## R10. Network backstop and self-test

- **Decision** (clarification 2): the compose `browser` service sits on its own network with a
  fixed subnet (`172.31.250.0/24`) so the quickstart can give a `DOCKER-USER` rule that drops new
  connections from that subnet to private ranges (recommended, not required).
- **Self-test**: setting `careers_lookup.lan_probe_url` (default unset; e.g. the router's address).
  At a run's first rendering, the renderer makes one request to it from the browser's side
  (`context.request.get`, 3-second timeout, no routing). Any response means the browser can reach
  the LAN: a warning goes to the trace and to the audit (`step: "render_check"`, `warning: true`),
  and rendering still goes ahead. Unset = no self-test, noted once in the summary.

## R11. Tool changes (US4)

- **Repeat search**: `search_careers` after the first returns `{ note: "already searched; use the
  links above" }`, no request, no audit row.
- **Aggregators**: `careers_lookup.skip_hosts` (default `glassdoor.com`, `ziprecruiter.com`,
  `indeed.com`, `linkedin.com`, `builtin.com`, `teamworkonline.com`), matched on the host or any
  parent domain, dropped in the lookup's search function before results are cached or numbered.
- **Refused opens don't abort**: `open_link` returns a failed page as a normal result
  `{ opened: false, reason, note }` instead of throwing, so the loop's consecutive-error count
  never sees it; the audit row, `lastFailure` and the open count are unchanged. Unknown link numbers
  and bad arguments still throw and still count. No change to the agent loop.

## R12. Retrying earlier unreadable lookups once (FR-023)

- **Decision**: migration `005_page_sources` adds `careers_audit.retry_once TINYINT NOT NULL
  DEFAULT 0` and sets it to 1 on existing `finish` rows whose reason is
  `careers_page_unreadable`, `job_page_unreadable` or `gave_up`. `attempted()` ignores rows with
  `retry_once = 1`. New rows are always 0, so a retried job that fails again stays attempted.
- **Picking and marking retries**: every job that failed in 008 was scored right after its lookup,
  so the usual "unscored" candidate list would never include it. `CareersStore.retries()` returns the
  keys still owed a retry (a `retry_once` row, no later finish except `lookup_error` /
  `search_unavailable`, which don't use up the retry); `careersStep` adds those that are
  alert jobs with no description (whether scored or not), passing `retry: true`, and `lookUpJob`
  writes a `step: "retry"` audit row first (like `remembered`).
- **Scoring again**: `setDescription` also clears `scored_at`, so a retried job that is found is
  listed as unscored and scored in the same run. For 008's normal path (unscored jobs) this changes
  nothing.
- **Testing on MariaDB**: the store contract plants `retry_once = 1` through a per-store hook (a raw
  insert in the integration suite), since no production code writes it.
- **Alternatives**: a date cutoff (rejected: depends on the deploy time); deleting old rows
  (rejected: loses history).

## R13. Recording how a page was read (FR-016)

- **Decision**: migration 005 also adds `careers_audit.page_source VARCHAR(16) NULL` (`html`,
  `board`, `rendered`), `fallback VARCHAR(16) NULL` (`board_failed`, `render_failed`,
  `render_off`) and `board VARCHAR(160) NULL` (`<kind>:<slug>`, e.g. `ashby:Vetcove`). They are
  set on `open_careers` / `open_job` rows only. Addresses and sizes only, as before.

## R14. Test split (Principle II)

- Unit (in memory): board links, Workday parsing, board pages, `fitPage`, `readPage` order and
  fallbacks with fakes, route verdicts, renderer with a fake `BrowserPort`, run-level render state,
  tool changes, skip hosts, retry selection, config, `postJson` with a fake fetch.
- Integration: migration 005 and the store contract cases on MariaDB; one rendering test against a
  real Playwright server, run by `check:db` only when `MYJOBBOT_TEST_BROWSER_URL` is set (it serves
  a local page through an injected address check that allows only the test server).
- UI: none.
- Estimate: ~48 unit, ~4 integration, 0 UI (≈ 92 / 8 / 0 for this feature; the suite stays ≈ 95 / 4 / 1).
