---
description: "Tasks for feature 016: edit search settings on the Settings page, delivered as small PRs"
---

# Tasks: Edit search settings on the Settings page

**Input**: Design documents from `docs/specs/016-settings-editor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/settings-page.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file.
Existing tests a change breaks are updated in that same sitting, before the code.

**Organization**: by user story, in sittings. **Each sitting is one pull request** (plan
"Delivery"): a docs PR, then six code PRs.

- **Per-PR flow** (each sitting's first and last tasks):
  1. Check `docker compose top myjobbot | grep -c "cli.ts run"` prints 0 (as its own command), then
     `docker compose stop`. Stop a running `docker:watch` by listing its PIDs in one command and
     killing them in the next (never a `pgrep -f` loop whose pattern is in the same command).
  2. `git switch main && git pull --ff-only && git switch -c <branch>`.
  3. Create `.specify/sitting-in-progress` naming the sitting; write the tests, then the code.
  4. Run `npm run check` and `npm run check:db`, have a reviewer agent check the diff (habit-hooks
     asks for one), check the size (`git diff --stat main`), and delete the marker. S5a also runs
     `tests/docker.sh`.
  5. Commit and push with no attribution or `Co-authored-by` lines (this repo's `user.email` is
     `risingfish@users.noreply.github.com` on purpose). Open the PR with no footer; its
     description lists that PR's quickstart steps.
  6. **Stop, and wait for the owner to merge it.** Then `npm run docker:up`, and the owner tries
     the PR before the next sitting starts.
- **Size**: about 10 files per PR, tests included. Past about 12, tell the owner when opening it.
  S2 (~15) and S5a (~26) are over the limit (plan, Delivery).
- **Limits to design for** (constitution Principle I): functions at most 20 lines, files at most
  200, at most 3 parameters. habit-hooks runs knip without the tests (`test-only-dead-code`), so
  every export needs a production caller in another file, in the sitting that adds it.
- **Libraries their own way** (constitution 2.3.0): React's `useState` and `useActionState` for the
  form, zod for the request and the settings (`z.strictObject` for rows), and
  `fileConfigSchema.shape` / `titleFilterTerms.shape` for each field's default. No new library.
- **One UI test only** (research R9): the sections are tested through their pure parts in
  `src/web/`. A second UI test would raise the UI share.
- **No new comments** beyond each new function's one-line purpose doc comment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3 from spec.md

---

## Phase 1: Setup

### Sitting S0: planning docs PR (T001–T003), branch `016-settings-editor`

- [X] T001 Per-PR flow step 1 is done (2026-10-25: the stack and the watcher are stopped). Create
  `.specify/sitting-in-progress` naming S0.
- [X] T002 Run `npm run check` and `npm run check:db`, and correct the ledger's baseline row below if
  the counts differ.
- [X] T003 Delete the marker, and commit any changes under `docs/specs/016-settings-editor/` (the
  spec and plan are already committed on the branch). Push it and open a docs-only PR ("Plan the
  Settings page editor (016)"). **Wait for the owner to merge it.**

---

## Phase 2: User Story 1 - See the search settings in effect (Priority: P1) 🎯 MVP

**Goal**: Settings shows every search setting in effect, defaults marked, and loads (Gmail
included) with nothing stored.

**Independent Test**: quickstart PR 1.

### Sitting S1, PR 1: the settings in view (T004–T013), branch `016-pr1-settings-view`

- [X] T004 [US1] Per-PR flow steps 1–3, for sitting S1.
- [X] T005 [P] [US1] Unit tests in a new `tests/settingsView.test.ts` (ten `test()`s) for
  `settingsView(stored, hasSearchKey)` and `gmailSettings(fileRaw)` in `src/web/settingsView.ts`
  (research R1, data model):
  - stored values are shown as stored and not marked default;
  - with nothing stored (`null`), every field shows its default, marked: threshold 70,
    preferences `""`, empty lists, no boosts;
  - the title filter's three lists each have their own default: `extra_exclude` stored and
    `include` unset gives the stored terms and the default include list, marked;
  - a value that fell back whole (`match_threshold: 150`) shows 70, marked default;
  - a list with one bad entry shows the others, not marked default;
  - entries are kept as stored: a search stored without `country` or `remote_only` stays without
    them;
  - `needsSource` is true with nothing stored and false once a company or a search is in effect;
  - `needsSearchKey` is true with searches in effect and no key, and false with a key or with no
    searches;
  - `title_boosts` comes as rows of term and points in the stored order, and `exclude_publishers`
    comes from its stored top-level key with `[]` as its default;
  - `gmailSettings` reads `gmail.alert_senders` from the runtime part, with its default, when no
    source is set.
- [X] T006 [P] [US1] Unit test in a new `tests/settingsSections.test.ts` (one `test()`) for `SECTIONS`
  in `src/web/settingsSections.ts` (data model, Fields and sections):
  - the ten fields cover the eight search keys, each key once;
  - every field has one section, a stored path and a check path;
  - no two fields share a check path.
- [X] T007 [P] [US1] Unit test in `tests/resolveSettings.test.ts` (one `test()`) for
  `settingsNotices(split, stored)` in `src/config/resolve.ts`. It gives the fallback and
  `file_ignored` notices, and they are the same ones `resolveSettings` returns for those inputs.
- [X] T008 [P] [US1] Update `tests/client/settings.test.tsx` (no new `test()`):
  - at :8, mock `getSettingsState` instead of `getUiState`. It returns `settingsView(null, false)`,
    no notices and the Gmail stores;
  - change the panel list at :14 to `["Sources", "Preferences", "Scoring", "Filters", "Gmail"]`.
- [X] T009 [US1] In `src/config/schema.ts`, export `titleFilterTerms`, the untransformed title filter
  object. `titleFilter` becomes `titleFilterTerms.transform(...)`. Add
  `src/web/settingsSections.ts` and `src/web/settingsView.ts` (T005, T006).
- [X] T010 [US1] In `src/config/resolve.ts`, add `settingsNotices` (T007), and use it in
  `fromStored`.
- [X] T011 [US1] In `web/lib/uiState.ts`, add `getStores()`, which gives the stores and the key
  without resolving settings, and build `getUiState` on it. Add `getSettingsState()`: the stores,
  `settingsNotices` and `settingsView(stored, hasSearchKey)`, never running the cross-setting rules
  (research R7). `web/lib/gmailDeps.ts` uses `getStores()`. `web/lib/gmailActions.ts` Check now
  reads the senders through `gmailSettings`. Update the doc comments.
- [X] T012 [US1] In `web/app/settings/page.tsx`, render the notices, then read-only Sources,
  Preferences, Scoring and Filters panels, then Gmail. Use `getSettingsState`, and drop the
  placeholder Scoring panel.
  - Each field shows its value, plus "(default)" when `isDefault`.
  - Sources shows the "needs a source" and "needs JSEARCH_API_KEY" notes (contract).
  - The panels go in `web/components/settings/SettingsSections.tsx`.
- [X] T013 [US1] Per-PR flow steps 4–6 ("Show the search settings on the Settings page (016 PR 1)").

**Checkpoint**: User Story 1 works: the page shows the real settings.

---

## Phase 3: User Stories 2 and 3 - Change, save and reset settings (Priority: P1, P2)

**Goal**: each section saves its own edits, checked with the rest. A setting can be reset to its
default.

**Independent Test**: quickstart PRs 2–4.

### Sitting S2, PR 2: the generic save path, Scoring and Preferences (T014–T026), branch `016-pr2-settings-save`

The save decisions are generic over `SECTIONS` (research R2), so their tests cover every section
here. S3 and S4 add only components.

- [X] T014 [US2] Per-PR flow steps 1–3, for sitting S2.
- [X] T015 [P] [US2] Unit tests in a new `tests/settingsApply.test.ts` (eight `test()`s) for
  `applySection(stored, request)` in `src/web/settingsApply.ts` (research R3):
  - it replaces only the section's fields, and keeps other sections exactly as stored, a value that
    fell back included;
  - a `"default"` edit removes the field;
  - keys that aren't search settings are dropped from the document to store;
  - the document to check holds the other sections after fallback, so a bad stored threshold
    doesn't block a Preferences save;
  - entries keep exactly the fields sent: a search row without `country` is stored without it, and
    a request repeating the stored values gives back the stored document (SC-006);
  - boost rows become a map in row order;
  - title filter fields are stored inside `title_filter`, and resetting one leaves the others;
  - a `title_filter` left with no lists is removed whole; with nothing stored (`null`), the
    document is built from the section alone.
- [X] T016 [P] [US2] Unit tests in a new `tests/settingsProblems.test.ts` (eight `test()`s) for
  `sectionProblems(issues, request)` in `src/web/settingsProblems.ts` (research R4):
  - a field's problem goes on its field (`match_threshold`);
  - a list entry's goes on its row: `companies[1].slug` → `companies`, row 1;
  - nested check paths resolve: `jsearch.exclude_publishers.2` → `exclude_publishers`, row 2, and
    `title_filter.include.1` → `include`, row 1;
  - a boost's goes on its row, by the term's position in the submitted rows;
  - a bad record key gives one problem per nested reason, on the same row;
  - a rule with no path goes to the top of the saved section: a Preferences save with no source is
    refused there with "configure at least one company or search";
  - the JSearch budget on a Sources save goes to the top of Sources;
  - a bad runtime value (`http.timeout_s`) goes to the top of the saved section, and every message
    is zod's own, unprefixed.
- [X] T017 [P] [US2] Unit tests in a new `tests/settingsSave.test.ts` (seven `test()`s) for
  `saveSection(stored, runtime, request)` in `src/web/settingsSave.ts`:
  - it returns the document to store when the check passes;
  - it returns the problems, and nothing to store, when the check fails;
  - it works with nothing stored (`null`);
  - a boost term listed twice is refused on its second row;
  - the preferences text round-trips exactly, line breaks included;
  - SC-003, table-driven: each row of 015's `INVALID` table (`tests/importSettings.test.ts:43-66`,
    copied here, since S5a deletes that file) is saved in its section with `{companies:[STRIPE]}`
    as the rest. Each is refused with its field and row, and a message regex for zod's bare
    reason. The "three refreshes a day" row's `refresh_hours` goes in the runtime part;
  - the runtime part passed in is used, for example a lower JSearch cap.
- [X] T018 [P] [US2] Unit tests in a new `tests/settingsForm.test.ts` (nine `test()`s) for
  `src/web/settingsForm.ts` (research R6):
  - `addRow` appends a row;
  - `removeRow` drops the row at its index;
  - `updateRow` changes one row's field;
  - `resetField` puts the default back, marked;
  - `editedField` clears the marker;
  - `sectionRequest` sends an untouched default field as `"default"` and every other field as a
    value (SC-007);
  - `saveRequest` refuses an unknown section;
  - it refuses a field of another section;
  - it refuses a row with extra keys.
- [X] T019 [P] [US2] UI test in a new `tests/client/settingsScoring.test.tsx` (one `test()`), with
  `web/lib/settingsActions.js` mocked:
  - editing the threshold and saving sends a `scoring` request;
  - a refusal shows "Too big: expected number to be <=100" beside the threshold, and the typed
    value stays;
  - a stored field shows Reset to default, and a default one doesn't;
  - a `failed` result shows "Couldn't save — try again".
- [X] T020 [P] [US2] Update `tests/client/settings.test.tsx` (no new `test()`): add a `vi.mock` of
  `web/lib/settingsActions.js`. Each section form sits inside its `Panel`, so the `main > div > h4`
  selector at :14 still finds the titles.
- [X] T021 [US2] Add `src/web/settingsApply.ts` (T015), `src/web/settingsProblems.ts` (T016) and
  `src/web/settingsSave.ts` (T017). `saveSection` imports the other two and is their production
  caller. `importSettings.ts` is left alone until S5a.
- [X] T022 [US2] Add `src/web/settingsForm.ts` (T018), including `sectionRequest` and the
  `saveRequest` schema.
- [X] T023 [US2] Add `web/lib/settingsActions.ts` with
  `saveSettingsSection(previous: SaveResult, request: SaveRequest)` (research R5):
  - it checks the request with `saveRequest`, loads the stored document and the runtime part, and
    calls `saveSection`;
  - then it saves through `store.save(OWNER_ID, …)` with `revalidatePath("/settings")`, or returns
    the problems;
  - a thrown failure returns `{ ok: false, failed: true }`.
- [X] T024 [US2] Add the client components `web/components/settings/ScoringSection.tsx` (threshold,
  boost rows) and `PreferencesSection.tsx` (a textarea). Each wraps its form in `Panel` and uses
  `settingsForm.ts` and `useActionState`. Each shows (contract):
  - "(default)" and Reset to default;
  - its own Save, "Saved", and `SaveFailedNote`'s wording on a failed save;
  - problems beside fields and rows, or at the section's top.

  Render them from the page in place of the read-only panels.
- [X] T025 [US2] Check every file is within 200 lines. If a section component would pass the limit,
  split the row editor into `web/components/settings/RowList.tsx`.
- [X] T026 [US2] Per-PR flow steps 4–6 ("Save Scoring and Preferences from the Settings page (016
  PR 2)"). It is about 15 files: tell the owner when opening it.

### Sitting S3, PR 3: Sources (T027–T031), branch `016-pr3-settings-sources`

- [X] T027 [US2] Per-PR flow steps 1–3, for sitting S3.
- [X] T028 [P] [US2] Unit test in `tests/settingsForm.test.ts` (one `test()`): `blankBoard()` has a
  name, a board type and a board id, and `blankSearch()` only a name and a query, so a new search
  leaves remote only and country unset.
- [X] T029 [US2] Add `blankBoard` and `blankSearch` to `src/web/settingsForm.ts` (T028).
- [X] T030 [US2] Add `web/components/settings/SourcesSection.tsx`, using the blank rows (contract):
  - board rows: a name, a board-type select of `ATS_NAMES`, and a board id;
  - search rows: a name, a query, a remote-only checkbox and a country, which show their defaults
    while unset;
  - the two notes.

  Render it from the page.
- [X] T031 [US2] Per-PR flow steps 4–6 ("Edit sources from the Settings page (016 PR 3)").

### Sitting S4, PR 4: Filters (T032–T035), branch `016-pr4-settings-filters`

- [X] T032 [US2] Per-PR flow steps 1–3, for sitting S4.
- [X] T033 [US2] Add `web/components/settings/FiltersSection.tsx`, with five term lists. Each has its
  own "(default)" and Reset to default. Render it from the page. Its save logic and tests landed in
  S2.
- [X] T034 [US2] Delete the read-only panels in `web/components/settings/SettingsSections.tsx`, now
  that every section is a form, and the file if nothing else uses it.
- [X] T035 [US2] Per-PR flow steps 4–6 ("Edit filters from the Settings page (016 PR 4)").

**Checkpoint**: User Stories 2 and 3 work: every search setting can be changed and reset on the
page.

---

## Phase 4: Polish - only the page changes settings (FR-010, FR-014)

### Sitting S5a, PR 5a: the removals (T036–T041), branch `016-pr5a-remove-imports`

- [X] T036 Per-PR flow steps 1–3, for sitting S5a.
- [X] T037 [P] Update the tests the removals break, before the code (no new `test()`):
  - delete `tests/importSettings.test.ts` (8 unit; its SC-003 table lives in
    `settingsSave.test.ts`);
  - in `tests/resolveSettings.test.ts`:
    - delete the tests at :18 (the import), :51 (the race) and :57 (could not be stored), 3 unit;
    - rewrite :31 so search settings in the file, with nothing stored, are never imported: it
      throws "at least one company or search" and stores nothing;
    - drop the `at` argument everywhere;
  - in `tests/runSettings.test.ts`, rewrite :17 so a first run with nothing stored refuses, and seed
    :33 with `put`;
  - add a helper to `tests/helpers/memoryStore.ts` that seeds a store with search settings. Use it
    in the `runOnce` tests of `run.test.ts`, `llm.test.ts`, `searchE2e.test.ts`,
    `recovery.test.ts`, `runIds.test.ts` and `e2e.test.ts`;
  - the store contract's step 2 writes with `save` instead of `importIfAbsent`, and its test name
    at `tests/helpers/searchSettingsContract.ts:46` drops "imported once". The memory store loses
    `importIfAbsent`;
  - `tests/client/settingsNotices.test.tsx` drops its `imported` case.
- [X] T038 Remove the automatic import (research R8):
  - `importFromFile` and the `at` parameter of `resolveSettings` in `src/config/resolve.ts`, and its
    callers in `src/app/runSettings.ts` and `web/lib/uiState.ts`;
  - the `imported` kind of `SettingsNotice`, and `importIfAbsent` in
    `src/db/searchSettingsStore.ts` and `src/db/kysely/searchSettingsStore.ts`;
  - `SettingsNotices.tsx`'s "only traced" branch.

  Update the doc comments of `resolveSettings`, `getUiState` and `SettingsNotices`.
- [X] T039 Remove the commands: `export-settings`, `import-settings` and `withStores` from
  `src/cli.ts`. Delete `src/app/settingsCommands.ts` and `src/config/importSettings.ts`, which takes
  `issueMessages` with it. Remove any export left without a caller, such as `isRawObject` in
  `src/config/searchSettings.ts` if only `importSettings.ts` used it.
- [X] T040 [P] In `tests/docker.sh`, check `/settings`, which loads with "Sources", instead of
  `/recommended`:
  - the comment at :32;
  - the merge at :33, which now copies only `examples/config.json`;
  - the fetch at :67 and the foreign-host check at :68;
  - the "renders rows" check at :72, which becomes a check for "Sources".
- [X] T041 Per-PR flow steps 4–6 ("Stop importing search settings outside the Settings page (016
  PR 5a)"), including `tests/docker.sh`. It is about 26 files: tell the owner when opening it.

### Sitting S5b, PR 5b: docs (T042–T045), branch `016-pr5b-docs`

- [X] T042 Per-PR flow steps 1–3, for sitting S5b.
- [X] T043 [P] Update `README.md` (FR-010):
  - **Setup** and **Deploy with Docker**: add the first board or search on the Settings page; drop
    `settings.json` and `import-settings`;
  - **Web UI** (:134–135): "Search settings you import" becomes search settings saved on the
    Settings page;
  - **Configuration knobs**: search settings are changed on the Settings page, a section at a time;
    remove the upgrade import and the commands;
  - the Docker task table: point "Change search settings" at the page;
  - the data model (:644): drop "as imported".
- [X] T044 [P] Delete `examples/settings.json`. Update `CLAUDE.md`: the 015 line says search settings
  change only on the Settings page, and the two commands come out of Commands. Fill the ledger's last
  row.
- [X] T045 Per-PR flow steps 4–6 ("Document the Settings page editor (016 PR 5b)").

---

## Dependencies & Execution Order

- **S0 → S1 → S2 → S3 → S4 → S5a → S5b**, each merged and tried before the next.
- **S2** builds the generic save path every later section uses, with all its tests.
- **S5a** comes after every section can be saved: the commands and the automatic import stay until
  then, so there is always a way to set search settings.

### Within each sitting

- The per-PR flow's first task, then the test tasks (all [P]: different files), then the code in
  task order, then the closing flow task.
- Every new export has a production caller in another file, in the sitting that adds it:
  - S1:
    - `titleFilterTerms` (from `settingsView.ts`);
    - `SECTIONS` (from `settingsView.ts`);
    - `settingsView` and `gmailSettings` (from `uiState.ts` and `gmailActions.ts`);
    - `settingsNotices` (from `uiState.ts`);
    - `getStores` (from `gmailDeps.ts`) and `getSettingsState` (from the page);
  - S2:
    - `applySection` and `sectionProblems` (from `settingsSave.ts`);
    - `saveSection` and `saveRequest` (from `settingsActions.ts`);
    - the form functions (from the section components);
  - S3: `blankBoard` and `blankSearch` (from `SourcesSection.tsx`);
  - S4: no new exports beyond its component;
  - S5a: removes exports and adds none.

## Parallel Example: User Story 2 (S2)

```text
T015 apply           tests/settingsApply.test.ts
T016 problems        tests/settingsProblems.test.ts
T017 save            tests/settingsSave.test.ts
T018 form, request   tests/settingsForm.test.ts
T019 Scoring editor  tests/client/settingsScoring.test.tsx
T020 page test       tests/client/settings.test.tsx
```

## Implementation Strategy

- **MVP**: S1. The page shows the real settings.
- **Increments**:
  - S2 makes Scoring and Preferences editable, and S3 and S4 the rest;
  - S5a makes the page the only way to change settings, and S5b documents it.

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (after 015, T002) | 664 (85.13%) | 58 (7.44%) | 58 (7.44%) |
| Planned new | 45 (T005 10, T006 1, T007 1, T015 8, T016 8, T017 7, T018 9, T028 1) | 0 | 1 (T019) |
| Planned removed | 11 (T037: `importSettings.test.ts` 8, `resolveSettings.test.ts` 3) | 0 | 0 |
| Planned after | 698 (85.64%) | 58 (7.12%) | 59 (7.24%) |
| After PR 5b (T044) | 698 (85.64%): the `node` project's 699 less the `runOnce` test counted as integration | 58 (7.12%): the `integration` project's 57 (1 skipped without a browser) plus that `runOnce` test | 59 (7.24%) |
