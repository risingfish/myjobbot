---
description: "Tasks for feature 015: search settings in the database, delivered as small PRs"
---

# Tasks: Search settings in the database

**Input**: Design documents from `docs/specs/015-settings-in-database/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/settings.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file,
and the existing tests its change breaks, which are updated in that same sitting, before the code.

**Organization**: by user story, in sittings. **Each sitting is one pull request** (plan
"Delivery"): a docs PR, then five code PRs.

- **Per-PR flow** (each sitting's first and last tasks):
  1. Check `docker compose top myjobbot | grep -c "cli.ts run"` prints 0 (as its own command), then
     `docker compose stop`. Stop a running `docker:watch` by listing its PIDs in one command and
     killing them in the next (never a `pgrep -f` loop whose pattern is in the same command).
  2. `git switch main && git pull --ff-only && git switch -c <branch>`.
  3. Create `.specify/sitting-in-progress` naming the sitting; write the tests, then the code.
  4. Run `npm run check` and `npm run check:db`, check the size (`git diff --stat main`), and delete
     the marker. Sittings that change how `config.json` is read or what `examples/` holds (S1b, S4)
     also run `tests/docker.sh`.
  5. Commit and push with no attribution or `Co-authored-by` lines (this repo's `user.email` is
     `risingfish@users.noreply.github.com` on purpose), and open the PR with no footer. Its
     description lists that PR's quickstart steps.
  6. **Stop, and wait for the owner to merge it.** Then `npm run docker:up`, and the owner tries
     the PR before the next sitting starts.
- **Size**: about 10 files per PR, tests included. Past about 12, tell the owner when opening it.
  PR 1b is larger (about 23) by the owner's choice: it stays whole.
- **Limits to design for** (constitution Principle I): functions at most 20 lines, files at most
  200, at most 3 parameters. habit-hooks runs knip without the tests (`test-only-dead-code`), so
  every export and every store method needs a production caller in another file, in the sitting
  that adds it.
- **Libraries their own way** (constitution 2.3.0): Kysely's schema builder for migration 011
  (`createTable`, the builder's `"json"` column type, `modifyEnd` with the table options as the one
  `sql` fragment, `addForeignKeyConstraint`), `insertInto(...).ignore()` and `onDuplicateKeyUpdate`
  for the store's writes; zod's own
  `safeParse` on the exported element schemas and on `fileConfigSchema.shape` for the fallback. No
  new library.
- **Integration tests are capped at 3 new** (research R9): migration 011, one bundled settings
  contract case, and one `runOnce` test. Anything that touches files or the database counts as
  integration; the run's trace events are checked through the helper with the memory trace.
- **No new comments** beyond each new function's one-line purpose doc comment. Update existing doc
  comments whose purpose changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4 from spec.md

---

## Phase 1: Setup

### Sitting S0: planning docs PR (T001–T003), branch `015-settings-in-database`

- [X] T001 Per-PR flow step 1 (done on 2026-10-25: the stack is stopped). Create
  `.specify/sitting-in-progress` naming S0.
- [X] T002 Run `npm run check` and `npm run check:db`, and correct the ledger's baseline row below if
  the counts differ (and the planned-after row and the percentages in plan.md and research R9 with
  it).
- [X] T003 Delete the marker, and commit only `docs/specs/015-settings-in-database/` ("Plan search
  settings in the database (015)"). Push it and open a docs-only PR. **Wait for the owner to merge
  it.**

---

## Phase 2: Foundational

### Sitting S1a, PR 1a: the tables (T004–T008), branch `015-pr1a-user-settings-tables`

- [X] T004 Per-PR flow steps 1–3, for sitting S1a.
- [X] T005 [P] Integration test in `tests/integration/companyMigrations.test.ts` (one new `test()`,
  named for step 011; move the file's name to `laterMigrations.test.ts` only if it would pass 200
  lines): `migrateBefore(db, "011")`, run 011, check both tables exist and are empty, and
  `columnTypes` for every column in data-model.md. Add `011_user_settings` to the exact migration
  lists at `tests/integration/migrate.test.ts:57`, `:73`, `:104`, `:122` and
  `tests/integration/companyMigrations.test.ts:30`, `:56`, and both tables to the collation list at
  `migrate.test.ts:59`, in the order that list already follows (as MariaDB returns them; check it
  against the run rather than assuming `user_settings` before `users`). Add `user_settings` then `users` to `TABLES` in `tests/helpers/testDb.ts`,
  ordered so `emptyTables` empties `user_settings` before `users` (the foreign key).
- [X] T006 Add `src/db/migrations/011_user_settings.ts` (exported as `userSettings`): `users` (`id`
  int auto-increment primary key, `name` `varchar(255)` not null, `created_at` `varchar(32)` not
  null) and `user_settings` (`user_id` int primary key, `settings` `"json"` not null, `updated_at`
  `varchar(32)` not null; T005's `columnTypes` expects `settings` as MariaDB reports a `json`
  column, `longtext`), with the table options of `009_companies.ts` and
  `addForeignKeyConstraint("user_settings_user_fk", ["user_id"], "users", ["id"])`. List it in
  `src/db/migrations/index.ts`.
- [X] T007 Add `UsersTable` and `UserSettingsTable` to `Database` in `src/db/schema.ts`.
- [X] T008 Per-PR flow steps 4–6 ("Add the users and user settings tables (015 PR 1a)").

---

## Phase 3: User Stories 1 and 2 - Read search settings from the database, carried over (Priority: P1) 🎯 MVP

**Goal**: runs and pages use search settings from the database; the upgrade imports the file's
once.

**Independent Test**: after one run, `user_settings` holds the file's search settings; editing a
search setting in `config.json` no longer changes anything, while editing a runtime setting still
does (quickstart PR 1b).

### Sitting S1b, PR 1b: the store, the import and both readers (T009–T021), branch `015-pr1b-settings-store`

- [X] T009 [US1] Per-PR flow steps 1–3, for sitting S1b.
- [X] T010 [US1] Add `FULL_CONFIG` to `tests/helpers/config.ts`: a raw `config.json` object with
  all eight search keys set (two companies, one search, preferences, `match_threshold: 60`,
  `title_filter` with `extra_exclude`, two title boosts, `exclude_companies`,
  `jsearch.exclude_publishers`) plus runtime keys, `jsearch.monthly_request_cap` and
  `refresh_hours` among them, so a split leaves runtime values beside `exclude_publishers`. T011
  and T012 use it; it has a search, so a run on it would need `JSEARCH_API_KEY` (T014 uses
  `ONE_COMPANY`). Do this first: the other S1b test tasks build on it.
- [X] T011 [P] [US1] Unit tests in a new `tests/searchSettings.test.ts` (eight `test()`s) for
  `splitSettings(raw)` and `mergeSettings(runtime, search)` in `src/config/searchSettings.ts`
  (research R2), on `FULL_CONFIG`:
  - the eight search keys go to the search part, everything else to runtime;
  - `jsearch.exclude_publishers` goes to the search part as `exclude_publishers`, the rest of
    `jsearch` stays runtime, and a `jsearch` holding only `exclude_publishers` leaves no runtime
    `jsearch`;
  - unset keys stay absent from both parts;
  - a raw file with only runtime keys gives an empty search part;
  - merging puts `exclude_publishers` back inside `jsearch` with the file's other `jsearch` values;
  - merging with an empty search part gives the runtime part unchanged, and merging copies only the
    search keys from the search part (a stray key is left out);
  - `splitSettings` then `mergeSettings` gives back the original object, deep-equal;
  - `fileConfigSchema.parse(mergeSettings(...))` equals parsing the original file, and a raw value
    that isn't an object (`[]`) passes through split and merge so the schema gives today's error.
- [X] T012 [P] [US1] Unit tests in a new `tests/resolveSettings.test.ts` (eight `test()`s) for
  `resolveSettings(fileRaw, store, at)` in `src/config/resolve.ts`, with the memory settings store:
  - nothing stored and search settings in the file: they are imported once, the result parses as
    the file would, and the notices are one `imported` naming the keys, with no `file_ignored`;
  - nothing stored and none in the file: nothing is stored, and the defaults apply (a file with no
    source at all throws "configure at least one company or search", as today);
  - an invalid search part in the file: throws today's message and stores nothing;
  - settings stored: the file's search part is ignored, and a `file_ignored` notice names its keys
    as in `config.json` (`jsearch.exclude_publishers`);
  - settings stored, and the file holds only runtime keys: there are no notices;
  - a rule spanning both (too many stored searches for the file's JSearch cap) throws today's
    message;
  - the import race's losing side: a store whose `importIfAbsent` returns `false` because another
    process stored first gives the stored settings, not the file's, and no `imported` notice;
  - a store whose `importIfAbsent` returns `false` and whose `load` still gives `null` throws
    "search settings could not be stored".
- [X] T013 [P] [US1] One bundled contract case in a new `tests/helpers/searchSettingsContract.ts`
  (one `test()`, each step a helper; data-model "Store contract" steps 1, 2, 4 and 5; step 3 comes
  with `save` in S3), wired into `tests/storeContract.test.ts` and
  `tests/integration/storeContract.test.ts` like `companyContract`, with an `owners()` hook that
  returns the `users` rows' ids (expected `[1]`). Add `afterAll(() => emptyTables(db))` to
  `tests/integration/storeContract.test.ts`, so no contract's leftover rows reach `tests/docker.sh`.
- [X] T014 [P] [US1] Tests for the run's settings (research R4), on `ONE_COMPANY`:
  - unit, in a new `tests/runSettings.test.ts` (three `test()`s) for `settingsForRun(loaded, store,
    trace)` in `src/app/runSettings.ts`, with `memoryTrace()` (`tests/helpers/trace.ts`) and the
    memory store, no files: a first call imports and traces `settings_imported` with no
    `settings_file_ignored`; with settings already stored, it returns the stored sources and traces
    `settings_file_ignored` naming the file's search keys; the `AppConfig` it returned is unchanged
    after the store changes (FR-007);
  - integration, in `tests/run.test.ts` (one `test()`): a `runOnce` whose store already holds a
    different company fetches from the stored one, not the file's.

  The existing run tests keep passing unchanged: each fresh `memoryStores()` imports `ONE_COMPANY`
  on its first run.
- [X] T015 [P] [US1] Update the tests the new load path changes (no new `test()`):
  - `tests/configFiles.test.ts:7`: `loadConfig` returns `{ env, fileRaw, resume, dataDir }` and
    `loadFileConfig` the raw object (`.companies` still has length 2), unvalidated;
  - `tests/config.test.ts:20`, `:159` and `:160`: parse through `fileConfigSchema.parse(JSON.parse(...))`
    where they used `parseFileConfig`, which is removed;
  - `tests/config.test.ts:87`: the "not valid JSON" case calls `parseJson("{ not json", "config.json")`
    from `src/config/parse.ts`;
  - every `appConfigFrom` call in `tests/config.test.ts` takes the loaded parts and a `FileConfig`;
  - any other test the typecheck names that builds an `AppConfig` by hand.
- [X] T016 [US1] Add `src/db/searchSettingsStore.ts` (`SearchSettingsStore` with `load(userId)` and
  `importIfAbsent(settings, at)`, `RawSearchSettings = Record<string, unknown>`, `OWNER_ID = 1`),
  `searchSettings: SearchSettingsStore` in `Stores` in `src/db/store.ts` (two lines), and
  `src/db/kysely/searchSettingsStore.ts`: `load` parses the stored JSON; `importIfAbsent` runs,
  inside `withRetry` (`src/db/retry.ts`, two tries), one transaction that ensures the owner row
  (`insertInto("users")` with `id: OWNER_ID`, `name: "owner"`, `created_at: at`, a no-op
  `onDuplicateKeyUpdate`), then `insertInto("user_settings").values(...).ignore()` for `OWNER_ID`,
  and returns `numInsertedOrUpdatedRows === 1n`. Wire it into `src/db/kysely/stores.ts`. Add
  `tests/helpers/memorySearchSettingsStore.ts` (same behaviour, the owner row included, `OWNER_ID`
  never the literal) and wire it into `memoryStores()` in `tests/helpers/memoryStore.ts`.
- [X] T017 [US1] Add `src/config/searchSettings.ts` (T011): a private `SEARCH_KEYS`, and exported
  `splitSettings` and `mergeSettings`, both called from `resolve.ts`.
- [X] T018 [US1] Add `src/config/resolve.ts` (T012): `SettingsNotice` (`imported` and `file_ignored`
  in this PR) and `resolveSettings(fileRaw, store, at)` returning `{ file, notices }` (research R4,
  R6), including the fixed "search settings could not be stored" when an import returns `false`
  and nothing is stored.
- [X] T019 [US1] Change `src/config/load.ts` and `parse.ts` (research R4):
  - `loadConfig(environment)` keeps parsing `envSchema` first (so a bad `LLM_BASE_URL` still stops a
    run before the database opens) and returns a `LoadedConfig` (`{ env, fileRaw, resume, dataDir
    }`, exported from `load.ts`);
  - `loadFileConfig(dataDir)` returns the raw object;
  - both read through `readConfigText` (the `config.yaml` hint, unchanged) and an exported
    `parseJson(text, name)` in `parse.ts`, which says "`<name>` is not valid JSON: …" (`load.ts`
    is its production caller; S3's import adds a second);
  - `appConfigFrom(loaded, file)` builds the `AppConfig` from the loaded parts and the resolved
    `FileConfig`, and runs `requireSearchKey`; `parseFileConfig` is removed.

  Update the doc comments.
- [X] T020 [US1] Add `src/app/runSettings.ts` with `settingsForRun(loaded, store, trace)` (T014),
  called from `runOnce` in `src/app/run.ts` after the stores and the trace open: it calls
  `resolveSettings`, writes `settings_imported` and `settings_file_ignored` to the `Trace`
  (contract), and returns the `AppConfig` from `appConfigFrom`. `openRunLogs` takes the
  `LoadedConfig`, since it runs before the settings are resolved. `runOnce` builds the run from the
  `AppConfig` and stays within 20 lines, and `run.ts` within 200. In `web/lib/uiState.ts`, `getUiState` resolves the settings on every request
  and returns `notices` beside `config`. Update the doc comments.
- [X] T021 [US1] Per-PR flow steps 4–6 ("Read search settings from the database (015 PR 1b)"),
  including `tests/docker.sh` (its `examples/config.json` still holds search settings, so the web
  check imports them into `myjobbot_test`, which T013's `afterAll` leaves empty). It is about 23 files: tell the owner when opening it.

**Checkpoint**: User Stories 1 and 2 work: the owner's search settings live in the database.

---

## Phase 4: User Story 4 - Bad stored search settings don't stop the search (Priority: P3)

**Goal**: each bad stored setting falls back on its own and is reported.

**Independent Test**: a stored `match_threshold` of 150 scores with 70 and is reported on the
Settings page and in the trace (quickstart PR 2).

### Sitting S2, PR 2: fallbacks and notices (T022–T030), branch `015-pr2-settings-fallback`

- [X] T022 [US4] Per-PR flow steps 1–3, for sitting S2.
- [X] T023 [P] [US4] Unit tests in `tests/searchSettings.test.ts` (twelve `test()`s) for
  `sanitizeSearchSettings(stored)` (research R5). Each notice's `setting` is the key, plus the
  entry's position for an entry:
  - a bad `match_threshold` is dropped with a notice naming `match_threshold`;
  - a bad `preferences` type is dropped;
  - one bad company is dropped and the others kept (`companies[1]`);
  - one bad search is dropped and the others kept;
  - one bad title boost term and one bad points value are each dropped (`title_boosts[n]`);
  - one bad entry in each of `title_filter.include`, `exclude` and `extra_exclude` is dropped;
  - one bad `exclude_companies` entry is dropped;
  - one bad `exclude_publishers` domain entry is dropped, named `jsearch.exclude_publishers[n]`,
    with the reason "not a valid domain entry", while a `""` entry keeps `filterTerm`'s message;
  - a list whose entries all fail (`title_filter.include: [""]`) is dropped whole, so its default
    applies, with one notice per entry; an empty list stored on purpose stays empty;
  - a key of the wrong shape (a list stored as a number) is dropped whole, with one notice naming
    the key;
  - a key that isn't a search setting (`http`) is dropped with a notice naming it;
  - valid settings give no notices, and no notice holds a value or the preferences text.
- [X] T024 [P] [US4] Unit tests in `tests/resolveSettings.test.ts` (two `test()`s): a fallback
  leaves the rest as stored and returns a `fallback` notice; a cross-setting rule that still fails
  after falling back (no source left) throws today's message.
- [X] T025 [P] [US4] Unit test in `tests/runSettings.test.ts` (one `test()`): with `match_threshold:
  150` stored, `settingsForRun` returns the default 70 and traces one `settings_fallback` naming
  `match_threshold`.
- [X] T026 [P] [US4] UI test in a new `tests/client/settingsNotices.test.tsx` (one `test()`): the
  panel lists each fallback (setting and reason) and the file-ignored notice, and renders nothing
  for no notices or an `imported` one alone. In `tests/client/settings.test.tsx:8`, add
  `notices: []` to the `getUiState` mock; its panel list (`["Scoring", "Gmail"]`, :14) is unchanged,
  since the panel renders nothing without notices.
- [X] T027 [US4] Export `company`, `search`, `filterTerm` and `publisherTerm` from
  `src/config/schema.ts`, and a new exported `boostPoints` (`z.number().int().min(1).max(100)`) that
  `title_boosts` uses in place of its inline schema. Add `sanitizeSearchSettings` to
  `src/config/searchSettings.ts`, checking scalars with `fileConfigSchema.shape[key]` and entries
  with the element schemas.
- [X] T028 [US4] Call it in `resolveSettings` before merging, add the `fallback` kind to
  `SettingsNotice`, and return its notices. Write each to the run's trace as `settings_fallback` in
  `src/app/runSettings.ts`.
- [X] T029 [US4] Add `web/components/settings/SettingsNotices.tsx`, and render it first in
  `web/app/settings/page.tsx`, above Scoring. The page calls `getUiState` once and passes its
  `notices` to the panel and its Gmail state to `gmailView`.
- [X] T030 [US4] Per-PR flow steps 4–6 ("Fall back per setting and report it (015 PR 2)").

---

## Phase 5: User Story 3 - The owner changes search settings (Priority: P2)

**Goal**: export, edit and import search settings from the command line.

**Independent Test**: export, change the threshold, import; the next page uses it. A file with a
runtime key is refused (quickstart PR 3).

### Sitting S3, PR 3: export and import (T031–T037), branch `015-pr3-settings-commands`

- [X] T031 [US3] Per-PR flow steps 1–3, for sitting S3.
- [X] T032 [P] [US3] Unit tests in a new `tests/importSettings.test.ts` (eight `test()`s) for
  `checkImport(text, name, runtime)` and `exportDocument(stored)` in `src/config/importSettings.ts`:
  - valid search settings are accepted and returned raw, `exclude_publishers` at the top level;
  - text that isn't JSON is refused with "`<name>` is not valid JSON";
  - a runtime key (`http`) is refused with "belongs in config.json";
  - a `jsearch` key other than `exclude_publishers` is refused the same way;
  - an unknown key (`foo`) is refused the same way;
  - a rule failure (too many searches for the current cap) is refused with today's message, and so
    is `{}` ("configure at least one company or search");
  - SC-003, table-driven: each invalid example in `tests/config.test.ts` that concerns a search
    setting, imported, is refused with the message loading the file gives. A row whose example also
    sets a runtime key (the "three refreshes a day" case's `jsearch.refresh_hours`) puts that key in
    the runtime part, so it is refused for the rule, not the key;
  - `exportDocument` writes `exclude_publishers` inside `jsearch`, and `checkImport` of that
    output gives back the stored document exactly (SC-006); `exportDocument(null)` gives `{}`.
- [X] T033 [P] [US3] Add contract step 3 to the bundled case in
  `tests/helpers/searchSettingsContract.ts` (no new `test()`): `save` replaces the whole document, a
  key absent from the new one is gone, and `save` for a user id with no `users` row is refused and
  stores nothing. Then a `seedUser(2)` hook (a `users` row on MariaDB, a known id in memory) lets
  `save(2, …)` store that user's document, and `load(1)` is unchanged (SC-008).
- [X] T034 [US3] Add `save` to `SearchSettingsStore` in `src/db/searchSettingsStore.ts`, to
  `src/db/kysely/searchSettingsStore.ts` (the same owner-row transaction when the id is `OWNER_ID`,
  then `onDuplicateKeyUpdate` replacing `settings` and `updated_at`; for an id with no user the
  foreign key refuses it) and to `tests/helpers/memorySearchSettingsStore.ts` (throws for an id with
  no user; `seedUser` adds one).
- [X] T035 [US3] Add `src/config/importSettings.ts` (T032), using `parseJson`, `splitSettings`,
  `mergeSettings` and `fileConfigSchema`. Export `SEARCH_KEYS` from `src/config/searchSettings.ts`
  for its key check.
- [X] T036 [US3] Add `export-settings <path>` and `import-settings <path>` to `src/cli.ts` (`USAGE`
  and `COMMANDS`), each a small command function: export loads the owner's settings and writes
  `exportDocument`'s pretty JSON; import reads the file, takes the runtime part from
  `loadFileConfig` and `splitSettings`, runs `checkImport`, and `save`s. A refusal prints each
  message and exits 1. If `src/cli.ts` (54 lines) would pass 200, the two commands go in
  `src/app/settingsCommands.ts`.
- [X] T037 [US3] Per-PR flow steps 4–6 ("Export and import search settings (015 PR 3)").

---

## Phase 6: Polish

### Sitting S4, PR 4: docs (T038–T042), branch `015-pr4-docs`

- [X] T038 Per-PR flow steps 1–3, for sitting S4.
- [X] T039 [P] Update `README.md` (FR-014):
  - **Setup** and **Deploy with Docker**: copy `examples/config.json` (runtime settings) and
    `examples/settings.json`, edit the second, and `npm start -- import-settings data/settings.json`
    (`docker compose exec myjobbot npm start -- import-settings /data/settings.json` in Docker).
    Until then, a run refuses and the web UI shows "configure at least one company or search";
  - **Storage**: the `users` and `user_settings` tables in the data model diagram, and that a
    database backup holds the search settings;
  - **Configuration knobs (`data/config.json`)**: only runtime settings, plus where search settings
    live, the upgrade import, the two commands and the notices;
  - **How it works**: the "One run, start to finish" diagram (line 417 today, "config/load.ts …
    validated with zod") shows `config.json` read raw and the search settings resolved from the
    database, and the `exclude_publishers` knob row (line 776, "stops the app at startup") says a
    bad stored entry falls back instead;
  - nothing may tell the owner to edit search settings in `config.json` (lines 17, 124, 341 and 659
    today).
- [X] T040 [P] Update `examples/config.json` to runtime settings only, and add
  `examples/settings.json` with the search settings in export shape. In `tests/docker.sh`'s
  `data_dir with-config`, write the data folder's `config.json` as the two examples merged (a
  `node -e` one-liner), so the web check still finds a source on an empty `myjobbot_test`. Update
  `tests/configFiles.test.ts` if it loads the examples.
- [X] T041 Add one line to `CLAUDE.md`'s Conventions: search settings live in `user_settings` (one
  raw document per user, owner id 1), runtime settings in `config.json`, and `fileConfigSchema`
  validates the merged whole, changed with the two commands. Under Commands, add
  `npm start -- export-settings <path>` and `npm start -- import-settings <path>`. Fill the ledger's
  last row.
- [X] T042 Per-PR flow steps 4–6 ("Document search settings in the database (015 PR 4)"), including
  `tests/docker.sh`.

---

## Dependencies & Execution Order

- **S0 → S1a → S1b → S2 → S3 → S4**, each merged and tried before the next.
- **S1b** needs S1a's tables and must land the store, the import and both readers together, or the
  owner's settings are lost on the first run (plan, Delivery).
- **S2** extends `searchSettings.ts`, `resolve.ts`, `runSettings.ts` and the Settings page from S1b.
- **S3** needs the store and `mergeSettings`; it could follow S1b directly, but S2 goes first so an
  import's checks and a read's fallback land in the order the owner tries them.

### Within each sitting

- The per-PR flow's first task, then the test tasks (all [P]: different files; in S1b after T010's
  fixture), then the code in
  task order, then the closing flow task.
- Every new export and store method has a production caller in another file, in the sitting that
  adds it:
  - S1a: the migration (from `migrations/index.ts`);
  - S1b: `splitSettings`, `mergeSettings` (from `resolve.ts`), `resolveSettings` (from
    `runSettings.ts` and `uiState.ts`), `settingsForRun` (from `run.ts`), `parseJson` and
    `LoadedConfig` (from `load.ts` and `run.ts`), `load` and `importIfAbsent` (from `resolve.ts`),
    the search settings store (from `stores.ts`);
  - S2: the element schemas and `boostPoints` (from `searchSettings.ts`), `sanitizeSearchSettings`
    (from `resolve.ts`), `SettingsNotices` (from the page);
  - S3: `save`, `checkImport`, `exportDocument` (from `cli.ts`), `SEARCH_KEYS` (from
    `importSettings.ts`).

## Parallel Example: User Stories 1 and 2 (S1b)

```text
T010 fixture (first)    tests/helpers/config.ts
then, in parallel:
T011 split and merge    tests/searchSettings.test.ts
T012 resolve            tests/resolveSettings.test.ts
T013 contract case      tests/helpers/searchSettingsContract.ts
T014 run settings       tests/runSettings.test.ts, tests/run.test.ts
T015 load-path updates  tests/configFiles.test.ts, tests/config.test.ts
```

## Coverage notes

- **FR-008** (each page load uses the stored settings) and **SC-004** (a change is used on the next
  page load or run, with no restart) are checked by the quickstart only (PR 3 step 2):
  `getUiState` resolving per request is one line, and a test of it would need the Next.js server.
- **FR-007** (a run keeps the settings it started with) is checked by T014's third unit test.
- **SC-002** and **SC-005** are checked on the owner's real data (quickstart PR 1b steps 3 and 6).

## Implementation Strategy

- **MVP**: S1a + S1b. The owner's search settings live in the database and carry over unchanged.
- **Increments**: S2 makes bad stored values safe, S3 gives the owner a way to change them, and S4
  documents it all.

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (after 014, T002) | 621 (84.72%) | 55, 1 skipped without a browser (7.50%) | 57 (7.78%) |
| Planned new | 43 (T011 8, T012 8, T013's memory run 1, T014 3, T023 12, T024 2, T025 1, T032 8) | 3 (T005, T013's MariaDB run, T014's `runOnce`) | 1 (T026) |
| Planned after | 664 (85.13%) | 58 (7.44%) | 58 (7.44%) |
| After PR 4 (T041) | 664 (85.13%): the `node` project's 665 less T014's `runOnce` | 58 (7.44%): the `integration` project's 57 (1 skipped without a browser) plus T014's `runOnce` | 58 (7.44%) |
