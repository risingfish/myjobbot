# Implementation Plan: Company records

**Branch**: `014-company-records` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/014-company-records/spec.md` (issue #27)

## Summary

Every company myjobbot meets gets a row in a new `companies` table, and every stored job points at
it through `jobs.company_id`:
- **Recording:** `JobStore.upsertAll` records the companies, keyed by `normalizeCompany`, in the same
  call that stores their jobs. That covers boards, JSearch and alert emails, and excluded companies
  too.
- **Backfill:** a step at the start of each run links any unlinked jobs. After the upgrade that is
  every stored job; afterwards it is none.
- **The careers lookup's pages:** its remembered careers pages move into the records, and their
  table is dropped.
- **Configured boards:** their public board address becomes the careers page.
- **The search:** after the agent finishes, a step searches SearXNG for up to 50 due companies (no
  model involved). It picks a website and a careers page by fixed rules, and keeps the reason and the
  turned-down addresses for anything it can't resolve.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx)

**Primary Dependencies**: no new ones; existing Kysely 0.29, zod 4, the project's HTTP client and
SearXNG client

**Storage**: MariaDB through Kysely. Migration `009_companies` creates `companies` and
`jobs.company_id`; `010_fold_careers_pages` moves `careers_pages` into it and drops it (research
R3–R5).

**Testing**: vitest (`node` and `integration` projects); the company contract runs on memory and on
`myjobbot_test`

**Target Platform**: the Docker stack on the owner's LAN (agent and the SearXNG service)

**Project Type**: CLI agent plus a Next.js web UI in one repository; no UI change

**Performance Goals**: recording adds one upsert and one select per fetch batch. The search makes at
most 100 SearXNG requests per run (50 companies × 2), a few minutes at most.

**Constraints**:
- No model calls and no page text; search results never reach the model (FR-008).
- Addresses must be storable public `http(s)` addresses, not on `skip_hosts`.
- A run completes when SearXNG is down (SC-004).

**Scale/Scope**: about 1,040 stored jobs today from a few hundred companies. The backfill links
them all in the first run, and their searches spread over the following runs.

## Constitution Check

*Checked against constitution v2.3.0. GATE passes before Phase 0 and again after Phase 1.*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. The rules are small pure functions in `src/companies/`. `src/db/store.ts` (195 lines) stays under 200: the new interface goes in `src/db/companyStore.ts`, and the upsert's company part in `src/db/kysely/companyRows.ts`. `runWithStores` (9 of 20 lines) hands the new steps to `beforeAgent` and `afterAgent` (R4). The contract's steps are split across `companyContract.ts` and `companySearchSteps.ts` (R11). The address rules land with the step that calls them, so no export is test-only (R12). |
| II. Test-first | Pass. Tests precede code in every sitting. The split is 43 unit (37 is the floor), exactly 3 integration and 0 UI, which moves every share toward 95 / 4 / 1 (84.1 / 7.602 / 8.3 → 84.7 / 7.534 / 7.8%). Decisions are pure functions (`companyKeys`, `mainName`, `pickWebsite`, `pickCareers`, `storableUrl`, `boardPageUrl`, due ordering), and the store's behaviour is one bundled contract case (R12). |
| III. Purpose comments | Pass. Every new function gets its one-line doc comment. The doc comments of `upsertAll`, `searchCareers` (now `searchWeb`) and the careers lookup's page functions change with their purpose. |
| IV. Bounded, locked dependencies | Pass. No new library: a short list of second-level labels stands in for the public suffix list (R7). Migrations use Kysely's schema builder (`createTable`, `addForeignKeyConstraint`, `dropTable`), and 010's data step uses the query builder through `db.withTables<...>()`. |
| V. Specs in docs/specs | Pass. |

## Project Structure

### Documentation (this feature)

```text
docs/specs/014-company-records/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/company-records.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── companies/
│   ├── keys.ts                # companyKeys: one key, name and times per company (PR 1b)
│   ├── boardPage.ts           # boardPageUrl (PR 3)
│   ├── pickAddresses.ts       # mainName, storableUrl, pickWebsite, pickCareers (PR 4)
│   └── searchCompanies.ts     # the run's search step (PR 4)
├── db/
│   ├── migrations/009_companies.ts (PR 1a), 010_fold_careers_pages.ts (PR 2), index.ts
│   ├── schema.ts              # CompaniesTable, jobs.company_id (PR 1a); careers_pages gone (PR 2)
│   ├── companyStore.ts        # CompanyStore with setBoardPage (PR 3); CompanyRow, SearchRecord (PR 4)
│   ├── store.ts               # JobStore.linkUnlinkedJobs (PR 1b); CareersStore page methods (PR 2);
│   │                          #   Stores.companies (PR 3)
│   └── kysely/companyRows.ts (PR 1b), jobStore.ts (PR 1b), careersStore.ts (PR 2),
│       companyStore.ts (PR 3, 4), stores.ts (PR 3)
├── careers/searxng.ts         # searchCareers → searchWeb(query) (PR 4)
├── careers/lookUpJob.ts       # reads and writes the company's careers page (PR 2)
├── tools/context.ts           # ToolContext.companies (PR 3)
├── config/schema.ts           # company_search.max_per_run (PR 4)
└── app/run.ts                 # beforeAgent: linkUnlinkedJobs (PR 1b), board pages (PR 3);
                               #   afterAgent: searchCompanies, then pruning (PR 4)

tests/
├── companyKeys.test.ts (PR 1b), boardPage.test.ts (PR 3), pickAddresses.test.ts,
│   searchCompanies.test.ts (PR 4), run.test.ts (PR 3, 4), config.test.ts (PR 4)   # unit
├── fetchJobs.test.ts, alertFetch.test.ts   # excluded companies recorded (PR 1b, no new tests)
├── helpers/companyContract.ts (PR 1b, steps in PR 2, 3), companySearchSteps.ts (PR 4)
├── helpers/memoryJobViews.ts (newTables), memoryCompanies.ts (PR 1b), memoryCompanyStore.ts (PR 3),
│   memoryStore.ts, memoryCareersStore.ts (PR 2), context.ts (PR 3)
├── integration/migrate.test.ts     # migrations 009 (PR 1a) and 010 (PR 2)
└── storeContract.test.ts, integration/storeContract.test.ts   # wire the contract
```

**Structure Decision**: one new folder, `src/companies/`, for the company rules and the search step.
Storage follows the existing store pattern: an interface, a Kysely implementation, a memory
implementation and a contract run on both.

## Delivery (research R12)

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contract, quickstart, tasks | — |
| 1a | S1a | Migration 009 and the schema (~5 files) | Nothing visible; the table and column exist |
| 1b | S1b | Recording at upsert and `markSeen`, backfill at run start (~14) | Every job linked, one record per company (SC-001, SC-002) |
| 2 | S2 | Migration 010: careers pages folded in; the careers lookup on the record (~16) | Lookup pages appear on the companies |
| 3 | S3 | Configured boards' addresses as careers pages, `CompanyStore`, `ToolContext.companies` (~13) | Board companies have their careers page (with a board configured) |
| 4 | S4 | The address rules and the search step, config, outcome, trace (~14) | Addresses found; misses listed with why (SC-003 to SC-006) |
| 5 | S5 | README, CLAUDE.md and the test ledger (~3) | — |

PR 1 is split into 1a and 1b at the owner's request (2026-10-24). PRs 1b, 2, 3 and 4 are past the
usual ten files, because each one's test updates touch files across the suite. The owner is told
when each opens.

## Complexity Tracking

No constitution violations to justify.
