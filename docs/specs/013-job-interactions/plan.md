# Implementation Plan: Job interactions (Applied and Hide)

**Branch**: `013-job-interactions` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/013-job-interactions/spec.md`

## Summary

The owner can mark a job **Applied** from its row (a blue `?` that becomes a green `✓`) or from the
details panel (a green Applied button that becomes "Applied ✓"), and undo it from either after a
confirmation. Migration `008_applied` adds `applied` and `applied_on` to `jobs`. One store method
sets or clears both, keeping the first time on a repeat mark. A server action beside `setJobHidden`
stamps the server's time. The browser shows the date (`YYYY-MM-DD`) in its own zone, without a
different date first. Applied jobs are never pruned. The panel's header also gains **Hide**: it
reuses the rows' Hide, closes the panel once saved, and is disabled for a job already hidden. Hide
and Applied share one save hook and one failure note, so neither duplicates the other.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx), React 19 / Next.js 16 for the web UI

**Primary Dependencies**: no new ones; existing Kysely 0.29, zod 4, Next.js server actions

**Storage**: MariaDB through Kysely; migration `008_applied` adds two columns (research R1)

**Testing**: vitest (`node`, `dom` on happy-dom 21, and `integration` projects); the store contract
runs on memory and on `myjobbot_test`

**Target Platform**: the Docker stack on the owner's LAN (agent and web UI)

**Project Type**: CLI agent plus a Next.js web UI in one repository

**Performance Goals**: a mark shows within half a second (SC-002), one `UPDATE` and one `SELECT` by
primary key

**Constraints**: the time comes from the server; it is shown in the browser's zone without a
different value first (FR-011); cross-site requests refused (FR-010)

**Scale/Scope**: about 1,040 stored jobs; one owner

## Constitution Check

*Checked against constitution v2.3.0. GATE passes before Phase 0 and again after Phase 1.*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. Functions already near the 20-line limit get helpers, not lines: `toJobRowView` (19 lines) gains one `...appliedMark(job)` spread, and `JobRows` (20, the limit) hands its handlers to a new `useJobChanges` hook. `DetailsPanel.tsx` (143 lines) gets smaller as its header moves out, and the header's UI tests get their own file, since `detailsPanel.test.tsx` is at 135 of 200 lines. Hide and Applied share `useSave` and `SaveFailedNote` (S2), so jscpd finds no copies. Every export has a production importer in another file, in the sitting that adds it, since habit-hooks' knip pass without the tests reports test-only code; pure functions a single hook uses (`saveOutcome`, `appliedRequest`) live in their own modules (tasks, "Within each sitting"). |
| II. Test-first | Pass. Tests precede code in every sitting. The 37 new tests are 32 unit, 2 integration and 3 UI. That moves the mix from 83.9 / 7.7 / 8.35 to 84.1 / 7.6 / 8.33, toward 95 / 4 / 1. Decisions are plain functions (`saveOutcome`, `appliedRequest`, `rowLabel`, `appliedFact`, `withJobApplied`, `panelApplied`, `panelHide`, and `setAppliedFor`'s validation), and the store's behaviour is one bundled contract case (R12). |
| III. Purpose comments | Pass. Every new function, component and hook gets its one-line doc comment. The tasks also update every existing doc comment whose purpose changes: `upsertAll` and `pruneLastSeenBefore` (T009, T032), `JobRows`, `JobRow`, `JobTable`, `usePageRows`, `AppliedMark` (T017, T023, T035, T036, T038), `usePanelJob`, `PanelContent` and `JobSection` (T045, T046, T048). |
| IV. Bounded, locked dependencies | Pass. No new library. React's `useSyncExternalStore` reads the browser's zone; `Intl.DateTimeFormat("sv-SE")` formats dates as `gmailPanel.ts` does; Next.js server actions carry the change; the browser's `confirm` asks before an undo. Migration 008 uses the schema builder with a `` sql`tinyint` `` fragment, and the mark uses `eb.fn.coalesce` (R2). |
| V. Specs in docs/specs | Pass. |

## Project Structure

### Documentation (this feature)

```text
docs/specs/013-job-interactions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/job-actions.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── migrations/008_applied.ts, migrations/index.ts, schema.ts   # PR 1
│   ├── rows.ts                  # applied, applied_on parsed (PR 1)
│   ├── store.ts                 # AppliedChange, JobViews.setApplied (PR 4)
│   └── kysely/jobViews.ts       # JOB_COLUMNS (PR 1); setApplied (PR 4)
│       kysely/jobStore.ts       # upsertAll comment (PR 1); prune skips applied jobs (PR 4)
└── web/api.ts, rowViews.ts      # JobRowView.applied, appliedOn via appliedMark() (PR 1)

