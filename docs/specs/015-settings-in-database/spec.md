# Feature Specification: Search settings in the database

**Feature Branch**: `015-settings-in-database`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Move the settings in `data/config.json` into a settings table in the
database, so `config.json` is no longer needed." Narrowed by the owner in clarification: "app
runtime configs should stay in config.json. User filtering, boosts, etc. go into the database."

## Overview

myjobbot's settings live in `data/config.json`, a file in the data folder that both the agent and
the web UI read. The agent reads it once at the start of each run; the web UI reads it again on
every page load. The file is checked when it is read, and a bad value stops the run (or shows the
web UI's error page) with a message naming what is wrong.

The file mixes two kinds of setting:
- **Search settings**: what the owner is looking for and how jobs are filtered and ranked. These
  are the sources (`companies`, `searches`), the free-text `preferences`, `match_threshold`,
  `title_filter`, `title_boosts`, `exclude_companies` and `jsearch.exclude_publishers`.
- **Runtime settings**: how the app runs. These are the limits and tuning for the agent, HTTP,
  JSearch (its monthly cap, refresh timing and posting window), the careers lookup and the company
  search, plus the job lifetimes (`ghost_threshold_days`, `job_retention_days`) and the Gmail alert
  senders.

Search settings are the owner's own data: they change as the search goes on, and a later feature
lets the owner edit them on the Settings page. This feature moves them into the database, beside
everything else the owner's search has produced. Runtime settings stay in `config.json`: they are
the app's tuning, set once and changed with the code.

The resume (`data/resume.md`), the secrets and connection details in `.env`, and the database
connection itself stay where they are.

myjobbot has one user today, but is meant to grow into a multi-user system. Search settings are the
first per-person data to move into the database, so they are stored as belonging to a user from the
start. This feature has exactly one user, the owner, and adds no sign-in or second user. It only
makes sure a later multi-user feature can give each user their own search settings without moving
these again.

## Clarifications

### Session 2026-10-25

- Q: What happens to the existing `data/config.json`? → A: Its search settings are imported once,
  automatically, at upgrade: when no search settings are stored and the file has any, they are
  checked and copied in. After that the file's search settings are ignored, with no fallback, and the
  owner is told they can be removed from the file. Its runtime settings stay in use.
- Q: How does the owner change settings in this feature? → A: Search settings change through
  command-line export and import. Export writes the stored search settings to a JSON file, in the
  same shape those keys have in today's `config.json`. Import checks an edited file as a whole and
  replaces the stored search settings, or changes nothing. Editing on the Settings page is a later
  feature. Runtime settings are still changed by editing `config.json`.
- Q: What happens when stored search settings fail the checks at load (for example, after an
  upgrade tightens a rule)? → A: Each bad setting falls back on its own, with a warning, and runs
  keep going. Imports are still checked as a whole and refused when invalid.
- Q: Which settings move to the database? → A: Only the search settings: `companies`, `searches`,
  `preferences`, `match_threshold`, `title_filter`, `title_boosts`, `exclude_companies` and
  `jsearch.exclude_publishers`. Everything else stays in `config.json` as runtime settings.
- Q (owner, 2026-10-25): Should this be designed for a future multi-user system? → A: Yes. Search
  settings belong to a user from the start; this feature has one user, the owner, and no sign-in.
  Runtime settings stay app-wide.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Runs and pages read search settings from the database (Priority: P1)

The owner's search settings are stored in the database. Every agent run and every web page uses the
stored search settings, with the same meaning, defaults and checks as today, together with the
runtime settings from `config.json`.

**Why this priority**: This is the feature. Everything else is about getting search settings in and
changing them.

**Independent Test**: Store search settings in the test database and use a `config.json` that holds
runtime settings only. Then check two things:
- An agent run uses the stored sources, thresholds and filters, and the file's limits.
- The web pages (Recommended, All jobs, the job details panel, the Gmail panel's alert check) score
  and filter exactly as they would with the same values all in the file.

**Acceptance Scenarios**:

1. **Given** valid search settings are stored and `config.json` holds only runtime settings,
   **When** a run starts, **Then** it uses both and finishes as it would have with every value in
   the file.
2. **Given** valid search settings are stored, **When** the owner opens Recommended, **Then** jobs
   are scored, filtered and boosted using the stored `match_threshold`, `title_filter`,
   `title_boosts` and `exclude_companies`.
3. **Given** a stored search setting is left unset, **When** it is read, **Then** the same default
   applies that applies today when the key is missing from the file.
4. **Given** search settings were changed in the database between two page loads, **When** the
   second page loads, **Then** it uses the changed settings, as a file edit does today.
5. **Given** search settings change while a run is in progress, **When** the run continues, **Then**
   it keeps the settings it started with. The next run uses the new ones.

---

### User Story 2 - Existing search settings carry over (Priority: P1)

The owner already has a working `config.json`: 2 searches, 10 title boosts, 5 excluded companies
and a preferences text, alongside their runtime tuning. When they upgrade, the search settings end
up in the database unchanged, the runtime settings keep working from the file, and nothing has to be
typed in again.

**Why this priority**: Without it the upgrade loses the owner's working setup.

**Independent Test**: Start from a database with no stored search settings and an existing
`config.json`. Start the agent or the web UI. Then compare what is stored with the file's search
settings, value by value, and check that a run gives the same result as before the upgrade.

**Acceptance Scenarios**:

1. **Given** a valid `config.json` and no stored search settings, **When** the agent or the web UI
   first reads its settings (a run, or a page load), **Then** every search setting in the file is stored as it was, unset ones stay unset so
   their defaults apply, and the runtime settings are not copied.
2. **Given** the agent and the web UI first read their settings at the same time on an upgraded
   database, **When** both find the file, **Then** its search settings are imported exactly once.
3. **Given** a `config.json` whose search settings are invalid and no stored search settings,
   **When** the import is tried, **Then** nothing is stored and the message names each bad value the
   way loading the file does today. The import is tried again on the next start, so fixing the file
   is enough.
4. **Given** search settings are already stored, **When** the agent or the web UI starts with
   search settings still in `config.json`, **Then** the file's search settings are not used, and
   the owner is told they are no longer used and can be removed from the file.

---

### User Story 3 - The owner changes search settings (Priority: P2)

Once search settings live in the database, editing them in the file no longer changes anything. The
owner needs another way to change them, for example to add a search, tune a title boost or raise
the match threshold. In this feature, the owner exports the stored search settings to a JSON file,
edits it and imports it back, all from the command line. The file has the same shape those keys
have in today's `config.json`. Editing on the Settings page is a later feature.

**Why this priority**: Without a way to change search settings, the owner's only option is to edit
the database by hand.

**Independent Test**: Export, change one value, import. Then check two things: the next page load
or run uses the new value, and an invalid file is refused with nothing changed.

**Acceptance Scenarios**:

1. **Given** stored search settings, **When** the owner exports them, **Then** the file holds every
   stored value and leaves unset values out, so their defaults still apply after a round trip.
2. **Given** an exported file with the match threshold changed to a valid value, **When** the
   owner imports it, **Then** the stored search settings are replaced by the file's, and the next
   page load scores with the new threshold.
3. **Given** a file that breaks a rule (for example, too many searches for the JSearch monthly
   cap in `config.json`), **When** the owner imports it, **Then** the import is refused, the
   message says which rule it breaks, and the stored search settings are unchanged.
4. **Given** stored search settings, **When** the owner exports and imports with no edits, **Then**
   the stored search settings are unchanged.
5. **Given** a file that also holds a runtime setting (for example `http`), **When** the owner
   imports it, **Then** the import is refused and the message says that setting belongs in
   `config.json`.

---

### User Story 4 - Bad stored search settings don't stop the search (Priority: P3)

Imports refuse invalid search settings, but stored ones can still turn invalid later, for example
when an upgrade tightens a rule. When that happens, each bad setting falls back on its own, the rest
are used as stored, and the owner is told what fell back.

**Why this priority**: This is a rare case, but a silent stop would lose a day of searching.

**Independent Test**: Store search settings with one out-of-range value and one bad list entry.
Then check that a run and a page load use the defaults for those, use everything else as stored,
and report both.

**Acceptance Scenarios**:

1. **Given** a stored `match_threshold` of 150, **When** a run starts, **Then** it scores with the
   default threshold, and the run's trace records a warning naming `match_threshold` and why.
2. **Given** one stored title boost with an empty term, **When** a page loads, **Then** that one
   entry is left out and the other boosts apply.
3. **Given** a search setting that fell back, **When** the owner opens the Settings page, **Then**
   it lists each setting that fell back and why.
4. **Given** settings that still break a cross-setting rule after falling back (for example, no
   company or search at all), **When** a run starts, **Then** it refuses with that rule's message,
   as today.

---

### Edge Cases

- **No search settings stored and none in the file** (a fresh install): the defaults apply. A run
  refuses to start with "configure at least one company or search", and the web UI shows its error
  page with that message, as an empty file does today. The owner adds search settings with the
  command-line import (User Story 3); the README's Setup says so.
- **The database cannot be reached**: runs and pages fail as they do today when the database is
  down. They never fall back to the file's search settings.
- **A stored value no longer passes the rules** (for example, after an upgrade tightens one): it
  falls back as User Story 4 describes. A fallback is never silent.
- **A cross-setting rule fails only because of a fallback**: settings are checked against these
  rules after falling back. The run refuses only if a rule still fails.
- **A rule spans both places**: the searches (stored) must fit the JSearch monthly cap and refresh
  timing (`config.json`). It is checked at the start of each run and on every import, against the
  current file. Editing the cap in the file so the stored searches no longer fit refuses the next run
  with today's message, as the same edit does today.
- **Export with nothing stored**: the file is empty (`{}`). Importing it is refused with "configure
  at least one company or search", like any import that leaves no source, and nothing changes.
- **Import of a file that is not JSON**: refused with today's "not valid JSON" message, and nothing
  is changed.
- **Concurrent changes**: if two imports race, one wins whole. Search settings are never a mix of
  two imports.
- **A board removed from the search settings**: same as removing it from the file today. Its stored
  jobs stop changing, and its company record keeps its careers page (feature 014).
- **Search settings left in `config.json` after the move**: they do not change behaviour. A run or
  page load ignores them, and the owner is told they can be removed.
- **Only the old `config.yaml` is present**: today's "config is now JSON" hint, unchanged.
- **JSearch key**: searches are stored but `JSEARCH_API_KEY` is missing from `.env`. A run refuses
  to start, as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST store these search settings in the database: `companies`, `searches`,
  `preferences`, `match_threshold`, `title_filter` (including `extra_exclude`), `title_boosts`,
  `exclude_companies` and `jsearch.exclude_publishers`. Every other setting stays in `config.json`.
- **FR-002**: Agent runs and the web UI MUST read search settings only from the database, and
  runtime settings only from `config.json`.
- **FR-003**: Settings MUST be checked against the same rules as today: each value's type and range,
  the defaults for unset values, and the cross-setting rules, whichever place each setting now lives:
  - at least one company or search
  - unique source names
  - no source named like the Gmail alerts source
  - the searches fit the JSearch monthly cap
  - job retention is longer than the ghost threshold (both in `config.json`, checked as today)
- **FR-004**: An import of search settings (including the upgrade import) MUST be checked as a whole,
  against the current runtime settings for the rules that span both, before it is saved. An invalid
  import MUST be refused with the same messages loading the file gives today, and MUST leave the
  stored search settings exactly as they were. A command-line import of a file holding any runtime
  setting MUST be refused; the upgrade import takes only the file's search settings and leaves its
  runtime settings in place.
- **FR-005**: When stored search settings are read and one fails its checks, it MUST fall back on
  its own and leave the rest as stored:
  - a bad value takes its default
  - a bad entry in a list or map (one company, one search, one title boost) is left out, and the
    other entries are kept
  - a list or map whose entries are all bad takes its default, as if it were unset (an empty
    `title_filter.include` would otherwise match no title and hide every job)

  The cross-setting rules (FR-003) are checked after falling back. A run MUST refuse to start if
  one still fails, and the web UI MUST show its error page. Runtime settings in `config.json` keep
  today's behaviour: a bad value there stops the run with today's message.
- **FR-005a**: Every fallback MUST be reported, naming the setting (for a list or map entry, the
  setting and the entry's position) and the reason:
  - in the run's trace, for a run
  - on the Settings page, for the web UI

  Reports MUST NOT include the preferences text, the bad value, or other free text beyond the
  setting's name, the entry's position and the rule it broke.
- **FR-006**: An unset search setting MUST behave exactly as the same key missing from `config.json`
  does today. Defaults stay defined in one place and are not copied into storage as fixed values, so
  a later change to a default reaches unset settings.
- **FR-007**: A run MUST use the settings as they were when it started, for the whole run.
- **FR-008**: The web UI MUST use the stored search settings as of each page load or action.
- **FR-009**: When the agent or the web UI first reads its settings (a run, or a page load) on a
  database with no stored search settings and `config.json` holds any, the system MUST import them once, without loss. This covers every search
  setting, including the order of lists and the free-text preferences. Search settings missing from
  the file stay unset, and runtime settings are not copied. The import happens once per database,
  even when the agent and the web UI start together.
- **FR-010**: Once search settings are stored, the upgrade import MUST NOT run again. Search settings
  still present in `config.json` MUST NOT change the stored ones, and the owner MUST be told (in the
  run's trace and on the Settings page) that they are no longer used and can be removed from the
  file.
- **FR-011**: The owner MUST be able to export the stored search settings from the command line to a
  JSON file, in the shape those keys have in today's `config.json`, holding the stored values and
  leaving out unset ones.
- **FR-011a**: The owner MUST be able to import such a file from the command line. The import
  replaces the stored search settings as a whole after FR-004's checks, and an export followed by an
  import with no edits changes nothing.
- **FR-011b**: Settings editing on the Settings page is out of scope. The page's placeholder
  Scoring panel is left as it is, and the page gains only the notices of FR-005a and FR-010.
- **FR-012**: The resume, the `.env` values (secrets, the model connection, folders and service
  addresses), the database connection and the runtime settings in `config.json` MUST stay where they
  are. Only the search settings listed in FR-001 move.
- **FR-013**: Search settings MUST be stored in the same database as everything else and follow its
  storage rules:
  - exact text comparison
  - added through a numbered migration step
  - the step runs once per database, even when the agent and the web UI start together
- **FR-014**: The README (its Setup, Storage, Deploy with Docker and "Configuration knobs"
  sections), `examples/` and the agent's architecture notes (`CLAUDE.md`) MUST describe the new home
  of the search settings and how to change them, and which settings stay in `config.json`. Nothing
  may tell the owner to edit search settings in `data/config.json`.
- **FR-015**: Search settings MUST belong to a user. This feature MUST create exactly one user, the
  owner, when the settings are first stored (including the upgrade import), and every read, import
  and export MUST be for that user. It adds no sign-in, no way to add a user, and no per-user
  runtime settings. Stored search settings MUST be laid out so that a later feature can add users,
  each with their own set, without moving or rewriting the owner's.

### Key Entities

- **User**: a person myjobbot searches for. There is exactly one, the owner, in this feature. It has
  a stable identity that search settings point at, so later users can be added beside it.
- **Search settings**: one user's set of search settings, stored in the database. It covers:
  - the sources: company boards (name, board type, board id) and JSearch searches (name, query,
    remote only, country)
  - the owner's preferences text
  - scoring and filtering values: the match threshold, the title filter, title boosts, excluded
    companies and excluded JSearch publishers

  Each user has exactly one set; in this feature that means one set, the owner's. It may be unset, in
  which case every value takes its default. Each import replaces the whole set or none of it.
- **Runtime settings**: everything else in `config.json` (limits and tuning for the agent, HTTP,
  JSearch, the careers lookup and the company search; job lifetimes; the Gmail alert senders). They
  belong to the app, not a user, and stay in the file, read and checked as today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the search settings removed from `data/config.json`, an agent run and every web
  page work using the stored search settings and the file's runtime settings.
- **SC-002**: The owner's current `config.json`, brought in, gives stored search settings that match
  the file value for value (2 searches, 10 title boosts, 5 excluded companies, 2 excluded publishers,
  the title filter, the preferences text, match threshold 60). Recommended shows the same jobs in the same order before and after the
  upgrade.
- **SC-003**: Every rule the file's search settings are checked against today is enforced on every
  import. Each invalid example in today's config tests that concerns a search setting is refused
  with the same message when imported, and nothing is stored.
- **SC-004**: A search settings change is used by the next page load or the next run, with no restart
  of the agent or the web UI.
- **SC-005**: A backup of the database alone is enough to restore the owner's search settings.
- **SC-006**: An export followed by an import with no edits leaves the stored search settings
  unchanged.
- **SC-007**: A stored search setting made invalid after it was saved never stops a run on its own,
  and every fallback is reported.
- **SC-008**: A second user's search settings can be added to the storage, in a later feature,
  without changing or moving the owner's stored settings.

## Assumptions

- There is one user, the owner, with one set of search settings. The storage is ready for more
  users, but adding them, signing in, and deciding which of today's shared data becomes per-user
  (the jobs, their scores and verdicts, the resume, the Gmail connection, the company records) are
  for later features. In this feature all of those stay shared, as today.
- Settings change rarely and are read at most once per page load or run, so speed is not a concern.
- No history of earlier search settings is kept beyond the database's own backups. Undoing a change
  means changing it back.
- `preferences` moves with the search settings. It is a setting, not a document like the resume.
- `config.json` stays required in the same way it is today; the upgrade leaves the file in place
  and never rewrites it.
- The Settings page's Scoring panel shows a fixed "Match threshold: 70" today, and its Save button
  does nothing. Replacing it is part of the later Settings editor feature.
- The command-line export and import run like the existing commands (`npm start -- …`) against
  the configured database. In Docker they run inside the agent's container.
- Each run checks the settings once, at its start. When something falls back, the web UI reports
  it each time it reads the settings. Nothing about a fallback is stored.
- How the search settings are laid out in the database (one record or one row per setting) is left
  to the plan. The spec only requires the behaviour above.
- Today's checks (`src/config/schema.ts`) remain the single definition of what valid settings are,
  for both kinds. The plan decides how they apply to stored values and how the two places are joined.
- Delivery follows the owner's usual small PRs, each tried before the next.
