# Feature Specification: React Web UI

**Feature Directory**: `docs/specs/002-react-web-ui`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Bring React in so I can learn to use it. Update existing pages to be react based."

**Supersedes**: the "Rendering" decision in `docs/superpowers/specs/2026-10-04-web-ui-design.md`,
which rejected React as overkill for read-only tables. The goal has changed: the owner wants to
learn React on a real codebase they use every day.

## Background

The web UI is the owner's window into what the job-search agent found:
- **Recommended**: jobs at or above the match threshold, with the model's reasons and gaps.
- **All jobs**: every retrieved job, including ones the filters hid from the model.
- **Reasoning**: every scoring decision, newest first.
- **Settings**: a blank page, added just before this spec (uncommitted at the time of writing).

Today every page is HTML assembled on the server, plus about 25 lines of plain browser script
for infinite scrolling and the Hide button.

The owner wants these pages rebuilt with React, both to learn React and to have a base for
upcoming interactive pages such as Settings. React is the point of the feature, so this spec
names it. Every other technology choice is left to the plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Same pages, now built with React (Priority: P1)

The owner opens the web UI and sees the same tabs, rows, scores, notes and links as before.
Everything they rely on daily still works:
- tab navigation, with the current tab marked
- the score breakdown and boost notes
- "via LinkedIn" source labels
- the possible-ghost warning
- "hidden by title filter" and "excluded company" notes
- the reasons and gaps lists
- the footer showing the database path and render time

Behind the scenes, every page is now made of React components.

**Why this priority**: This is the conversion itself. Without it there is nothing to learn from,
and the UI must not get worse in the process.

**Independent Test**: Load each of the four pages against the same seeded data before and after
the change. Every job, score, note, link and empty-state message from before is still present.

**Acceptance Scenarios**:

1. **Given** jobs scored at 90 and 40 with a threshold of 70, **When** the owner opens Recommended, **Then** only the 90 job appears, with its reasons, gaps and "1 recommended · threshold 70".
2. **Given** a title boost for "typescript", **When** a 65-scored TypeScript job is shown, **Then** it appears in Recommended with "model 65 · +10 typescript".
3. **Given** a job title containing `<script>` markup, **When** any page shows it, **Then** it is shown as text and never runs.
4. **Given** a job whose posting link is `javascript:…`, **When** it is shown, **Then** it is not a clickable link. Only `http` and `https` postings become links.
5. **Given** a page with no data, **When** it is opened, **Then** it shows the same empty-state message as today, for example "No recommendations yet: run myjobbot run.".
6. **Given** any page, **When** the owner switches tabs, **Then** the URL changes to that tab's address (`/recommended`, `/jobs`, `/reasoning`, `/settings`), and that address can be bookmarked and reloaded.

---

### User Story 2 - Long lists and Hide keep working (Priority: P1)

The owner scrolls through hundreds of jobs and hides the ones they don't want. Each list shows
100 rows at first and loads the next 100 as the owner scrolls. Hide and Unhide take effect at once,
without a full page reload:
- On Recommended, a hidden job disappears.
- On All jobs, a hidden job dims, gains a "hidden by you" note, and its button becomes "Unhide".

**Why this priority**: These are the UI's only interactive behaviours. They are also where
React's state handling is most instructive.

**Independent Test**: Seed 250 jobs. Open All jobs and scroll to the bottom: 100, then 200, then
250 rows appear. Hide one job: it dims at once, and after a reload it is still hidden. Unhide it:
it returns to normal.

**Acceptance Scenarios**:

1. **Given** 250 jobs, **When** the owner opens All jobs, **Then** exactly 100 rows show, and scrolling near the end loads the next 100 until all 250 are shown, with no duplicates and none missing.
2. **Given** a recommended job, **When** the owner clicks Hide, **Then** it disappears from Recommended at once, and stays gone after a reload.
3. **Given** a hidden job on All jobs, **When** the owner clicks Unhide, **Then** the row returns to normal and the button reads "Hide".
4. **Given** the Hide request fails, **When** the owner clicks Hide, **Then** the row stays as it was and the owner sees that the change did not happen.
5. **Given** a page on another site tries to hide a job on the owner's behalf, **When** the request arrives, **Then** it is refused, as today.

---

### User Story 3 - A Settings page ready to grow (Priority: P2)

The owner opens Settings and sees an empty page within the same layout and navigation as the
other tabs. It is built as a React page the owner can start adding to while learning.

**Why this priority**: It is the first page the owner will extend by hand, but it has no content
yet, so the existing tabs come first.

**Independent Test**: Open `/settings`. It shows the shared header, navigation (with Settings
marked) and footer, and an empty body.

**Acceptance Scenarios**:

1. **Given** any page, **When** the owner clicks Settings, **Then** the Settings page opens with Settings marked as current in the navigation and nothing else in the body.

---

### User Story 4 - Learning from the code (Priority: P2)

The owner reads the converted pages to learn React: how a page is split into components, how data
reaches them, and how state changes when they hide a job or scroll.

**Why this priority**: Learning is the stated reason for the feature. The code has to teach,
not just work.

**Independent Test**: Read the walkthrough document start to finish. Each React idea it covers
(components, props, state, effects, event handling, loading data) points to a file and function
that exist in the code and use that idea. Each exercise can be attempted against the real UI.

**Acceptance Scenarios**:

