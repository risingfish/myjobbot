# Research: Edit search settings on the Settings page

Every decision follows the code on `main` after feature 015 (`c446532`). No new library is needed:
the form is React's own state and `useActionState`, the checks are zod's, and the store is 015's.

## R1. What the page shows: a settings view built per field, never thrown on

- **Decision**: a pure `settingsView(stored, hasSearchKey)` in a new `src/web/settingsView.ts`
  builds what the page shows:
  1. It sanitizes the stored document with 015's `sanitizeSearchSettings`.
  2. For each field (R2) it gives `{ value, isDefault }`:
     - **the value in effect**: the sanitized stored value, or the field's default when it is
       absent. List entries are kept as stored, so an entry's blank optional fields stay absent (a
       search with no `country`, say).
     - **`isDefault`**: true when the field is absent after sanitizing.
  3. It also gives two flags:
     - `needsSource`: no company and no search is in effect;
     - `needsSearchKey`: searches are in effect but `JSEARCH_API_KEY` isn't set.
- **The defaults come from the schema itself**:
  - each top-level key from `fileConfigSchema.shape[key].parse(undefined)`: 70, `""`, `[]`, `{}`;
  - the excluded publishers from `fileConfigSchema.shape.jsearch.parse(undefined).exclude_publishers`;
  - the title filter's three lists from `titleFilterTerms.shape[list].parse(undefined)`.

  `titleFilterTerms` is the untransformed title filter object, newly exported from `schema.ts`.
  The transform that joins `extra_exclude` into `exclude` is applied on top of it, so nothing is
  defined twice.
- **`gmailSettings(fileRaw)`**, in the same file, reads `gmail.alert_senders` from the runtime part
  through `fileConfigSchema.shape.gmail`. It works with no source set.
- **Notices**: a pure `settingsNotices(split, stored)` in `src/config/resolve.ts` gives the fallback
  and `file_ignored` notices. `resolveSettings`'s `fromStored` uses it too, so the Settings page and
  runs report the same things.
- **Rationale**: the page must load with no sources (FR-011). Parsing the merged whole would throw on
  the "at least one company or search" rule. Building the view per field never runs the
  cross-setting rules; only saves check them.
- **Alternatives**:
  - parse the whole and catch the error (loses every value on any rule failure);
  - a second copy of the defaults in the web code (two definitions of one thing).

## R2. The sections and their fields: one table drives everything

- **Decision**: `SECTIONS` in `src/web/settingsSections.ts` lists every field once:
  - its **name**, used in requests, problems and the view;
  - its **section**;
  - its **stored path** in the document;
  - its **check path** in the `config.json` shape that `fileConfigSchema` parses and its issues
    name.

  | Field | Section | Stored path | Check path |
  |---|---|---|---|
  | `companies` | sources | `companies` | `companies` |
  | `searches` | sources | `searches` | `searches` |
  | `preferences` | preferences | `preferences` | `preferences` |
  | `match_threshold` | scoring | `match_threshold` | `match_threshold` |
  | `title_boosts` | scoring | `title_boosts` | `title_boosts` |
  | `include` | filters | `title_filter.include` | `title_filter.include` |
  | `exclude` | filters | `title_filter.exclude` | `title_filter.exclude` |
  | `extra_exclude` | filters | `title_filter.extra_exclude` | `title_filter.extra_exclude` |
  | `exclude_companies` | filters | `exclude_companies` | `exclude_companies` |
  | `exclude_publishers` | filters | `exclude_publishers` | `jsearch.exclude_publishers` |

  A unit test checks the table covers all eight search keys, through these ten fields, and nothing
  twice. `applySection` (R3) and `sectionProblems` (R4) are generic over the table, so every section
  works as soon as S2 lands. S3 and S4 only add components.

## R3. A section's save: replace its fields, check with the rest, store all or none

- **Decision**: a pure `applySection(stored, request)` in `src/web/settingsApply.ts` returns the
  document to store and the document to check:
  - **To store**:
    - starts from the stored raw document, keeping only search keys: a key that isn't one is
      dropped on any save, which clears its notice;
    - replaces the section's fields at their stored paths;
    - removes a field edited to "default", and removes a `title_filter` left with no lists whole;
    - keeps other sections' fields exactly as stored, even values that fell back.
  - **To check**: the other sections after fallback, plus the section's edits as they are. So a
    value that fell back in another section never blocks a save, and the section's own values must
    pass strictly.
