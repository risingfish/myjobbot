# Feature Specification: Job details panel

**Feature Branch**: `011-job-details-panel`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Looking at the UI, i have a lot of questions. The categorization isn't
super great. Let's plan out some changes. 1. Setup a details panel for a job. When I click on a job
in the UI, I'd like a panel to slide out from the right side of the screen over the list. I want to
see the details of the job in that list. In the list itself, place an external link icon to the
left of the hide button that will open the actual page from the source like the job title does
now. 2. The second part of this is going to be tracing the jobs path through the categorizer with
details at every step it takes: what decisions were made, what the result was, what tool was
called when, etc. it should all be in chronological order. Don't start on any of this work yet,
just keep it in mind when planning #1."

## Overview

The web UI lists jobs in tables (Recommended, All jobs): a score, a title that opens the posting,
location, source and posting date, with the score's reasons and gaps folded under the title. The
rest of what myjobbot knows about a job is out of sight, which makes it hard to understand why a
job scored the way it did:
- the description and where it came from;
- the score's two parts, and how the shown score was boosted;
- the job's pay and remote terms;
- the job's earlier scores;
- any warnings.

The row keeps its folded reasons and gaps; the panel shows them in full with the rest.

This feature adds a **details panel**. Clicking a job slides a panel in from the right, over the
list, showing everything about that job. The title no longer leaves the app; a small external-link
icon next to the Hide button opens the original posting instead.

The owner's second request, a chronological trace of the job's path through the categorizer (each
decision, tool call and result), is a **later feature**. This one doesn't build it, but the panel
is laid out in sections so the trace can be added as one more section without rework.

## Delivery

The owner reviews and tests each change in the UI before the next one, so this feature ships as a
series of **small pull requests**, merged one at a time, never one large one. Each PR must:
- leave the app working, with something new the owner can try in the UI;
- be small enough to review comfortably (aim for about 10 files, tests included);
- be merged and checked before the next one starts.

