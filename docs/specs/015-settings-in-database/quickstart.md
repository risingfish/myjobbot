# Quickstart: Search settings in the database

Check each PR once it is merged and the stack is rebuilt (`npm run docker:up`). Before it is opened,
every PR also passes `npm run check` and `npm run check:db`. The queries run against the `myjobbot`
database. The commands and messages are in [contracts/settings.md](contracts/settings.md), and the
tables in [data-model.md](data-model.md).

## PR 1a: the tables

`SHOW TABLES LIKE '%user%';` lists `users` and `user_settings`, both empty. Nothing else changes.

## PR 1b: settings read from the database

1. **Before the first run:** `SELECT COUNT(*) FROM user_settings;` is `0`.
2. **After the first run**, or the first web page opened, whichever comes first:
   - `SELECT user_id, settings FROM user_settings;` shows one row for user `1` holding your
     searches, boosts, excluded companies, preferences and threshold, exactly as in `config.json`;
   - `SELECT * FROM users;` shows the owner;
   - if a run came first, its trace has `settings_imported` and no `settings_file_ignored`. If a
     page came first, the web UI did the import, and the first run's trace has
     `settings_file_ignored` instead.
3. **SC-002:** Recommended shows the same jobs in the same order as before the upgrade.
4. **Editing a search setting in `config.json`** (say `match_threshold`) changes nothing on the next
   page load or run (FR-002). The next run's trace has `settings_file_ignored`.
5. **Editing a runtime setting** (say `http.timeout_s`) still takes effect on the next run.
6. **SC-005, a backup restores the settings:** dump the two tables and load them into the test
   database, then compare:

   ```bash
   mariadb-dump myjobbot users user_settings > /tmp/settings-backup.sql
   mariadb myjobbot_test < /tmp/settings-backup.sql
   ```

   `SELECT settings FROM myjobbot_test.user_settings;` matches the `myjobbot` row exactly. (The
   integration tests empty `myjobbot_test` again on their next run.)

## PR 2: fallbacks and notices

1. Set `match_threshold` to `150` in the stored settings by hand:

   ```sql
   UPDATE user_settings SET settings = JSON_SET(settings, '$.match_threshold', 150) WHERE user_id = 1;
   ```

   Open Settings: the notices panel says `match_threshold` fell back and why. Recommended scores
   with the default, 70. A run's trace has `settings_fallback`.
2. The notices panel also says that `config.json` still holds search settings that can be removed.
   Remove them from the file and the notice goes away.

## PR 3: export and import

1. `npm start -- export-settings /tmp/settings.json` writes your search settings in `config.json`'s
   shape.
2. Change `match_threshold` in that file, then `npm start -- import-settings /tmp/settings.json`.
   The next page load scores with the new value, with no restart (SC-004).
3. Add `"http": {}` to the file and import it. The import is refused with "belongs in config.json",
   and nothing changes.
4. Export again and import with no edits: the stored row is unchanged (SC-006).
5. Import `{}`: refused with "configure at least one company or search", and nothing changes.
6. In Docker, run them inside the agent's container:

   ```bash
   docker compose exec myjobbot npm start -- export-settings /data/settings.json
   ```

## PR 4: docs

The README (Setup, Storage, Deploy with Docker, Configuration knobs) and `examples/` describe where
search settings live and how to change them, and list which settings stay in `config.json`. A fresh
setup from `examples/` works once `examples/settings.json` is imported; before that, a run refuses
and the web UI shows "configure at least one company or search".
