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
| I. Habit-hooks clean | Pass. The rules are small pure functions in `src/companies/`. `src/db/store.ts` (195 lines) gets no additions: the new interface goes in `src/db/companyStore.ts`, and the upsert's company part in `src/db/kysely/companyRows.ts`. The address rules land with the step that calls them, so no export is test-only (R12). |
| II. Test-first | Pass. Tests precede code in every sitting. The split is at least 38 unit, exactly 3 integration and 0 UI, which moves every share toward 95 / 4 / 1 (84.1 / 7.60 / 8.3 → 84.6 / 7.57 / 7.8%). Decisions are pure functions (`companyKeys`, `mainName`, `pickWebsite`, `pickCareers`, `storableUrl`, `boardPageUrl`, due ordering), and the store's behaviour is one bundled contract case (R12). |
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
│   ├── keys.ts                # companyKeys: one key, name and time per company in a batch (PR 1)
│   ├── boardPage.ts           # boardPageUrl (PR 3)
│   ├── pickAddresses.ts       # mainName, storableUrl, pickWebsite, pickCareers (PR 4)
│   └── searchCompanies.ts     # the run's search step (PR 4)
├── db/
│   ├── migrations/009_companies.ts (PR 1), 010_fold_careers_pages.ts (PR 2), index.ts
│   ├── schema.ts              # CompaniesTable, jobs.company_id (PR 1); careers_pages gone (PR 2)
│   ├── companyStore.ts        # CompanyStore, CompanyRow, SearchRecord (PR 1, 3, 4)
│   ├── store.ts               # Stores.companies (PR 1); CareersStore page methods (PR 2)
│   └── kysely/companyRows.ts (PR 1), companyStore.ts (PR 3, 4), jobStore.ts (PR 1),
│       careersStore.ts (PR 2), stores.ts (PR 1)
├── careers/searxng.ts         # searchCareers → searchWeb(query) (PR 4)
├── careers/lookUpJob.ts       # reads and writes the company's careers page (PR 2)
├── tools/boardFetch.ts        # setBoardPage after a board's upsert (PR 3)
├── config/schema.ts           # company_search.max_per_run (PR 4)
└── app/run.ts                 # linkUnlinkedJobs first (PR 1); board pages (PR 3); searchCompanies last (PR 4)

tests/
├── companyKeys.test.ts, boardPage.test.ts, pickAddresses.test.ts, searchCompanies.test.ts   # unit
├── helpers/companyContract.ts, memoryCompanyStore.ts, memoryStore.ts   # one bundled case
├── integration/migrate.test.ts     # migrations 009 and 010
└── storeContract.test.ts, integration/storeContract.test.ts   # wire the contract
```

**Structure Decision**: one new folder, `src/companies/`, for the company rules and the search step.
Storage follows the existing store pattern: an interface, a Kysely implementation, a memory
implementation and a contract run on both.

## Delivery (research R12)

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contract, quickstart, tasks | — |
| 1 | S1 | Migration 009, recording at upsert, backfill at run start (~12 files) | Every job linked, one record per company (SC-001, SC-002) |
| 2 | S2 | Migration 010: careers pages folded in; the careers lookup on the record (~10) | Lookup pages appear on the companies |
| 3 | S3 | Configured boards' addresses as careers pages (~6) | Board companies have their careers page |
| 4 | S4 | The address rules and the search step, config, outcome, trace (~12) | Addresses found; misses listed with why (SC-003 to SC-006) |
| 5 | S5 | README, CLAUDE.md and the test ledger (~3) | — |

## Complexity Tracking

No constitution violations to justify.
