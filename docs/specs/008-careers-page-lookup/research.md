# Research: Job details from company careers pages

All measurements below were taken on 2026-10-16 against the owner's SearXNG
(`https://search.forthebrew.com`) and live careers sites.

## R1. SearXNG search API

- **Decision**: `GET {MYJOBBOT_SEARXNG_URL}/search?q=<company> careers&format=json`, read with the
  existing `HttpClient.getJson` (rate limiting, retries, timeout). Parse `results[]` with zod,
  keeping `url`, `title`, `content` (the snippet). Keep the first 10 results, with duplicates by
  address dropped, titles cut to 120 characters and snippets to 200.
- **Rationale**: The owner's instance answers JSON (`200 application/json`, 20 results for
  "Vetcove careers", keys `query, results, answers, corrections, infoboxes, suggestions,
  unresponsive_engines`). SearXNG returns `403` when `formats` in its `settings.yml` lacks `json`.
  That case becomes the "search unavailable" reason, with a note naming the setting.
- **Alternatives considered**:
  - All 20 results: twice the tokens. In the measurement, the relevant addresses were all in the
    top 8.
  - SearXNG's HTML page: it would need parsing, which is what JSON avoids.

## R2. Search results often hold the job page itself

- **Decision**: The model may open a **job page straight from the search results**, skipping the
  careers page. The careers-page step is used when the results only offer a listing.
- **Rationale**: For "Vetcove careers", the results included
  `vetcove.com/careers/software-engineer/`, `…/front-end-software-engineer/` and
  `jobs.ashbyhq.com/Vetcove/<id>`. The careers page itself (`shop.vetcove.com/careers/`) has **no
  job links in its HTML**: the list is built in the browser. Requiring the careers page first
  would fail exactly where the search had already succeeded. This fits the spec's workflow, since
  every step is still a model choice among offered links.
- **Alternatives considered**:
  - A fixed order (search, then careers page, then job): fails on JavaScript-built listings.
  - Searching "<company> <title>": the owner specified "<company> careers", and that search
    still finds job pages. Revisit if the audit shows many "job not found" results.

## R3. HTML trimming library (owner-approved 2026-10-16)

- **Decision**: **htmlparser2 12.0.0**, exact pin. MIT, ESM, Node ≥ 20.19. Its dependencies
  (`domutils`, `entities`, `domhandler`, `domelementtype`) are all by the same author. One
  streaming pass with `Parser` callbacks (`onopentag`, `ontext`, `onclosetag`) builds the trimmed
  page; no document tree is kept.
- **Rationale**: Real pages break the regex helpers. `shop.vetcove.com` uses single-quoted
  `href='…'`, which `src/gmail/alertJobs/parse.ts`'s pattern misses. Script bodies contain `<`, and
  hidden blocks nest. htmlparser2 is the most-used lenient parser in Node (cheerio and linkedom
  build on it), and the callback form needs no tree.
- **Alternatives considered** (presented to the owner):
  - cheerio 1.2.0: about 10 packages and a full in-memory document.
  - node-html-parser 9.0.4: less lenient and less used.
  - extending the regex helpers: unsafe on the open web.

## R4. What trimming keeps

- **Decision**: One shared function, `trimPage(html, { baseUrl, maxChars, sought?, links? })`, is
  used for both careers pages and job pages (FR-007). It returns links unnumbered; the lookup's
  `LinkRegistry` gives them numbers. Job pages pass `links: false`:
  - **Drops** these elements with their content: `head script style noscript template svg iframe
    canvas form nav header footer`. Also any element with `hidden`, `aria-hidden="true"`, or an
    inline `display:none` / `visibility:hidden`.
  - **Keeps** text, with block elements (`p div li h1–h6 tr br section article`) turned into line
    breaks and whitespace collapsed.
  - **Links** are collected separately as `{ text, url }`. Addresses are resolved against the
    page's final address; only `http`/`https` ones are kept, with fragments removed and
    duplicates dropped. A link's text is cut to 120 characters, and a link with no text uses its
    `title` or `aria-label`.
  - **Order under the cap**: when a careers page has more links than fit, links whose text shares
    words with the sought title (via `normalizeTitle`) come first, then the rest in page order.
    Cutting then drops the least likely links.
  - **`more_pages`** is true when a link has `rel="next"` or its text is "next", "›", "»" or
    "more jobs". This is the FR-010 placeholder: reported and audited, never followed.
  - **The cap** is `careers_lookup.page_chars` for text plus links together. When it is reached,
    the result says `cut: true`.
