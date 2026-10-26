# Quickstart: Edit search settings on the Settings page

Check each PR once it is merged and the stack is rebuilt (`npm run docker:up`). Before it is opened,
every PR also passes `npm run check` and `npm run check:db`. The page's layout and messages are in
[contracts/settings-page.md](contracts/settings-page.md).

## PR 1: the settings in view

1. Open Settings. Sources, Preferences, Scoring and Filters show your stored settings. Settings you
   never set show their defaults with "(default)", such as the title filter's include terms.
2. The old "Match threshold: 70" placeholder is gone; Scoring shows your real threshold.
3. **SC-002**: every value in `SELECT settings FROM user_settings WHERE user_id = 1;` appears on the
   page.
4. Against an empty test database and a data folder whose `config.json` holds only runtime settings
   (the automatic import still runs until PR 5a), Settings loads and Sources says a company or search
   is needed. The Gmail panel's Check now still works:

   ```bash
   MYJOBBOT_DB_NAME=myjobbot_test MYJOBBOT_DATA_DIR=/tmp/runtime-only npm run web
   ```

## PR 2: saving Scoring and Preferences

1. Change the threshold and Save Scoring: "Saved". Recommended now uses the new threshold, with no
   restart (SC-004).
2. Enter 150 and Save: the problem shows beside the threshold, 150 stays in the field, and the
   stored row is unchanged.
3. Add a boost and Save, in under 30 seconds from opening the page (SC-001).
4. Reset the threshold to default and Save: the stored row no longer holds `match_threshold`, and the
   page shows 70 (default).
5. Edit Preferences and Scoring, then Save only Preferences: the Scoring edit is still on the page,
   unsaved.
6. **SC-006**: Save Scoring with no edits. `SELECT settings …` is the same before and after.
7. Stop MariaDB's network briefly (or point the web UI at a wrong host), then Save: "Couldn't save —
   try again", and the edit stays.

## PR 3: Sources

1. Add a board and Save Sources. The next run fetches from it.
2. Give two sources the same name and Save: refused with "company and search names must be unique".
3. Add searches until the JSearch budget is exceeded: refused with the budget message.

## PR 4: Filters

1. Add an excluded company and Save Filters. That company drops out of Recommended.
2. Add a malformed publisher domain (`trabajo.*`) and Save: refused beside that row.

## PR 5a: removals

1. `npm start -- import-settings x` and `export-settings x` print the usage line (exit 2).
2. On an empty test database with search settings in `config.json`, nothing is imported. The Settings
   page loads, says a company or search is needed, and notes the file's search settings can be
   removed. A Preferences save is refused with "configure at least one company or search".
3. Add a board in Sources: the other pages work again.

## PR 5b: docs

The README's Setup tells you to add the first board or search on the Settings page, and nothing
mentions `export-settings`, `import-settings` or `examples/settings.json`.
