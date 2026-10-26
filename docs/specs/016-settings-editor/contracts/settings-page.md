# Contract: the Settings page's search settings

## Layout

Top to bottom:
1. **Settings notices**: feature 015's panel, unchanged.
2. **Sources**: company boards and saved searches.
3. **Preferences**: the preferences text.
4. **Scoring**: the match threshold and the title boosts. It replaces the placeholder Scoring panel.
5. **Filters**: the title filter (include, exclude, extra exclude), excluded companies and excluded
   publishers.
6. **Gmail**: unchanged.

Each of sections 2–5 has its own **Save** button. While no company and no search is in effect, the
Sources section says "Add a company board or a saved search: runs and the other pages need one."

## Each field

- **The value in effect**: stored, or the default.
- **A default marker**: "(default)" beside a field that isn't stored. Editing the field removes the
  marker.
- **Reset to default**: shown only on a stored field. It puts the default back on the page, marked,
  and the next Save of that section unsets the field.
- **Lists**: one row per entry, each with a Remove button, and an Add button below. The rows:

  | List | Row fields |
  |---|---|
  | Boards | name, board type (`greenhouse`, `lever`, `ashby`), board id |
  | Searches | name, query, remote only, country |
  | Boosts | term, points (1–100) |
  | Terms and excluded names | one text field |

## Saving

| Result | The page shows |
|---|---|
| Stored | "Saved" beside the section's Save. The page reloads its data, and other sections' unsaved edits stay |
| Refused | each problem beside its field, or its row, or at the top of the section; nothing stored; the section's edits stay |
| Failed to reach the server | "Couldn't save. Try again." beside the section's Save; edits stay |

Problems use feature 015's messages unchanged, for example:
- "Too big: expected number to be <=100"
- "company and search names must be unique"
- "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours"
- "configure at least one company or search"

## Server action

`saveSettingsSection(request: SaveRequest): Promise<SaveResult>`, in `web/lib/settingsActions.ts`.
The types are in [data-model.md](../data-model.md).
- A request of the wrong shape (an unknown section, or a field of another section) gets
  `{ ok: false, problems: [{ field: null, entry: null, message: "not a settings section" }] }`.
- The last save wins: there is no version check.

## Removed

- `npm start -- export-settings <path>` and `npm start -- import-settings <path>`.
- The automatic import of `config.json`'s search settings into an empty database, and the
  `settings_imported` trace event.
- `settings_file_ignored` and `settings_fallback` stay.
