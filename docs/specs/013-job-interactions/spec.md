# Feature Specification: Job interactions (Applied and Hide)

**Feature Branch**: `013-job-interactions`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "1. We need a button to mark 'Applied' so I can keep track of which
jobs I applied for. In the jobs table, add an `applied` field and an `applied_on` datetime. In the
list, show a blue question-mark icon when a job hasn't been applied to. Clicking it switches it to a
green checkmark and marks the job applied in the database. 2. In the job description drawer, put a
green 'Applied' button to the left of the Close button. Also add a "Hide" button between 'Applied'
and 'Close', styled like the Close button. Once Applied is clicked, hide that button and show
"Applied" with a green checkmark to the right of it. Hide and Close stay."

## Overview

The owner reviews jobs in the Recommended and All jobs tables and in the details panel (feature
011). Today the only thing they can record about a job is **Hide**: a row's Hide button sets the
job's hidden flag, which removes it from Recommended; All jobs keeps showing it with an Unhide
button. Nothing records which jobs the owner has applied to, so they track that elsewhere.

This feature adds:
- **Applied**: the owner marks a job as applied to, from its row or from its details panel, and
  myjobbot remembers that and when.
- **Hide in the panel**: the same Hide the rows have, also offered in the details panel's header.

## Clarifications

### Session 2026-10-23

- Q: Can a job's Applied mark be undone after it's set? → A: Yes, from either place (the row's
  green checkmark or the panel's "Applied ✓"), after the owner confirms "Mark as not applied?".
  Undoing clears the mark and its time.
- Q: After the owner clicks Hide in the details panel, should the panel close, or stay open with
  that button turned into Unhide? → A: The panel closes once the hide is saved; the owner is back
  on the list.
- Q: Which time zone should Applied times be shown in? → A: Stored as UTC; shown in the browser's
  own time zone.
- Q: When the details panel is open for a job that's already hidden, what should be in Hide's place
  in the header? → A: Hide is shown but disabled, labelled as already hidden.
- Q: Should the panel's Hide be the same Hide the rows already have, setting the existing hidden
  flag? → A: Yes: one hidden flag; Recommended drops the job, and Unhide on All jobs brings it back.

## Delivery

As with earlier features, this ships as **small pull requests** merged and tried in the UI one at a
time (about 10 files each, tests included). A likely split:
1. **Recording Applied**: the stored applied state and time, and the row's question-mark /
   checkmark (US1).
2. **The panel's Applied button** and its "Applied ✓" state (US2).
3. **The panel's Hide button** (US3).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mark a job applied from the list (Priority: P1)

Each job row shows whether the owner has applied. A job not yet applied to shows a blue
question-mark icon; clicking it marks the job applied, and the icon becomes a green checkmark. The
mark is saved, so it is still there after a reload, on both tables and in the panel.

**Why this priority**: It's the core of the request: knowing at a glance which jobs have already
been applied to.

**Independent Test**: On All jobs, click a job's question-mark icon. It turns into a green checkmark
at once, and stays a checkmark after reloading the page.

**Acceptance Scenarios**:

1. **Given** a job not applied to, **When** its row is shown, **Then** it shows a blue question-mark
   icon labelled (for screen readers and on hover) as "Mark as applied".
2. **Given** that icon, **When** the owner clicks it, **Then** the icon becomes a green checkmark,
   and after a reload the job is still shown as applied, with the time it was marked.
3. **Given** the save fails, **When** the owner clicks the icon, **Then** the row keeps its
   question mark and says the change couldn't be saved, as Hide does today.
4. **Given** a job already applied to, **When** its row is shown, **Then** it shows the green
   checkmark, labelled as applied with the date it was marked.
5. **Given** a keyboard user, **When** they tab through a row, **Then** they reach the applied icon
   as its own control, separate from the posting link and Hide.
6. **Given** a job applied to, **When** the owner clicks its green checkmark and confirms "Mark as
   not applied?", **Then** the row returns to the blue question mark and the stored time is
   cleared; if they decline, nothing changes.

---

### User Story 2 - Mark a job applied from the details panel (Priority: P1)

While reading a job in the details panel, the owner can mark it applied without going back to the
list. The panel's header shows, left to right: a green **Applied** button, **Hide**, **Close**.
After Applied is clicked, the button is replaced by the word "Applied" with a green checkmark; Hide
and Close stay. The job's row in the list updates to the green checkmark at the same time.

**Why this priority**: The panel is where the owner reads a job and decides to apply, so marking it
there is the natural moment.

**Independent Test**: Open a job's panel, click Applied. The button gives way to "Applied ✓", the
row behind the panel shows the green checkmark, and both survive a reload.

**Acceptance Scenarios**:

1. **Given** the panel for a job not applied to, **When** it opens, **Then** its header shows a
   green Applied button, then Hide, then Close, in that order.
2. **Given** that panel, **When** the owner clicks Applied, **Then** the button is replaced by
   "Applied" with a green checkmark, Hide and Close are unchanged, and the job's row shows the
   green checkmark.
3. **Given** the panel for a job already applied to (from the row, or earlier), **When** it opens,
   **Then** it shows "Applied ✓" instead of the button.
4. **Given** the save fails, **When** the owner clicks Applied, **Then** the button stays and the
   panel says the change couldn't be saved.
5. **Given** a job marked applied from its row while its panel is open, **Then** the panel switches
   to "Applied ✓" too.
6. **Given** the panel shows "Applied ✓", **When** the owner clicks it and confirms "Mark as not
   applied?", **Then** the green Applied button returns, and the row shows the blue question mark.

---

### User Story 3 - Hide a job from the details panel (Priority: P2)

The panel's header has a **Hide** button between Applied and Close, styled like Close. It does what
the row's Hide does today.

**Why this priority**: It saves a trip back to the row, but Hide already works from the list.

**Independent Test**: Open a job's panel on Recommended and click Hide. The job is hidden exactly as
if its row's Hide had been clicked.

**Acceptance Scenarios**:

1. **Given** the panel for a job that isn't hidden, **When** the owner clicks Hide, **Then** the job
   is hidden exactly as by its row's Hide (it leaves Recommended; on All jobs its row shows
   Unhide), and the change is saved.
