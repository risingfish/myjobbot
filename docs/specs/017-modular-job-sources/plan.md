# Implementation Plan: Modular job sources

**Branch**: `017-modular-job-sources` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/017-modular-job-sources/spec.md`

## Summary

Every job source becomes a module shipped with the app, behind one interface. The interface covers:
- identity: an id, a name, a kind, a scope;
- a saved source's fields and how the form shows them;
- the links it recognises, what it requires, and its limits;
- a paged fetch with a cost per page;
- for company boards, its company and what the careers lookup reads.

The owner's boards and saved searches move out of feature 015's settings document into a
`user_sources` table, one row each, and every job points at its source by id.

The run changes shape. A fetch phase before the agent reads every source that is on, page by page,
within each module's limits and schedule, and continues large sources where they stopped. The model
only scores. Greenhouse, Lever, Ashby, JSearch and Gmail alerts move onto modules, and Workday
becomes a new one. The Settings page's Sources section becomes a list of saved sources, each added
by pasting a link or choosing a module, and tested when saved.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx); Next.js 16 and React 19 for the web UI

**Primary Dependencies**: no new ones; existing zod 4, Kysely 0.29 and the HTTP client

**Storage**: MariaDB. Migration `012_user_sources` adds `user_sources` and `jobs.source_id`, and
moves the owner's boards and searches into the new table (research R3).

**Testing**: vitest (`node`, `dom` and `integration` projects); the saved-source contract runs on
memory and on `myjobbot_test`

**Target Platform**: the Docker stack on the owner's LAN

**Project Type**: CLI agent plus a Next.js web UI in one repository

**Performance Goals**: a run's fetch phase stays within each host's existing request limit. A Workday
source at its per-run limit makes about 105 requests to its host, under the 300 allowed.

**Constraints**:
- Modules only reach the network through the run's HTTP client, so the public-address checks and rate
  limits hold.
- No module stores anything; one pipeline stores every page.
- A failing source never stops a run.
- Stored jobs keep their history through the move.

**Scale/Scope**: one owner, six modules, tens of saved sources

## Constitution Check

*Checked against constitution v2.3.0. GATE passes before Phase 0 and again after Phase 1.*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. Each module is its own small file under `src/sources/modules/`. The interface, registry, fetch phase and pipeline are separate small modules. `run.ts` (182 lines) gains one call, to the fetch phase, inside `beforeAgent`. The settings decisions (`sourceRows`, `recognizeLink`, `sourceRules`, `sourceFormView`) are plain functions in `src/web/`. Every export lands with its production caller in the same PR. |
| II. Test-first | Pass. Tests precede code in every sitting. The split is about 60 new unit tests, exactly 3 integration (migration 012's tables, its data step, and the saved-source contract on MariaDB) and exactly 1 UI (the Sources section). From 698 / 58 / 59 that is about 758 / 61 / 60, so every share moves toward 95 / 4 / 1 (85.64 → 86.2 unit, 7.12 → 6.9 integration, 7.24 → 6.8 UI; research R9). |
| III. Purpose comments | Pass. Every new function and component gets its one-line doc comment, and changed ones are updated: `runOnce`'s, `beforeAgent`'s, `configuredSources`', and the tools' descriptions. |
| IV. Bounded, locked dependencies | Pass. No new library. zod's own schemas give each module's params, and Kysely's schema builder and query builder give the table, the data step (`db.withTables<…>()`) and the store. |
| V. Specs in docs/specs | Pass. |

## Project Structure

### Documentation (this feature)

```text
docs/specs/017-modular-job-sources/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/source-module.md
├── contracts/sources-ui-and-run.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── sources/
│   ├── module.ts            # SourceModule, SourcePage, FieldSpec, SourceContext (PR 1)
│   ├── registry.ts          # MODULES, moduleFor, recognizeLink (PR 1, 2)
│   ├── modules/greenhouse.ts, lever.ts, ashby.ts   # from the current readers (PR 1)
│   ├── modules/workday.ts   # new source, plus the careers lookup's reads (PR 2)
│   ├── modules/jsearch.ts, gmailAlerts.ts          # (PR 5)
│   ├── ingest.ts            # the shared pipeline (PR 5)
│   └── fetchPhase.ts        # fetch every source that is on, with cursors and budgets (PR 5)
├── careers/boardPages.ts    # reads boards through the modules (PR 2)
├── db/
│   ├── migrations/012_user_sources.ts, migrations/index.ts, schema.ts   # PR 3, 4
│   ├── sourceStore.ts, kysely/sourceStore.ts, store.ts, kysely/stores.ts   # PR 3
│   └── kysely/jobStore.ts   # source_id in upserts and unscored queries (PR 4)
├── config/schema.ts, searchSettings.ts, resolve.ts   # companies/searches out; retired notice (PR 4)
├── tools/                   # list_sources, next_jobs; fetch_jobs and its helpers removed (PR 5)
├── agent/prompt.ts          # the new steps (PR 5)
├── app/run.ts               # fetch phase in beforeAgent; saved sources in the context (PR 4, 5)
└── web/sourceRows.ts, sourceRules.ts, sourceForm.ts   # Settings decisions (PR 6)

