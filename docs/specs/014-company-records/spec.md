# Feature Specification: Company records

**Feature Branch**: `014-company-records`

**Created**: 2026-10-23

**Status**: Draft

**Input**: GitHub issue #27, "Start storing all companies we get for future data caching": "We need
to start keeping a table of companies we find. For this v1 we need to do the following: 1. Create a
new database table called 'companies'. It should have a unique id, the company name, the company
website url, careers page url, created_date, last_found_date. 2. As part of both the company api
queries, the jsearch results, and the linked in emails we want to check for the company and if they
are not in the database use the SearXNG database to find the company URL and the company career page
url. 3. Update any existing tables to use the company ID as a reference to link them to a company.
Important: 1. Even excluded companies need to be cached even though we won't show jobs from them."

## Overview

myjobbot finds jobs from three kinds of source: the configured company job boards (Greenhouse,
Lever, Ashby), JSearch searches, and LinkedIn alert emails read from Gmail. Today a company exists
only as a name written on each job. The one thing remembered per company is the careers page that
led to a found job in the careers lookup (feature 008), keyed by the normalized company name.

This feature gives every company myjobbot meets a record of its own: a stable id, its name, its
website and careers page addresses, when it was first recorded and when it was last found. Each run
records the companies behind the jobs it finds, and for a company it hasn't met before it searches
the owner's SearXNG instance for the company's website and careers page. Jobs (and other stored rows
that name a company) point at the company's record. Companies the owner excludes are recorded too,
so the cache is complete even though their jobs stay hidden.

This is v1 of a cache that later features build on; it adds no new screen.

## Clarifications

### Session 2026-10-23

- Q: How should feature 008's remembered careers pages relate to the company record? → A: Fold
  them in: the remembered pages move into the company record's careers page address and the
  separate store goes away, so there is one careers address per company, used by both the careers
  lookup and the cache.
- Q: How are the website and careers page chosen from SearXNG results? → A: By rules, with no model
  calls: free and fast, sometimes wrong or empty.
- Q: What happens to jobs already stored when this feature is installed? → A: Backfill at upgrade:
  a record is created for every company among the stored jobs and every job is linked; their
  addresses are searched over the following runs, within the per-run limit.
- Q: How many companies should one run search SearXNG for at most, by default? → A: 50 per run,
  set in the config file.
- Q: How should a search result be chosen as a company's website and as its careers page, using
  fixed rules and no model? → A: Website: the first result for "<company>" whose host's main name
  contains the company's normalized name, skipping aggregator hosts. Careers page: the first result
  for "<company> careers" on the website's host (or a subdomain) with "career" or "jobs" in its
  address or title, or a recognized job board page (Greenhouse, Lever, Ashby, Workday) for that
  company; otherwise empty. Every company whose careers page (or website) can't be resolved is kept
  track of, with why, so the owner can dig into the misses.
- Q: For a company configured as a job board, should its board address be its careers page outright,
  instead of searching for one? → A: Yes: the configured board's address becomes the careers page at
  once and is never replaced by a search result; only the website is searched.

## Delivery

As with earlier features, this ships as **small pull requests** (about 10 files each, tests
included), each merged and tried before the next. The split is decided in the plan; a likely order
is: the companies record and linking jobs to it (US1), then the address search (US2).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every company found is recorded once (Priority: P1)

When a run finds jobs, from any source, each job's company is recorded once, however many jobs it
has and whichever sources they came from. A company already recorded keeps its record; its "last
found" time moves forward. Every stored job is linked to its company's record. Companies on the
owner's exclusion list are recorded and linked the same way; their jobs stay hidden as today.

**Why this priority**: It's the foundation the issue asks for: one place that lists every company,
which later features cache data against.

**Independent Test**: Run with a configured board, a JSearch search and an alert email that between
them name the same company twice and an excluded company once. Afterwards there is exactly one
record per company (excluded one included), each job points at its company's record, and the
excluded company's jobs still don't appear in Recommended.

**Acceptance Scenarios**:

1. **Given** no record for "Acme", **When** a run stores a job from Acme, **Then** a record for
   Acme exists with its created and last-found times set to the run's time, and the job points at it.
2. **Given** a record for "Acme Inc", **When** a later run finds a job from "ACME, Inc.", **Then**
   no new record is made, the job points at the existing record, and its last-found time is the
   later run's time.
