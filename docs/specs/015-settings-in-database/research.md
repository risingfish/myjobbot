# Research: Search settings in the database

Every decision follows the code on `main` after feature 014 (`374154e`). No new library is needed.

## R1. One schema stays the definition of valid settings

- **Decision**: `fileConfigSchema` (`src/config/schema.ts`) keeps validating the whole, merged
  configuration, cross-setting rules included. The only change is where the input comes from: the
  runtime keys from `config.json`, and the search keys from the database. Every reader keeps getting
  the same `FileConfig` it gets today, so no consumer of the config changes (FR-003, FR-006).
- **Rationale**: the rules that span both places are already written against one object: the
  searches fit `jsearch.monthly_request_cap`, and retention outlasts the ghost threshold. Splitting
  the schema in two would mean writing them a second time.
- **Alternatives**: two schemas (search and runtime) plus a third check that joins them. That
  duplicates the cross-setting rules and the defaults.

## R2. Which keys are search settings

- **Decision**: a constant `SEARCH_KEYS` in a new `src/config/searchSettings.ts` names them:
  `companies`, `searches`, `preferences`, `match_threshold`, `title_filter`, `title_boosts`,
  `exclude_companies`, and `exclude_publishers` inside `jsearch`. It stays private to the module
  until PR 3, whose import check needs it and exports it then. Two pure functions use it:
  - **`splitSettings(raw)`** takes a raw `config.json` object and returns its search part and its
    runtime part. `jsearch.exclude_publishers` goes to the search part, stored at the top level as
    `exclude_publishers`; the rest of `jsearch` stays runtime. A `jsearch` left empty by the split
    is dropped from the runtime part, so a file with `"jsearch": { "exclude_publishers": [...] }`
    alone has no runtime `jsearch`. A raw value that isn't an object (a top-level `[]`, say) is
    passed through whole as the runtime part, so `fileConfigSchema` gives today's error.
  - **`mergeSettings(runtime, search)`** builds the raw object `fileConfigSchema` parses. It copies
    only `SEARCH_KEYS` from the search part, so a stray key in a stored document never reaches the
    schema, and puts `exclude_publishers` back inside `jsearch` beside the file's other `jsearch`
    values.
- Search settings are stored **raw**: only the keys the owner set, never the defaults. So an unset
  key still takes today's default from the schema, and a later change to a default reaches it
  (FR-006).
- **Names in notices and messages** use the key's place in `config.json`: `jsearch.exclude_publishers`,
  never the stored top-level name.

## R3. Storage: a user, and one settings document per user (FR-013, FR-015)