web/
├── lib/sourceActions.ts     # recognizeSourceLink, saveSource, setSourceEnabled, deleteSource (PR 6)
├── lib/uiState.ts           # saved sources in the settings state (PR 4, 6)
└── components/settings/SourcesSection.tsx (rebuilt), SourceForm.tsx   # (PR 6)

tests/
├── sources/*.test.ts        # each module with fake HTTP; registry; ingest; fetch phase (PR 1, 2, 5)
├── helpers/sourceContract.ts, memorySourceStore.ts   # the bundled contract (PR 3)
├── integration/laterMigrations.test.ts   # migration 012 tables and data step (PR 3, 4)
├── sourceRules.test.ts, sourceForm.test.ts, sourceRows.test.ts   # (PR 6)
├── client/sourcesSection.test.tsx   # the 1 UI test (PR 6)
└── run.test.ts, e2e.test.ts, searchE2e.test.ts, …   # rewritten for next_jobs and the fetch phase (PR 5)
```

**Structure Decision**: modules live in `src/sources/modules/`, one per platform, beside the
interface, the registry, the pipeline and the fetch phase. `src/tools/` keeps only the model's
tools, and `src/web/` keeps the Settings decisions.

## Delivery (research R9)

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contracts, quickstart, tasks | — |
| 1 | S1 | The interface and registry; Greenhouse, Lever, Ashby on it; no change in behaviour (~10 files) | Runs fetch the same boards |
| 2 | S2 | The Workday module; the careers lookup reads boards through the modules (~8) | Alert jobs from Workday companies still get descriptions |
| 3 | S3 | Migration 012's `user_sources`, the store and its contract (~10) | The table exists, empty |
| 4 | S4 | The move: the data step, `jobs.source_id`, and the readers switched to saved sources (~16) | Your boards and searches are saved sources, with their jobs' history kept |
| 5 | S5 | The fetch phase; JSearch and Gmail alerts as modules; `next_jobs` and the prompt (~18) | A run fetches every source that is on before scoring |
| 6 | S6 | The Sources section rebuilt (~12) | Add a source by pasting a link |
| 7 | S7 | README, CLAUDE.md, the ledger (~4) | — |

**Why PR 4 can't split:** once the data step moves `companies` and `searches` out of the settings
document, every reader has to read saved sources. So the move and the readers land together.

**PR 5 is over the usual size**, because the tools, the prompt and the run tests change together
when fetching leaves the model's hands. It can split into the fetch phase with JSearch and Gmail,
then the tools and prompt, if the owner prefers. In that case the fetch phase would run before the
agent while `fetch_jobs` still refetches, a harmless overlap for one PR.

## Complexity Tracking

No constitution violations to justify.
