---
description: "Tasks for feature 016: edit search settings on the Settings page, delivered as small PRs"
---

# Tasks: Edit search settings on the Settings page

**Input**: Design documents from `docs/specs/016-settings-editor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/settings-page.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file.
Existing tests a change breaks are updated in that same sitting, before the code.

**Organization**: by user story, in sittings. **Each sitting is one pull request** (plan
"Delivery"): a docs PR, then five code PRs.

- **Per-PR flow** (each sitting's first and last tasks):
  1. Check `docker compose top myjobbot | grep -c "cli.ts run"` prints 0 (as its own command), then
     `docker compose stop`. Stop a running `docker:watch` by listing its PIDs in one command and
     killing them in the next (never a `pgrep -f` loop whose pattern is in the same command).
  2. `git switch main && git pull --ff-only && git switch -c <branch>`.
  3. Create `.specify/sitting-in-progress` naming the sitting; write the tests, then the code.
  4. Run `npm run check` and `npm run check:db`, have a reviewer agent check the diff (habit-hooks
     asks for one), check the size (`git diff --stat main`), and delete the marker. S5 also runs
     `tests/docker.sh`.
  5. Commit and push with no attribution or `Co-authored-by` lines (this repo's `user.email` is
     `risingfish@users.noreply.github.com` on purpose). Open the PR with no footer; its
     description lists that PR's quickstart steps.
  6. **Stop, and wait for the owner to merge it.** Then `npm run docker:up`, and the owner tries
     the PR before the next sitting starts.
- **Size**: about 10 files per PR, tests included. Past about 12, tell the owner when opening it.
- **Limits to design for** (constitution Principle I): functions at most 20 lines, files at most
  200, at most 3 parameters. habit-hooks runs knip without the tests (`test-only-dead-code`), so
  every export needs a production caller in another file, in the sitting that adds it.
- **Libraries their own way** (constitution 2.3.0): React's `useState` and `useActionState` for the
  form, zod's `safeParse` for the action's input and the settings, and `fileConfigSchema.shape` for
  each key's default. No new library.
- **One UI test only** (research R9): the sections are tested through their pure parts in
  `src/web/`. A second UI test would raise the UI share.
- **No new comments** beyond each new function's one-line purpose doc comment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3 from spec.md

---

## Phase 1: Setup

### Sitting S0: planning docs PR (T001–T003), branch `016-settings-editor`

- [ ] T001 Per-PR flow step 1 (done on 2026-10-25: the stack and the watcher are stopped). Create
  `.specify/sitting-in-progress` naming S0.
- [ ] T002 Run `npm run check` and `npm run check:db`, and correct the ledger's baseline row below if
  the counts differ.
- [ ] T003 Delete the marker, and commit only `docs/specs/016-settings-editor/` ("Plan the Settings
  page editor (016)"). Push it and open a docs-only PR. **Wait for the owner to merge it.**

---

## Phase 2: User Story 1 - See the search settings in effect (Priority: P1) 🎯 MVP

**Goal**: Settings shows every search setting in effect, defaults marked, and loads with nothing
stored.

**Independent Test**: quickstart PR 1: the page shows the stored settings, with defaults marked,
and the placeholder is gone.

### Sitting S1, PR 1: the settings in view (T004–T011), branch `016-pr1-settings-view`

- [ ] T004 [US1] Per-PR flow steps 1–3, for sitting S1.
- [ ] T005 [P] [US1] Unit tests in a new `tests/settingsView.test.ts` (eight `test()`s) for
  `settingsView(stored, runtime)` in `src/web/settingsView.ts` (research R1, data model):
  - stored values are shown as stored and not marked default;
  - with nothing stored (`null`), every field shows its schema default, marked: threshold 70,
    preferences `""`, empty lists, no boosts;
  - the title filter's three lists each have their own default: `extra_exclude` stored and
    `include` unset gives the stored terms and the default include list, marked;
  - a stored value that fell back whole (`match_threshold: 150`) shows 70, marked default;
  - a list with one bad entry shows the others, not marked default;
  - `needsSource` is true with nothing stored and false once a company or a search is in effect;
  - `title_boosts` comes as rows of term and points, in the stored order;
  - `exclude_publishers` comes from its stored top-level key, with `[]` as its default.
- [ ] T006 [P] [US1] Unit tests in a new `tests/settingsSections.test.ts` (two `test()`s) for
  `SECTIONS` in `src/web/settingsSections.ts`, and for `gmailSettings(fileRaw)` in
  `src/web/settingsView.ts`:
  - each of the eight search keys belongs to exactly one section;
  - `gmailSettings` reads `gmail.alert_senders` from the runtime part, with its default, even when
    no source is set.
- [ ] T007 [P] [US1] Update `tests/client/settings.test.tsx` (no new `test()`). In the `getUiState`
  mock at :8, mock `getSettingsState` instead, returning a settings view from `settingsView(null,
  {})`, the notices and the Gmail stores. Change the panel list at :14 to
  `["Sources", "Preferences", "Scoring", "Filters", "Gmail"]`.
- [ ] T008 [US1] In `src/config/schema.ts`, export `titleFilterTerms`, the untransformed title filter
  object. `titleFilter` becomes `titleFilterTerms.transform(...)`. Add `src/web/settingsSections.ts`
  and `src/web/settingsView.ts` (T005, T006).
- [ ] T009 [US1] In `web/lib/uiState.ts`, add `getSettingsState()`. It returns the stores, the
  notices and `settingsView(stored, runtime)`, and never runs the cross-setting rules (research
  R7). In `web/lib/gmailActions.ts`, Check now reads the senders through `gmailSettings`, so it
  works with no source set.
- [ ] T010 [US1] In `web/app/settings/page.tsx`, render the notices, then read-only Sources,
  Preferences, Scoring and Filters panels, then Gmail. Use `getSettingsState`, and drop the
  placeholder Scoring panel. Each field shows its value, and "(default)" when `isDefault`. Sources
  says "Add a company board or a saved search: runs and the other pages need one." when
  `needsSource`. The components go in `web/components/settings/SettingsSections.tsx`.
- [ ] T011 [US1] Per-PR flow steps 4–6 ("Show the search settings on the Settings page (016 PR 1)").

**Checkpoint**: User Story 1 works: the page shows the real settings.

---

## Phase 3: User Stories 2 and 3 - Change, save and reset settings (Priority: P1, P2)

**Goal**: each section saves its own edits, checked with the rest. A setting can be reset to its
default.

**Independent Test**: quickstart PRs 2–4.

### Sitting S2, PR 2: the save path, Scoring and Preferences (T012–T020), branch `016-pr2-settings-save`

- [ ] T012 [US2] Per-PR flow steps 1–3, for sitting S2.
- [ ] T013 [P] [US2] Unit tests in a new `tests/settingsSave.test.ts` (fourteen `test()`s) for
  `applySection`, `sectionProblems` and `saveSection` in `src/web/settingsSave.ts` (research R3,
  R4, data model):
  - `applySection` replaces only the section's fields, and keeps the other sections exactly as
    stored, a value that fell back included;
  - a `"default"` edit removes the field from the document to store;
  - boost rows become a map in row order;
  - the document to check holds the other sections after fallback, so a bad stored threshold
    doesn't block a Preferences save;
  - the section's own values are checked strictly: a threshold of 150 is refused;
  - with nothing stored (`null`), a save builds the document from the section alone;
  - `sectionProblems` places a field's problem on its field;
  - it places a list entry's problem on its row, and a boost's on its row by the term's position;
  - it places a rule with no path at the top of the section;
  - it gives a bad record key's nested reasons;
  - `saveSection` returns the document to store when the check passes;
  - it returns the problems, and nothing to store, when the check fails;
  - SC-003, table-driven: each invalid search-setting example in `tests/config.test.ts`, saved in
    its section, is refused with the message loading the file gives. A runtime key in an example,
    such as the "three refreshes a day" case's `refresh_hours`, goes in the runtime part;
  - the save is checked against the runtime part passed in, for example the JSearch cap.
- [ ] T014 [P] [US2] Unit tests in a new `tests/settingsForm.test.ts` (seven `test()`s) for
  `src/web/settingsForm.ts` (research R6), and the request check:
  - `addRow` appends a blank row;
  - `removeRow` drops the row at its index;
  - `updateRow` changes one row's field;
  - `resetField` puts the default back, marked;
  - `editedField` clears the marker;
  - `saveRequest` (zod) refuses an unknown section;
  - `saveRequest` refuses a field of another section.
- [ ] T015 [P] [US2] UI test in a new `tests/client/settingsScoring.test.tsx` (one `test()`), with the
  action mocked:
  - editing the threshold and saving sends a `scoring` request;
  - a refusal shows "Too big: expected number to be <=100" beside the threshold, and the typed
    value stays;
  - a stored field shows Reset to default, and a default one doesn't.
- [ ] T016 [US2] Add `src/web/settingsSave.ts` (T013). Its issue wording comes from 015's
  `issueMessages`: move it out of `src/config/importSettings.ts`, which then imports it until S5
  deletes the file. Add `src/web/settingsForm.ts` (T014), including the `saveRequest` schema.
- [ ] T017 [US2] Add `web/lib/settingsActions.ts` with the server action
  `saveSettingsSection(request)` (research R5). It checks the request with `saveRequest`, loads the
  stored document and the runtime part, calls `saveSection`, then saves through
  `store.save(OWNER_ID, …)` with `revalidatePath("/settings")`, or returns the problems.
- [ ] T018 [US2] Add the client components `web/components/settings/ScoringSection.tsx` (threshold,
  boost rows) and `PreferencesSection.tsx` (a textarea), using `settingsForm.ts` and
  `useActionState`. Each shows "(default)", Reset to default, its own Save, "Saved", "Couldn't
  save. Try again.", and problems beside fields and rows (contract). Render them from the page in
  place of the read-only panels.
- [ ] T019 [US2] Check every file is within 200 lines. Split the row editor into
  `web/components/settings/RowList.tsx` if a section component would pass the limit.
- [ ] T020 [US2] Per-PR flow steps 4–6 ("Save Scoring and Preferences from the Settings page (016
  PR 2)").

### Sitting S3, PR 3: Sources (T021–T025), branch `016-pr3-settings-sources`

- [ ] T021 [US2] Per-PR flow steps 1–3, for sitting S3.
- [ ] T022 [P] [US2] Unit tests in `tests/settingsSave.test.ts` (three `test()`s):
  - a board row's bad field (`companies[1].slug`) is placed on row 1;
  - unique names, the reserved name and "at least one company or search" are placed at the top of
    Sources;
  - the JSearch budget message is placed at the top of Sources when a search is added.
- [ ] T023 [US2] Add `web/components/settings/SourcesSection.tsx`. Board rows have a name, a
  board-type select of `ATS_NAMES` and a board id. Search rows have a name, a query, a remote-only
  checkbox and a country (contract). It shows the "needs a source" note. Render it from the page.
- [ ] T024 [US2] Add the Sources rows to `src/web/settingsForm.ts`: a blank board and a blank search,
  each with all of its fields (research R3: entries are stored whole).
- [ ] T025 [US2] Per-PR flow steps 4–6 ("Edit sources from the Settings page (016 PR 3)").

### Sitting S4, PR 4: Filters (T026–T030), branch `016-pr4-settings-filters`

- [ ] T026 [US2] Per-PR flow steps 1–3, for sitting S4.
- [ ] T027 [P] [US2] Unit tests in `tests/settingsSave.test.ts` (three `test()`s):
  - title filter fields are stored inside `title_filter`, and one reset to default leaves the
    others;
  - a `title_filter` left with no lists is removed whole;
  - an excluded publisher's problem (`jsearch.exclude_publishers[2]`) is placed on row 2 of
    Filters.
- [ ] T028 [US2] Add the Filters mapping to `applySection` in `src/web/settingsSave.ts`: the three
  title filter lists, nested, plus the two exclusion lists (data model, Sections).
- [ ] T029 [US2] Add `web/components/settings/FiltersSection.tsx`, with five term lists, each with
  its own "(default)" and Reset to default. Render it from the page, replacing the last read-only
  panel. Delete the read-only panels in `SettingsSections.tsx` if nothing uses them.
- [ ] T030 [US2] Per-PR flow steps 4–6 ("Edit filters from the Settings page (016 PR 4)").

**Checkpoint**: User Stories 2 and 3 work: every search setting can be changed and reset on the
page.

---

## Phase 4: Polish - only the page changes settings (FR-010, FR-014)

### Sitting S5, PR 5: removals and docs (T031–T038), branch `016-pr5-remove-imports`

- [ ] T031 Per-PR flow steps 1–3, for sitting S5.
- [ ] T032 [P] Update the tests the removals break, before the code (no new `test()`):
  - delete `tests/importSettings.test.ts` (8 unit; its SC-003 table already lives in
    `settingsSave.test.ts`);
  - in `tests/resolveSettings.test.ts`, delete the tests at :18 (the import), :51 (the race) and :57
    (could not be stored), 3 unit. Rewrite :31 so search settings in the file with nothing stored
    are never imported: it throws "at least one company or search" and stores nothing;
  - in `tests/runSettings.test.ts`, rewrite :17 so a first run with nothing stored refuses, and seed
    :33 with `put`;
  - add a helper to `tests/helpers/memoryStore.ts` that seeds a store with search settings, and use
    it in every `runOnce` test the check names;
  - the store contract's step 2 writes with `save` instead of `importIfAbsent`, and the memory
    store loses `importIfAbsent`;
  - `tests/client/settingsNotices.test.tsx` drops its `imported` case.
- [ ] T033 Remove the automatic import: `importFromFile` in `src/config/resolve.ts`, the `imported`
  kind of `SettingsNotice`, `importIfAbsent` in `src/db/searchSettingsStore.ts` and
  `src/db/kysely/searchSettingsStore.ts`, and `settings_imported` (research R8). Update
  `resolveSettings`'s doc comment.
- [ ] T034 Remove the commands: `export-settings` and `import-settings` from `src/cli.ts` (`USAGE`,
  `COMMANDS`, `withStores` if unused). Delete `src/app/settingsCommands.ts` and
  `src/config/importSettings.ts`.
- [ ] T035 [P] In `tests/docker.sh`, check `/settings` (the page loads with "Sources") instead of
  `/recommended`, and copy only `examples/config.json`, not the merge. Delete
  `examples/settings.json`, and move its example board into the README.
- [ ] T036 [P] Update `README.md`:
  - **Setup** and **Deploy with Docker**: add the first board or search on the Settings page;
    drop `settings.json` and `import-settings`;
  - **Configuration knobs**: search settings are changed on the Settings page, a section at a time;
    remove the upgrade import and the commands;
  - the Docker task table: drop "Change search settings", or point it at the page.
- [ ] T037 Update `CLAUDE.md`: the 015 line says search settings change only on the Settings page,
  and the two commands come out of Commands. Fill the ledger's last row.
- [ ] T038 Per-PR flow steps 4–6 ("Change search settings only on the Settings page (016 PR 5)"),
  including `tests/docker.sh`. It is about 16 files: tell the owner when opening it, and offer to
  split the docs (T035–T037) into their own PR.

---

## Dependencies & Execution Order

- **S0 → S1 → S2 → S3 → S4 → S5**, each merged and tried before the next.
- **S2** builds the save path every later section uses.
- **S5** comes last: the commands and the automatic import stay until every section can be saved,
  so there is always a way to set search settings.

### Within each sitting

- The per-PR flow's first task, then the test tasks (all [P]: different files), then the code in
  task order, then the closing flow task.
- Every new export has a production caller in another file, in the sitting that adds it:
  - S1: `titleFilterTerms` (from `settingsView.ts`),
    `settingsView` and `gmailSettings` (from `uiState.ts`, `gmailActions.ts`), `SECTIONS` (from
    `settingsView.ts`), `getSettingsState` (from the page);
  - S2: `applySection`, `sectionProblems`, `saveSection` (from `settingsActions.ts`), the form
    functions and `saveRequest` (from the section components and the action);
  - S3, S4: no new exports beyond their components, rendered from the page.

## Parallel Example: User Story 2 (S2)

```text
T013 save decisions   tests/settingsSave.test.ts
T014 form and request tests/settingsForm.test.ts
T015 Scoring editor   tests/client/settingsScoring.test.tsx
```

## Implementation Strategy

- **MVP**: S1. The page shows the real settings.
- **Increments**: S2 makes Scoring and Preferences editable, S3 and S4 the rest, and S5 makes the
  page the only way.

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (after 015, T002) | 664 (85.13%) | 58 (7.44%) | 58 (7.44%) |
| Planned new | 37 (T005 8, T006 2, T013 14, T014 7, T022 3, T027 3) | 0 | 1 (T015) |
| Planned removed | 11 (T032: `importSettings.test.ts` 8, `resolveSettings.test.ts` 3) | 0 | 0 |
| Planned after | 690 (85.50%) | 58 (7.19%) | 59 (7.31%) |
| After PR 5 (T037) | | | |