2. **Given** that click, **When** the save succeeds, **Then** the panel closes and the owner is back
   on the list (on Recommended, the job's row is gone; on All jobs, it shows Unhide).
3. **Given** the save fails, **When** the owner clicks Hide, **Then** nothing changes, the panel
   stays open and says the change couldn't be saved.
4. **Given** the panel for a job that is already hidden (opened from All jobs), **When** it opens,
   **Then** Hide is shown in its place but disabled, labelled (for screen readers and on hover) as
   already hidden, and clicking it does nothing.

### Edge Cases

- **Applied and hidden together**: the two are independent; a job can be both. Hiding an applied
  job doesn't clear Applied, and marking a hidden job applied doesn't unhide it.
- **Applied jobs on Recommended**: an applied job stays on Recommended (only Hide removes jobs
  there), showing the green checkmark.
- **Changing your mind**: Applied can be undone from the row's checkmark or the panel's
  "Applied ✓", after confirming "Mark as not applied?" (FR-013). Declining the confirmation changes
  nothing; marking the job applied again later records the new time.
- **Clicking twice / two tabs**: marking an already-applied job applied again keeps the first time
  it was marked.
- **A job pruned or missing**: marking a job that no longer exists reports that it couldn't be
  saved, as Hide does ("No such job.").
- **Agent runs**: a run that fetches the job again or scores it again keeps its applied state and
  time, as it keeps the hidden flag today.
- **Cross-site requests** to mark a job applied are refused, as they are for Hide.
- **JavaScript off**: the icon shows the saved state; marking needs JavaScript, and the page's
  existing note says so. Without JavaScript the browser's time zone is unknown, so the label may
  leave out the date.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: myjobbot MUST record, per job, whether the owner has applied to it and, when they
  have, the moment it was marked. A job with no record MUST read as not applied.
- **FR-002**: Every row in the Recommended and All jobs tables MUST show the job's applied state:
  a blue question-mark icon when not applied, a green checkmark when applied. Each MUST have an
  accessible label ("Mark as applied" / "Applied on <date>").
- **FR-003**: Clicking the question-mark icon MUST mark the job applied and save it, and the row
  MUST switch to the checkmark once the save succeeds. A failed save MUST leave the row unchanged
  and say so.
- **FR-004**: The details panel's header MUST show, left to right: Applied (green, only when the job
  isn't applied to), Hide (styled like Close), Close.
- **FR-005**: Clicking the panel's Applied MUST mark the job applied as FR-003 does; on success the
  button MUST be replaced by "Applied" with a green checkmark, while Hide and Close stay.
- **FR-006**: The panel and the job's row MUST always agree on the applied state, whichever one
  made the change.
- **FR-007**: The panel's Hide MUST change the job's hidden flag exactly as the row's Hide does, with
  the same effect on each table and the same failure message. Once the hide is saved, the panel
  MUST close; on a failed save it MUST stay open. The panel never offers Unhide: for a job already
  hidden, Hide MUST be shown disabled and labelled as already hidden.
- **FR-008**: The applied state and time MUST survive agent runs, re-fetches and re-scoring.
- **FR-009**: Marking an already-applied job applied MUST keep its original time.
- **FR-010**: Marking a job applied MUST refuse cross-site requests and malformed requests, as Hide
  does.
- **FR-011**: The applied time MUST be stored as UTC and shown as a date (and time where shown in
  full) in the browser's own time zone. The page MUST NOT show a different date or time first and
  then change it once it becomes interactive.
- **FR-012**: Applied MUST NOT change which jobs Recommended lists, how jobs are scored, or what the
  model sees.
- **FR-013**: The owner MUST be able to undo Applied from the row's green checkmark or the panel's
  "Applied ✓", only after confirming "Mark as not applied?". Undoing MUST clear both the mark and its
  time; declining MUST change nothing, and a failed save MUST leave the job applied and say so.

### Key Entities

- **Applied mark**: on a job; whether the owner has applied and when it was marked. Set by the
  owner from the UI, never by the agent.
- **Hidden flag** (existing): on a job; set by Hide, removes the job from Recommended. This feature
  only adds another place to set it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any row or open panel, the owner marks a job applied in one click.
- **SC-002**: The change shows within half a second on the home network, like Hide.
- **SC-003**: After a reload, every job marked applied still shows as applied, with the time it was
  marked; none is lost to an agent run.
- **SC-004**: The owner can tell at a glance, for every row of either table, whether they've applied.
- **SC-005**: Every existing Hide scenario (rows, Recommended removal, Unhide on All jobs, failures,
  cross-site refusal) still passes unchanged.

## Assumptions

- **Hide is the existing Hide.** The panel's Hide reuses the stored hidden flag and its behaviour on
  each table; there is no new kind of hiding and no new stored field for it. A hidden job comes back
  as it does today, through Unhide on All jobs. (Confirmed by the owner, 2026-10-23.)
- **Recording is per job**, with one owner; there's no list of applications, notes, or status
  beyond applied / not applied (e.g. no "interviewing" or "rejected"). Those would be a later
  feature.
- **The marked time is when the owner clicks**, not an application date they type in.
- **Reasoning page** keeps its current columns; the applied icon is only on Recommended and All
  jobs.
- **Storage detail for planning**: whether the applied state is its own stored yes/no beside the
  time, or simply "the time is set", is a design choice left to `/speckit-plan` (the request named
  `applied` and `applied_on`). Either way it is a numbered migration with the
  schema and the store contract updated.
