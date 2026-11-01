# Implementation Plan: Body filters

**Branch**: `018-body-filters` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/018-body-filters/spec.md`

## Summary

A new search setting, `body_filter`, holds two lists of terms, `include` and `exclude`, like the
title filter. A job is kept from the model when its readable description contains an exclude term,
or when the include list has terms and the description contains none of them. Both lists match the
way title filter exclude terms match titles, and a job with no description passes both. It is never deleted, and on All jobs it carries the note "hidden by body filter". The list is
edited in the Settings page's Filters section as two lists. Jobs scored before a term was added keep their
score.

The job panel gains a **Re-score** button. It scores the job at once, in the web server, by running
a small agent session over that one job. The session uses the run's rubric, data markers, trace
files and `record_matches`.
- A job with no description is looked up first through the careers lookup.
- A job that a company, title or body filter now matches is not sent to the model and loses its
  score.
- A failure keeps the old score and shows a fixed message.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx); Next.js 16 and React 19 for the web UI

**Primary Dependencies**: no new ones; the existing zod 4, Kysely 0.29 and openai client, and the
careers lookup

**Storage**: MariaDB. There is no migration: `body_filter` lives in the `user_settings` document,
and clearing a score uses the existing `jobs` columns (research R8).

**Testing**: vitest (`node`, `dom` and `integration` projects); the new re-score contract runs on
memory and on `myjobbot_test`

**Target Platform**: the Docker stack on the owner's LAN. The `web` service joins the `browser`
network (R9).

**Project Type**: CLI agent plus a Next.js web UI in one repository

**Performance Goals**: a re-score normally finishes within 30 seconds, or within 2 minutes when its
description has to be looked up (SC-005). Body filter matching is one in-memory pass per job.

**Constraints**:
- Job text reaches the model only inside a wrapped tool result (FR-014, R6).
- Failure messages are fixed (FR-013).
- Page fetches keep `assertPublic`, the redirect checks and `careers_audit` (R9).
- No new library.
- Next.js runs one server action at a time per client, so a running re-score holds up the page's
  other actions; accepted for one owner (research R5).

**Scale/Scope**: one owner, tens of filter terms, one re-score at a time

## Constitution Check

*Checked against constitution v2.3.0. GATE passes before Phase 0 and again after Phase 1.*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. Matching is its own small file (`src/jobs/bodyFilter.ts`), and the re-score is split into a plan (`src/rescore/plan.ts`), a one-job store (`oneJobStore.ts`), a prompt, a session and a flow (`rescore.ts`), each well under 200 lines. Files near the limit are relieved first, or checked: `src/db/store.ts` (194) takes one line for `clearScore`; `src/app/run.ts` (194 lines) loses `openRunLogs`, `runClients` and `pageRenderer` to `runLogs.ts` and `runParts.ts`. `storeContract.ts` (188) gets no new case; a new `rescoreContract.ts` takes it. `PanelHeader.tsx` gets one line, with the button in `PanelRescore.tsx`. Every new export lands with its production caller in the same PR. |
| II. Test-first | Pass. Tests precede code in every sitting. The split is 39 new unit tests, 2 integration tests (the re-score contract on MariaDB, and `openRescore`, the thin edge that wires the re-score, against a temporary data folder) and exactly 1 UI test (the Re-score button). From 735 / 59 / 62 that gives 774 / 61 / 63, so every share moves toward 95 / 4 / 1 (85.86 → 86.19 unit, 6.89 → 6.79 integration, 7.24 → 7.02 UI; research R11). The decisions are plain functions: `passesBodyFilter`, `filterMatch`, `isWanted`, `filterNote`, `rescoreStep`, `oneJobStore`, `rescoreNote`, `withJobRow`. The CLI command and server action stay thin and are walked through in quickstart §4. |
| III. Purpose comments | Pass. Every new function and component gets its one-line doc comment. Changed purposes are updated: `isWanted`'s, `unscoredJobs`', `filterNote`'s, `recordMatchesTool`'s, `FiltersSection`'s, and the title filter sanitizer's, renamed `filterLists`. |
| IV. Bounded, locked dependencies | Pass. No new library. zod's own schema adds the setting, Kysely's `updateTable` clears the score, and the openai client and `runAgent` are reused as they are. |
| V. Specs in docs/specs | Pass. |

## Project Structure

### Documentation (this feature)

```text
docs/specs/018-body-filters/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/body-filter.md
├── contracts/rescore.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── config/schema.ts, searchSettings.ts    # body_filter and the shared filterLists sanitizer (PR 1)
├── jobs/bodyFilter.ts                     # passesBodyFilter (PR 1)
├── jobs/filterMatch.ts                    # filterMatch, FilterSet, FILTER_NOTES: one order of checks (PR 1)
├── web/settingsSections.ts, settingsView.ts, settingsForm.ts   # the two Filters fields (PR 1)
├── web/rowViews.ts, pageData.ts           # "hidden by body filter" through filterMatch (PR 1)
├── tools/unscored.ts                      # isWanted through filterMatch (PR 2)
├── tools/recordMatches.ts, getJobDetails.ts   # narrowed context types; jobDetails exported (PR 2)
├── app/runLogs.ts, runParts.ts, run.ts    # run logs, clients and renderer moved out of run.ts (PR 2)
├── app/lookalikes.ts                      # narrowed context type (PR 2)
├── agent/rubric.ts, prompt.ts             # the shared scoring rubric (PR 3)
├── careers/deps.ts, tools/careersStep.ts  # careersDeps from a plain CareersParts, no ToolContext (PR 3)
├── db/store.ts, db/kysely/jobViews.ts     # JobViews.clearScore (PR 3)
├── rescore/plan.ts                        # rescoreStep (PR 3)
├── rescore/oneJobStore.ts                 # a JobStore that knows one job (PR 3)
├── rescore/session.ts                     # the get_job tool, prompt and runAgent call (PR 3)
├── rescore/rescore.ts                     # the flow: plan, lookup, clear or score (PR 3)
├── rescore/open.ts                        # openRescore: deps, including lookUp (PR 3)
├── cli.ts                                 # the rescore CLI command (PR 3)
└── web/rescoreNote.ts                     # the panel's fixed messages (PR 4)

