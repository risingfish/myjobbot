# Research: Edit search settings on the Settings page

Every decision follows the code on `main` after feature 015 (`c446532`). No new library is needed:
the form is React's own state and `useActionState`, the checks are zod's, and the store is 015's.

## R1. What the page shows: a settings view built per key, never thrown on

- **Decision**: a pure `settingsView(stored, runtime)` in a new `src/web/settingsView.ts` builds
  what the page shows:
  1. It sanitizes the stored document with 015's `sanitizeSearchSettings`.
  2. For each field it gives `{ value, isDefault }`:
     - **the value in effect**: the sanitized stored value, or the key's default when it is absent;
     - **`isDefault`**: true when the key is absent after sanitizing.
  3. It also gives `needsSource`, true when no company and no search is in effect.

  The defaults come from the schema itself, per key: `fileConfigSchema.shape[key].parse(undefined)`
  (70 for the threshold, `""` for preferences, `[]` for the lists, `{}` for the boosts). The title
  filter's three lists are separate fields, each with its own default. Their defaults come from the
  untransformed title filter object, which `schema.ts` exports as `titleFilterTerms`: the transform
  that joins `extra_exclude` into `exclude` is applied on top of it, so nothing is defined twice.
- **Rationale**: the page must load with no sources (FR-011). Parsing the merged whole would throw on
  the "at least one company or search" rule. Building the view per key never runs the cross-setting
  rules, which only saves check.
- **Alternatives**:
  - parse the whole and catch the error (loses every value on any rule failure);
  - a second copy of the defaults in the web code (two definitions of one thing).

## R2. The sections and their fields

- **Decision**: one table in `src/web/settingsSections.ts` names each section and the fields it owns:

  | Section | Fields (as stored) |
  |---|---|
  | Sources | `companies`, `searches` |
  | Preferences | `preferences` |
  | Scoring | `match_threshold`, `title_boosts` |
  | Filters | `title_filter.include`, `title_filter.exclude`, `title_filter.extra_exclude`, `exclude_companies`, `exclude_publishers` |

  Every search key belongs to exactly one section; a unit test checks the table covers all eight
  keys, and nothing twice.

## R3. A section's save: replace its fields, check with the rest, store all or none

- **Decision**: a pure `applySection(stored, section, edits)` in `src/web/settingsSave.ts` returns the
  document to store and the document to check:
  - **To store**: the stored raw document with the section's fields replaced by the edits. A field
    edited to "default" is removed. A `title_filter` left with no lists is removed whole. Fields of
    other sections are kept exactly as stored, even values that fell back.
  - **To check**: the other sections as sanitized, plus the section's edits as they are. So a value
    that fell back in another section never blocks a save, and the section's own values must pass
    strictly.

  The check is `fileConfigSchema.safeParse(mergeSettings(runtime, toCheck))`, the same rules and
  messages as 015's import (FR-003). It runs against `config.json`'s runtime part as read at the
  moment of saving.
- **Last save wins** (FR-007): the save reads the stored document when it runs and replaces the
  section's fields in it. There is no version check, and no merging.
- **Entries are stored whole**: a board or search row submits all its fields, so
  `remote_only: false` and `country: "us"` are stored as typed. "Unset" applies to whole settings,
  not to fields inside an entry.
- **Alternatives**: store the sanitized whole on every save (would silently rewrite other sections'
  stored values).

## R4. Problems next to their field

- **Decision**: a pure `sectionProblems(issues, section)` maps each zod issue to a place on the page:
  - **a field**: the issue's first path key, such as `match_threshold`;
  - **an entry**: the next path key, the row's index in a list. For `title_boosts`, the entry is the
    term's position in the submitted order, since the path holds the term itself;
  - **the section**: an issue with no path, i.e. a cross-setting rule. "At least one company or
    search", unique names, the reserved name and the JSearch budget all concern Sources. The
    retention rule concerns `config.json` only, and is shown on the section that was saved, naming
    `config.json`.

  Messages are zod's, unchanged, as 015's import gives them. A bad record key gives its nested
  reasons, as `issueMessages` does in 015's `importSettings.ts`, which moves here.

## R5. Saving from the browser: one server action, input checked

- **Decision**: `saveSettingsSection(section, edits)` in a new `web/lib/settingsActions.ts`
  (`"use server"`):
  1. It checks the input's shape with zod, since it comes from the browser: a known section name,
     and for each of that section's fields either `"default"` or a value. The values themselves
     are checked by the schema in step 4.
  2. It opens the stores, loads the owner's document and reads `config.json`'s runtime part.
  3. It calls `applySection`.
  4. It checks the result. A refusal returns `{ ok: false, problems }` and stores nothing.
  5. Otherwise it calls `store.save(OWNER_ID, toStore, now)`, `revalidatePath("/settings")`, and
     returns `{ ok: true }`.

  The pure decisions (steps 3 and 4) are one function, `saveSection(stored, runtime, request)`,
  which is unit-tested; the action only adds the edges.

