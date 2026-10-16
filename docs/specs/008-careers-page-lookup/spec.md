# Feature Specification: Job details from company careers pages

**Feature Branch**: `008-careers-page-lookup`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "Next up, lets get ready to enhance the email extraction work. The
problem with the emails is there is no data so score will almost always be 0. We need to be able
to search out a companies careers page and pull job data from it. To this end, let's build a tool
that calls a SearXNG platform, whether hosted locally as part of this docker compose stack, or on
another container in the network. [...] Workflow: 1. Create a tool that will query SearXNG's API
look for '<Company_name> Careers'. Get the URLs for the first page of listings, and feed them back
into an LLM call to ask it to determine which is the 'correct' Careers listing page. [...] 2.
Create a tool that the LLM can use to make a curl getting the companies careers page and feed it's
markup back to the LLM. The associate job we are looking for should also be fed back as part of
this call. 3. The LLM should search the page HTML for the most likely job match and extract the
url. 4. The LLM should use the same CURL tool to get the job listings HTML for processing and the
mark should be returned back to the LLM. 5. Populate the jobs details and categorize like normal.
Details not to miss: [no careers page on the first results page → logged warning, audit log];
[trim every page as much as possible so this runs on a 16GB graphics card]; [a placeholder for
careers-page navigation, not implemented]. Make sure to keep D.R.Y. principles, as well as
HabitHooks rules, as key concepts. This more detailed query regime will eventually be migrated to
the job board API queries as well, so it should not be scoped only to the email extraction."

## Overview

Jobs read from alert emails (feature 007) arrive with a title, company and location but no
description. The model scores them on almost nothing, so they nearly always score 0. This feature
gives the agent a way to find a job's description on the company's own careers page:

1. search the web for the company's careers page and let the model pick the right result;
2. fetch that page, trimmed down, and let the model pick the link to the job it is looking for;
3. fetch the job's own page, trimmed down, and store its text as the job's description;
4. score the job as usual.

The search goes through a SearXNG server the owner runs: part of this stack, or anywhere else on
the network. The lookup is built as a general capability (company + job in, description out), with
alert jobs as its first user, so the job-board sources can adopt it later without a second copy.

## Clarifications

### Session 2026-10-16

- Q: Where should the careers-page lookup run: inside the agent's main conversation, or in a
  short conversation of its own per job? → A: A short conversation of its own per job, with only
  the search and fetch tools; only the outcome (description or reason) returns to the run.
- Q: What starts a job's lookup: the run on its own, or the main agent job by job? → A: The run
  on its own: after alert jobs are stored and JSearch has run, every job still missing a
  description is looked up (up to the per-run limit) before the agent scores; the main agent gets
  no new tool.
- Q: Where should the lookup audit log be kept? → A: In the database: one row per lookup step,
  kept across runs, queryable by company, reason and date.
- Q: Should JSearch keep running before the careers lookup for alert jobs? → A: Yes, JSearch
  first; the careers lookup runs only for jobs JSearch didn't find. Revisit once the audit log
  and JSearch trace counts show which delivers.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Alert jobs get a real description and a real score (Priority: P1)

A run reads alert emails and stores jobs with no description. For each such job that passes the
title filter, the run looks up the company's careers page, opens it, finds the matching
job, opens the job's page, and stores the job's description. The job is then scored on that
description like any other job, and good matches show up in Recommended.

**Why this priority**: This is the whole problem: alert jobs score 0 because the model has
nothing to read. One working path from "company + title" to "description" fixes it.

**Independent Test**: With search configured and an alert job from a company whose careers page
lists the job as plain links, run the agent once; the job now has a description taken from the
company's site, a score that reflects it, and the audit log shows each step.

**Acceptance Scenarios**:

1. **Given** an unscored alert job "Senior Backend Engineer" at a company whose careers page links
   to that posting, **When** a run happens, **Then** the job is stored with the description from
   the posting's page and is scored on it.
2. **Given** the careers page lists several jobs, **When** the agent looks for the alert job,
   **Then** it is given the job it is looking for (title, company, location) alongside the trimmed
   page, and it picks the link whose job matches best.
3. **Given** the job already has a description, **When** a run happens, **Then** no careers lookup
   is made for it.
4. **Given** search is not configured or can't be reached, **When** a run happens, **Then** alert
   jobs are scored on what the email gave (as today), the run record says why the lookup was
   skipped, and the rest of the run works as before.

---

### User Story 2 - Failed lookups are visible and explainable (Priority: P2)

Every lookup leaves an audit trail the owner can read after the run: which search was made, which
result was chosen as the careers page, which job link was chosen, and how it ended. When the
careers page isn't among the first page of search results, or the job can't be found on it, the
audit records a warning with the reason, so the owner can look into why.

**Why this priority**: Careers pages vary wildly; the owner needs to see where the lookup fails to
improve it. The lookup still pays off without this, but blind.

