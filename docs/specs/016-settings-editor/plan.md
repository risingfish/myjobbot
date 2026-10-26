# Implementation Plan: Edit search settings on the Settings page

**Branch**: `016-settings-editor` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/016-settings-editor/spec.md`

## Summary

The Settings page shows every search setting in effect and lets the owner change it, one section at
a time. The sections are Sources, Preferences, Scoring and Filters.

- **Showing**: a pure settings view builds each field from the stored document after fallback,
  with each key's default taken from `fileConfigSchema`'s own shape. It never runs the cross-setting
  rules, so the page loads with nothing stored.
- **Saving**: a section's Save replaces only that section's fields in the stored document. It checks
  them together with the rest, with 015's rules and messages, and stores all or none. Problems show
  beside their field or row. The last save wins.
- **Removed**, once every section can be saved: 015's `export-settings` and `import-settings`
  commands, and its automatic import from `config.json`. Only the page changes search settings from
  then on.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx); Next.js 16 and React 19 for the web UI

**Primary Dependencies**: no new ones; existing zod 4 and Kysely 0.29 (through 015's store)

**Storage**: MariaDB, no schema change: 015's `user_settings`, written through
`SearchSettingsStore.save`

**Testing**: vitest (`node`, `dom` and `integration` projects)

**Target Platform**: the Docker stack on the owner's LAN

**Project Type**: CLI agent plus a Next.js web UI in one repository

**Performance Goals**: one primary-key read per page load and per save

**Constraints**:
- `fileConfigSchema` stays the one definition of valid settings and of their defaults.
- A section's save is all or none.
- The page loads with no search settings stored.
- No login (LAN only, as the Gmail panel).

**Scale/Scope**: one owner, four sections, saves that are rare

## Constitution Check

*Checked against constitution v2.3.0. GATE passes before Phase 0 and again after Phase 1.*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. The decisions are small pure functions in new files under `src/web/`: `settingsView.ts`, `settingsSections.ts`, `settingsApply.ts`, `settingsProblems.ts`, `settingsSave.ts` and `settingsForm.ts`. `saveSection` is the production caller of `applySection` and `sectionProblems`, which keeps them out of the test-only report. The components only wire inputs to them, one per section, so each file stays under 200 lines. `schema.ts` (162 lines) gains one export (`titleFilterTerms`), split out of `titleFilter`. Every new export lands with its production caller in the same PR, and S5a removes the exports the removals orphan. |
| II. Test-first | Pass. Tests precede code in every sitting. The save decisions are generic over the sections table, so all their tests land in S2 with that code, and S3 and S4 add only components and their blank rows. The split is 45 new unit tests, 0 integration and 1 UI, less 11 removed unit tests (015's command and automatic-import tests). That moves every share toward 95 / 4 / 1 (85.13 → 85.64 unit, 7.44 → 7.12 integration, 7.44 → 7.24 UI; research R9, tasks ledger). Only one UI test is added, because a second would raise the UI share; the other sections are tested through their pure parts. |
| III. Purpose comments | Pass. Every new function and component gets its one-line doc comment. `gmailDeps`'s is updated in PR 1; `resolveSettings`'s, `getUiState`'s and `SettingsNotices`' are updated when the automatic import goes (PR 5a). |
| IV. Bounded, locked dependencies | Pass. No new library. React's own `useState` and `useActionState` hold and send the form; zod checks the action's input and the settings; the store's `save` uses the builder as in 015. |
| V. Specs in docs/specs | Pass. |

## Project Structure

### Documentation (this feature)

```text
docs/specs/016-settings-editor/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/settings-page.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── config/schema.ts             # export titleFilterTerms (PR 1)
├── config/resolve.ts            # settingsNotices (PR 1); no automatic import, no `at` (PR 5a)
├── config/importSettings.ts     # deleted with issueMessages (PR 5a)
├── app/settingsCommands.ts      # deleted (PR 5a)
├── app/runSettings.ts           # resolveSettings without `at` (PR 5a)
├── cli.ts                       # export-settings, import-settings, withStores removed (PR 5a)
├── db/searchSettingsStore.ts, db/kysely/searchSettingsStore.ts   # importIfAbsent removed (PR 5a)
└── web/
    ├── settingsSections.ts      # SECTIONS: every field's section, stored path and check path (PR 1)
    ├── settingsView.ts          # settingsView, gmailSettings (PR 1)
    ├── settingsApply.ts         # applySection (PR 2)
    ├── settingsProblems.ts      # sectionProblems (PR 2)
    ├── settingsSave.ts          # saveSection (PR 2)
    └── settingsForm.ts          # row edits, resetField, editedField, sectionRequest, saveRequest (PR 2); blank rows (PR 3)

web/
├── lib/uiState.ts               # getStores, getSettingsState (PR 1); resolveSettings without `at` (PR 5a)
├── lib/gmailDeps.ts             # uses getStores, so Gmail works without sources (PR 1)
├── lib/gmailActions.ts          # Check now reads senders through gmailSettings (PR 1)
├── lib/settingsActions.ts       # saveSettingsSection(previous, request) (PR 2)
├── app/settings/page.tsx        # the four sections; placeholder Scoring removed (PR 1–4)
└── components/settings/         # SettingsSections (PR 1), ScoringSection, PreferencesSection (PR 2),
                                 # SourcesSection (PR 3), FiltersSection (PR 4); SettingsNotices (PR 5a)

tests/
├── settingsView.test.ts, settingsSections.test.ts   # unit (PR 1)
├── settingsApply.test.ts, settingsProblems.test.ts, settingsSave.test.ts, settingsForm.test.ts   # unit (PR 2, 3)
├── client/settingsScoring.test.tsx   # the 1 UI test (PR 2)
├── client/settings.test.tsx          # updated (PR 1, 2)
├── importSettings.test.ts            # deleted (PR 5a)
├── run, llm, searchE2e, recovery, runIds, e2e tests   # seeded stores, no import (PR 5a)
└── docker.sh                         # checks /settings (PR 5a)
```

**Structure Decision**: the decisions sit in `src/web/`, beside the other web view logic
(`gmailPanel.ts`, `pageData.ts`), so they are unit-tested without rendering. `web/` holds only the
action, the page and the components.

## Delivery (research R9)

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contract, quickstart, tasks | — |
| 1 | S1 | The settings in view: every field in effect, defaults marked, loads without sources, Gmail works without sources, placeholder gone (~13 files) | The page shows the real settings |
| 2 | S2 | The generic save path, Scoring and Preferences editable, reset, problems beside fields (~15) | Change and reset the threshold and boosts |
| 3 | S3 | Sources editable: boards and searches (~4) | Add and remove boards and searches |
| 4 | S4 | Filters editable: title filter and exclusions (~3) | Change the filters |
| 5a | S5a | Remove the commands and the automatic import; the run tests seed their stores; `tests/docker.sh` checks `/settings` (~26) | Nothing is imported; setup starts on the Settings page |
| 5b | S5b | README, `examples/`, `CLAUDE.md`, the ledger (~4) | — |

PR 5a comes after every section can be saved, so every version has a way to set search settings:
the commands until PR 5a, then the page. It is over the usual size. Most of it is the six test files
whose `runOnce` calls relied on the import to seed their memory store, and the change to each is
small. PR 2 is a little over, because its tests cover every section's save logic at once.

## Complexity Tracking

No constitution violations to justify.