web/
├── lib/rescoreActions.ts, rows.ts         # the rescoreJob server action; jobRequest exported (PR 4)
├── lib/useRescore.ts                      # the button's state (PR 4)
├── lib/useJobDetails.ts, useJobChanges.ts, usePageRows.ts, pageRows.ts   # reload details, replace or drop the row (PR 4)
├── components/panel/PanelRescore.tsx, PanelHeader.tsx, DetailsPanel.tsx   # the button (PR 4)
├── components/pages/RowsList.tsx          # passes markRescored to the panel (PR 4)
└── components/settings/FiltersSection.tsx # the two description lists (PR 1)

compose.yaml                               # web joins the browser network (PR 4)

tests/
├── bodyFilter.test.ts, filterMatch.test.ts, searchSettings.test.ts, settingsSave.test.ts, settingsView.test.ts, pageData.test.ts   # (PR 1)
├── settingsSections.test.ts               # updated for the two fields (PR 1)
├── nextJobs.test.ts                       # (PR 2)
├── rescorePlan.test.ts, oneJobStore.test.ts, rescore.test.ts, prompt.test.ts   # (PR 3)
├── helpers/rescoreContract.ts, storeContract.test.ts, integration/storeContract.test.ts, integration/openRescore.test.ts   # (PR 3)
├── toolDeclarations.test.ts, cli.test.ts  # updated (PR 3)
├── rescoreNote.test.ts, pageRows.test.ts  # (PR 4)
├── client/panelRescore.test.tsx           # the 1 UI test (PR 4)
└── client/panelHeader.test.tsx and the other panel and list UI tests   # updated: the rescoreActions mock (PR 4)
```

**Structure Decision**: the matching rule sits with the title and company filters in `src/jobs/`.
The re-score gets its own `src/rescore/` folder, because both the web server and its tests reach
it, and it knows nothing about Next.js. `web/lib/` only wires it to the server action.

## Delivery (research R11)

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contracts, quickstart, tasks | — |
| 1 | S1 | `body_filter` setting (include and exclude), matching, the two Filters fields, the All jobs note (US2, US3; ~10 files, ~17 with tests) | Add terms in Settings and see which jobs they would hide |
| 2 | S2 | The run skips matching jobs (US1). Re-score prep with no behaviour change: run logs, clients and renderer moved out of `run.ts`, narrowed tool context types (~9) | A run leaves matching jobs unscored |
| 3 | S3 | The re-score core: rubric shared, careers deps, `clearScore` and its contract, plan, one-job store, session, flow, `openRescore`, and the `rescore <ats> <job_id>` CLI command as its first entry point (~24 with tests) | `npm start -- rescore <ats> <job_id>` re-scores one job |
| 4 | S4 | The Re-score button, server action, fixed messages, the panel and list refresh, compose network (~10, ~22 with the existing UI tests that gain the server-action mock) | Press Re-score on a job and see its new score |
| 5 | S5 | README, CLAUDE.md, the ledger (~3) | — |

**PR 3 is over the usual size.** Every part of the core needs a production caller in the sitting
that adds it (knip), and the CLI command is the smallest caller that reaches all of them. The only
part that stands on its own is the rubric and careers-deps move, a pure refactor reached from the run
(~6 files). If the owner prefers, it can go first as its own PR.

**PR 4's size** is about 10 files of its own. The rest are the eight existing panel and list UI
tests, each gaining a one-line `vi.mock` of the server action and, in `panelHeader.test.tsx`, the
new button order. Splitting it would leave a server action with no caller (knip), so it stays one
PR.

## Complexity Tracking

No constitution violations to justify.