**Independent Test**: Look up a company whose name returns no careers page in the first page of
search results; the audit log has a warning naming the company, the search made and the results
seen, and the job is still scored on the email's details.

**Acceptance Scenarios**:

1. **Given** no result on the first page of search results is the company's careers page,
   **When** the lookup runs, **Then** a warning is written to the audit log with the company, the
   search text and the result addresses seen, and the job falls back to the email's details.
2. **Given** the careers page was found but no link on it matches the job, **When** the lookup
   ends, **Then** a warning is written naming the careers page and the job sought.
3. **Given** a lookup succeeded, **When** the owner reads the audit log, **Then** each step is
   there in order: search, chosen careers page, chosen job link, description stored.

---

### User Story 3 - Careers pages are remembered (Priority: P3)

Once a company's careers page has been found, later lookups for the same company reuse it instead
of searching again.

**Why this priority**: Alerts often list the same companies week after week; reusing the page
saves a search and a model decision per job, which matters on a small graphics card.

**Independent Test**: Look up two jobs at the same company in two runs; the second run makes no
search for that company and the audit log says the remembered page was used.

**Acceptance Scenarios**:

1. **Given** a careers page was found for a company in an earlier run, **When** another job from
   that company needs a lookup, **Then** the remembered page is used and no search is made.
2. **Given** the remembered page can no longer be fetched, **When** a lookup uses it, **Then** it
   is forgotten, a fresh search is made, and the audit log says so.

---

### Edge Cases

- **Careers page needs JavaScript**: many careers sites (hosted job boards) render their listings
  in the browser, so the fetched page has no job links. The lookup ends with a warning saying the
  page had no readable job listings; the job falls back to the email's details.
- **The search results already include the job's own page**: the model may open it directly and
  skip the careers page (common when the careers page builds its list with JavaScript).
- **Listings split across pages**: the careers page may show only the first page of jobs. Moving to
  the next page is a placeholder in this feature: the page result says whether more pages appear
  to exist, the audit notes it, and nothing follows them.
- **Page too large even after trimming**: the content is cut at the size limit, and the audit
  notes that it was cut.
- **Search returns no results**: the lookup ends with reason "no careers page in the results"
  (its audit lists no addresses); other jobs' lookups go on.
- **SearXNG can't be used** (unreachable, an HTTP error such as 403 when its JSON output is
  switched off, or an answer in the wrong shape): treated as "search unavailable"; no further
  lookups start in that run, and the run record has a clear note naming the setting to check.
- **The model asks for an address that wasn't offered**: refused. The model can only open
  addresses from the search results it was given or links on a page it was given (see FR-008).
- **An address points at the local network or isn't a web page** (`file:`, private addresses,
  non-HTML content): refused or skipped with a note.
- **A slow or hanging site**: each fetch has a time limit; on timeout the step ends with a warning.
- **Page text that tries to instruct the model**: fetched pages are untrusted text handed to the
  model as data; the tools enforce every limit regardless of what the page says.
- **The same company appears several times in one run**: the careers page is searched for at most
  once per company per run.
- **Too many jobs to look up in one run**: lookups stop at the per-run limit; the rest wait for a
  later run and stay scored on the email's details meanwhile.

## Requirements *(mandatory)*

### Functional Requirements

**Search**

- **FR-000**: Each job's lookup MUST run as a short conversation of its own with the model,
  holding only that job, the lookup instructions and the search and fetch tools, so its context
  starts empty and stays small. Only the outcome (a description, or a reason) returns to the run;
  search results and pages never enter the agent's main conversation.
- **FR-001**: The lookup conversation MUST have a tool that searches the web for a company's careers page (the
  search text is "<company name> careers") and returns the first page of results, each as a
  title, address and short snippet.
- **FR-002**: The search server's address MUST be configurable, so it can be a SearXNG service in
  this stack or one elsewhere on the network (for example `https://search.forthebrew.com`). With no
  address configured, the lookup is off and runs behave as they do today.
- **FR-003**: The stack MUST offer an optional SearXNG service the owner can switch on, for those
  without one elsewhere.

**Fetching pages**

- **FR-004**: The lookup conversation MUST have one tool that fetches a web page and returns it trimmed for the
  model; the same tool serves the careers page and the job's page.
- **FR-005**: When the page fetched is a careers page, the tool's result MUST include the job being
  looked for (title, company, location), so the model can pick the matching link.
- **FR-006**: Every page and every search result list MUST be trimmed before it reaches the model:
  scripts, styles, navigation chrome, hidden elements, markup and attributes the model doesn't need
  are removed, keeping readable text and links (with their addresses). The trimmed result MUST
  NOT exceed a configurable size limit, with a default that leaves room for the conversation in a
  model running on a 16GB graphics card.
- **FR-007**: The trimming MUST be one shared step used by every tool that hands web content to
  the model (search results, careers page, job page), not repeated per tool.
- **FR-008**: The fetch tool MUST only open web (`http`/`https`) addresses that appeared in a
  search result or as a link in a page given to the model during this lookup, and MUST refuse
  addresses on the local network.