- **Measured** (raw HTML, then text after dropping scripts, styles, nav, header and footer):

  | Page | Raw | Text | Links in HTML |
  |---|---|---|---|
  | `shop.vetcove.com/careers/` | 73 KB | 2.7 K chars | listing built by JavaScript |
  | `vetcove.com/careers/software-engineer/` (job page) | 54 KB | 6.2 K chars | – |
  | `jobs.ashbyhq.com/vetcove` | 24 KB | ~0 (JavaScript app) | 0 |
  | `boards.greenhouse.io/stripe` | 374 KB | 2.5 K chars | 23 |

- **Stored versus read**: the stored description is the job page's trimmed text, up to
  `page_chars`. `get_job_details` hands the scorer the first 6,000 characters (its existing
  `MAX_DESCRIPTION_CHARS`, marked truncated beyond that), which covers the measured job page
  (6.2 K) almost whole.
- **Defaults from these numbers**:
  - `page_chars` = **12,000**, which fits a full job description with room to spare.
  - The lookup conversation is bounded by allowing at most 3 page opens: worst case about
    54,000 characters (~14 K tokens), typical about 30,000 (contract, "Context bound").
    `context_chars` is set to 56,000 so compaction never cuts a lookup short.
  - That fits a 16 GB graphics card running a 7–14 B model at 16 K context.
  - Job pages are trimmed with links off (`links: false`), so their whole cap goes to the
    description text.

## R5. Running a lookup as its own conversation (clarification Q1)