- **Decision**: migration `011_user_settings` adds two tables, both built with the schema builder,
  both `utf8mb4_bin`:
  - **`users`**: `id` (auto-increment primary key), `name` (`varchar(255)`), `created_at` (ISO
    time).
  - **`user_settings`**: `user_id` (primary key, and a foreign key to `users.id`), `settings`
    (the builder's own `"json"` type: the raw search settings as JSON), `updated_at`. On MariaDB
    `json` is `longtext` in utf8mb4_bin with a `json_valid` check, so no `sql` fragment is needed
    for it. Not `text`: an `INSERT IGNORE` relaxes strict mode and would truncate a long document
    silently. The one `sql` fragment is the table options passed to `modifyEnd`, as in
    `009_companies.ts`.
- **The owner** is the user with id 1, inserted with that explicit id. The store creates it, if
  it's missing, in the same transaction that first stores settings, so it exists once settings do.
  It is never created on its own (FR-015). `OWNER_ID = 1` is the one place the code names it; both
  stores use the constant, never the literal. The store creates no other user: `importIfAbsent`
  writes only the owner's settings (it takes no user id), and `save` for an id with no `users` row
  fails on the foreign key. A
  later multi-user feature adds rows to `users`, and each new user's settings become another
  `user_settings` row, without touching the owner's (SC-008).
- **Why one document per user**: an import replaces the whole set or nothing (US3, edge case
  "Concurrent changes"). A single-row write is atomic without coordinating many rows. It also keeps
  "unset" exact: a key is unset exactly when it's absent from the document.
- **Alternatives**:
  - one row per setting (needs a transaction around every import, and leaves "unset" open to
    mistakes);
  - one row with a column per setting (the schema and the migrations would have to track every
    future setting);
  - keying by a fixed name instead of a user (has to be redone when users arrive).

## R4. Reading settings: after the stores open

- **Decision**: `loadConfig(environment)` keeps reading `.env`, `config.json` and the resume, and
  keeps parsing the environment with `envSchema`, so a bad `LLM_BASE_URL` still stops a run before
  the database is opened (`tests/docker.sh` checks this). It no longer validates the file: it
  returns a `LoadedConfig` (`{ env, fileRaw, resume, dataDir }`, defined in `load.ts`), with
  `fileRaw` the parsed JSON (the `config.yaml` hint and the "not valid JSON" message unchanged).
  `loadFileConfig(dataDir)` returns the same raw object for the web UI. `openRunLogs` in `run.ts`
  takes the `LoadedConfig`, since the trace opens before the settings are resolved.
- **An accepted change**: a bad runtime value in `config.json` is now found after the database is
  connected and migrated and the run's trace is open, not before. The message is today's; the run
  ends as an aborted one with its trace.
- A new **`resolveSettings(fileRaw, store, at)`** in `src/config/resolve.ts` runs once the stores
  are open:
  1. It reads the owner's stored search settings.
  2. If none are stored, it runs the upgrade import first (R6).
  3. It sanitizes the stored part (R5, from PR 2).
  4. It merges with the file's runtime part and parses with `fileConfigSchema`.
  5. It returns `{ file: FileConfig, notices: SettingsNotice[] }`. `SettingsNotice` is defined in
     `resolve.ts` (data model).
- **`appConfigFrom(loaded, file)`** then builds the `AppConfig` from the loaded parts and the
  resolved `FileConfig`, and runs `requireSearchKey` (searches need `JSEARCH_API_KEY`).
- **Where it's called**:
  - **The agent:** a new `src/app/runSettings.ts` holds one helper, `settingsForRun(loaded, store,
    trace)`, that `runOnce` calls once, after the stores and the trace open: it resolves, writes the
    notices to the `Trace`, and returns the `AppConfig`. Its trace events are unit-tested with
    `memoryTrace()` and the memory store, with no files. So a run keeps its settings for the whole run (FR-007), and `run.ts` (180 lines)
    gains only the call.
  - **The web UI:** `getUiState` calls `resolveSettings` on every request (FR-008), and returns
    `notices` beside `config`. The Settings page already calls `getUiState` once; it takes the
    notices from that same call.

## R5. Fallback for bad stored search settings (FR-005, FR-005a)

- **Decision**: a pure `sanitizeSearchSettings(stored)` in `searchSettings.ts` checks each stored
  key against its own part of the schema, and returns the cleaned settings plus one notice per
  problem:
  - **A scalar** (`preferences`, `match_threshold`) is checked with `fileConfigSchema.shape[key]`.
    One that fails is dropped, so the schema's default applies.
  - **A list** (`companies`, `searches`, `exclude_companies`, `exclude_publishers`, and the three
    lists inside `title_filter`) keeps the entries that pass and drops the others, one notice each.
  - **`title_boosts`** keeps the entries whose term and points pass.
  - **A list or map whose entries all fail** is dropped whole, so its default applies, rather than
    kept empty: an empty `title_filter.include` would match no title and hide every job. An empty
    list stored on purpose stays empty.
  - **A key of the wrong shape altogether** (a list stored as a number, say) is dropped whole, with
    one notice naming the key.
  - **A key that isn't a search setting** (only possible by editing the row by hand) is dropped,
    with a notice naming it.

  The element schemas (`company`, `search`, `filterTerm`, `publisherTerm`, and a new `boostPoints`
  for the inline `z.number().int().min(1).max(100)` of `title_boosts`) are exported from
  `schema.ts` for this, so the rules stay defined once.
- **After sanitizing**, the merged object goes through `fileConfigSchema` as usual. A cross-setting
  rule that still fails throws today's message, so a run refuses and the web UI shows its error
  page.
- **Notices** name the setting and, for an entry, its position, never its value:
  `{ kind: "fallback", setting: "title_boosts[3]", reason: "filter terms need at least one letter or
  digit" }`, `companies[1]`, `title_filter.extra_exclude[0]`, `jsearch.exclude_publishers[2]`. The
  position counts from 0 in the stored list, or in the stored map's entry order for
  `title_boosts`. The reason is the first zod issue's message, except where that message embeds the
  input: `publisherTerm`'s domain check does, so an entry failing that check gets the fixed reason
  "not a valid domain entry". An `exclude_publishers` entry failing `filterTerm` (`""`, `"--"`)
  keeps `filterTerm`'s message, which holds no input. No
  notice holds the preferences text or a dropped value (FR-005a).
- **Where they show**: the run writes each notice to its trace as `settings_fallback`, and the
  Settings page lists them in a new Settings notices panel.
- **Runtime settings in `config.json` are not sanitized**: a bad value there throws as today.

## R6. The upgrade import (FR-009, FR-010)

- **Decision**: in `resolveSettings`, when the store has no settings for the owner, it imports:
  1. It takes `config.json`'s search part (`splitSettings`).
  2. If that part is empty, there's nothing to import, and the defaults apply.
  3. Otherwise it validates the merged object as a whole with `fileConfigSchema`. On failure it
     throws today's messages, stores nothing, and tries again on the next read.
  4. On success it calls `store.importIfAbsent(searchPart, at)`, always for the owner. In one
     transaction, that ensures the owner row, then `insertInto("user_settings")...ignore()`, and
     returns whether a row was inserted (`numInsertedOrUpdatedRows === 1n`). An existing row makes
     it a no-op, so when the agent and the web UI read together exactly one import lands (US2-2).
     Two first writes of the owner row at once can deadlock in InnoDB, so the transaction runs
     inside the existing `withRetry` (`src/db/retry.ts`, two tries).
  5. If it stored, the notices include `{ kind: "imported", keys }`, traced as
     `settings_imported`. If it returned `false`, it reads the stored row and goes on as if
     settings had been stored already. If that read is still `null` (`INSERT IGNORE` also turns
     other errors into warnings), it throws the fixed "search settings could not be stored".
- **Once settings are stored**: if the file's search part is still non-empty, `resolveSettings` adds
  a `file_ignored` notice naming those keys (as named in `config.json`). The run traces it as
  `settings_file_ignored`, and the Settings page shows it. The read that does the import adds no
  `file_ignored` notice: the file is what it just imported. The next read does.
- **The file is never rewritten.**

## R7. Command-line export and import (FR-011, FR-011a)

- **Decision**: two commands in `src/cli.ts`, named like `import-sqlite`:
  - **`npm start -- export-settings <path>`** writes the owner's stored search settings as pretty
    JSON in `config.json`'s shape: `exclude_publishers` goes back inside `jsearch`. It writes `{}`
    when none are stored.
  - **`npm start -- import-settings <path>`** reads the file and:
    1. refuses invalid JSON with today's message, worded for that file: "`<path>` is not valid
       JSON: …" (`parse.ts`'s `parseJson` is exported for this and takes the name);
    2. refuses any key that isn't a search setting, with "`<key>` belongs in config.json, not in
       imported settings" (a `jsearch` key other than `exclude_publishers` too);
    3. validates the file merged with the current `config.json` runtime part, through
       `fileConfigSchema`. A file with no source, `{}` included, is refused with "configure at
       least one company or search";
    4. on success replaces the owner's settings in one write (`store.save`, added in this PR). On
       failure it prints each issue as loading the file does, and stores nothing.
- **Pure logic**: the decisions (key check, split, merge, validation) live in
  `src/config/importSettings.ts` as plain functions, unit-tested. The CLI only reads and writes
  files and calls the store. Its runtime part comes from `loadFileConfig` and `splitSettings`.
- **A round trip changes nothing** (SC-006): export writes exactly the stored raw document, with
  only `exclude_publishers` moved, and import moves it back.

## R8. The Settings page

- **Decision**: `web/app/settings/page.tsx` gains a Settings notices panel, placed first, above the
  Scoring panel. It lists the `fallback` and `file_ignored` notices from `getUiState`, and renders
  nothing when there are none (an `imported` notice is only traced). The placeholder Scoring panel
  is left as it is (FR-011b).

## R9. Delivery and test split

- **Delivery**: five code PRs after the docs PR (plan, Delivery):
  - **1a**: the migration, about 6 files;
  - **1b**: the store (`load`, `importIfAbsent`), split and merge, the upgrade import, and both
    readers switched over, about 23 files. These land together, because the readers can't move
    until the import exists, or settings would be lost; the owner chose to keep it whole;
  - **2**: the fallback and the notices;
  - **3**: the commands, and the store's `save`;
  - **4**: the docs, `examples/` and `tests/docker.sh`.
- **Test split (new tests, by count)**: 43 unit, 3 integration and 1 UI.
  - **Unit:** the pure split, merge, sanitize and import decisions, the run's settings helper with
    the memory trace and store (no files), plus the contract's memory run.
  - **Integration:** migration 011, the bundled settings contract case on MariaDB, and one `runOnce`
    test (it writes the data folder and the trace file, so it counts as integration).
  - **UI:** the notices panel.
  - From 621 / 55 / 57 (84.72 / 7.50 / 7.78%), 43 unit, 3 integration and 1 UI give 664 / 58 / 58
    (85.13 / 7.44 / 7.44%), so every share moves toward 95 / 4 / 1.
