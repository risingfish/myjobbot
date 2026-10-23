# Implementation Plan: Job interactions (Applied and Hide)

**Branch**: `013-job-interactions` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/013-job-interactions/spec.md`

## Summary

The owner can mark a job **Applied** from its row (a blue `?` that becomes a green `✓`) or from the
details panel (a green Applied button that becomes "Applied ✓"), and undo it from either after a
confirmation. Migration `008_applied` adds `applied` and `applied_on` to `jobs`. One store method
sets or clears both, keeping the first time on a repeat mark. A server action beside `setJobHidden`
stamps the server's time. The browser shows the time in its own zone, without a flash on load.
Applied jobs are never pruned. The panel's header also gains **Hide**: it reuses the rows' Hide,
closes the panel once saved, and is disabled for a job already hidden.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx), React 19 / Next.js 16 for the web UI

**Primary Dependencies**: no new ones; existing Kysely 0.29, zod 4, Next.js server actions

**Storage**: MariaDB through Kysely; migration `008_applied` adds two columns (research R1)

**Testing**: vitest (`node`, `dom` and `integration` projects); the store contract runs on memory and
on `myjobbot_test`

**Target Platform**: the Docker stack on the owner's LAN (agent and web UI)

**Project Type**: CLI agent plus a Next.js web UI in one repository

**Performance Goals**: a mark shows within half a second (SC-002), one indexed `UPDATE` and one
`SELECT` by primary key

**Constraints**: the time comes from the server; it is shown in the browser's zone without a
different value first (FR-011); cross-site requests refused (FR-010)

**Scale/Scope**: about 1,040 stored jobs; one owner

## Constitution Check

*Checked against constitution v2.3.0. GATE passes before Phase 0 and again after Phase 1.*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. New code is small components and hooks (`PanelHeader`, `AppliedButton`, `useApplied`, `appliedTime`). `DetailsPanel.tsx` (143 lines) gets smaller by moving its header out (R9). Each store method arrives in the sitting of its first production caller (R12). |
| II. Test-first | Pass. Tests precede code in every sitting. The split is ~30 unit / ~6 integration / 3 UI (R12), which moves today's mix (84 / 8 / 8) slightly toward 95 / 4 / 1. |
| III. Purpose comments | Pass. Every new function, component and hook gets its one-line doc comment. |
| IV. Bounded, locked dependencies | Pass. No new library. React's `useSyncExternalStore` for the browser's zone, Next.js server actions for the change, `window.confirm` for the confirmation. Migration 008 uses the schema builder with a `` sql`tinyint` `` fragment; the mark uses `eb.fn.coalesce` (R2). |
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
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── migrations/008_applied.ts, migrations/index.ts, schema.ts   # PR 1
│   ├── rows.ts                  # applied, applied_on parsed (PR 1)
│   ├── store.ts                 # AppliedMark, JobViews.setApplied (PR 2)
│   └── kysely/jobViews.ts       # JOB_COLUMNS (PR 1); setApplied (PR 2)
│       kysely/jobStore.ts       # pruneLastSeenBefore skips applied jobs (PR 1)
└── web/api.ts, rowViews.ts      # JobRowView.applied, appliedOn (PR 1)

web/
├── lib/
│   ├── rows.ts                  # setAppliedFor (PR 2)
│   ├── actions.ts               # setJobApplied (PR 2)
│   ├── useApplied.ts            # marks or undoes after confirm, tracks saving/failed (PR 2)
│   ├── appliedTime.ts           # appliedLabel, useLocalTimeZone (PR 2)
│   ├── pageRows.ts, usePageRows.ts   # withJobApplied, markApplied (PR 2)
│   └── useOpenJob.ts            # noteHidden → noteChange (PR 3)
├── components/
│   ├── forms/AppliedButton.tsx  # the row's ? / ✓ (PR 2)
│   ├── tables/Tables.tsx, JobRow.tsx   # the leading Applied column (PR 2)
│   ├── pages/RowsList.tsx       # wires rows and panel (PR 2, 3, 4)
│   └── panel/
│       ├── PanelHeader.tsx      # heading, PanelApplied, PanelHide, Close (PR 3, 4)
│       ├── DetailsPanel.tsx     # uses PanelHeader; onApplied, onHidden props (PR 3, 4)
│       └── JobSection.tsx       # "Applied" fact (PR 3)
└── app/styles.css               # applied colours, column, header buttons (PR 2, 3, 4)

tests/
├── helpers/storeContract.ts, memoryJobViews.ts, memoryStore.ts   # contract cases (PR 1, 2)
├── integration/migrate.test.ts  # migration 008 (PR 1)
├── webRows.test.ts, pageRows.test.ts, appliedTime.test.ts, rowViews tests   # unit
└── client/applied.test.tsx, detailsPanel.test.tsx   # 3 UI tests (PR 2, 3, 4)
```

**Structure Decision**: no new folders. The applied mark follows Hide's path file for file (store →
`web/lib/rows.ts` → server action → hook → button), so a reader who knows Hide can follow it.

## Delivery (research R12)

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contract, quickstart, tasks | — |
| 1 | S1 | Migration 008, row parsing and views; the cleanup keeps applied jobs | Nothing visible; the columns exist |
| 2 | S2 | `setApplied`, the server action, the row's `?` / `✓` with undo, browser-zone dates | Mark and undo from rows (US1) |
| 3 | S3 | Panel header: Applied / "Applied ✓", kept in step with the row; the Job section's date | Mark and undo from the panel (US2) |
| 4 | S4 | Panel header: Hide, closing the panel, disabled when hidden; README | Hide from the panel (US3) |

PR 2 is the largest (about 14 files with its tests), because the store method, the action and the
control have to land together for knip to stay clean.

## Complexity Tracking

No constitution violations to justify.
