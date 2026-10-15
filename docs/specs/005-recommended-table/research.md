# Research: Tighter job tables

## R1. Hover-over for the score breakdown

- **Decision**: a CSS-only tooltip. The score is `<span class="score" tabindex="0">` holding a
  `<span role="tooltip" class="tip">` with the note, shown by `:hover` and `:focus-within`. The
  number gets `aria-describedby` pointing at the tip.
- **Rationale**: it opens on keyboard focus (FR-003), and a tap focuses it on touch screens. It
  needs no client JavaScript, so it behaves the same in server-rendered rows and in rows added by
  infinite scroll. The text stays in the page, so tests can read it.
- **Alternatives**:
  - The native `title` attribute: no keyboard reveal, and an OS delay of about 1 s.
  - A React state popover: needs client code in every row.
  - A tooltip library: a new dependency for one hover.

## R2. Truncating titles to 64 characters

- **Decision**: a pure `shortTitle(title, limit = 64)` in `src/web/shortTitle.ts`. It splits into
  graphemes with `Intl.Segmenter` (built into Node 24 and browsers), keeps the first 64, appends
  "…" when it cut anything, and trims trailing spaces before the "…". The row view gets
  `shortTitle`; `title` stays the full text.
- **Rationale**: "characters as people read them" (spec assumption): an emoji or accented letter
  is never split. Doing it in the row view makes it unit-testable and the same for both pages.
- **Alternatives**:
  - CSS `text-overflow: ellipsis`: it cuts by pixel width, not 64 characters, and needs
    single-line cells.
  - `string.slice(0, 64)`: splits surrogate pairs.

## R3. Keeping "Why" from widening the table

- **Decision**: give the title cell `class="title-cell"` with `overflow-wrap: anywhere` and
  `min-width: 16em`. Give Score `class="score-col"` with `width: 1%; white-space: nowrap`.
- **Rationale**: `anywhere` lowers the cell's min-content width, so in automatic table layout a
  long URL in the reasons wraps instead of forcing the column wide. The 1% width shrinks Score to
  its content.
- **Alternatives**:
  - `table-layout: fixed`: every column would need a set width, which changes columns the spec
    says to leave alone.
  - `word-break: break-all`: breaks ordinary words too.

## R4. Checking the 1280-pixel width (SC-001)

- **Decision**: a manual check in the quickstart. The owner opens both pages at 1280 px wide, or
  checks `document.querySelector('.table').scrollWidth <= clientWidth` in the console.
- **Rationale**: this machine has no Playwright browser (found in 004 T038). Installing one just
  for this is out of proportion, and happy-dom doesn't lay out pages.
- **Alternatives**: install Playwright's Chromium (about 150 MB download) and add a browser test.
  Deferred; the owner can ask for it.

## R5. Removing the Scored column

- **Decision**: drop `scoredDate` from `JobRowView` and its cell, and drop "Scored" from
  `JOB_HEADERS`. `scored_at` stays in storage and in the Reasoning page's "Scored at".
- **Rationale**: an unused view field would be dead code.