- **The check** is `fileConfigSchema.safeParse(mergeSettings(runtime, toCheck))`, with the same rules
  and messages as 015's import (FR-003), against `config.json`'s runtime part read at the moment of
  saving.
- **Entries keep what the owner filled in**: a row sends the fields it holds. A field the owner
  never filled in (a search's `remote_only` or `country`) stays absent, and the entry's own default
  applies. So a save with no edits stores exactly what was stored (SC-006).
- **Boost rows** become a map in row order. A term that appears twice is refused on its second row,
  instead of silently collapsing.
- **Last save wins** (FR-007): the save reads the stored document when it runs and replaces the
  section's fields in it. There is no version check, and no merging.
- **`saveSection(stored, runtime, request)`** in `src/web/settingsSave.ts` combines `applySection`,
  the check and `sectionProblems`, and returns the document to store or the problems. As the only
  production caller of both helpers, it keeps them out of knip's test-only report.
- **Alternatives**: store the sanitized whole on every save (would silently rewrite other sections'
  stored values).

## R4. Problems next to their field

- **Decision**: a pure `sectionProblems(issues, request)` in `src/web/settingsProblems.ts` places
  each zod issue through the `SECTIONS` check paths, taking the longest match:
  - **a field**: the issue's path starts with a field's check path. So
    `["jsearch","exclude_publishers",2]` is field `exclude_publishers`, and
    `["title_filter","include",1]` is field `include`;
  - **an entry**: the path element after the field's path, the row's index. For `title_boosts` that
    element is the term, so the row is that term's position in the submitted rows;
  - **the section**: an issue whose path names no field of the saved section is shown at the top of
    the section that was saved. That covers a cross-setting rule with no path ("at least one company
    or search", unique names, the reserved name, the JSearch budget, retention), and a bad runtime
    value in `config.json` (`http.timeout_s`). Each section keeps its own save result, so this is the
    only place it can show.
- **One problem per reason, message unprefixed** (`Problem.message` is zod's own text): a bad record
  key (`invalid_key`) gives one problem per nested reason, on the same row. 015's `issueMessages`,
  which prefixes the path, is left alone in `importSettings.ts` until S5a deletes it.

## R5. Saving from the browser: one server action, input checked, failures returned

- **Decision**: `saveSettingsSection(previous: SaveResult, request: SaveRequest)` in a new
  `web/lib/settingsActions.ts` (`"use server"`), shaped for React's `useActionState`:
  1. It checks the request with `saveRequest` (zod, `src/web/settingsForm.ts`), since it comes from
     the browser: a known section, only that section's fields, each `"default"` or a value. List
     rows are `z.strictObject`s with the row's known fields, so a row with extra keys is refused
     rather than stored.
  2. It gets the stores, loads the owner's document and reads `config.json`'s runtime part.
  3. It calls `saveSection`.
  4. A refusal returns `{ ok: false, problems }` and stores nothing.
  5. Otherwise it calls `store.save(OWNER_ID, toStore, now)` and `revalidatePath("/settings")`, and
     returns `{ ok: true }`.

  If any step throws (the database can't be reached, say), it returns
  `{ ok: false, failed: true }`, and the section shows the existing `SaveFailedNote` wording,
  "Couldn't save — try again". Nothing is lost to the error page.

## R6. The form: one client component per section, React's own state

- **Decision**: each section is a client component inside its `Panel`, holding its fields in
  `useState` and dispatching its Save through `useActionState`. The pending flag disables Save, and
  the returned problems are shown beside their fields and rows. Edits stay in state after a refusal
  (FR-004), and a save of one section leaves the others' state alone (US2-7).

  The form's decisions are pure functions in `src/web/settingsForm.ts`, unit-tested:
  - `addRow`, `removeRow`, `updateRow`;
  - `resetField` (back to the default, marked) and `editedField` (a changed field stops being the
    default);
  - `sectionRequest(section, fields)`, which turns the fields into a `SaveRequest`. An untouched
    default field goes as `"default"`, so it stays unset (SC-007), and every other field goes as a
    value;
  - the blank rows for each list (S3 for boards and searches): only the fields an entry needs.

  The components only wire them to inputs.
- **Inputs**:
  - board type: a select of `ATS_NAMES`;
  - remote only: a checkbox;
  - threshold and boost points: number inputs;
  - preferences: a textarea, kept exactly as typed;
  - every other value: a text input.
- **Alternatives**: one big form state for the page (couples sections the owner saves separately).

## R7. The Settings page and the Gmail actions work without sources

- **Decision**: `web/lib/uiState.ts` gains `getStores()`, which returns the stores and the sealing
  key without resolving any settings.
  - **`getUiState`** builds on it and keeps resolving, for every other page. Those pages need the
    checked whole, and show the error page without a source, as before 015.
  - **`getSettingsState()`** builds on it too. It adds the settings view (R1) and the notices, and
    never runs the cross-setting rules. The Settings page uses it.
  - **`gmailDeps`** (`web/lib/gmailDeps.ts`) uses `getStores()` instead of `getUiState()`. So
    connect, Check now and disconnect all work before any source is saved, and Check now takes its
    senders from `gmailSettings` (R1).

## R8. Removing the commands and the automatic import (FR-010, FR-014)

- **Decision**, done in S5a with the tests, then the docs in S5b:
  - **The commands**: `src/cli.ts` loses `export-settings`, `import-settings` and `withStores`.
    `src/app/settingsCommands.ts` and `src/config/importSettings.ts` are deleted, and with them
    `issueMessages`. Each export left without a caller goes too, such as `isRawObject` if only
    `importSettings.ts` used it; knip names them.
  - **The automatic import**:
    - `resolveSettings` loses the import. With nothing stored, it parses the runtime part alone, and
      the search part is only reported as `file_ignored`.
    - Its `at` parameter goes, and its callers change: `src/app/runSettings.ts` and
      `web/lib/uiState.ts`.
    - `SearchSettingsStore.importIfAbsent`, the `imported` notice, the `settings_imported` trace
      event and `SettingsNotices`' "only traced" branch and doc comment are removed.
  - **Tests**:
    - the store contract's first write becomes `save`, and its test name drops "imported once";
    - the `runOnce` tests that seeded their memory store through the import get a helper,
      `memoryStores` with search settings. They are in `run.test.ts`, `llm.test.ts`,
      `searchE2e.test.ts`, `recovery.test.ts`, `runIds.test.ts` and `e2e.test.ts`;
    - `tests/docker.sh` checks `/settings` instead of `/recommended`, because an empty test
      database now has no sources. Its comment at :32, the merge at :33, the fetch at :67, the host
      check at :68 and the "renders rows" check at :72 all change.
  - **Docs (S5b)**: the README and `examples/` drop the commands and the import:
    - `settings.json` is deleted;
    - "Search settings you import" goes (README :134–135), and so does the data model's "as
      imported" label (:644);
    - Setup says to add the first board or search on the Settings page.

    `CLAUDE.md` changes the same way.
- **Order**: this lands last, after the page can save every section, so there is never a version
  with no way to set search settings.

## R9. Delivery and test split

- **Delivery**: six code PRs after the docs PR (plan, Delivery):
  1. **View**: the page shows every setting in effect, defaults marked, and loads without sources.
     It replaces the Scoring placeholder, and the Gmail actions work without sources.
  2. **Save, Scoring and Preferences**: the generic save path, reset to default, problems shown next
     to fields.
  3. **Sources**: boards and searches.
  4. **Filters**: the title filter and the exclusions.
  - **5a. Removals**: the commands and the automatic import, and the tests they break.
  - **5b. Docs**: the README, `examples/`, `CLAUDE.md`.
- **Test split**: the decisions are pure functions, unit-tested:
  - the view and notices;
  - the sections table;
  - `applySection`, `sectionProblems` and `saveSection`, which includes the SC-003 table for every
    section;
  - the form functions and the request check.

  The other kinds:
  - **UI**: exactly one new test, for the Scoring section. It saves, shows a refusal beside the
    field, keeps the edit, and shows the failed-save note. The settings page test is updated, not
    added to.
  - **Integration**: none new. The store's `save` is already in the contract.
  - **Removed**: 015's tests for the commands (`importSettings.test.ts`, 8) and for the automatic
    import (3 in `resolveSettings.test.ts`). The other tests that relied on the import are
    rewritten, not removed.
  - **Totals**: 45 new unit tests and 1 UI test, less 11 removed unit tests (tasks, ledger). From
    664 / 58 / 58 (85.13 / 7.44 / 7.44%) that gives 698 / 58 / 59 (85.64 / 7.12 / 7.24%), so every
    share moves toward 95 / 4 / 1. A second UI test would move the UI share the wrong way, so the
    other sections are tested through their pure parts.
