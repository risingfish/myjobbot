---
description: "Tasks for feature 005: tighter job tables"
---

# Tasks: Tighter job tables

**Input**: Design documents from `docs/specs/005-recommended-table/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/job-table.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind.

**Organization**: grouped by user story and planned in sittings. A sitting may span turns, is done
in the main checkout on `005-recommended-table` with the Docker stack stopped, ends with
`npm run check` and `npm run check:db` green, and is the commit point. The owner asked on
2026-10-15 for a commit between sittings.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3 from spec.md

---

## Phase 1: Setup

### Sitting S0: stop the stack and get a green baseline (T001–T002)

- [X] T001 Stop the stack (`docker compose stop`; no `docker:watch`), after
  `docker compose top myjobbot` shows no run in progress. It is production since feature 004, so
  scheduled runs pause until the merge. Create `.specify/sitting-in-progress` naming S0.
- [X] T002 Run `npm run check` and `npm run check:db` on the clean branch to record the
  baseline: node 221, dom 26, integration 20 tests. Delete the marker. There is nothing to commit
  except the spec docs; commit them with the owner's standing OK
  ("Plan the tighter job tables (005)").

---

## Phase 2: Foundational

None. Every story touches only the existing job-table components and `src/web/`.

---

## Phase 3: User Story 1: scan without sideways scrolling (P1) 🎯 MVP

**Goal**: number-only Score, 64-character titles, no Scored column, on Recommended and All Jobs.

**Independent Test**: render a job row and the job table: headers have no Scored, a 70-character
title shows 64 characters + "…", and the Score cell shows only the number.

### Sitting S1: Stories 1 and 2, the score and title columns (T003–T011)

Stories 1 and 2 share a sitting so the score breakdown is never missing from the page at a commit.

#### Tests first

- [X] T003 [P] [US1] **Unit**: write `tests/shortTitle.test.ts` for `shortTitle(title, limit)`
  from `src/web/shortTitle.ts`:
  - a title of 10 characters is returned unchanged
  - exactly 64 characters is returned unchanged, with no "…"
  - 65 characters returns the first 64 + "…"
  - a cut that lands after a space trims the space before the "…"
  - a title of 70 emoji or accented letters built from combining marks cuts after 64 graphemes
    without splitting one

  5 tests. They fail until T005.
- [X] T004 [P] [US1] **Unit**: in `tests/pageData.test.ts`, add one test: a stored job titled with
  80 characters gives a row whose `shortTitle` is 64 characters + "…", whose `title` is the full
  80, and which has no `scoredDate` key. Fails until T006.
- [X] T005 [US1] **UI**: update `tests/client/jobRow.test.tsx` and `tests/helpers/rowFixtures.ts`:
  - The fixture gets `shortTitle` and drops `scoredDate`.
  - Change "the score cell shows the boosted score and its note": the `.score` text starts with
    "75", the note sits in `[role=tooltip]` inside it, and the cell has no other visible text. A
    score with an empty note has no tooltip and no `tabindex`. An unscored row has an empty
    `td.score-col`.
  - New test: `JobTable`'s header row is exactly Score, Title, Company, Location, Remote, Source,
    Posted and "", and a row has 8 cells.
  - New assertion in the link test: a row whose `shortTitle` differs from `title` shows
    `shortTitle` as the link text, with `title` attribute = full title.

  Fails until T007–T009.

#### Implementation

- [X] T006 [US1] Create `src/web/shortTitle.ts`: `shortTitle(title: string, limit = 64): string`.
  It splits with `Intl.Segmenter(undefined, { granularity: "grapheme" })`, returns `title` when it
  has ≤ `limit` graphemes, and otherwise returns the first `limit`, `trimEnd()`, + "…". Doc
  comment. T003 passes.
- [X] T007 [US1] In `src/web/api.ts`, `JobRowView` gets `shortTitle: string` and loses
  `scoredDate`. In `src/web/rowViews.ts`, `toJobRowView` sets
  `shortTitle: shortTitle(job.title)` and drops `scoredDate`; delete `dateOnly` only if nothing
  else uses it (`posted` does, so keep it). T004 passes; typecheck points at every display use.
- [X] T008 [US1] In `web/components/tables/Tables.tsx`, drop "Scored" from `JOB_HEADERS`. In
  `web/components/tables/JobCells.tsx`, `WhenCells` drops the scored `<td>` (update its doc
  comment: "when it was posted and how long it has been open").
- [X] T009 [US1] In `web/components/tables/TitleCell.tsx`, the `<td>` gets `className="title-cell"`,
  and the link shows `job.shortTitle`. When it differs from `job.title`, the link gets a `title`
  attribute with the full title. Add a `title` prop to `web/components/common/ExternalLink.tsx`
  if it lacks one.

### Phase 4: User Story 2: the score breakdown on demand (P2), in sitting S1

**Goal**: the breakdown appears on hover and keyboard focus.

**Independent Test**: T005's tooltip assertions, plus quickstart step 3 in a browser.

- [X] T010 [US2] Create `web/components/tables/ScoreTipCell.tsx`, following
  `contracts/job-table.md`:
  - `<td className="score-col">`, empty when the score is null.
  - With an empty note: `<span className="score">{value}</span>`.
  - With a note: `<span className="score" tabIndex={0} aria-describedby={id}>{value}`, then
    `<span role="tooltip" id={id} className="tip">{note}</span></span>`, with `id` from React's
    `useId()`.

  Use it in `web/components/tables/JobRow.tsx` in place of `ScoreCell`. `VerdictRow` keeps
  `ScoreCell`, so `/reasoning` is unchanged. In `web/app/styles.css`:
  - `.score-col { width: 1%; white-space: nowrap }`
  - `.score { position: relative }`
  - `.tip` hidden (`display: none`), positioned under the number, card background, border,
    `white-space: normal`, `width: max-content; max-width: 24em`, `z-index: 1`
  - `.score:hover .tip, .score:focus .tip { display: block }`

  T005 passes.
- [X] T011 Close S1: `npm run check` and `npm run check:db` green; the ledger is updated; delete
  the marker. Commit ("Narrow the job tables' score and title columns (005 S1)").

S1 notes (2026-10-15):
- **Header check**: `tests/client/rowsList.test.tsx` already checked the job table's headers, so it
  was updated in place instead of adding T005's header test.
- **Cut-title check**: folded into the existing link test.
- **Tooltip test**: the old score test became two, so UI is +1.
- **Renames**: `WhenCells` became `WhenCell`, since it now renders one cell.
- **Split for the line limit**: `ScoreTipCell` was split into the cell and `ScoreNumber`.
- **Walkthrough**: `docs/react-walkthrough.md` now names the new components.
- **Result**: node 227, dom 27, integration 20, all green.

**Checkpoint**: Stories 1 and 2 work on both pages.

---

## Phase 5: User Story 3: full title and wrapping "Why" (P3)

**Goal**: an opened "Why" never widens the table.

**Independent Test**: quickstart step 5 in a browser (layout can't be measured in happy-dom).

### Sitting S2: wrapping, docs and the browser check (T012–T015)

- [ ] T012 [US3] In `web/app/styles.css`, add `.title-cell { overflow-wrap: anywhere;
  min-width: 16em }`. Also `.title-cell details ul { overflow-wrap: anywhere }` if the list
  doesn't inherit it. No test: CSS layout is checked in T014 (research R4).

---

## Phase 6: Polish, in sitting S2

- [ ] T013 [P] In `README.md`, update any description of the job table's columns (Scored and the
  score breakdown), if one exists. Grep for "Scored" and "breakdown".
- [ ] T014 Run `quickstart.md`'s manual steps 1–8 with the owner's browser, or, without one,
  `npm run web` plus a by-hand check of the console expression from step 1. Record the results in
  Notes. Restart the stack (`npm run docker:up`) only after the merge.
- [ ] T015 Close S2: `npm run check` and `npm run check:db` green; delete the marker; commit
  ("Wrap the title column (005 S2)"); with the owner's OK, push and open the PR.

---

## Dependencies & Execution Order

- **S0** → **S1** → **S2**, in that order.
- Within S1:
  - The tests (T003–T005) come before the code; T003 and T004 are [P].
  - T006 → T007 → (T008, T009) → T010 → T011.
- US2 depends on US1's `JobRow` change, and US3 depends on T009's `title-cell` class.

## Parallel Example: Sitting S1

```text
Task: "Unit tests for shortTitle in tests/shortTitle.test.ts"           (T003)
Task: "Unit test for the row view's shortTitle in tests/pageData.test.ts" (T004)
```

## Implementation Strategy

- **MVP**: S1 delivers Stories 1 and 2, the bulk of the narrowing.
- **S2**: adds wrapping and the browser check.
- **Rollback**: revert the merge; there is no data or schema change.

## Test mix ledger (constitution Principle II, 95/4/1)

| | Unit (node) | Integration | UI (dom) |
|---|---|---|---|
| Baseline (T002) | 221 | 20 | 26 |
| S1 adds | +6 (T003: 5, T004: 1) | 0 | +1 (T005 header test; the others are changed in place) |
| After S1 | 227 | 20 | 27 |

Every new test is in-memory; the only UI addition is the header test.

## Notes

- `scored_at` stays in storage and on `/reasoning` (FR-001).
- No new dependencies; `Intl.Segmenter` is built in (research R2).
