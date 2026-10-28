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
migration `013_move_sources` moves the owner's boards and searches into the new table (research R3).

**Testing**: vitest (`node`, `dom` and `integration` projects); the saved-source contract runs on
memory and on `myjobbot_test`

**Target Platform**: the Docker stack on the owner's LAN

**Project Type**: CLI agent plus a Next.js web UI in one repository

**Performance Goals**: a run's fetch phase stays within each host's existing request limit. A Workday
source at its per-run limit makes about 105 requests to its host, under the 300 allowed.

**Constraints**:
- Modules only reach the network through `sourceHttp`, which checks every address is public, follows
  no redirects and is rate-limited per host.
- No module stores anything; one pipeline stores every page.
- A failing source never stops a run.
- Stored jobs keep their history through the move.

**Scale/Scope**: one owner, six modules, tens of saved sources

## Constitution Check

*Checked against constitution v2.3.0. GATE passes before Phase 0 and again after Phase 1.*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. Each module is its own small file under `src/sources/modules/`. The interface, registry, network-checked client, failure reasons, fetch phase and pipeline are separate small modules. `beforeAgent` moves out of `src/app/run.ts` (182 lines) into `src/app/beforeAgent.ts`, so neither passes 200. `SourceStore` methods take a `SourceKey` object, so none has more than 3 parameters. The settings decisions (`sourceRows`, `sourceRules`, `sourceChoices`, `sourceFormView`, `saveSourcePlan`) are plain functions in `src/web/`; `recognizeLink` is in `src/sources/registry.ts`. Every export lands with its production caller in the same PR. |
| II. Test-first | Pass. Tests precede code in every sitting. The split is 50 new unit tests, exactly 2 integration (migration 012's tables and migration 013's data step in one test, and the saved-source contract on MariaDB) and exactly 1 UI (the Sources section). S4b removes 17 unit tests: the cross-source rule tests and feature 016's Sources tests. From 698 / 58 / 59 that gives 731 / 60 / 60, so every share moves toward 95 / 4 / 1 (85.64 → 85.90 unit, 7.12 → 7.05 integration, 7.24 → 7.05 UI; research R9, tasks ledger). |
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
│   ├── module.ts            # SourceModule, SourcePage, SourceField, SourceContext (PR 1)
│   ├── sourceHttp.ts, failure.ts   # the network-checked client; fixed failure reasons (PR 1)
│   ├── registry.ts          # MODULES, moduleFor (PR 1); recognizeLink (PR 6)
│   ├── modules/greenhouse.ts, lever.ts, ashby.ts   # from the current readers (PR 1)
│   ├── modules/workday.ts   # new source, plus the careers lookup's reads (PR 2)
│   ├── modules/jsearch.ts, gmailAlerts.ts          # (PR 5)
│   ├── ingest.ts            # the shared pipeline (PR 5)
│   └── fetchPhase.ts        # fetch every source that is on, with cursors and budgets (PR 5)
├── careers/boardPages.ts    # reads boards through the modules (PR 2)
├── db/
│   ├── migrations/012_user_sources.ts (PR 3), 013_move_sources.ts (PR 4b), migrations/index.ts, schema.ts
│   ├── sourceStore.ts, kysely/sourceStore.ts, store.ts, kysely/stores.ts   # PR 3
│   ├── kysely/jobStore.ts   # source_id in upserts and unscored queries (PR 4a)
│   └── kysely/companyStore.ts   # setBoardPage returns the company id (PR 4a)
├── config/schema.ts, searchSettings.ts, resolve.ts, parse.ts   # companies/searches and requireSearchKey out; retired notice (PR 4b)
├── tools/                   # list_sources, next_jobs; fetch_jobs and its helpers removed (PR 5)
├── agent/prompt.ts          # the new steps (PR 5)
├── app/beforeAgent.ts       # moved out of run.ts; saved sources' companies (PR 4b), fetch phase (PR 5)
├── http/client.ts           # HttpStatusError, NetworkError (PR 1)
├── gmail/alertFetch.ts      # yields jobs and mail state; stores nothing (PR 5)
└── web/sourceRows.ts, sourceRules.ts, sourceForm.ts   # Settings decisions (PR 6)

web/
├── lib/sourceActions.ts     # recognizeSourceLink, saveSource, setSourceEnabled, deleteSource (PR 6)
├── lib/uiState.ts           # saved sources in the settings state (PR 3, 4b)
├── lib/gmailActions.ts      # connecting Gmail ensures the Gmail alerts source (PR 4b)
└── components/settings/SourcesSection.tsx (read-only in PR 4b, editable in PR 6), SourceForm.tsx (PR 6)

tests/
├── sourceModules.test.ts, workdayModule.test.ts, ingest.test.ts, fetchPhase.test.ts, nextJobs.test.ts   # (PR 1, 2, 5)
├── helpers/sourceContract.ts, memorySourceStore.ts   # the bundled contract (PR 3)
├── integration/companyMigrations.test.ts   # migrations 012 and 013 in one test (PR 4b)
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
| 1 | S1 | The interface, registry, network-checked client and failure reasons; Greenhouse, Lever, Ashby on it; no change in behaviour (~12 files) | Runs fetch the same boards |
| 2 | S2 | The Workday module; the careers lookup reads boards through the modules (~8) | Alert jobs from Workday companies still get descriptions |
| 3 | S3 | Migration 012's `user_sources` and `jobs.source_id`; the store and its contract (~11) | The table exists, empty |
| 4a | S4a | Jobs linked by `source_id`; `setBoardPage` returns the company id; no behaviour change (~8) | Nothing visible |
| 4b | S4b | The move: migration 013's data step, the readers switched to saved sources, `requireSearchKey` removed, read-only Sources list (~22) | Your boards and searches are saved sources, with their jobs' history kept |
| 5 | S5 | The fetch phase; JSearch and Gmail alerts as modules; `next_jobs` and the prompt (~22) | A run fetches every source that is on before scoring |
| 6 | S6 | The Sources section made editable (~13) | Add a source by pasting a link |
| 7 | S7 | README, CLAUDE.md, the ledger (~4) | — |

**Why PR 4b can't split:** once the data step moves `companies` and `searches` out of the settings
document, every reader has to read saved sources. So the move and the readers land together. The
plumbing they rely on, `source_id` in the job store and the company link, lands first in 4a.
`upsertAll` takes either a plain name or `{ id, name }`, so the ~60 test call sites keep working.

**PR 5 is over the usual size**, because the tools, the prompt, the alert reader and the run tests
change together when fetching leaves the model's hands. It can split into the fetch phase with
JSearch and Gmail, then the tools and prompt, if the owner prefers. In that case the fetch phase
would run before the agent while `fetch_jobs` still refetches, a harmless overlap for one PR.

## Complexity Tracking

No constitution violations to justify.
