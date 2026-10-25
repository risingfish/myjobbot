# Implementation Plan: Search settings in the database

**Branch**: `015-settings-in-database` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/015-settings-in-database/spec.md`

## Summary

The owner's search settings move from `config.json` into the database: sources, preferences, the
match threshold, the title filter, title boosts, and excluded companies and publishers. They are
stored as one JSON document per user, in `user_settings`, beside a `users` table that holds just the
owner for now. Runtime settings stay in `config.json`.

- **Reading:** both the agent and the web UI split the file into its runtime part, then merge in the
  stored search part. The merged object goes through the same `fileConfigSchema` as today, so every
  rule and default is defined once and every consumer sees the same `FileConfig`.
- **The upgrade import:** the first read after the upgrade copies the file's search part in, once.
- **Bad stored values:** each one falls back on its own, with a notice in the trace and on the
  Settings page.
- **Changing settings:** `export-settings` and `import-settings` commands change them in this
  feature.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx); Next.js 16 for the web UI

**Primary Dependencies**: no new ones; existing Kysely 0.29 and zod 4

**Storage**: MariaDB through Kysely. Migration `011_user_settings` adds `users` and `user_settings`
(research R3).

**Testing**: vitest (`node`, `dom` and `integration` projects); the settings contract runs on memory
and on `myjobbot_test`

**Target Platform**: the Docker stack on the owner's LAN

**Project Type**: CLI agent plus a Next.js web UI in one repository

**Performance Goals**: one primary-key read per run, and one per web request (research R4)

**Constraints**:
- `fileConfigSchema` stays the single definition of valid settings.
- Stored settings are raw, with no defaults stored.
- An import replaces the whole set or nothing.
- The upgrade import happens once per database.
- The storage is ready for more users.

**Scale/Scope**: one user and one document of a few KB

## Constitution Check

*Checked against constitution v2.3.0. GATE passes before Phase 0 and again after Phase 1.*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. New logic is small pure functions in `src/config/searchSettings.ts`, `resolve.ts` and `importSettings.ts`. `schema.ts` (160 lines) exports four element schemas it already defines, plus `boostPoints` lifted out of `title_boosts`. `src/db/store.ts` gains two lines (the import and `Stores.searchSettings`); the interface goes in `src/db/searchSettingsStore.ts`. `run.ts` (180 lines) gains one call: the resolving and tracing live in a new `src/app/runSettings.ts`. Each export and store method lands with its production caller (`save` in PR 3, with the import command). |
| II. Test-first | Pass. Tests precede code in every sitting. The split is 43 unit, 3 integration and 1 UI, which moves every share toward 95 / 4 / 1 (84.72 / 7.50 / 7.78 → 85.13 / 7.44 / 7.44%). Tests that write files (the one `runOnce` test) count as integration; the run's trace events are unit-tested through `settingsForRun` with the memory trace. The decisions (split, merge, sanitize, import checks) are plain functions, and the store's behaviour is one bundled contract case (R9). |
| III. Purpose comments | Pass. Every new function gets its one-line doc comment. `loadConfig`'s and `getUiState`'s are updated, since they no longer validate or read search settings from the file. |
| IV. Bounded, locked dependencies | Pass. No new library. zod's own `safeParse` on the element schemas drives the fallback. Migration 011 uses the schema builder, with its own `"json"` column type; the table options passed to `modifyEnd` are its one `sql` fragment, as in `009_companies.ts`. The store uses `onDuplicateKeyUpdate` for `save`, as the other stores do, and `insertInto(...).ignore()` for the import-once write, which no store uses yet: it is Kysely's own form of `INSERT IGNORE`, and the import only needs "stored or not". |
| V. Specs in docs/specs | Pass. |

## Project Structure

### Documentation (this feature)

```text
docs/specs/015-settings-in-database/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/settings.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── config/
│   ├── schema.ts            # export company, search, filterTerm, publisherTerm, boostPoints (PR 2)
│   ├── searchSettings.ts    # splitSettings, mergeSettings (PR 1b); sanitizeSearchSettings (PR 2); SEARCH_KEYS exported (PR 3)
│   ├── resolve.ts           # resolveSettings, SettingsNotice: import once, sanitize, merge, parse (PR 1b, 2)
│   ├── importSettings.ts    # the import command's checks, exportDocument (PR 3)
│   ├── load.ts, parse.ts    # LoadedConfig, config.json read raw, parseJson(text, name); validate only after merging (PR 1b)
├── db/
│   ├── migrations/011_user_settings.ts, migrations/index.ts, schema.ts   # PR 1a
│   ├── searchSettingsStore.ts   # SearchSettingsStore (load, importIfAbsent; save in PR 3), RawSearchSettings, OWNER_ID (PR 1b)
│   ├── store.ts             # Stores.searchSettings (PR 1b)
│   └── kysely/searchSettingsStore.ts, kysely/stores.ts   # PR 1b, 3
├── app/runSettings.ts       # settingsForRun: resolve after the stores open, trace the notices, build AppConfig (PR 1b, 2)
├── app/run.ts               # calls it from runOnce (PR 1b)
└── cli.ts                   # export-settings, import-settings (PR 3)

web/
├── lib/uiState.ts           # resolveSettings per request; notices in UiState (PR 1b, 2)
└── app/settings/page.tsx, components/settings/SettingsNotices.tsx   # notices panel (PR 2)

tests/
├── searchSettings.test.ts, resolveSettings.test.ts, runSettings.test.ts, importSettings.test.ts   # unit
├── helpers/searchSettingsContract.ts, memorySearchSettingsStore.ts   # one bundled case (step 3 in PR 3)
├── helpers/config.ts        # FULL_CONFIG: every search key plus runtime keys
├── integration/companyMigrations.test.ts or migrate.test.ts   # migration 011
├── client/settingsNotices.test.tsx   # 1 UI test
├── run.test.ts              # 1 new (integration): a run reads the stored sources
├── integration/storeContract.test.ts   # the contract on MariaDB; afterAll empties the tables
├── client/settings.test.tsx # notices: [] in the getUiState mock
└── config.test.ts, configFiles.test.ts   # updated for the new load path
```

**Structure Decision**: the settings logic stays in `src/config/`, beside the schema it applies.
Storage follows the store pattern: an interface, a Kysely store, a memory store and a contract run
on both. The store is `searchSettings` (`SearchSettingsStore`), named for what it holds:
`settings` alone already means the database connection settings (`src/db/settings.ts`).

## Delivery (research R9)

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contract, quickstart, tasks | — |
| 1a | S1a | Migration 011: `users`, `user_settings` (~6 files) | The tables exist, empty |
| 1b | S1b | Store, split and merge, upgrade import, agent and web UI read from the database (~23) | Settings imported once; search settings edited in the file no longer apply |
| 2 | S2 | Fallback per setting, notices in the trace and on the Settings page (~11) | A bad stored value falls back and is reported |
| 3 | S3 | `export-settings`, `import-settings` and the store's `save` (~8) | Change settings by export, edit, import |
| 4 | S4 | README, `examples/`, `tests/docker.sh`, CLAUDE.md, the test ledger (~7) | — |

PR 1b is over the usual size, and stays whole by the owner's choice (2026-10-25). Its readers must
not move to the database before the upgrade import exists, or the owner's settings would be lost on
the first run. A split would put the store, split and merge, and the import in one PR, and the
readers in the next.

FR-008 and SC-004 (each page load and run uses the current stored settings) are checked by the
quickstart only (tasks, Coverage notes).

## Complexity Tracking

No constitution violations to justify.