- **Decision**: Reuse `runAgent` from `src/agent/loop.ts`, which "knows nothing about jobs", with
  the lookup's own system prompt, three tools, limits, `isFinished`, and a trace that tags each
  event with the job (`{ lookup: "<ats>:<job_id>" }`). It uses the run's `ChatFn` (same LLM, same
  raw-response log).
  - **Limits**: `max_steps` 8, `max_wall_clock_min` = `careers_lookup.max_minutes` (default 5),
    `max_consecutive_tool_errors` 2, `context_chars` 56,000. The loop checks the clock between
    steps, so one slow model call (up to the client's 10-minute request timeout) can overrun
    `max_minutes`; the per-run `max_total_minutes` is checked between lookups for the same
    reason.
  - **Failures inside tools**: `dispatch` turns a thrown error into a tool error for the model,
    so the tools record a `SearchUnavailable` or store error as the session's `stop` before
    rethrowing, and `isFinished` ends the loop on it (contract, "How a failure inside a tool
    reaches it").
  - **Mapping**: an aborted lookup becomes reason `gave_up` (step or time limit), `timed_out`,
    or `lookup_error` when the loop's reason is an LLM error. Anything a lookup throws is caught
    per job as `lookup_error`, so one broken lookup never fails the alerts source.
- **Rationale**: This is DRY: one loop, budget and compaction for both conversations. It is
  tested already, and keeps the habit-hooks surface small.
- **Alternatives considered**: a bespoke mini-loop, which would duplicate the budget, compaction
  and tool dispatch.

## R6. The model never types an address (FR-008)

- **Decision**: Every address the lookup knows gets a **number** in a per-lookup registry: search
  results first, then the links of each page opened. The fetch tool takes `link: <number>`, never
  a URL.
  - **Refusals**: unknown numbers, non-`http(s)` addresses, ports other than 80/443, and hosts
    that resolve to a non-public address. The non-public check uses `node:net`'s `BlockList`,
    built in with no dependency, covering `0.0.0.0/8` (reaches the local host on Linux),
    loopback, private, link-local, CGNAT, multicast, the IPv6 unspecified address `::`, ULA,
    and IPv4-mapped IPv6 (`::ffff:0:0/96`, so `::ffff:127.0.0.1` is refused too).
  - **DNS** is resolved through an injectable `lookup` (production: `node:dns/promises`).
  - **Redirects** are followed by hand (`redirect: "manual"`), at most 5 hops, and each hop is
    re-checked.
- **Rationale**: This is the strongest form of "only addresses that appeared". It removes URL
  copying errors, common with small models, and blocks reaching the LAN: the SearXNG host,
  MariaDB and the LLM server.
- **Accepted risk**: DNS rebinding between the check and the fetch. Low value to an attacker
  here, and closing it needs a custom dispatcher; noted for feature 009.
- **Alternatives considered**: free-form URLs checked against the seen set. That works, but the
  model must copy long URLs exactly.

## R7. Fetching pages as text

- **Decision**: Add `getText(url, { maxBytes, headers })` to `HttpClient`, sharing `getJson`'s
  retry, backoff, rate limiter and timeout through one private `request` method (DRY).
  - **Size**: the body is read as a stream and stops at `careers_lookup.max_download_kb`
    (default 2,048 KB; the largest page measured was 374 KB).
  - **Content type**: only `text/html` and `application/xhtml+xml` are accepted; anything else
    is refused.
  - **User agent**: `getText` requests send `User-Agent: myjobbot (+careers lookup)`.
- **Rationale**: Every web call keeps going through one client with one per-host limit.
- **Alternatives considered**: a separate fetcher. That would duplicate the retry and limiter
  logic.

## R8. Which jobs, and when (clarifications Q2 and Q4)

- **Decision**: In `alertSource`, after `fetchAlerts` (which already ran JSearch), call
  `lookUpCareers(deps, sought)`. `sought` is chosen as follows:
  - the Gmail-alerts jobs from the existing `unscoredJobs` (title and company filters, DRY)
  - with `description === null`
  - that have not been attempted: no `finish` row other than `lookup_error` or
    `search_unavailable` (data model), so temporary failures are retried; oldest first
  - capped at `careers_lookup.max_per_run` (default 10) and `careers_lookup.max_total_minutes`
    (default 30)

  The lookups run one at a time, so the single llama.cpp slot is never contended. They finish
  before `fetch_jobs` returns the page, so the agent scores with the descriptions.
- **Rationale**: Deterministic, testable and capped. The main agent's tools are unchanged.
  Already-scored alert jobs (such as the 8 that scored 0 in the 007 live run) are not re-looked
  up; re-scoring them is a separate decision.
- **Alternatives considered**: retrying failed jobs every run. That wastes GPU time on pages known
  to fail; the audit makes them easy to find instead.

## R9. Remembered careers pages (P3)

- **Decision**:
  - **Key**: the table `careers_pages` is keyed by `normalizeCompany(company)`.
  - **When a page is remembered**: when the model opens a link as a careers page and the lookup
    then ends `found`.
  - **Reuse**: in a later lookup for that company, the remembered page is offered as link 1, and
    `search_careers` stays available.
  - **Forgetting**: a remembered page that fails to load (HTTP error, refused, or no readable
    links) is deleted, and the audit says so.
  - **Within a run**: search results are cached per company for the run, so the search happens
    at most once per company per run (FR-015).
- **Alternatives considered**: remembering every opened page, which would remember wrong picks.

## R10. Audit log in the database (clarification Q3)

- **Decision**:
  - **Table**: `careers_audit`, one row per step (search, open, finish), written as each step
    happens, so an aborted run still leaves its trail.
  - **What a row holds**: no page or email text. The search text is stored for `search` rows,
    and the result addresses go in a capped `detail` column (≤ 2,000 characters) for the "no
    careers page" warning (US2 scenario 1).
  - **Pruning**: rows are pruned with jobs (`job_retention_days`) in `pruneOldJobs`.
- **Alternatives considered**: covered by the clarification (files, or both).

## R11. Configuration

- **Decision**:
  - **Address**: `MYJOBBOT_SEARXNG_URL` in `.env` (optional `z.url()`), since it is deployment,
    not preference. Unset means the lookup is off, with the note "careers search not configured"
    (FR-002).
  - **Limits**: in `config.json`, `careers_lookup: { max_per_run: 10, max_total_minutes: 30,
    max_minutes: 5, page_chars: 12000, search_results: 10, max_download_kb: 2048 }`, with all
    defaults applied by zod (`prefault({})`).
  - **Bundled SearXNG**: `compose.yaml` gains an optional `searxng` service under the `search`
    profile (`docker compose --profile search up`). The image is pinned by tag
    (`searxng/searxng:2026.10.x`, tag fixed at implementation), with a mounted
    `docker/searxng/settings.yml` that enables `json` and sets `server.limiter: false` (private,
    LAN-only). With it, `MYJOBBOT_SEARXNG_URL=http://searxng:8080`.
- **Note**: the SearXNG address is reached through `getJson`, not the fetch tool, so the LAN
  block in R6 does not apply to it.

## R12. Description provenance (FR-012)

- **Decision**: `jobs` gains two columns:
  - `description_source`: `'source'` or `'careers'`, NULL when there is no description. The
    migration backfills `'source'` for existing descriptions, and `upsertAll` sets `'source'`
    whenever it writes a description.
  - `description_url`: the address of the page the description came from.

  A new `JobStore.setDescription(key, { description, url, source })` stores a careers
  description. `get_job_details` adds `description_from: "careers page"` for those jobs.
- **Alternatives considered**: inferring the origin from `ats`, which breaks once boards use the
  lookup (FR-019).