web/
├── lib/
│   ├── saveOutcome.ts, useSave.ts   # the pure outcome, and the hook that imports it (PR 2)
│   ├── useHide.ts               # moved onto useSave (PR 2)
│   ├── useJobChanges.ts         # markHidden (PR 2); markApplied (PR 4); hideFromPanel (PR 6)
│   ├── appliedTime.ts           # rowLabel, useLocalTimeZone (PR 3); appliedFact (PR 5); appliedLabel private
│   ├── rows.ts, actions.ts      # setAppliedFor, setJobApplied (PR 4)
│   ├── appliedRequest.ts, useApplied.ts   # the pure request, and the hook that imports it (PR 4)
│   ├── pageRows.ts, usePageRows.ts   # withJobApplied, markApplied (PR 4)
│   ├── useOpenJob.ts            # noteHidden → noteChange (PR 5)
│   └── panelActions.ts          # panelApplied (PR 5); panelHide (PR 6)
├── components/
│   ├── forms/SaveFailedNote.tsx, HideButton.tsx   # PR 2
│   ├── forms/AppliedButton.tsx  # the row's clickable mark (PR 4)
│   ├── tables/AppliedMark.tsx   # the ? / ✓ glyph and label (PR 3); inButton (PR 4)
│   ├── tables/Tables.tsx, JobRow.tsx   # the leading Applied column (PR 3); onApplied (PR 4)
│   ├── pages/RowsList.tsx       # useJobChanges (PR 2); noscript text (PR 4)
│   └── panel/
│       ├── PanelHeader.tsx      # heading, div.details-actions: PanelApplied (PR 5), PanelHide (PR 6), Close
│       ├── DetailsPanel.tsx     # uses PanelHeader; onApplied (PR 5), onHidden (PR 6)
│       └── JobSection.tsx       # "Applied" fact (PR 5)
└── app/styles.css               # colours (PR 3), buttons (PR 4, 5)

tests/
├── helpers/appliedContract.ts   # one bundled case (PR 4), run by storeContract.test.ts and
│                                #   integration/storeContract.test.ts
├── helpers/memoryJobViews.ts, memoryStore.ts, rowFixtures.ts   # defaults (PR 1); setApplied, prune (PR 4)
├── integration/migrate.test.ts  # migration 008 (PR 1)
├── pageData.test.ts, jobDetail.test.ts (PR 1), saveOutcome.test.ts (PR 2), appliedTime.test.ts
│   (PR 3, 5), webRows.test.ts, pageRows.test.ts, appliedRequest.test.ts (PR 4),
│   panelActions.test.ts (PR 5, 6)   # unit
└── client/applied.test.tsx (PR 4), panelHeader.test.tsx (PR 5, 6)   # 3 UI tests
    client/rowsList.test.tsx (PR 3, 4), jobRow.test.tsx (PR 4)   # updated, no new tests

README.md                        # "only writes" (PR 4); Applied, the panel, the cleanup (PR 6)
CLAUDE.md                        # the applied mark's rule (PR 6)
```

**Structure Decision**: no new folders. The applied mark follows Hide's path file for file (store →
`web/lib/rows.ts` → server action → hook → button), on a save hook the two share.

## Delivery (research R12)

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contract, quickstart, tasks | — |
| 1 | S1 | Migration 008, row parsing and views (~12 files) | Nothing visible; the columns exist |
| 2 | S2 | `saveOutcome`, `useSave`, `SaveFailedNote`, `useJobChanges`: Hide moved onto them (~9) | Hide works exactly as before |
| 3 | S3 | The Applied column, read-only (~8) | Every row shows a blue `?` |
| 4 | S4 | `setApplied`, the cleanup rule, the action, the clickable mark with undo (~25) | Mark and undo from rows (US1) |
| 5 | S5 | Panel header: Applied / "Applied ✓", in step with the row; the Job section's date (~10) | Mark and undo from the panel (US2) |
| 6 | S6 | Panel header: Hide, closing the panel, disabled when hidden; README, CLAUDE.md (~8) | Hide from the panel (US3) |

PR 4 is past the usual ten files because the store method, the server action and the click have to
land together: split apart, each half would leave code only tests use, which habit-hooks reports.
The owner is told when it opens.

## Complexity Tracking

No constitution violations to justify.
