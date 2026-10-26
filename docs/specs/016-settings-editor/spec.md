# Feature Specification: Edit search settings on the Settings page

**Feature Branch**: `016-settings-editor`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Time for the settings UI"

## Overview

Feature 015 moved the owner's search settings into the database:
- the sources (company boards and saved JSearch searches);
- the preferences text;
- the match threshold;
- the title filter, title boosts and excluded companies and publishers.

Today the owner changes them from the command line: export to a file, edit it, import it back. The
Settings page shows only a placeholder Scoring panel ("Match threshold: 70" and a Save button that
does nothing), the notices panel from 015, and the Gmail panel.

This feature lets the owner see and change every search setting on the Settings page, with the same
checks as an import. From here on the page is where search settings are made: the import from
`config.json` was for the one-time move to the database, and when users are added later they will
start with mostly empty settings and build them up here. Runtime settings stay in `config.json`,
edited as before. The command-line `export-settings` and `import-settings` from feature 015 are
removed, and so is the automatic one-time import from `config.json` on an empty database: going
forward, only the page changes search settings. The database backup still holds them.

The page is split into sections, each with its own Save:
- **Sources**: the company boards and saved searches;
- **Preferences**: the preferences text;
- **Scoring**: the match threshold and the title boosts;
- **Filters**: the title filter and the excluded companies and publishers.

## Clarifications

### Session 2026-10-25

- Q: How should the owner edit the settings? → A: A form, with a field for each setting and rows to
  add or remove for the lists. No raw text box.
- Q: One Save for the whole form, or a Save per section? → A: A Save per section. Each saves its own
  edits and leaves the others as stored, checked with everything else. The owner added: importing
  is only for the initial move to the database; going forward settings are made on this page, and
  when users are added they will start with mostly empty settings.
- Q: When should a save from an out-of-date page be refused? → A: Never; the last save wins. Once
  this is finished, nothing should change search settings outside the page.
- Q: Should `import-settings` and `export-settings` stay once the page is done? → A: Remove both.
  Going forward, only the page changes search settings.
- Q: Should the automatic one-time import from `config.json` (feature 015) be removed too? → A: Yes.
  Search settings left in `config.json` are only ever ignored, with the notice, and every setup
  starts on the Settings page.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the search settings in effect (Priority: P1)

The owner opens Settings and sees every search setting as it is used right now:
- the company boards and saved searches;
- the preferences text;
- the match threshold;
- the title filter's include, exclude and extra exclude terms;
- the title boosts;
- the excluded companies and publishers.

A setting the owner never set shows the default it takes, marked as the default.

**Why this priority**: The owner can't change what they can't see, and today the page shows a
fixed, wrong "70".

