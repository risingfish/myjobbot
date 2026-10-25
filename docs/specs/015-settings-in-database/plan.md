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
| I. Habit-hooks clean | Pass. New logic is small pure functions in `src/config/searchSettings.ts`, `resolve.ts` and `importSettings.ts`. `schema.ts` (160 lines) only exports four element schemas it already defines. `src/db/store.ts` gains one line (`Stores.settings`); the interface goes in `src/db/settingsStore.ts`. `run.ts` calls `resolveSettings` from its existing `runOnce`, via a helper if `runOnce` would pass 20 lines. |
| II. Test-first | Pass. Tests precede code in every sitting. The split is about 32 unit, exactly 2 integration and 1 UI, which moves every share toward 95 / 4 / 1 (84.7 / 7.50 / 7.78 → 85.0 / 7.43 / 7.57%). The decisions (split, merge, sanitize, import checks) are plain functions, and the store's behaviour is one bundled contract case (R9). |
| III. Purpose comments | Pass. Every new function gets its one-line doc comment. `loadConfig`'s and `getUiState`'s are updated, since they no longer validate or read search settings from the file. |
| IV. Bounded, locked dependencies | Pass. No new library. zod's own `safeParse` on the element schemas drives the fallback. Migration 011 uses the schema builder; the store uses `insertInto(...).onDuplicateKeyUpdate` as the other stores do. |
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
│   ├── schema.ts            # export company, search, filterTerm, publisherTerm (PR 1b, 2)
│   ├── searchSettings.ts    # SEARCH_KEYS, splitSettings, mergeSettings (PR 1b); sanitizeSearchSettings (PR 2)
│   ├── resolve.ts           # resolveSettings: import once, sanitize, merge, parse; notices (PR 1b, 2)
│   ├── importSettings.ts    # the import command's checks (PR 3)
│   ├── load.ts, parse.ts    # read config.json raw; validate only after merging (PR 1b)
├── db/
│   ├── migrations/011_user_settings.ts, migrations/index.ts, schema.ts   # PR 1a
│   ├── settingsStore.ts     # SettingsStore, RawSearchSettings, OWNER_ID (PR 1b)
│   ├── store.ts             # Stores.settings (PR 1b)
│   └── kysely/settingsStore.ts, kysely/stores.ts   # PR 1b
├── app/run.ts               # resolve settings after opening the stores; trace notices (PR 1b, 2)
└── cli.ts                   # export-settings, import-settings (PR 3)

web/
├── lib/uiState.ts           # resolveSettings per request; notices in UiState (PR 1b, 2)
└── app/settings/page.tsx, components/settings/SettingsNotices.tsx   # notices panel (PR 2)

tests/
├── searchSettings.test.ts, resolveSettings.test.ts, importSettings.test.ts   # unit
├── helpers/settingsContract.ts, memorySettingsStore.ts   # one bundled case
├── integration/companyMigrations.test.ts or migrate.test.ts   # migration 011
├── client/settingsNotices.test.tsx   # 1 UI test
└── config.test.ts, configFiles.test.ts, run.test.ts   # updated for the new load path
```

**Structure Decision**: the settings logic stays in `src/config/`, beside the schema it applies.
Storage follows the store pattern: an interface, a Kysely store, a memory store and a contract run
on both.

## Delivery (research R9)

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contract, quickstart, tasks | — |
| 1a | S1a | Migration 011: `users`, `user_settings` (~5 files) | The tables exist, empty |
| 1b | S1b | Store, split and merge, upgrade import, agent and web UI read from the database (~14) | Settings imported once; search settings edited in the file no longer apply |
| 2 | S2 | Fallback per setting, notices in the trace and on the Settings page (~9) | A bad stored value falls back and is reported |
| 3 | S3 | `export-settings` and `import-settings` (~6) | Change settings by export, edit, import |
| 4 | S4 | README, `examples/`, CLAUDE.md, the test ledger (~5) | — |

PR 1b can't be split further: if the readers moved to the database before the upgrade import
existed, the owner's settings would be lost on the first run.

## Complexity Tracking

No constitution violations to justify.
