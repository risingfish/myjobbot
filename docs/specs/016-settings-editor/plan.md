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
| I. Habit-hooks clean | Pass. The decisions are small pure functions in new files under `src/web/`: `settingsView.ts`, `settingsSections.ts`, `settingsSave.ts` and `settingsForm.ts`. The components only wire inputs to them, one component per section with one per row kind, so each file stays under 200 lines. `schema.ts` (162 lines) gains one export (`titleFilterTerms`), split out of `titleFilter`. Every new export lands with its production caller in the same PR. |
| II. Test-first | Pass. Tests precede code in every sitting. The split is 37 new unit tests, 0 integration and 1 UI, less 11 removed unit tests (015's command and automatic-import tests). That moves every share toward 95 / 4 / 1 (85.13 → 85.50 unit, 7.44 → 7.19 integration, 7.44 → 7.31 UI; research R9, tasks ledger). Only one UI test is added, because a second would raise the UI share; the other sections are tested through their pure parts. |
| III. Purpose comments | Pass. Every new function and component gets its one-line doc comment. `resolveSettings`'s and `getUiState`'s are updated when the automatic import goes (PR 5). |
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
├── config/resolve.ts            # no automatic import (PR 5)
├── config/importSettings.ts     # deleted; its issue wording moves to web/settingsSave.ts (PR 5)
├── app/settingsCommands.ts      # deleted (PR 5)
├── cli.ts                       # export-settings, import-settings removed (PR 5)
├── db/searchSettingsStore.ts, db/kysely/searchSettingsStore.ts   # importIfAbsent removed (PR 5)
└── web/
    ├── settingsView.ts          # settingsView: fields in effect, defaults marked (PR 1)
    ├── settingsSections.ts      # the four sections and their fields (PR 1)
    ├── settingsSave.ts          # applySection, sectionProblems, saveSection (PR 2)
    └── settingsForm.ts          # addRow, removeRow, updateRow, resetField, editedField (PR 2)

web/
├── lib/uiState.ts               # getSettingsState: never runs the cross-setting rules (PR 1)
├── lib/settingsActions.ts       # saveSettingsSection server action (PR 2)
├── lib/gmailActions.ts          # Check now reads gmail settings from the runtime part (PR 1)
├── app/settings/page.tsx        # the four sections; placeholder Scoring removed (PR 1)
└── components/settings/         # one component per section, plus row editors (PR 1–4)

tests/
├── settingsView.test.ts, settingsSections.test.ts, settingsSave.test.ts, settingsForm.test.ts   # unit
├── client/settingsScoring.test.tsx   # the 1 UI test (PR 2)
├── client/settings.test.tsx          # updated for the sections (PR 1)
├── importSettings.test.ts            # deleted; SC-003 table moves to settingsSave.test.ts (PR 5)
└── run.test.ts, runSettings.test.ts, resolveSettings.test.ts, helpers/   # seeded stores, no import (PR 5)
```

**Structure Decision**: the decisions sit in `src/web/`, beside the other web view logic
(`gmailPanel.ts`, `pageData.ts`), so they are unit-tested without rendering. `web/` holds only the
action, the page and the components.

## Delivery (research R9)

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contract, quickstart, tasks | — |
| 1 | S1 | The settings in view: every field in effect, defaults marked, loads without sources, placeholder gone (~10 files) | The page shows the real settings |
| 2 | S2 | Save path, Scoring and Preferences editable, reset, problems beside fields (~12) | Change and reset the threshold and boosts |
| 3 | S3 | Sources editable: boards and searches (~6) | Add and remove boards and searches |
| 4 | S4 | Filters editable: title filter and exclusions (~6) | Change the filters |
| 5 | S5 | Remove the commands and the automatic import; README, `examples/`, `tests/docker.sh`, `CLAUDE.md` (~16) | Setup starts on the Settings page |

PR 5 comes last, so every version has a way to set search settings: the commands until PR 5, then
the page. It is over the usual size, because the removals touch the run tests that relied on the
import. It can split in two, the code removal and then the docs, if the owner prefers.

## Complexity Tracking

No constitution violations to justify.