3. **Given** "Acme" is on the exclusion list, **When** a run finds an Acme job, **Then** Acme is
   recorded and the job linked, and the job is not shown in Recommended or scored, as today.
4. **Given** jobs from the same company arrive from a board, a JSearch search and an alert email in
   one run, **When** the run ends, **Then** there is one record for that company.

---

### User Story 2 - New companies get their website and careers page found (Priority: P2)

For a company recorded for the first time, myjobbot searches the owner's SearXNG instance and
stores the company's website address and careers page address on its record. A company whose
addresses were already found is not searched again.

**Why this priority**: The addresses are the data worth caching; but recording companies (US1) is
useful without them, and the search depends on SearXNG being configured.

**Independent Test**: With SearXNG configured, run against a source with a company never seen
before. Its record ends up with a website and a careers page address. A second run that finds the
same company makes no further search for it.

**Acceptance Scenarios**:

1. **Given** a new company and SearXNG configured, **When** the run records it, **Then** its record
   holds the company's website and careers page addresses found through SearXNG.
2. **Given** a company whose addresses are already recorded, **When** a later run finds it again,
   **Then** no search is made for it.
3. **Given** SearXNG is not configured or not reachable, **When** a run finds new companies,
   **Then** they are still recorded and linked with no addresses, the run carries on, and the
   missing search is noted in the run's trace.
4. **Given** the search finds no usable website or careers page, **When** the run ends, **Then** the
   address stays empty rather than holding a guess, and the company is searched again on a later
   run per FR-010.
5. **Given** an excluded company is new, **When** the run records it, **Then** it is searched like
   any other new company.

---

### Edge Cases

- Names that differ only in case, punctuation or a trailing legal suffix ("Acme", "ACME Inc.",
  "Acme, LLC") are one company, matching how the careers lookup and alert matching already compare
  names. Two different companies with the same name are one record (accepted for v1).
- A job whose company name is empty or has no letters or digits gets no company link and no record.
- Jobs already stored before this feature are backfilled at upgrade (FR-011).
- Pruning: jobs are deleted after `job_retention_days`; company records are kept when their jobs go,
  since the record is the cache.
- A found address must be a public `http(s)` web address; a job-board aggregator host (the careers
  lookup's `skip_hosts`, e.g. linkedin.com, indeed.com) is never recorded as a company's website or
  careers page.
- The careers lookup (feature 008) finding a careers page that led to a job: see FR-009.
- SearXNG becomes unusable partway through a run: remaining new companies are recorded without
  addresses and searched on a later run, with "search not available" as their outcome (FR-015).
- A company with a website but no careers page counts as unresolved: it is searched again per
  FR-010, and its outcome says why the careers page wasn't found.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST keep a company record holding: a unique id, the company's name, its
  website address, its careers page address, when it was created, and when it was last found. Both
  addresses may be empty.
- **FR-002**: Every run MUST record the company of each job it stores, from every source: configured
  boards, JSearch searches (including the alert lookup's searches) and LinkedIn alert emails.
- **FR-003**: Companies MUST be matched by their normalized name (case, punctuation and a trailing
  legal suffix ignored), the same comparison myjobbot already uses for company names; one normalized
  name has exactly one record.
- **FR-004**: When a run finds a company already recorded, it MUST update that record's last-found
  time and MUST NOT create another record. The record's name stays as first recorded.
- **FR-005**: Companies on the owner's exclusion list MUST be recorded, linked and searched like any
  other; excluding a company continues to keep its jobs out of scoring and the job tables.
- **FR-006**: Each stored job MUST be linked to its company's record. The careers lookup's remembered
  careers pages (feature 008) MUST be folded into the company record: each remembered page becomes
  its company's careers page address, the separate store is retired, and the careers lookup reads,
  refreshes and forgets the careers page on the company record instead.
- **FR-007**: For a company with no addresses yet, the system MUST search the owner's SearXNG
  instance for its website and careers page and store what it finds on the record. Results MUST be
  chosen by fixed rules, with no model calls: the same results always give the same addresses, and
  when no result passes the rules the address stays empty. The rules:
  - **Website**: the first result of a search for the company's name whose host's main name (the
    part before the public suffix, e.g. `acme` in `www.acme.co.uk`) contains the company's
    normalized name with its spaces removed, skipping `skip_hosts`.
  - **Configured boards**: for a company configured as a job board, the board's own address is its
    careers page from the run that first records it, and a search never replaces it; only its
    website is searched. A company later removed from the config keeps the address it has.
  - **Careers page**: for any other company, the first result of a search for "<company name>
    careers" that is either on the website's host or one of its subdomains, with "career" or "jobs"
    in its address or title, or a recognized job board page (Greenhouse, Lever, Ashby, Workday)
    whose board names this company. A careers page can be found even when no website is.
- **FR-008**: Only public `http(s)` addresses may be stored, and never an address on a host in the
  careers lookup's `skip_hosts`. Search results never reach the model in this feature.
- **FR-009**: When the careers lookup finds a careers page that led to a job, that page MUST become
  (or stay) the company's careers page address, replacing one found by search (but never a
  configured board's address, FR-007); when the lookup finds
  the remembered page no longer works, the company's careers page address is cleared (as the
  remembered page is forgotten today) and is searched for again per FR-010.
- **FR-010**: A company whose search found nothing, or whose search could not run, MUST be searched
  again on a later run that finds it, at most once per day per company, so a run doesn't repeat
  failed searches.
- **FR-011**: Jobs already stored when this feature is installed MUST be linked to company records at
  upgrade time: one record per company among them (created time = the earliest first-seen of its
  jobs, last-found time = the latest last-seen), with the careers page taken from the configured
  board (for a board company) or any remembered careers page, and otherwise searched over the following runs within FR-012's limit.
- **FR-012**: Company searches in one run MUST be bounded by a per-run limit on the number of
  companies searched, set in the config file with a default of 50, so a run that meets many new
  companies stays within its time budget; companies over the limit are searched on later runs, the
  ones found most recently first.
- **FR-013**: Pruning old jobs MUST NOT delete company records.
- **FR-014**: The run's trace MUST record each company search (company, whether it found a website
  and a careers page, or why not), without page text.
