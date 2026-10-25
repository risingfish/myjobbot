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

- **Decision**: a constant in a new `src/config/searchSettings.ts` names them: `companies`,
  `searches`, `preferences`, `match_threshold`, `title_filter`, `title_boosts`, `exclude_companies`,
  and `exclude_publishers` inside `jsearch`. Two pure functions use it:
  - **`splitSettings(raw)`** takes a raw `config.json` object and returns its search part and its
    runtime part. `jsearch.exclude_publishers` goes to the search part; the rest of `jsearch` stays
    runtime.
  - **`mergeSettings(runtime, search)`** builds the raw object `fileConfigSchema` parses, putting
    `exclude_publishers` back inside `jsearch`.
- Search settings are stored **raw**: only the keys the owner set, never the defaults. So an unset
  key still takes today's default from the schema, and a later change to a default reaches it
  (FR-006).

## R3. Storage: a user, and one settings document per user (FR-013, FR-015)

- **Decision**: migration `011_user_settings` adds two tables, both built with the schema builder,
  both `utf8mb4_bin`:
  - **`users`**: `id` (auto-increment primary key), `name` (`varchar(255)`), `created_at` (ISO
    time).
  - **`user_settings`**: `user_id` (primary key, and a foreign key to `users.id`), `settings`
    (`longtext`: the raw search settings as JSON), `updated_at`.
- **The owner** is the user with id 1. The store creates it, if it's missing, in the same
  transaction that first stores settings, so it exists once settings do. It is never created on its
  own (FR-015). `OWNER_ID = 1` is the one place the code names it. A later multi-user feature adds
  rows to `users`, and each new user's settings become another `user_settings` row, without
  touching the owner's (SC-008).
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

- **Decision**: `loadConfig` keeps reading `.env`, `config.json` and the resume, but no longer
  validates the file. A new `resolveSettings(fileRaw, store)` in `src/config/resolve.ts` runs once
  the stores are open:
  1. It reads the owner's stored search settings.
  2. If none are stored, it runs the upgrade import first (R6).
  3. It sanitizes the stored part (R5).
  4. It merges with the file's runtime part and parses with `fileConfigSchema`.
  5. It returns `{ file: FileConfig, notices: SettingsNotice[] }`.
- **Where it's called**:
  - **The agent:** `runOnce` calls it once at the start of a run, so a run keeps its settings for
    the whole run (FR-007).
  - **The web UI:** `getUiState` calls it on every request (FR-008).
- `requireSearchKey` (searches need `JSEARCH_API_KEY`) still runs for the agent, after resolving.

## R5. Fallback for bad stored search settings (FR-005, FR-005a)

- **Decision**: a pure `sanitizeSearchSettings(stored)` in `searchSettings.ts` checks each stored
  key against its own part of the schema, and returns the cleaned settings plus one notice per
  problem:
  - **A scalar** (`preferences`, `match_threshold`) that fails is dropped, so the schema's default
    applies.
  - **A list** (`companies`, `searches`, `exclude_companies`, `exclude_publishers`, and the three
    lists inside `title_filter`) keeps the entries that pass and drops the others, one notice each.
  - **`title_boosts`** keeps the entries whose term and points pass.
  - **A key of the wrong shape altogether** (a list stored as a number, say) is dropped whole.

  The element schemas (`company`, `search`, `filterTerm`, `publisherTerm`) are exported from
  `schema.ts` for this, so the rules stay defined once.
- **After sanitizing**, the merged object goes through `fileConfigSchema` as usual. A cross-setting
  rule that still fails throws today's message, so a run refuses and the web UI shows its error
  page.
- **Notices** name the setting and the rule only: `{ setting: "title_boosts.'' ", reason: "filter
  terms need at least one letter or digit" }`. They never include the preferences text or a dropped
  value (FR-005a).
- **Where they show**: the run writes each notice to its trace as `settings_fallback`, and the
  Settings page lists them in a new Settings notices panel.
- **Runtime settings in `config.json` are not sanitized**: a bad value there throws as today.

## R6. The upgrade import (FR-009, FR-010)

- **Decision**: in `resolveSettings`, when the store has no settings for the owner, it imports:
  1. It takes `config.json`'s search part (`splitSettings`).
  2. If that part is empty, there's nothing to import, and the defaults apply.
  3. Otherwise it validates the merged object as a whole with `fileConfigSchema`. On failure it
     throws today's messages, stores nothing, and tries again next start.
  4. On success it calls `store.importIfAbsent(OWNER_ID, searchPart, at)`. That is one `INSERT ...
     ON DUPLICATE KEY UPDATE user_id = user_id`, a no-op when a row exists, so when the agent and the
     web UI start together exactly one import lands (US2-2). Whichever loses reads the stored row.
- **Once settings are stored**: if the file's search part is still non-empty, `resolveSettings` adds
  a notice that those keys are no longer used and can be removed from `config.json`. The run traces
  it as `settings_file_ignored`, and the Settings page shows it.
- **The file is never rewritten.**

## R7. Command-line export and import (FR-011, FR-011a)

- **Decision**: two commands in `src/cli.ts`, named like `import-sqlite`:
  - **`npm start -- export-settings <path>`** writes the owner's stored search settings, raw, as
    pretty JSON. It writes `{}` when none are stored.
  - **`npm start -- import-settings <path>`** reads the file and:
    1. refuses invalid JSON with today's message;
    2. refuses any runtime key, with "`<key>` belongs in config.json";
    3. validates the file merged with the current `config.json` runtime part, through
       `fileConfigSchema`;
    4. on success replaces the owner's settings in one write (`store.save`). On failure it prints
       each issue as loading the file does, and stores nothing.
- **Pure logic**: the decisions (runtime key check, merge, validation) live in
  `src/config/importSettings.ts` as plain functions, unit-tested. The CLI only reads and writes
  files and calls the store.
- **A round trip changes nothing** (SC-006), because export writes exactly the stored raw document.

## R8. The Settings page

- **Decision**: `web/app/settings/page.tsx` gains a Settings notices panel. It lists the fallback
  and file-ignored notices from `getUiState`, shown only when there are any. The placeholder Scoring
  panel is left as it is (FR-011b).

## R9. Delivery and test split

- **Delivery**: five code PRs after the docs PR (plan, Delivery):
  - **1a**: the migration;
  - **1b**: the store, split and merge, the upgrade import, and both readers switched over. These
    land together, because the readers can't move until the import exists, or settings would be
    lost;
  - **2**: the fallback and the notices;
  - **3**: the commands;
  - **4**: the docs.
- **Test split (new tests, by count)**: about 32 unit, exactly 2 integration (migration 011, and
  one bundled settings contract case on MariaDB), and 1 UI (the notices panel).
  - **Unit:** the pure split, merge, sanitize and import decisions, plus the contract's memory run.
  - From 621 / 55 / 57 (84.7 / 7.50 / 7.78%), 32 unit, 2 integration and 1 UI give 653 / 57 / 58
    (85.0 / 7.43 / 7.57%), so every share moves toward 95 / 4 / 1.