**Independent Test**: Store search settings with a threshold of 60, two boards, one search and three
boosts. Open Settings and check that each value is shown as stored, and that an unset setting (say
the title filter's include terms) shows its default list marked as the default.

**Acceptance Scenarios**:

1. **Given** stored search settings, **When** the owner opens Settings, **Then** every search
   setting is shown with the value runs use.
2. **Given** a setting the owner never set, **When** the page shows it, **Then** it shows the
   default and says it is the default.
3. **Given** a stored setting that fell back (feature 015), **When** the page shows it, **Then** it
   shows the value in effect, and the notices panel still says what fell back and why.
4. **Given** no stored search settings (a fresh install, or later a new user), **When** the owner
   opens Settings, **Then** the page loads, shows every setting at its default, and says that no
   company or search is set yet. It doesn't show the error page, and the owner can add the first
   board or search from there.

---

### User Story 2 - Change a setting and save it (Priority: P1)

The owner changes one or more search settings on the page and saves. Examples:
- raise the match threshold;
- add a title boost;
- add a company board;
- remove a saved search;
- add an excluded company.

Each section has its own Save, which saves that section's edits and leaves the other sections as
stored. The section's new values are checked together with the rest of the stored settings,
against the same rules an import is checked against. If they pass, they are stored, and the next
page load or run uses them. If it fails, nothing is stored, the page says what is
wrong next to the setting it concerns, and the owner's edits stay on the page to be fixed.

**Why this priority**: This is the feature. It replaces export, edit, import for everyday changes.

**Independent Test**: Change the threshold from 60 to 75 and save. Check that the stored setting is
75 and that Recommended now uses 75. Then enter a threshold of 150 and save. Check that the page
explains the problem, nothing is stored, and the 150 is still in the field.

**Acceptance Scenarios**:

1. **Given** the Settings page, **When** the owner changes the threshold to a valid value and saves,
   **Then** it is stored, the page confirms it, and the next page load scores with it.
2. **Given** the owner adds a company board with a name, a board type and a board id, **When** they
   save, **Then** the board is stored and the next run fetches from it.
3. **Given** a change that breaks a rule, such as a threshold of 150, a duplicate source name, a
   search named "Gmail alerts", or more searches than the JSearch budget allows, **When** the owner
   saves, **Then** nothing is stored, and the page names each problem next to the setting it
   concerns, with the message an import gives.
4. **Given** a refused save, **When** the page shows the problems, **Then** the owner's unsaved edits
   are still on the page.
5. **Given** the owner removes every company and every search, **When** they save, **Then** the save
   is refused with "configure at least one company or search".
6. **Given** a run in progress, **When** the owner saves a change, **Then** the run keeps the
   settings it started with, and the next run uses the new ones.
7. **Given** unsaved edits in two sections, **When** the owner saves one of them, **Then** only that
   section's edits are stored, and the other section's edits stay on the page, still unsaved.
8. **Given** a saved search that no longer fits the JSearch budget once added, **When** the owner
   saves the Sources section, **Then** the save is refused with the budget message, though the
   budget itself lives in `config.json`.

---

### User Story 3 - Return a setting to its default (Priority: P2)

The owner changed a setting and wants the default back. They choose to reset that setting, and once
saved it is unset again. A later change to the default reaches it, as for a setting never set.

**Why this priority**: Without it, a setting once changed can only be set to a copy of the default,
which a later change to the default no longer reaches.

**Independent Test**: Store a threshold of 60. Reset it and save. Check that the stored settings no
longer hold a threshold, and that the page shows 70 marked as the default.

**Acceptance Scenarios**:

1. **Given** a stored setting, **When** the owner resets it and saves, **Then** it is no longer
   stored and its default applies.
2. **Given** a setting already at its default, **When** the page shows it, **Then** there is nothing
   to reset.

---

### Edge Cases

- **Unsaved edits in another section**: a save of one section leaves them on the page, unsaved. The
  owner saves each section separately.
- **Saving a section with no edits**: nothing changes, with two exceptions:
  - a setting of that section that fell back: the page shows the value in effect, so saving stores
    that value. The bad stored value is replaced and its notice goes away;
  - keys that aren't search settings (only possible by editing the database by hand) are dropped on
    any save.
- **Search settings still in `config.json`**: they are never imported or used, even on an empty
  database, and a save doesn't touch the file. The notices panel keeps saying they can be removed.
- **Before the first board or search is saved** (a fresh install): runs refuse to start and the other
  pages show "configure at least one company or search", as an empty `config.json` did before
  feature 015. The Settings page loads, so the owner can add one.
- **The JSearch budget**: whether the searches fit is checked against `config.json`'s cap and
  refresh timing at the moment of saving. A later edit to the file can still refuse runs, as with an
  import today.
- **Saved searches need a JSearch key**: a search can be saved without `JSEARCH_API_KEY` in `.env`.
  Runs then refuse to start, as today, and the Sources section says the key is missing.
- **Before the first source is saved**: a save of Preferences, Scoring or Filters is refused with
  "configure at least one company or search", shown on that section, because every save is checked
  with the rest. The owner saves a board or search in Sources first.
- **A rule that spans sections or `config.json`** (unique names, the JSearch budget, a bad runtime
  value in `config.json`): its problem is shown at the top of the section that was saved.
- **A saved entry with optional fields left blank** (a search with no country, say): the blank
  fields stay unset, and the entry's own defaults apply (remote only off, country `us`). Saving with
  no edits doesn't fill them in.
- **The same boost term twice**: the save is refused on the second row.
- **An entry left half filled in**, such as a new board with no board id: the save is refused, naming
  that entry.
- **Long preferences text**: kept exactly as typed, line breaks included.
- **The database can't be reached**: the page shows the error page as other pages do, and a save
  reports that it failed and stores nothing.
- **Other people on the LAN**: the web UI has no login, so anyone who can open it can change the
  search settings, as anyone can connect Gmail today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Settings page MUST show every search setting with the value in effect:
  - `companies`
  - `searches`
  - `preferences`
  - `match_threshold`
  - `title_filter` (include, exclude and extra exclude)
  - `title_boosts`
  - `exclude_companies`
  - `jsearch.exclude_publishers`

  A setting that is not stored MUST be shown at its default and marked as the default.
- **FR-002**: The owner MUST be able to change any search setting on the page:
  - add, edit and remove entries in each list (boards, searches, terms, boosts, excluded names);
  - edit the threshold and the preferences text.
- **FR-003**: The page MUST have a Save for each section (Sources, Preferences, Scoring, Filters).
  A save MUST store that section's settings and leave the other sections' stored settings as they
  are. Before storing, it MUST check the section's new values together with the rest of the stored
  settings, with the same rules and messages as feature 015's import (its FR-004), against the
  current `config.json`. A save MUST store all of the section's changes or none of them.
- **FR-004**: A refused save MUST show each problem next to the setting or entry it concerns, and
  MUST keep the owner's unsaved edits on the page.
- **FR-005**: A stored change MUST be used from the next page load, and by the next run. A run
  already in progress keeps its settings.
- **FR-006**: The owner MUST be able to reset any setting to its default. After a save, the setting
  is no longer stored, so a later change to the default reaches it. A setting the owner never touched
  MUST stay unset when other settings are saved.
- **FR-007**: The last save wins. A save is not refused because the stored settings changed after
  the page was opened (in another tab, say); it stores its own section's settings over them. Search
  settings are expected to change only on this page.
- **FR-008**: The page MUST NOT edit runtime settings. They stay in `config.json`, edited as before.
- **FR-009**: The placeholder Scoring panel ("Match threshold: 70" and a Save button that does
  nothing) MUST be replaced. The notices panel (feature 015) and the Gmail panel stay.
- **FR-010**: The command-line `export-settings` and `import-settings` (feature 015) MUST be removed,
  with their mentions in the README, `examples/` and the architecture notes. Only the page changes
  search settings. The setup instructions MUST say to add the first board or search on the Settings
  page instead of importing a file.
- **FR-011**: The page MUST load, and be usable to build settings from nothing, when no search
  settings are stored (a fresh install today, a new user later). It shows the defaults, says that a
  company or search is needed, and doesn't show the web UI's error page.
- **FR-012**: Saved settings belong to the owner, as in feature 015. This feature adds no sign-in and
  no other user.
- **FR-013**: The owner MUST edit the settings through a form:
  - a field for each single value: the threshold and the preferences text;
  - rows to add, edit or remove for each list: boards (name, board type, board id), searches (name,
    query, remote only, country), boosts (term and points), and the terms and names of the title
    filter and the exclusions.

  There is no raw text box for a whole settings file.
- **FR-014**: The automatic import of `config.json`'s search settings into an empty database
  (feature 015 FR-009) MUST be removed. Search settings found in `config.json` MUST never be stored
  or used; they are only reported as removable, as feature 015's notice does today, on every
  database, empty or not.

### Key Entities

- **Search settings**: the owner's stored set from feature 015, now viewed and changed on the
  Settings page. A setting is either stored (set by the owner) or unset (its default applies).
- **A section**: a group of related search settings on the page with its own Save: Sources,
  Preferences, Scoring or Filters.
- **A save**: one section's changes, checked together with the rest of the stored set and stored all
  or none. It is refused only if it breaks a rule; the last save wins.
- **Runtime settings**: unchanged. `config.json`'s settings, which the page doesn't edit but which
  saves are checked against.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can change the match threshold, or add a title boost, from the Settings page
  in under 30 seconds, with no command line.
- **SC-002**: Every search setting feature 015's import accepts can be set on the page, and every one
  stored can be seen there.
- **SC-003**: Every invalid example feature 015's import refuses (its SC-003) is refused when
  saved from the page, with the same message, and nothing is stored.
- **SC-004**: A saved change is used by the next page load and the next run, with no restart.
- **SC-005**: A save never stores a set that breaks a rule, whatever was saved before it, in this tab
  or another.
- **SC-006**: Saving with no edits leaves the stored settings unchanged, entries' blank fields
  included, unless a setting had fallen back or a key isn't a search setting.
- **SC-007**: A setting the owner never set stays unset through any number of saves of other
  settings.

## Assumptions

- There is one user, the owner, as in feature 015.
- The web UI keeps no login, which keeps it on the owner's LAN. That is the same trust as the Gmail
  panel, whose actions already change stored data.
- The page shows search settings only. Showing runtime settings (read-only or editable) is out of
  scope.
- Each section's save is atomic: all of that section's changes are stored, or none.
- The page is the only way to change search settings from now on. A copy of them is kept by the
  database's own backups; there is no separate export.
- A refused save's messages are the ones feature 015's import gives, placed next to the setting they
  concern. The messages are not reworded.
- There is no check for changes made elsewhere: the last save wins. With one owner, and settings
  changed only on this page, two saves racing is not expected. Each save still checks the section's
  values against the settings stored at that moment, so the rules always hold.
- Delivery follows the owner's usual small PRs, each tried before the next. Viewing can ship before
  editing.
