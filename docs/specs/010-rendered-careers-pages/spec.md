# Feature Specification: Read careers pages built by JavaScript

**Feature Branch**: `010-rendered-careers-pages`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Read JavaScript-built careers and job pages in the careers lookup
(feature 008 follow-up). Production runs on 2026-10-16/17 found 1 of 20 jobs because most job
boards (Ashby, Workday, Eightfold, Cisco/Micron career sites, consider.com) build pages with
JavaScript, so trimPage gets 0 chars. Approach agreed with the owner: (1) for links on known
job-board hosts with a public JSON API, fetch the posting/listing as JSON instead of HTML — Ashby,
Greenhouse and Lever clients already exist in src/sources/; add Workday; (2) for any other page
that trims to no text, render it in a headless browser using Playwright (owner's choice:
playwright-core connecting to the official Playwright server image), then trim the rendered HTML
as usual. The browser runs as its own container, like SearXNG: optional compose profile or another
host, set by MYJOBBOT_BROWSER_URL; unset means no rendering (lookup still works without it).
Security: every request the browser makes is intercepted and checked against the same
public-address rules as fetchPage (BlockList, http(s) only, default port, no credentials),
images/fonts/media are blocked, and the browser container has internet access but no route to the
LAN as a backstop. Audit log keeps addresses and sizes only, and should record whether a page came
from HTML, a board API or the browser. Rendering costs ~2-10s and ~1GB RAM, so only blank pages
are rendered. Also small model-efficiency fixes seen in the same runs: a repeat search_careers
returns 'already searched; use the links above' instead of re-searching, known aggregator hosts
(Glassdoor, ZipRecruiter, Indeed, LinkedIn, Built In, teamworkonline) are dropped from search
results, and a refused fetch does not count toward the 2-consecutive-tool-errors abort. Must stay
DRY, follow HabitHooks rules, and keep src/careers independent of alerts."

## Overview

The careers lookup (feature 008) reads a page by downloading its HTML and trimming it. In the
first two production runs (2026-10-16 and 2026-10-17) it found 1 job of 20. The main cause: most
job boards build their pages with JavaScript, so the downloaded HTML has no text. Every page from
Ashby, Workday, Eightfold, `careers.cisco.com`, `careers.micron.com` and `consider.com` trimmed to
0 characters. Plain-HTML pages (company sites, Greenhouse, WSP) read fine.

This feature gives the lookup two more ways to read a page, tried in this order:

1. **Job-board data**: when a link is on a job board that publishes its postings as data (Ashby,
   Greenhouse, Lever, Workday), read the board's postings directly. This is fast and exact, and
   gives the full description without trimming guesswork.
