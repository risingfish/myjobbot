# Feature Specification: Tighter job tables

**Feature Branch**: `005-recommended-table`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "The next spec is UI. Recommended Tab, table columns: Score: make the
score summary a hover-over and reduce the width of the column. Title: truncate to maybe 64 chars
and make the "Why" text in it wrap. Company, Location, Remote, Source, Posted: no change. Scored:
remove column (leave data in database)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan recommendations without sideways scrolling (Priority: P1)

The owner opens Recommended to decide which jobs to apply for. Today the score breakdown, long
titles and the opened "Why" text push the table wider than the window. After this change, each row
shows the score as a single number in a narrow column, a title of at most 64 characters, and no
Scored column, so the whole table fits a normal laptop window.

**Why this priority**: The table's width is the problem being fixed; this story alone delivers it.

**Independent Test**: Load Recommended with jobs whose titles run past 64 characters and whose
scores have breakdowns; check the column set, the title lengths and the table's width.

**Acceptance Scenarios**:

1. **Given** a recommended job titled with more than 64 characters, **When** the page loads,
   **Then** the title shows its first 64 characters followed by "…", and still links to the
   posting.
2. **Given** a recommended job titled with 64 characters or fewer, **When** the page loads,
   **Then** the title shows in full with no "…".
3. **Given** any recommended job, **When** the page loads, **Then** the headers are Score, Title,
   Company, Location, Remote, Source, Posted and the action column, with no Scored column.
4. **Given** a recommended job with a score breakdown, **When** the page loads, **Then** the
   Score cell shows only the number; the breakdown is not printed under it.
5. **Given** a 1280-pixel-wide window and closed "Why" sections, **When** the page loads,
   **Then** the table fits without horizontal scrolling.

---

### User Story 2 - See the score breakdown on demand (Priority: P2)

The owner wants to know why a job scored 75: the model's score and the title boost that raised it.
Pointing at the score shows that breakdown; moving away hides it.

**Why this priority**: It keeps the information Story 1 takes off the page reachable.

**Independent Test**: Hover and keyboard-focus the score of a job with a breakdown; the
breakdown appears. Do the same for a job without one; nothing appears.

**Acceptance Scenarios**:

1. **Given** a job with a breakdown, **When** the owner points at its score, **Then** the full
   breakdown text appears next to it, and disappears when the pointer leaves.
2. **Given** a job with a breakdown, **When** the owner tabs to its score with the keyboard,
   **Then** the same breakdown appears.
3. **Given** a job with no breakdown, **When** the owner points at its score, **Then** nothing
   appears.

---

### User Story 3 - Read the full title and the "Why" without widening the table (Priority: P3)

The owner sometimes needs the whole title, and opens "Why" to read the reasons and gaps. The full
title is available by pointing at the truncated one, and the opened "Why" text wraps inside the
Title column instead of stretching it.

**Why this priority**: Recovers what truncation hides and stops "Why" from undoing Story 1.

**Independent Test**: Point at a truncated title; open "Why" on a job with long reasons.

**Acceptance Scenarios**:

1. **Given** a truncated title, **When** the owner points at it, **Then** the full title appears.
2. **Given** a job whose reasons include a long sentence or an unbroken long word (such as a URL),
   **When** the owner opens "Why", **Then** the text wraps within the Title column and the table
   gets no wider.

---

### Edge Cases

- A title of exactly 64 characters shows in full, with no "…".
- Characters outside the basic alphabet (accents, emoji) count as one character each, and
  truncation never splits one in half.
- The "hidden by you" and filter notes beside a title still show after a truncated title.
- An unscored job (none appear on Recommended today) shows an empty Score cell and no hover.
- Loading more rows by scrolling gives the new rows the same treatment.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Recommended table MUST NOT show a Scored column. Scoring dates MUST stay stored
  and MUST still appear wherever else they appear today (the Reasoning page).
- **FR-002**: The Score cell MUST show only the score number, in a column no wider than its
  header and a three-digit number need.
- **FR-003**: When a score has a breakdown, the breakdown MUST appear when the owner points at the
  score or moves keyboard focus to it, and MUST disappear when they move away. A score without a
  breakdown MUST show nothing extra.
- **FR-004**: A title longer than 64 characters MUST be cut to its first 64 characters plus "…";
  shorter titles MUST show unchanged. The full title MUST appear on pointing at a cut title, and
  the link MUST still open the full posting.
- **FR-005**: The "Why" reasons and gaps MUST wrap within the Title column, including long
  unbroken words, so opening them never widens the table.
- **FR-006**: The Company, Location, Remote, Source and Posted columns MUST look and behave as
  today, including "N days open" and "possible ghost".
- **FR-007**: These changes MUST apply to both job tables, Recommended and All Jobs, which share
  one layout (owner decision, 2026-10-15). The Reasoning page's table is unchanged.
- **FR-008**: Hide and Unhide, infinite scroll, and the page's counts MUST behave as today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With "Why" closed, the Recommended and All Jobs tables fit a 1280-pixel-wide window with no
  horizontal scrolling, using today's production data.
- **SC-002**: No title on the page shows more than 64 characters before its "…".
- **SC-003**: Every score's breakdown is reachable in one pointer move or one keyboard focus, and
  shows the same text the page shows today.
- **SC-004**: Opening "Why" on any job in today's data leaves the table's width unchanged.

## Clarifications

### Session 2026-10-15

- Q: Apply the changes to All Jobs too, since it shares the table? → A: Yes, both pages.

## Assumptions

- "Hover-over" means a tooltip-style reveal on pointer hover and on keyboard focus; on touch
  screens a tap on the score reveals it. The owner uses a laptop browser, so touch is best-effort.
- Truncation counts characters as people read them, not bytes.
- The 64-character limit is fixed, not a setting.
- The Scored column's removal is display-only; nothing in storage, the agent or the Reasoning page
  changes.
- The existing "Why" toggle stays as it is (closed by default, opened by clicking).