- **FR-009**: Each fetch MUST have a time limit and a maximum download size.
- **FR-010**: The careers-page result MUST say whether the page appears to continue on further
  pages. Following those pages is a placeholder: present in the result and the audit, not acted
  on.

**Results**

- **FR-011**: When the model has found the job's page, the job's description MUST be stored from
  that page's trimmed text, with the page's address, and the job MUST then be scored like any
  other job with a description.
- **FR-012**: A job MUST record where its description came from (careers page vs. a job source),
  so scores can be told apart later.
- **FR-013**: Jobs whose lookup fails MUST still be scored on what they already have, as today.
- **FR-014**: The run MUST start the lookups itself, not the main agent: after alert jobs are
  stored and the JSearch lookup has run, and before the agent scores, it looks up every stored
  alert job that still has no description and passes the title filter, at most a configurable
  number per run. The main agent's tools do not change.
- **FR-015**: A company's careers page MUST be searched for at most once per run and, once found,
  remembered for later runs (P3); a remembered page that fails to load is forgotten.

**Audit log**

- **FR-016**: Every lookup step MUST write an audit entry: the job and company, the step (search,
  remembered page offered, careers page opened, job page opened, finish), the addresses involved,
  the trimmed size, and the outcome. Entries MUST NOT contain page text or email text.
- **FR-017**: A lookup that ends without a description MUST write a warning entry with the reason,
  one of a fixed set: no careers page in the results, careers page unreadable, job not found on
  the page, job page unreadable, fetch refused, timed out, gave up (the lookup's step or time
  limit ran out), lookup error (the model server or the database failed during the lookup),
  search unavailable. A lookup error never stops the run or the alerts source; the next job's
  lookup still starts.
- **FR-018**: The audit log MUST be stored in the database, one row per lookup step, kept across
  runs, and queryable by company, warning reason and date without the web UI.

**Reuse**

- **FR-019**: The lookup MUST take only a job's title, company and (optional) location, and return
  a description or a reason, so any source (job boards, saved searches) can use it later without
  changes to the lookup itself. In this feature only alert jobs use it.

### Key Entities

- **Careers lookup**: one attempt to find one job's description, run as its own short
  conversation with the model. Holds the job sought (title, company, location), the steps taken
  and the outcome (description found, or a reason).
- **Audit entry**: one step of a lookup, with time, step, addresses, trimmed size, outcome, and a
  warning flag.
- **Remembered careers page**: a company name and the address of its careers page, with when it
  was found and last used.
- **Trimmed page**: the readable text and links of a fetched page, its address, whether it was
  cut, and whether it appears to continue on further pages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the first week of use, at least half of the alert jobs that pass the title
  filter get a description from a careers page, and none of them score 0 only because the
  description was missing.
- **SC-002**: No search result list or page handed to the model exceeds the configured size
  limit; with the default limit, a whole lookup (search, careers page, job page) fits in the
  context of a model served from a 16GB graphics card.
- **SC-003**: Every lookup that ends without a description has a warning in the audit log with
  one of the fixed reasons, so 100% of failures can be counted by reason.
- **SC-004**: A company whose careers page was already found costs no new search on later runs.
- **SC-005**: With search not configured, runs finish with the same results as before this
  feature.
- **SC-006**: Moving a job board onto this lookup later needs no change to the search, fetch,
  trimming or audit parts, only a call from that source.

## Assumptions

- The careers lookup supplements the JSearch lookup from feature 007 (clarified 2026-10-16): it
  runs for alert jobs that still have no description after JSearch. Dropping JSearch for alert
  jobs is a later decision once SC-001 and the JSearch trace counts can be measured.
- The lookup steps are tools the model calls (as the owner described), inside each job's own
  lookup conversation (FR-000), not a fixed pipeline; the code enforces the address, size and
  per-run limits.
- Fetching is a plain web request (no browser). Careers sites that need JavaScript are out of
  scope and show up in the audit log as "careers page unreadable".
- Following careers-page pagination is out of scope (placeholder only, FR-010).
- When the careers page turns out to be a job board myjobbot already supports (Greenhouse, Lever,
  Ashby), using that board's API is out of scope; it is noted for a later feature.
- The audit log is read by database query in this feature; a web view of it is out of scope.
- The default per-run lookup limit and size limit are set in the plan from measured page sizes;
  both are owner-configurable.
- The owner's SearXNG server has JSON output switched on; the optional bundled service ships with
  it on.
- Migrating job boards and saved searches onto the lookup is a later feature (FR-019 keeps that a
  one-call change).
- Lookups run when the alerts source is fetched (FR-014). In a run where Gmail can't be read,
  the alerts source isn't fetched, so no lookups run, even for alert jobs stored earlier; they
  wait for the next run where Gmail is readable.
- A lookup that failed because of a temporary problem (lookup error, or search unavailable) is
  tried again in a later run; any other ending counts as the job's one attempt.