The plan and tasks group the work into these PRs, one sitting each. A likely split:
1. **The external-link icon** beside Hide (US3's icon; the title still links out).
2. **The panel itself**: clicking a job's title opens it, and it closes as described, with the open job in
   the address, keyboard and screen-reader support, and the job section from data the rows
   already have. The title switches to opening the panel here (US1, FR-009).
3. **Loading the details**: the panel fetches the job's stored details when it opens, so a link to
   any job works and the job section gains pay and remote terms (US1, US2).
4. **Score**: the score section (US2).
5. **Description**: the full description, requirements and skills, and where it came from (US2).
6. **Warnings and score history** (the rest of US2).

## Clarifications

### Session 2026-10-21

- Q: Should clicking anywhere on a job's row open the details panel, or only clicking its title?
  → A: Only the title; the rest of the row does nothing.
- Q: Should the Reasoning page, which lists scores rather than jobs, also open the details panel
  when you click a job's title there? → A: No; the panel is only on Recommended and All jobs, and
  Reasoning keeps linking to the posting.
- Q: How wide should the details panel be on a normal desktop window? → A: About 60% of the window,
  roomy for long descriptions; nearly full width on narrow windows.
- Q: Should the panel block the list while it's open (modal), or leave the list usable behind it?
  (raised by the deep analysis: a modal panel makes "click another title to switch" impossible)
  → A: Leave the list usable (non-modal). Clicking another title switches the panel, the row's Hide
  stays reachable, and the panel doesn't trap keyboard focus.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See everything about a job without leaving the list (Priority: P1)

While reviewing jobs, the owner clicks a job's title. A panel slides in from the right over the list,
showing the job's details. The list stays where it was underneath. Closing the panel returns to
the same place in the list, and clicking another job switches the panel to that job.

**Why this priority**: It's the core of the request. Understanding a job's score today means
opening the posting, or digging through logs.

**Independent Test**: Click a job's title in the Recommended table. The panel opens with that job's
details, and closing it leaves the list unchanged and scrolled where it was.

**Acceptance Scenarios**:

1. **Given** the Recommended or All jobs table, **When** the owner clicks a job's title, **Then** a panel
   slides in from the right over the list and shows that job's details.
2. **Given** an open panel, **When** the owner closes it (close button, Escape, or clicking the
   list outside it), **Then** it slides away and the list keeps its scroll position and loaded
   rows.
3. **Given** an open panel, **When** the owner clicks another job's title, **Then** the panel shows that
   job instead, without closing first.
4. **Given** the address of a page with a job open, **When** the owner opens that address (or uses
   back and forward), **Then** the same job's panel is shown (or closed) to match.

---

### User Story 2 - The panel explains the job and its score (Priority: P1)

The panel shows, in clear sections:
- **The job**: title, company, location and remote terms, pay, when it was posted and how long it
  has been open (with the possible-ghost warning), its source and the publisher it came through,
  and whether the owner has hidden it.
- **The score**: the total, its resume-fit and preference-fit parts, and the reasons and gaps
  behind it; or "not scored yet".
- **The description**: the full text, plus any requirements and skills, and where the description
  came from (the job's own source, or a careers page with its address).
- **Warnings**: the "tried to escape the data markers" warning from feature 009, when present.
- **History**: every score recorded for this job, including the current one, newest first, with
  when it was scored.

**Why this priority**: Showing these details is the point of the panel; without them it's only a
bigger title.

**Independent Test**: Open the panel for a scored job with a careers-page description. Every
listed field appears, and the history shows each stored score.

**Acceptance Scenarios**:

1. **Given** a scored job, **When** its panel opens, **Then** it shows the total score, both parts,
   and the reasons and gaps.
2. **Given** an unscored job, **When** its panel opens, **Then** the score section says it hasn't
   been scored yet, and the other sections still show what is known.
3. **Given** a job with no description, **When** its panel opens, **Then** the description section
   says none was found, rather than being blank.
4. **Given** a job whose description came from a careers page, **When** its panel opens, **Then**
   the panel says so and links the page the description came from.
5. **Given** a job scored more than once, **When** its panel opens, **Then** the history lists
   every score, newest first, with its date.

---

### User Story 3 - Open the original posting from the list (Priority: P2)

In each row, an external-link icon sits just left of the Hide button. It opens the job's original
posting in a new tab, as the title link does today. The title itself now opens the panel.

**Why this priority**: It keeps the one-click route to the posting once the title opens the panel
instead.

**Independent Test**: Click a row's external-link icon. The posting opens in a new tab and the
panel doesn't open.

**Acceptance Scenarios**:

1. **Given** a job with a posting address, **When** the owner clicks its external-link icon,
   **Then** the posting opens in a new tab, and the panel doesn't open.
2. **Given** a job with no usable posting address, **When** the row is shown, **Then** no
   external-link icon is shown.
3. **Given** a keyboard user, **When** they tab through a row, **Then** they reach the icon (labelled
   for screen readers as opening the posting) and the Hide button separately.

### Edge Cases

- **Very long descriptions** (up to 20,000 characters) scroll inside the panel; reaching the end of
  the panel's scroll doesn't scroll the list behind it. The list stays scrollable and usable when
  the pointer is over it.
- **A job pruned or deleted**: an address naming a job that doesn't exist, or a job opened again
  after it was pruned, shows "job not found". Details already shown stay until the panel is opened
  again.
- **Hiding a job while its panel is open**: the row's Hide stays reachable, the panel shows the job
  as hidden, and the row updates the same way it does today. On Recommended, where hiding removes
  the row, the panel keeps showing the job until it is closed.
- **Narrow windows**: the panel covers nearly the full width, and the list stays reachable by
  closing it.
- **Outside text**: job text in the panel (titles, descriptions, reasons) is shown as text, never
  run as markup, as in the tables today.
- **The Reasoning page** lists scores rather than jobs; its titles keep linking to the posting and
  don't open the panel (clarified 2026-10-21).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Clicking a job's title in the Recommended and All jobs tables MUST open a details
  panel that slides in from the right edge, over the list. Clicking elsewhere in the row MUST do
  nothing.
- **FR-002**: The panel MUST close by its close button, by Escape (wherever focus is), and by
  clicking outside it, except on a job title (which switches it, FR-003) or a row's posting icon or
  Hide button (which do their own job). Closing MUST leave the list's scroll position, loaded rows
  and hidden states unchanged. The list MUST stay usable while the panel is open.
- **FR-003**: Clicking another job's title while the panel is open MUST switch the panel to that job.
- **FR-004**: The open job MUST be part of the page's address, so reloading, sharing the address,
  and back and forward all restore or close the panel.
- **FR-005**: The panel MUST show the job's details in sections: the job; the score with its parts,
  reasons and gaps; the description with any requirements and skills and its origin; warnings; and
  the score history. A missing value MUST be stated ("not scored yet", "no description found"),
  never left blank.
- **FR-006**: The panel MUST load a job's details when it opens. The tables MUST NOT grow heavier
  to carry details they don't show.
- **FR-007**: The panel MUST be laid out as named sections, so a later section (the job's path
  through the categorizer) can be added without changing the existing ones.
- **FR-008**: Each row MUST show an external-link icon, just left of the Hide button, that opens the
  job's posting in a new tab. Clicking it MUST NOT open the panel. It MUST be hidden when the job
  has no usable posting address.
- **FR-009**: The title MUST open the panel instead of the posting.
- **FR-010**: The panel MUST be usable by keyboard and screen reader. Focus moves into it when it
  opens, and back to the title that opened it when it closes (after opening from the address,
  to the page's main area). The panel is announced as a dialog named by the job's title. It doesn't
  trap focus, so the list stays reachable.
- **FR-011**: All job text in the panel MUST be shown as text, never as markup.
- **FR-012**: A job that can't be found MUST show a "job not found" panel, not an error page.
- **FR-013**: The panel MUST take about 60% of the window's width on desktop windows, and nearly the
  full width on narrow ones.

### Key Entities

- **Job details**: everything stored about one job, shown in the panel; loaded per job, on demand.
- **Score history**: every score recorded for a job, with when it was scored.
- **Panel section**: one named part of the panel (the job, score, description, warnings, history).
  The later trace feature adds one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any job in the Recommended or All jobs table, the owner reaches its description,
  score reasons and score history in one click.
- **SC-002**: The panel shows a job's details within 1 second of the click on the owner's network.
- **SC-003**: Closing the panel returns the owner to exactly the same place in the list (same
  scroll position, same rows loaded) every time.
- **SC-004**: The original posting is still one click away from the list.
- **SC-005**: The tables load as quickly as before; the panel adds no data to the rows they load.

## Assumptions

- **The data already exists:** the details are already stored (description, requirements, skills,
  its source and address, score parts, reasons and gaps, every score in the verdict history, the
  injection flag), so this feature only reads them; no new data is recorded.
- **The trace is a separate feature** (the job's path through the categorizer). It will decide
  where that data comes from: today it lives in run traces, the careers audit log and the verdict
  history. This feature only makes room for it in the panel.
