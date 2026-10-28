# Feature Specification: Modular job sources

**Feature Branch**: `017-modular-job-sources`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Modular job sources. Every job source becomes a code-shipped module implementing one interface; users' saved sources move into their own table; a Workday module is added; the Settings page's Sources section is rebuilt around adding a source from a module."

## Overview

myjobbot reads jobs from three kinds of source today:
- **company boards**: one company's feed on Greenhouse, Lever or Ashby;
- **saved searches**: JSearch queries across many job sites;
- **Gmail alerts**: LinkedIn alert emails.

Each kind is wired in separately, with its own way to fetch, to page, to count against a budget and to be configured. Adding a new platform means touching all of those places. The owner's boards and searches are two lists inside the search settings document. A board ties to its company record only by name.

This feature makes every source a **module**: a piece of the app, shipped with it, that knows how to read one platform. Every module answers the same questions:
- what it is called and what it reads;
- what a saved source of it needs (a company's board id, a search query);
- how to recognise a pasted link;
- what it requires, and what limits and costs apply;
- how to fetch jobs a page at a time;
- how to test a saved source;
- which company a saved source belongs to.

Everything after a module is shared: turning what a source returned into job rows, spotting repeats, linking company records, filtering, and capping descriptions.

The owner's **saved sources** (each board and each saved search) become rows of their own, one per source, belonging to the owner. On the Settings page the owner adds a source by choosing a module, or by pasting a link that a module recognises. They fill in what that module needs, and the source is tested when it is saved.

The modules in this feature:
- Greenhouse, Lever, Ashby, JSearch and Gmail alerts, moved onto the common interface;
- a new **Workday** module, for companies whose jobs are on Workday.

Modules are always written as part of the app; the owner creates saved sources, never modules. Reading websites that publish no data (scraping) is out of scope, but the module interface leaves room for it.

## Clarifications

### Session 2026-10-28

- Q: Is a source whose test fetch fails on save refused, or saved but marked as failing? → A: Saved,
  and marked as failing until a fetch works.
- Q: Does the model still choose which sources to fetch during a run, or does the run fetch every
  source first? → A: The owner decides. They keep a list of their added sources and turn each on or
  off; every source that is on is fetched on each run, and the model doesn't choose.
- Q: Is each saved source added and edited on its own, or is the whole list saved together? → A: On its
  own. Each source has its own form, Save and test; the list shows them all, with on/off and delete
  per row.
- Q: When a source has more postings than its per-run limit, does the next run continue or start
  again? → A: Continue. Each source remembers where it stopped, and the next run picks up there,
  going back to the first page once it has been through them all.
- Q: Can the owner set how often each saved source is fetched? → A: No. Each module's schedule applies
  to all its sources: boards every run, JSearch searches at most every `jsearch.refresh_hours`, which
  stays an app-wide runtime setting.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a company board by pasting its link (Priority: P1)

The owner finds a company they want to watch, opens its jobs page, copies the address and pastes it into Settings. myjobbot recognises the platform (Greenhouse, Lever, Ashby or Workday) and fills in what it needs. It tests the source and saves it. The next run fetches that company's jobs.

**Why this priority**: Today adding a board means knowing the platform and the board id. Pasting a link removes the guesswork, and it is the main thing the owner asked for.

**Independent Test**: Paste `boards.greenhouse.io/stripe`, `jobs.lever.co/palantir`, `jobs.ashbyhq.com/openai` and a Workday jobs address. Check that each is recognised as the right platform, with its fields filled in, tested and saved, and that the next run stores jobs from each.

**Acceptance Scenarios**:

1. **Given** the Settings page, **When** the owner pastes a recognised board link, **Then** the platform and its fields are filled in, and a name is suggested: the board's company id, or Workday's company, capitalised (`stripe` → "Stripe").
2. **Given** a recognised link, **When** the owner saves it, **Then** the source is tested by fetching its first page. It is saved, and the page says how many jobs the test found, or, when the test fails, that the source is failing and why.
3. **Given** a link no module recognises, **When** the owner pastes it, **Then** the page says which platforms are supported and offers to fill in a source by hand.
4. **Given** a saved board, **When** the next run starts, **Then** it fetches that board's jobs and stores them as from that source.
5. **Given** a Workday link, **When** it is saved and fetched, **Then** every posting on that Workday site is fetched, page after page, within the module's per-run limit.

---

### User Story 2 - Existing boards and searches keep working (Priority: P1)

The owner's current boards and saved searches become saved sources without anything being typed again. Their jobs keep their history: scores, verdicts, hidden and applied marks.

**Why this priority**: Without it the move loses the owner's working setup.

**Independent Test**: Start from the owner's current settings. After the upgrade, check that there is one saved source for each existing board and search, with the same names and fields. Check that a run fetches the same jobs, and that Recommended shows the same jobs in the same order.

**Acceptance Scenarios**:

1. **Given** boards and searches in the stored search settings, **When** the upgrade runs, **Then** each becomes a saved source of its module with the same name and fields, and they no longer appear in the settings document. Two entries pointing at the same board become one source, keeping the first one's name.
4. **Given** a fresh install with no search settings stored, **When** the upgrade runs, **Then** it does nothing and stops nothing.
2. **Given** jobs already stored from a board or search, **When** the upgrade runs, **Then** each stays linked to the saved source it came from, with its scores, verdicts and marks unchanged.
3. **Given** the upgrade has run, **When** it runs again, **Then** nothing changes.

---

### User Story 3 - Manage saved sources (Priority: P2)

The owner sees every saved source in one list on the Settings page: boards, searches and Gmail alerts. For each they see its platform, its name, whether it is on, and when it was last fetched and with what result. They can edit a source, turn it off without deleting it, or delete it.

**Why this priority**: Once sources are their own rows, the owner needs to manage them. Turning one off is the safe way to stop fetching without losing it.

**Independent Test**: Turn a board off and run: nothing is fetched from it, and its jobs stay. Turn it on: it is fetched again. Delete it: it is gone from the list, and its jobs stay.

**Acceptance Scenarios**:

1. **Given** saved sources, **When** the owner opens Settings, **Then** each is listed with its platform, name, on/off state, last fetch time and outcome.
2. **Given** a source turned off, **When** a run starts, **Then** it is not fetched, and its stored jobs keep being shown.
3. **Given** a source is edited (its board id, its query), **When** it is saved, **Then** it is tested again, and the next run uses the new fields.
4. **Given** a source is deleted, **When** the owner confirms, **Then** it is removed. Its stored jobs stay until they age out, as jobs from a removed board do today.

---

### User Story 4 - Saved searches as sources (Priority: P2)

The owner adds, edits and removes JSearch searches the same way as boards. JSearch's key and its monthly request budget stay app-wide, and the page says how much of the month's budget is used.

**Why this priority**: Searches are the other half of the owner's sources, and they should not need their own place in the UI.

**Independent Test**: Add a JSearch search, save it, and check the test used one request from the budget. Then check the page shows the budget used this month, and that a run refreshes the search on its usual schedule.

**Acceptance Scenarios**:

1. **Given** no JSearch key is configured, **When** the owner adds a JSearch search, **Then** the page says the key is required and can't test it.
2. **Given** searches that would exceed the monthly budget at their refresh schedule, **When** the owner saves one more, **Then** it is refused with the budget message.
3. **Given** a saved search, **When** a run starts, **Then** it is refreshed no more often than its schedule allows, and each request counts against the app-wide budget.

---

### User Story 5 - Gmail alerts as a source (Priority: P3)

Gmail alerts appears in the list of sources once Gmail is connected. It can be turned off and on like any other source. Connecting and disconnecting stay in the Gmail panel.

**Why this priority**: It completes the single list of sources, but Gmail already works.

**Independent Test**: With Gmail connected, check that the alerts source is listed and on. Turn it off and run: no emails are read. Turn it on: they are read again.

**Acceptance Scenarios**:

1. **Given** Gmail is connected, **When** the owner opens Settings, **Then** Gmail alerts is listed as a source. On an install that connects Gmail for the first time, connecting creates it, on.
2. **Given** Gmail alerts is turned off, **When** a run starts, **Then** no alert emails are read.

---

### Edge Cases

- **A test fetch on save fails**: the board id doesn't exist, the site is down, or the key is wrong. The
  source is still saved, and is marked as failing with the reason until a fetch works. The owner can
  fix it, turn it off or delete it.
- **A test fetch finds no jobs**: the source is saved, and the page says it found none (a company can have no openings).
- **Two saved sources with the same name**: refused, as duplicate source names are today.
- **A source named "Gmail alerts"**: refused, as today.
- **Two saved sources pointing at the same board**: refused, naming the existing one.
- **A source fails during a run**: the run notes it, records the outcome on the source, and moves on to the next one.
- **A module is removed from the app in a later version**: its saved sources stay, shown as unavailable, and are not fetched.
- **A Workday site with thousands of postings**: fetched page by page up to the module's per-run limit.
  The source remembers where the run stopped, and the next run continues from there. Once every
  page has been read, the next run starts again from the first page.
- **A source's postings change between runs** (new ones added, old ones closed): the place a source
  continues from may shift. A posting may be read twice or wait until the next pass, but it is never
  lost for good, and a posting read twice is stored once.
- **A pasted link that matches a specific posting** (`.../jobs/12345`): it is recognised as that company's board, not the posting.
- **Fallback for bad stored values** (feature 015): a saved source whose fields no longer pass its module's checks is shown with the problem and is not fetched until fixed. The other sources keep working.
- **Saved search settings still holding `companies` or `searches`** after the upgrade: they are not used, and the page notes they can be ignored, as for `config.json` today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every job source MUST be a module shipped with the app. A module states:
  - a stable id, a name and a description;
  - its kind: `ats`, `api`, `email`, and later `web`;
  - its scope: one company, a query across many, or an account;
  - the fields a saved source of it needs, and the rules those fields must pass;
  - the links it recognises, and the fields each one gives;
  - what it requires before it can be used (an API key, a connection);
  - its limits: a page size, a maximum per run, a refresh interval and a budget;
  - how to fetch jobs a page at a time, with the cost of each page;
  - how to test a saved source;
  - which company a company-scoped saved source belongs to.
- **FR-002**: The app MUST ship these modules: Greenhouse, Lever, Ashby, Workday, JSearch and Gmail alerts. Each MUST read what it reads today, Workday being new.
- **FR-003**: Everything after a module (turning what it returned into job rows, spotting repeats, linking company records, title filtering, excluded companies and publishers, description caps, keeping outside text inside the data markers) MUST be shared by all modules, not written per module.
- **FR-004**: The owner's saved sources MUST be stored one per row, each belonging to a user and holding its module, its name, its fields, whether it is on, and when it was last fetched and with what outcome.
- **FR-005**: Saved sources MUST be added, edited, turned off and on, and deleted on the Settings page. Each is added by choosing a module and filling its fields, or by pasting a link a module recognises.
  Each source is added and edited on its own, with its own form, Save and test, so one source's
  problem never holds up another. The list shows every source, with on/off and delete on each row.
- **FR-006**: Saving a source MUST check its fields against its module's rules and the cross-source rules: unique names, the reserved "Gmail alerts" name, no duplicate board, and the JSearch budget. It MUST also run the module's test fetch.
- **FR-007**: A run MUST fetch every saved source that is on and whose module is available, by page and within each module's limits. A source that fails MUST NOT stop the run; its outcome MUST be recorded on the source.
- **FR-007a**: When a run reaches a source's per-run limit before its last page, the source MUST
  remember where it stopped, and the next run MUST continue from there. After its last page, the next
  run MUST start again from the first. Turning a source off and on, or editing its fields, MUST start
  it again from the first page.
- **FR-008**: The upgrade MUST move the owner's existing boards and saved searches into saved sources, unchanged, and MUST keep every stored job linked to the source it came from, with its scores, verdicts and marks. It MUST run once, and running it again MUST change nothing.
- **FR-009**: JSearch MUST stay app-wide: one API key and one monthly request budget for the app. Each saved search is the owner's own saved source.
- **FR-009a**: How often a saved source is fetched MUST come from its module's schedule, the same for
  all of that module's sources: every run for company boards, and at most every
  `jsearch.refresh_hours` (an app-wide runtime setting) for JSearch searches. Saved sources MUST NOT
  have a refresh setting of their own.
- **FR-010**: Gmail alerts MUST be a source of the owner's account. It appears once Gmail is connected and can be turned off and on; connecting stays in the Gmail panel.
- **FR-011**: The careers lookup MUST read company boards through the same modules (Greenhouse, Lever, Ashby, Workday), instead of a separate copy of each reader.
- **FR-012**: A company-scoped saved source MUST link to its company record directly, not only by name. The company record's careers page comes from the module.
- **FR-013**: Modules that read websites publishing no data (scraping) MUST NOT be part of this feature. Adding one later MUST need no change to the module interface or the saved sources.
- **FR-014**: Every request a module makes MUST go through the app's existing network rules: public addresses only, checked again on redirects, rate-limited per host.
- **FR-015**: Saved sources MUST belong to a user, as search settings do (feature 015), and every read and change is for the owner. No sign-in is added.
- **FR-016**: Which sources are fetched MUST be the owner's choice, made by turning each saved source on
  or off. Each run MUST fetch every source that is on, within its module's limits; the model MUST NOT
  choose which sources to fetch, and only scores what was fetched.
- **FR-017**: A source whose test fetch fails on save MUST still be saved, and MUST be marked as failing,
  with the reason, until a fetch of it works.

### Key Entities

- **Source module**: a part of the app that reads one platform. It has an id, a name, a description, a kind, a scope, the fields a saved source needs, the links it recognises, its requirements and its limits. It knows how to fetch, test and name a saved source's company. Modules are never stored and never made by the owner.
- **Saved source**: one source the owner has set up. It records which module it uses, its name, its fields, whether it is on, when it was last fetched and with what outcome, and for a company-scoped source, its company record. It belongs to a user.
- **Fetch outcome**: what a source's last fetch did: when it ran, how many jobs it found, what it cost, why it failed when it did, and where it stopped when it reached its per-run limit.
- **Job** (unchanged in meaning): each job records the saved source it came from.
- **Company record** (feature 014): a company-scoped saved source points at it, and gives it its careers page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can add a company board by pasting its link and saving, in under 30 seconds, without knowing the platform or the board id.
- **SC-002**: After the upgrade, every existing board and search is a saved source with the same name and fields. Recommended shows the same jobs in the same order.
- **SC-003**: A link from each supported platform (Greenhouse, Lever, Ashby, Workday) is recognised correctly, including links to a single posting.
- **SC-004**: A Workday company's jobs are fetched completely across pages, up to the per-run limit, on its first run.
- **SC-005**: One failing source never stops a run. Every other source that is on is still fetched, and the failure is shown on that source.
- **SC-006**: A new company-board platform is added by writing one new module, with no change to the run, the job pipeline, the saved sources or the Settings page.
- **SC-007**: Turning a source off stops it being fetched from the next run, with none of its stored jobs lost.

## Assumptions

- There is one user, the owner, as in features 015 and 016. Saved sources belong to them and are ready for more users.
- The JSearch key stays in `.env` and its monthly budget in `config.json`'s runtime settings, both app-wide.
- The board readers for Greenhouse, Lever and Ashby already read what the app needs. Moving them onto modules changes how they are organised, not what they fetch.
- Workday sites publish their postings as paged data at a fixed address. The careers lookup already reads it, for single postings and title searches.
- Modules are added by writing code; there is no plugin system or upload.
- The Settings page keeps feature 016's way of saving, with problems shown beside their field. The Sources section is the part rebuilt.
- Stored jobs keep their history through the move. Job ids and boards are unchanged, only how a job points at its source.
- Delivery follows the owner's usual small PRs, each tried before the next.