1. **Given** the converted code, **When** the owner looks for where a piece of the page comes from (for example the score cell), **Then** they find one small, clearly named component for it.
2. **Given** the walkthrough, **When** the owner follows a reference to where state changes on Hide, **Then** it leads to the exact component and the lines that update it.
3. **Given** the walkthrough's exercises, **When** the owner tries one (for example, showing a count of hidden jobs on All jobs), **Then** the exercise names the files to change and how to check the result.

### Edge Cases

- **Script turned off or failing to load in the browser**: pages are built in the browser (see FR-014), so they cannot show their data. The owner sees a short message saying the UI needs JavaScript, not a blank page.
- **The data request for a page fails** (server down, or a config error): the page shows an error message in place of the rows, and the navigation still works.
- **The database is being written by a run while the owner browses**: pages still load, as today.
- **A config error** (for example a bad `exclude_publishers` entry) while the UI is running: the owner sees an error message, not a blank screen.
- **Scrolling past the end, or an invalid page offset in the address**: the list shows from the start, with no duplicate or missing rows.
- **Unknown address** (`/nope`): a "Not found" page. **Wrong method** (a POST to a page): "Method not allowed". **The root** (`/`): redirects to Recommended, as today.
- **Text from job postings** (titles, companies, reasons) containing markup: always shown as text.
- **Many rows** (thousands of jobs): scrolling stays smooth, because rows still load 100 at a time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every page of the web UI (Recommended, All jobs, Reasoning, Settings) MUST be built from React components.
- **FR-002**: Each page MUST show the same information it shows today: the same columns, scores, score breakdowns, boost notes, source labels, ghost warnings, filter notes, hidden notes, reasons, gaps, summary line, empty-state message and footer.
- **FR-003**: Each page MUST keep its address (`/recommended`, `/jobs`, `/reasoning`, `/settings`). The root MUST still redirect to `/recommended`, and every address MUST load directly from a bookmark or reload.
- **FR-004**: Lists MUST show 100 rows at first and load the next 100 as the owner nears the end, until every row is shown, with no duplicates or gaps.
- **FR-005**: Hide and Unhide MUST update the job immediately without a full page reload, persist across reloads, and behave per tab as today: removed on Recommended, dimmed with a "hidden by you" note on All jobs.
- **FR-006**: A failed Hide or Unhide MUST leave the row unchanged and tell the owner it failed.
- **FR-007**: Requests that change data MUST still be refused unless they come from the UI's own pages, as the Hide action is today.
- **FR-008**: All text that comes from job postings or the model MUST be shown as text, never interpreted as markup or script. Only `http` and `https` posting addresses may become links.
- **FR-009**: Unknown addresses MUST show "Not found", wrong request methods MUST be refused, and server errors MUST show an error message rather than a blank page.
- **FR-010**: The UI MUST keep the current light and dark appearance, following the system setting.
- **FR-011**: The new code MUST meet the project's existing quality gates: type-checked, tested, and clean under habit-hooks. Browser-side code is included, and no code is exempted from the checks to get there.
- **FR-012**: The Docker setup MUST still serve the UI, and a dependency change MUST still be picked up by the watch-and-rebuild workflow.
- **FR-013**: A walkthrough document in `docs/` MUST map each React idea used (components, props, state, effects, event handling, loading data) to the specific files and components that use it in this UI. It MUST include at least three small exercises the owner can do against the real UI. It MUST be kept accurate: every file and component it names exists.
- **FR-014**: Pages MUST be built in the browser by React from data the server provides, so page changes such as Hide and loading more rows happen in React rather than in separate scripts.

### Key Entities

- **Page**: one of the four tabs. It has an address, a label, a summary line, an empty-state message and its rows.
- **Job row**: a retrieved job with score, title, company, location, remote flag, source, posted date, scored date, filter notes and hidden state.
- **Verdict row**: one scoring decision with time, run, job, company, score, reasons and gaps.
- **Hide action**: a change to one job's hidden state, made from a row.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For the same data, 100% of the jobs, scores, notes and links shown before the change are shown after it, on all four pages.
- **SC-002**: Every behaviour covered by today's web UI and Hide tests still passes, adapted to the new structure where needed. That is 23 scenarios: 16 for the pages and 7 for Hide. None is dropped.
- **SC-003**: Hiding or unhiding a job updates the page in under half a second on the home network, with no full reload.
- **SC-004**: Each page shows its first rows within 1 second of opening on the home network, with 1,000 stored jobs.
- **SC-005**: The project's full check (type checks, tests, habit-hooks) passes with zero findings and no exemptions added.
- **SC-006**: The owner can point to the component responsible for any visible part of a page (the score cell, the Hide button, the navigation) within a minute of looking.
- **SC-007**: 100% of the files and components named in the walkthrough exist, and each exercise can be completed without changing anything outside the files it names.

## Assumptions

- **Single user on the home network**, as today. Adding authentication is out of scope.
- **Read-mostly UI.** Hide is the only change the UI makes. New settings controls are future work, not part of this feature.
- **No visual redesign.** The pages keep today's look and layout. Learning React is the goal, not a new design.
- **Browser support**: current desktop and mobile browsers. Very old browsers are not targeted.
- **JavaScript required.** The owner's own browsers on the home network run JavaScript, so a no-script fallback beyond a short notice is not needed.
- **Typed React code.** The owner learns React with the same language and checks as the rest of the project.
- **New dependencies** follow the project rule: exact or `~` pins, installed through the lockfile with the optional-dependency splice where needed.
- **The agent run is unaffected.** Only the web UI changes.