2. **Plain download** (today's way) for every other page.
3. **Rendering**: when a plain download trims to no text, open the page in a browser that runs its
   JavaScript, then trim what the browser shows. The browser is a separate service the owner runs,
   like the search service; without it, lookups work as they do today.

The same runs also showed the model wasting its few steps. This feature fixes three of those
habits in the tools: repeat searches, aggregator results, and fetch refusals that abort a lookup.

## Clarifications

### Session 2026-10-17

- Q: Once 010 ships, should jobs whose earlier lookups failed because a page was unreadable be
  looked up again automatically, once? → A: Yes, once: jobs whose last lookup before 010 ended
  `careers_page_unreadable`, `job_page_unreadable` or `gave_up` get one more lookup; other reasons
  are not retried.
- Q: Should "no route to the LAN" for the bundled browser be a hard requirement enforced by a host
  firewall rule, or is checking every browser request in the agent enough? → A: The per-request
  checks are the requirement; the firewall rule is documented and recommended, and a self-test at
  the first rendering of a run warns (without blocking) when the browser can reach a LAN address.
- Q: When a lookup finds a company's board on Ashby, Greenhouse, Lever or Workday, should that
  board join the regular job-board sources? → A: No, out of scope: the audit log records the board
  kind and board name; adding boards to the sources is a later decision.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Jobs on data-publishing job boards are found (Priority: P1)

An alert job's posting lives on Ashby, Greenhouse, Lever or Workday. The lookup reaches the board
(from the search results or from the company's careers page), sees the board's job list, picks the
job, and stores its full description. The job is then scored on that description.

**Why this priority**: These boards hold most of the jobs that failed in production, and reading
their data needs no new service, so it delivers the largest gain on its own.

**Independent Test**: With a board's listing and posting served as test data, run a lookup whose
search result is the board's job page; the job is stored with the posting's description and the
audit log shows the page came from board data.

**Acceptance Scenarios**:

1. **Given** a search result that is a job's own page on Ashby, **When** the model opens it as the
   job page, **Then** the model sees that posting's title, location and description, and finishing
   as found stores that description with the posting's address.
2. **Given** a company careers page that links to its Workday board, **When** the model opens that
   link as a careers page, **Then** the model sees the board's open jobs as numbered links (title
   and location, the sought title ranked first), within the usual page size limit.
3. **Given** a board link whose company the board doesn't know, or a board that answers with an
   error, **When** the model opens it, **Then** the lookup falls back to the plain download of the
   same address, and the audit row says so.

---

### User Story 2 - Other JavaScript-built pages are rendered (Priority: P2)

A careers page or job page is not on a known board, and its plain download trims to no text. When
the owner has a browser service configured, the lookup renders the page and the model sees the
rendered text and links as usual. Without the service, the page reads as empty, exactly as today.

**Why this priority**: It covers the remaining sites (Eightfold, company-built career sites) but
needs a new service and carries more risk, so it comes after board data.

**Independent Test**: With a fake browser service that returns rendered HTML, open a page whose
plain download is empty; the model sees the rendered text and the audit row records rendering.
With the service unset, the same page reads as empty and nothing else changes.

**Acceptance Scenarios**:

1. **Given** a browser service is configured and a page whose plain download is unreadable (no
   text on a job page, no job links on a careers page),
   **When** the model opens it, **Then** the page is rendered, trimmed with the same rules and size
   limit, and shown to the model.
2. **Given** a page whose plain download has text, **When** the model opens it, **Then** it is not
   rendered.
3. **Given** no browser service is configured, **When** a page trims to no text, **Then** it is
   shown as empty (as in feature 008) and the run's careers summary notes that rendering is off.
4. **Given** the browser service is configured but unreachable, **When** a page needs rendering,
   **Then** the page is shown as empty, the audit row records the failure, and later pages in the
   same run skip rendering instead of waiting on the service again.

---

### User Story 3 - Rendering can't be used to reach the owner's network (Priority: P2)

A page the browser renders may try to load scripts, frames or data from anywhere, including
addresses on the owner's home network. The lookup refuses every such request, so a hostile page
can't use the browser to reach private services.

**Why this priority**: Rendering is only acceptable if it keeps the protection the plain download
already has; it ships together with User Story 2.

**Independent Test**: Render a test page that requests a private address, a non-default port and
an address with credentials; none of the requests is made, and the page's own text is still shown.

**Acceptance Scenarios**:

1. **Given** a rendered page that requests a private, loopback or link-local address, **When** it
   renders, **Then** that request is refused and the rest of the page still renders.
2. **Given** a rendered page that redirects or navigates to a private address, **When** it renders,
   **Then** the navigation is refused and the lookup sees a refused fetch.
3. **Given** a rendered page that loads images, fonts and video, **When** it renders, **Then** those
   requests are not made.

---

### User Story 4 - The model's steps aren't wasted (Priority: P3)

The model gets a bounded number of steps and page opens per job. Searching twice, opening
aggregator sites that refuse automated visits, and having two refused fetches end the whole lookup
used most of those steps in production. The tools now steer the model away from all three.

**Why this priority**: Cheap and independent of the other stories, but it only improves the odds
once pages are readable.

**Independent Test**: Script a model that searches twice, is offered an aggregator result, and
opens two refused links in a row; the second search returns a note without searching again, the
aggregator never appears, and the lookup continues after the refusals.

**Acceptance Scenarios**:

1. **Given** a lookup that already searched, **When** the model searches again, **Then** no new
   search is made and the model is told to use the links it already has.
2. **Given** search results that include Glassdoor, ZipRecruiter, Indeed, LinkedIn, Built In or
   Teamwork Online, **When** they are shown to the model, **Then** those results are left out.
3. **Given** two opens in a row that are refused by the site or by the address rules, **When** the
   model makes a third call, **Then** the lookup is still running (other tool errors still count
   toward the abort as before).

### Edge Cases

- A board link points at a job that has since closed: the board's data no longer lists it, so the
  model sees "this posting is no longer listed" and can finish with job_not_found.
- A board's data is larger than the page size limit (hundreds of jobs): the list is cut with the
  sought title ranked first, as careers pages are today.
- A Workday company uses a custom domain instead of `myworkdayjobs.com`: it is treated as an
  ordinary page (plain download, then rendering).
- A rendered page never finishes loading (endless scripts): rendering stops at a time limit and
  whatever text has appeared is used; if none, the page reads as empty.
- A rendered page is still empty (needs a login or blocks automated browsers): the page reads as
  empty and the model can finish with the matching unreadable reason.
- The plain download is refused by the address rules: the page is not rendered either.
- The browser service is configured with an address on the owner's network: allowed (it is the
  owner's own service); the address rules apply to the pages it renders, not to the service.
- A lookup renders several pages: the run's lookup time limits (per job and per run) still apply,
  with rendering time counted.

## Requirements *(mandatory)*

### Functional Requirements

**Job-board data**

- **FR-001**: When the model opens a link on a known job board that publishes postings as data
  (Ashby, Greenhouse, Lever, Workday), the lookup MUST read the board's data instead of the page.
- **FR-002**: Opened as a careers page, a board MUST be shown as its open jobs, each a numbered
  link with title and location, ranked and size-limited like any careers page.
- **FR-003**: Opened as a job page, a board posting MUST be shown as its title, location and
  description text, size-limited like any job page; finishing as found MUST store that text and the
  posting's own address.
- **FR-004**: Reading a board's data MUST reuse the existing job-board readers where they exist
  (Ashby, Greenhouse, Lever); Workday MUST get a reader of its own, usable later as a job-board
  source as well.
- **FR-005**: When a board's data can't be read (unknown company, error, unexpected shape), the
  lookup MUST fall back to the plain download of the same address.
- **FR-006**: Board data MUST be fetched only from the boards' own published addresses, under the
  same address rules as any other fetch.

**Rendering**

- **FR-007**: The browser service MUST be optional and set by one setting (an address); when unset,
  no page is rendered and lookups behave exactly as in feature 008.
- **FR-008**: The stack MUST be able to run the browser service as an optional part of the compose
  stack, or use one running elsewhere on the network.
- **FR-009**: A page MUST be rendered only when its plain download succeeded and is unreadable: a
  job page with no text, or a careers page with no job links (a careers page often has header text
  but builds its job list with JavaScript); the rendered page MUST go through the same trimming and
  size limit.
- **FR-010**: Every request a rendered page makes (the page itself, redirects, navigations, scripts,
  frames, data requests) MUST pass the same address rules as the plain download (public addresses,
  http(s) only, default port, no credentials); refused requests MUST NOT be made.
- **FR-011**: Rendering MUST NOT load images, fonts or media.
- **FR-012**: Rendering MUST stop at a configurable time limit per page, using whatever text has
  appeared by then.
- **FR-013**: When the browser service fails or can't be reached, the page MUST read as empty, and
  the rest of the run MUST NOT try rendering again.
- **FR-014**: The quickstart MUST document a host firewall rule that gives the bundled browser
  service internet access but no route to the owner's local network, as a second line of defence
  behind FR-010 (recommended, not required). At the first rendering of a run, a self-test MUST
  check whether the browser service can reach a local-network address and, if it can, write a
  warning to the trace and the audit log; rendering still goes ahead.
- **FR-015**: Each rendering MUST use a fresh browser context (no cookies, storage or cache carried
  between pages or lookups).

**Audit and reporting**

- **FR-016**: Each page-open audit row MUST record how the page was read: plain download, board
  data, or rendering, plus fallbacks (board data failed, rendering failed or off). It MUST keep
  addresses and sizes only, never page text. A page read from board data MUST also record the
  board kind and the company's board name.
- **FR-017**: The run's careers summary MUST note when rendering is off (not configured) or was
  turned off mid-run (service failed).

**Tool behaviour**

- **FR-018**: A second search in the same lookup MUST NOT search again; it MUST return a short note
  telling the model to use the links it has.
- **FR-019**: Search results on known aggregator sites (Glassdoor, ZipRecruiter, Indeed, LinkedIn,
  Built In, Teamwork Online) MUST be left out before they are shown or numbered; the list MUST be a
  setting with these as the default.
- **FR-020**: A refused or failed page open MUST NOT count toward the lookup's
  consecutive-tool-error abort; the per-lookup open limit still bounds it.

**Boundaries**

- **FR-021**: The careers lookup MUST stay independent of where its jobs come from (alerts or
  boards); nothing in it may depend on alert emails.
- **FR-022**: Board detection, board reading, plain download and rendering MUST each live in one
  place and be shared, not copied, between the careers lookup and the job-board sources.
- **FR-023**: Jobs whose last lookup before this feature ended `careers_page_unreadable`,
  `job_page_unreadable` or `gave_up` MUST be eligible for exactly one more lookup; the retry is
  marked in the audit log, and a retried job that fails again is not retried again. Jobs that
  ended with any other reason stay attempted. Because those jobs were scored after their failed
  lookup, a retry applies to already-scored jobs too, and a description found for an
  already-scored job MUST make it be scored again.

### Key Entities

- **Page source**: how an opened page was read — plain download, board data or rendering — with
  fallbacks; recorded on the page's audit row.
- **Board link**: an address recognized as a known job board, with the board kind, the company's
  board name and, for a job, the posting's id.
- **Browser service**: the owner's rendering service, identified by one address; on or off for the
  whole run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the next production run after release, with the same kind of alert jobs, at
  least 4 in 10 looked-up jobs end as found (from 1 in 20 before).
- **SC-002**: No page from Ashby, Greenhouse, Lever or Workday reaches the model empty when the
  board lists the job.
- **SC-003**: No rendered page makes a request to a private, loopback or link-local address (zero
  such requests in tests, and none in the audit log).
- **SC-004**: With the browser service not configured, every page that the plain download could
  read gives the same lookup outcome as before this feature, and no rendering is attempted.
- **SC-005**: No lookup ends early because of fetch refusals alone; lookups that end on the
  tool-error limit drop to zero in the first week's audit log.
- **SC-006**: No page or list handed to the model exceeds the configured page size limit, rendered
  or not.

## Assumptions

- The owner runs the browser service on the same host as the stack or elsewhere on the network,
  with roughly 1 GB of memory to spare while a page renders; rendering takes about 2–10 seconds.
- Only pages that read as empty are rendered, so most lookups never use the browser.
- Board data is public and needs no account; the boards' published data addresses are stable.
- Workday's public job data is reachable for companies on `*.myworkdayjobs.com` without login;
  custom Workday domains are treated as ordinary pages.
- Earlier failures other than the three retried reasons (FR-023) are not retried; the owner can
  still reset a job by hand (as was done on 2026-10-17), and the quickstart will document how.
- Prompt-injection hardening of page text is feature 009 and out of scope here; this feature keeps
  feature 008's existing "treat pages as data" instruction.
- Careers-page navigation (next pages of a listing) stays a placeholder, as in feature 008.
- Boards found by lookups are not added to the regular job-board sources; the audit log keeps the
  board kind and name so that can be decided later.