- **FR-015**: Each company record MUST keep the outcome of its last search, so the owner can list
  every company whose careers page (or website) could not be resolved and see why: for each missing
  address, one fixed reason (search not available, no results, no result passed the rules) and up to
  five of the result addresses the rules turned down. Only addresses and these reasons are kept,
  never page text. The outcome is replaced by the next search, and cleared when an address is set
  another way (FR-009).

### Key Entities

- **Company**: a business myjobbot has found jobs from, kept in the `companies` table the issue
  names. Id, name (as first seen), website address, careers page address, created time, last-found
  time, when its addresses were last searched, and the outcome of that search (per missing address:
  a reason and the turned-down result addresses). One per normalized name.
- **Job** (existing): gains a link to its Company; keeps its company name as received from the
  source.
- **Remembered careers page** (existing, feature 008): retired; its address becomes the Company's
  careers page address.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After any run, 100% of stored jobs with a company name are linked to a company record,
  and no normalized company name has more than one record.
- **SC-002**: Excluded companies' jobs are recorded and linked, and none of them appear in
  Recommended or are scored.
- **SC-003**: With SearXNG available, a newly found company is searched in the run that first finds
  it (within the per-run limit) and at most once per day after that until something is found; a
  company with both addresses found is never searched again.
- **SC-004**: A run with SearXNG unavailable completes and records every company it found.
- **SC-005**: On a sample of 20 newly found well-known companies, the stored website is the
  company's own site for at least 16, at most 2 hold a wrong site (the rest are empty), and no
  stored address is a job aggregator.
- **SC-006**: Every company left without a careers page after a search can be listed from the
  database with a reason, and, for "no result passed the rules", the addresses that were turned
  down.

## Assumptions

- "The company api queries" means the configured company boards (`companies` in the config:
  Greenhouse, Lever, Ashby).
- "The SearXNG database" means the owner's SearXNG instance (`MYJOBBOT_SEARXNG_URL`), already used
  by the careers lookup.
- Jobs keep their company name text; the link is added alongside it, so the job tables and filters
  work unchanged.
- Times are stored as UTC, like every other time in myjobbot.
- No screen shows companies in v1; the records are seen through the database and the run's trace.
- "Update any existing tables" covers the three kinds of stored record that name a company today:
  jobs are linked (FR-006), the careers lookup's remembered careers pages are folded into the
  company record (FR-006), and the careers audit log is left as it is (next point). Scoring verdicts,
  the API call log and the Gmail connection and alert state name no company, so they need no link.
- The careers audit log keeps the company name as written; it is kept only for the retention window
  and needs no link.
- The owner can correct a wrong address later only by editing the database in v1.
