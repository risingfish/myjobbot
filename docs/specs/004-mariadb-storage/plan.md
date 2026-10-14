# Implementation Plan: MariaDB Storage

**Branch**: `mariadb-storage` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/004-mariadb-storage/spec.md`

## Summary

Storage moves from the SQLite file to the owner's MariaDB 10.11 server.
- **Kysely over mysql2.** All database access goes through Kysely typed queries, checked against
  one description of the tables, and schema changes run through Kysely's migrator.
- **Unchanged behaviour.** Every table compares text exactly (`utf8mb4_bin`), and every connection
  sets `utf8mb4`, so comparisons, uniqueness and sort order stay as they are today.
- **Async store interfaces.** The three database classes become interfaces with async methods.
  Kysely implements them for real use, and an in-memory fake implements them for unit tests. One
  shared contract suite keeps the two in step.
- **A one-time copy.** A `myjobbot import-sqlite` command copies the existing data in a single
  transaction and checks it before committing.

Spikes against the real test database settled every unknown: the charset, exact comparison, the
upsert, `LEAST`, racing migrators, and Next.js with mysql2. See [research.md](research.md).

## Technical Context

- **Language/Version**: TypeScript 6.0 on Node 24, unchanged.
- **Primary Dependencies**:
  - **New**: `kysely` 0.29.6 and `mysql2` 3.24.6, exact-pinned, both approved by the owner
    (research R1).
  - **Retired from normal use**: `node:sqlite`, which remains only in the import command.
- **Storage**: MariaDB 10.11.14 at 192.168.3.10. `myjobbot` holds the real data and
  `myjobbot_test` serves the integration tests; both are `utf8mb4` / `utf8mb4_general_ci`, with
  tables set to `utf8mb4_bin`.
- **Testing**: vitest 5 with three projects:
  - `node`: unit tests, using the in-memory store
  - `dom`: UI tests
  - `integration` (new): the MariaDB tests, one file at a time
- **Target Platform**: as today. Both Docker services reach the server over the LAN; there is no
  new container.
- **Project Type**: CLI agent plus Next.js web app in one package, unchanged.
- **Performance Goals**: first rows within 1 s with 1,000 jobs, Hide within 0.5 s (from feature
  003). A network round-trip adds about 1 ms; the queries are the same.
- **Constraints**:
  - The 20-line function limit, 200-line files and knip.
  - Credentials only in `.env`, never printed.
  - The agent and the web app can both start migrations at once.
  - Database access becomes async all the way up.
- **Scale/Scope**:
  - 3 tables, about 1,500 rows today.
  - 18 store methods, 11 call sites, about 100 test files touched.
  - Test target: at least 80% unit, at most 10% integration, at most 10% UI.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates from `.specify/memory/constitution.md` v2.0.0.

| Gate | Pre-design | Post-design |
|---|---|---|
| IV. New libraries presented and approved | Kysely approved; mysql2 recommended | Pass: the owner approved mysql2 on 2026-10-14 (R1) |
| IV. Exact pins, lockfile, optional entries kept | Planned | Pass: both exact; counts re-checked at install (R11) |
| I. habit-hooks clean at every sitting boundary (20-line functions, 200-line files, knip) | Risk: SQL and the fake are long; new modules before they're wired | Pass: sittings S0–S7 each end green (tasks.md); one file per store class, DDL split per table, fake split by interface |
| I. No exemptions | Planned | Pass: no ignores; the import command is reachable from the CLI, so knip sees it |
| II. Test first, `npm run check` green | Risk: tests need the server | Pass: contract cases are written before both implementations. Without the server, only the integration project fails, with a clear message |
| II. Test mix 95/4/1; plan states its split | **Required** | Projected about 82/10/8 (R9); the spec's interim target is met, and the plan names what's left |
| III. Doc comment on every function in `src/` and `web/` | Planned | Pass |
| V. Specs in `docs/specs/` | Pass | Pass |

No violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
docs/specs/004-mariadb-storage/
├── spec.md, plan.md, research.md (R1–R11), data-model.md, quickstart.md
├── contracts/storage.md
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code (repository root)

```text
src/db/
├── store.ts                  # NEW: JobStore, JobViews, ApiCallLog interfaces (async) + row types
├── schema.ts                 # NEW: Kysely Database type for jobs, verdicts, api_calls
├── settings.ts               # NEW: MYJOBBOT_DB_* parsing (zod) and safe error messages
├── connect.ts                # NEW: pool + Kysely + SET NAMES; connectWithRetry; close
├── retry.ts                  # NEW: pure retry schedule (3 tries, 10 s)
├── migrations/
│   ├── index.ts              # NEW: ordered list for the Migrator
│   └── 001_initial.ts        # NEW: jobs, verdicts, api_calls with utf8mb4_bin (split per table)
├── migrate.ts                # NEW: migrateToLatest with a clear error
├── kysely/
│   ├── jobStore.ts           # NEW: KyselyJobStore (upsert, verdicts, pruning, lookups)
│   ├── jobViews.ts           # NEW: KyselyJobViews (pages, counts, hide)
│   └── apiCalls.ts           # NEW: KyselyApiCallLog
├── rows.ts                   # NEW: pure row ↔ value mapping (toParams, jsonList decoding)
├── columns.ts                # kept (jsonList)
├── jobStore.ts, jobViews.ts, apiCalls.ts, open.ts   # DELETED (SQLite)
src/app/
├── run.ts                    # connects, migrates, builds the context from Kysely stores, closes
└── importSqlite.ts           # NEW: the one-time copy (node:sqlite read → one MariaDB transaction)
src/cli.ts                    # + `import-sqlite <path>`
src/tools/*.ts                # await the store calls (8 files)
src/web/pageData.ts           # async loaders
web/lib/uiState.ts            # cached Kysely stores + migrate once; dbLabel() for the footer
web/lib/rows.ts, actions.ts   # async
web/components/pages/DataPage.tsx  # async server component
web/app/layout.tsx            # Footer shows dbLabel()

tests/
├── helpers/memoryStore.ts    # NEW: in-memory JobStore/JobViews/ApiCallLog
├── helpers/storeContract.ts  # NEW: shared contract cases
├── helpers/testDb.ts         # NEW: myjobbot_test connection, refuses non-_test names, empties tables
├── storeContract.test.ts     # NEW: contract against the fake (unit)
├── integration/
│   ├── storeContract.test.ts # NEW: contract against MariaDB
│   ├── migrate.test.ts       # NEW: steps run once; collation of both databases agrees
│   └── importSqlite.test.ts  # NEW: copy, refuse twice, reject over-long rows
├── helpers/views.ts, context.ts   # seed the memory store instead of :memory: SQLite
├── config.test.ts            # parseFileConfig (unit); 1 file test remains (leftover YAML)
└── client/*.test.tsx         # load-more and dedupe cases move to pageRows unit tests
vitest.config.ts              # + integration project (tests/integration, one file at a time)
.env.example                  # + MYJOBBOT_DB_* (no values)
README.md, CLAUDE.md          # storage, setup, test mix
```

**Structure Decision**:
- **Interfaces in `src/db/store.ts`**, so the agent, the tools and the web app depend on the
  interfaces, not on Kysely.
- **Real implementations in `src/db/kysely/`.**
- **The fake in `tests/helpers/`**, where test-only code belongs under the knip rules.

## Rollout

1. **Branch**: `mariadb-storage`, which already holds the spec and constitution v2.0.0.
2. **Build and test in a worktree** (`../myjobbot-mariadb`), against `myjobbot_test` only. The
   main checkout goes back to `main`, because Docker mounts its `src/` live, and editing there
   would change the scheduled agent mid-feature. The live stack keeps running on SQLite until the
   switch.

   The work goes in two green steps, so habit-hooks is never unclean (constitution I):
   1. Every caller goes async behind the store interfaces while still on SQLite, with the
      in-memory fake and the contract suite.
   2. MariaDB slots in under the same interfaces, in one sitting that adds the Kysely modules,
      switches the agent and the web app, and deletes SQLite.
3. **Switch-over, in one sitting, with no run in progress**:
   1. back up SQLite
   2. `import-sqlite`
   3. merge and pull
   4. `npm run docker:up`
   5. check pages and one manual run

   Rolling back means checking out the previous `main` and rebuilding; the SQLite file is
   untouched.
4. **`docker:watch` caution** (from memory): pull before switching branches, so it never rebuilds
   from stale files. Or stop the watcher during the switch.

## Complexity Tracking

None.