## R6. The form: one client component per section, React's own state

- **Decision**: each section is a client component holding its edits in `useState`, with its Save
  dispatching through React's `useActionState`. The pending flag disables Save, and the returned
  problems are shown next to their fields. Edits stay in state after a refusal (FR-004), and a save
  of one section leaves the others' state alone (US2-7).

  The row edits are pure functions in `src/web/settingsForm.ts`, unit-tested:
  - `addRow` and `removeRow`;
  - `updateRow`;
  - `resetField` (back to the default, marked);
  - `editedField` (a changed field stops being the default).

  The components only wire them to inputs.
- **Inputs**:
  - board type: a select of `ATS_NAMES`;
  - remote only: a checkbox;
  - threshold and boost points: number inputs;
  - preferences: a textarea, kept exactly as typed;
  - every other value: a text input.
- **Alternatives**: one big form state for the page (couples sections the owner saves separately).

## R7. The Settings page loads without sources

- **Decision**: `getUiState` stays as it is for every other page. Those pages need the checked whole,
  and show the error page without a source, as before 015. The Settings page instead uses a new
  `getSettingsState()` in `web/lib/uiState.ts`, which returns the stores, the settings view (R1)
  and the notices, and never runs the cross-setting rules.
  - The notices come from sanitizing, plus `file_ignored`.
  - The Gmail panel's view uses only the stores.
  - The Gmail "Check now" action reads `gmail.alert_senders` through
    `fileConfigSchema.shape.gmail` on the runtime part, so it works before any source is saved too.

## R8. Removing the commands and the automatic import (FR-010, FR-014)

- **Decision**:
  - **The commands**: `src/cli.ts` loses `export-settings` and `import-settings`, and
    `src/app/settingsCommands.ts` and `src/config/importSettings.ts` are deleted. Their checks move
    into R3 and R4, and the SC-003 table test moves to the save tests.
  - **The automatic import**: `resolveSettings` loses the import. With nothing stored, it parses the
    runtime part alone, and the search part is only reported as `file_ignored`. That throws "at least
    one company or search" for a run, as an empty file did.
  - **What goes with the import**: `SearchSettingsStore.importIfAbsent`, the `imported` notice and
    the `settings_imported` trace event are removed. The store contract's first write becomes
    `save`, which already creates the owner.
  - **Tests**: the run tests that relied on the import to seed their memory store get a helper,
    `memoryStores` with search settings. `tests/docker.sh` checks `/settings` instead of
    `/recommended`, since an empty test database now has no sources.
  - **Docs**: the README, `examples/` (`settings.json` deleted) and `CLAUDE.md` drop the commands and
    the import. Setup says to add the first board or search on the Settings page.
- **Order**: this lands last, after the page can save every section, so there is never a version
  with no way to set search settings.

## R9. Delivery and test split

- **Delivery**: five code PRs after the docs PR (plan, Delivery):
  1. **View**: the page shows every setting in effect, defaults marked, and loads without sources.
     It replaces the Scoring placeholder.
  2. **Save, Scoring and Preferences**: the save path, reset to default, problems shown next to
     fields.
  3. **Sources**: boards and searches.
  4. **Filters**: the title filter and the exclusions.
  5. **Removals and docs**: the commands, the automatic import, and the docs.
- **Test split**: most decisions are pure functions, unit-tested:
  - the view, the sections table, `applySection`, `sectionProblems` and `saveSection`, which
    includes the SC-003 table;
  - the form's row edits;
  - the input check.

  - **UI**: exactly one new test, for the Scoring section. It saves, shows a refusal next to the
    field, and keeps the edit. The settings page test is updated, not added to.
  - **Integration**: none new. The store's `save` is already in the contract.
  - **Removed**: 015's tests for the commands (`importSettings.test.ts`, 8) and for the automatic
    import (3 in `resolveSettings.test.ts`). The other tests that relied on the import are
    rewritten, not removed.
  - 37 new unit tests and 1 UI test, less 11 removed unit tests (tasks, ledger). From 664 / 58 / 58
    (85.13 / 7.44 / 7.44%) that gives 690 / 58 / 59 (85.50 / 7.19 / 7.31%), so every share moves
    toward 95 / 4 / 1. A second UI test would move the UI share the wrong way, so the other
    sections are tested through their pure parts.
