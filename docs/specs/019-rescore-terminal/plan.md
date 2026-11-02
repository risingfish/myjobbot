# Implementation Plan: Re-score terminal

**Branch**: `019-rescore-terminal` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/019-rescore-terminal/spec.md`

## Summary

Each re-score records its steps as it runs, in two new tables (`rescore_runs`, `rescore_steps`)
through a `RescoreLogStore`. A step is a kind plus app-controlled values; one pure function,
`stepLine`, turns it into the terminal's text, so no page or model text can reach it. The panel's
Re-score starts the run through a server action that returns at once and leaves the work to
Next's `after()`. The browser follows the stored log through a streaming Route Handler (Server-Sent
Events), which also serves reopened, finished and CLI runs. The terminal sits under the panel's
header, styled with Pico's monospace font and colours. History becomes one list, with a Log action
on every re-score. Only one re-score of a job runs at a time; a run open for 10 minutes counts as
failed.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx); Next.js 16.4 and React 19 for the web UI

**Primary Dependencies**: no new ones. Next's `after()` and Route Handlers, the browser's
`EventSource`, Kysely 0.29, zod 4

**Storage**: MariaDB, migration `014_rescore_runs` (data-model.md)

**Testing**: vitest (`node`, `dom`, `integration`); a `RescoreLogStore` contract run on memory and
on `myjobbot_test`

**Target Platform**: the Docker stack on the owner's LAN

**Project Type**: CLI agent plus a Next.js web UI in one repository

**Performance Goals**: terminal open within 1 s of pressing Re-score (SC-001); each line within
1 s of its step (SC-002: 400 ms polling)

**Constraints**: lines only from `stepLine` (FR-003); the trace file unchanged (FR-009); one run
per job (FR-014); no new library

**Scale/Scope**: one owner; a run has tens of steps; one or two open terminals

## Constitution Check

*Checked against constitution v2.4.0. GATE passes before Phase 0 and again after Phase 1.*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. New small files: `steps.ts` (kinds and `stepLine`), `log.ts` (`RescoreLog`), `traceSteps.ts`, the store pair, the route handler, `useRescoreLog`, `RescoreTerminal`, `history.ts`. `src/db/store.ts` (197 lines) gets only the `rescoreLog` field on `Stores` and its import (≤ 200); the store's interface has its own file, as `SourceStore` does. Every export lands with its production caller in its PR. `knip.json`'s Next entries gain `web/app/**/route.ts`. |
| II. Test-first | Pass. Tests precede code in each sitting (in S3–S4, in the same turn as it). 27 unit, 2 integration (the store contract on MariaDB), 1 UI (the terminal): 790 / 61 / 63 becomes 817 / 63 / 64, and every share moves toward 95 / 4 / 1. The decisions are plain functions: `stepLine`, `stepFromAudit`, `stepsFromTrace`, `historyRows`, the open-run rule, the SSE event builder. |
| III. Purpose comments | Pass. Every new function gets its one-line doc comment; changed purposes are updated (`rescore`, `openRescore`, `rescoreCommand`, `PanelRescore`, `HistorySection`, `pruneLastSeenBefore`, `rescoreNote`). |
| IV. Bounded, locked dependencies | Pass. Kysely schema and query builders only; Next's `after()` and Route Handler streaming as documented; `EventSource` as the browser's own SSE client; Pico variables for styling. No new library. |
| V. Specs in docs/specs | Pass. |
| Workflow (2.4.0) | Pass. S1–S2 add a migration and change the run, so the stack is stopped. S3–S4 add no migration and touch none of the run's paths (`src/agent/`, `src/tools/`, `src/sources/`, `src/careers/`, `src/app/`): they change the web UI and `src/web/`, so they are UI work and the stack may keep running. Every turn then ends clean: each S3–S4 test task lands in the same turn as the code that makes it pass. |

## Project Structure

### Documentation (this feature)

```text
docs/specs/019-rescore-terminal/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/rescore-log.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── db/migrations/014_rescore_runs.ts, index.ts, schema.ts   # the two tables (PR 1)
├── db/rescoreLogStore.ts                  # the store's interface and types (PR 1)
├── db/kysely/rescoreLogStore.ts, stores.ts, jobStore.ts     # Kysely store; prune with the job, deleteOrphansOf (PR 1)
├── rescore/steps.ts                       # step kinds, fields, stepLine (PR 2)
├── rescore/log.ts                         # RescoreLog: stamp, store, notify (PR 2)
├── rescore/traceSteps.ts                  # trace events and audit rows → steps (PR 2)
├── rescore/rescore.ts, open.ts, session.ts, oneJobStore.ts   # steps from the flow (PR 2)
├── cli.ts                                 # prints lines; refuses a second run (PR 2)
├── web/history.ts, jobDetail.ts, api.ts   # one History list (PR 4)
├── web/rescoreNote.ts                     # notes from RescoreEnd (PR 3)
└── web/rescoreStream.ts                   # the SSE events for a run, as a plain function (PR 3)

web/
├── app/api/rescores/[id]/route.ts         # the streaming Route Handler (PR 3)
├── lib/actions.ts, rows.ts                # startRescore with after(); rescoreJob removed (PR 3); loadDetailsFor reads runs (PR 4)
├── lib/uiState.ts                         # exposes rescoreLog (PR 4)
├── lib/useRescoreLog.ts, useRescoreTerminal.ts, useRescore.ts   # EventSource → lines; the panel's terminal state (PR 3)
├── components/panel/RescoreTerminal.tsx, PanelRescore.tsx, PanelHeader.tsx, DetailsPanel.tsx   # (PR 3)
├── components/panel/HistorySection.tsx    # Log actions (PR 4)
└── app/styles.css                         # terminal styles from Pico variables (PR 3)

tests/
├── helpers/rescoreLogContract.ts, memoryRescoreLog.ts, testDb.ts, storeContract.test.ts, integration/storeContract.test.ts, integration/migrate.test.ts   # (PR 1)
├── rescoreSteps.test.ts, rescoreLog.test.ts, traceSteps.test.ts, rescore.test.ts   # (PR 2)
├── rescoreStream.test.ts, webRows.test.ts, rescoreNote.test.ts, client/rescoreTerminal.test.tsx, client/panelRescore.test.tsx, client/panelHeader.test.tsx, client/panelPostingLink.test.tsx, client/detailsPanel.test.tsx   # (PR 3)
└── history.test.ts, jobDetail.test.ts, client/panelSections.test.tsx   # (PR 4)
```

**Structure Decision**: the step model lives with the re-score in `src/rescore/`, framework-free;
the web side only starts runs and relays stored lines.

## Delivery

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contract, quickstart, tasks; constitution 2.4.0 with CLAUDE.md and the tasks template | — |
| 1 | S1 | migration 014, `RescoreLogStore` (Kysely, memory, contract), pruning with the job, the test-database table list (~11 files with tests) | nothing visible; `check:db` |
| 2 | S2 | steps and `stepLine`, `RescoreLog`, capture in the flow, lookup and session; runs recorded; CLI prints lines and refuses a second run (~11) | `npm start -- rescore …` prints the log |
| 3 | S3 | `startRescore` with `after()`, the SSE Route Handler, `useRescoreLog`, `useRescoreTerminal`, `RescoreTerminal`, panel wiring, styles, knip entry (~13, plus updated panel tests) | press Re-score and watch it |
| 4 | S4 | History as one list with Log; reopen a running run (~9) | Log from History |
| 5 | S5 | README, CLAUDE.md, ledger (~3) | — |

## Complexity Tracking

No constitution violations to justify.
