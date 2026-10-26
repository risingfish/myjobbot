# Contract: the Settings page's search settings

## Layout

Top to bottom:
1. **Settings notices**: feature 015's panel, unchanged.
2. **Sources**: company boards and saved searches.
3. **Preferences**: the preferences text.
4. **Scoring**: the match threshold and the title boosts. It replaces the placeholder Scoring panel.
5. **Filters**: the title filter (include, exclude, extra exclude), excluded companies and excluded
   publishers.
6. **Gmail**: unchanged. It works with no source set.

Each of sections 2–5 is a `Panel` holding a form with its own **Save** button. Sources also shows
two notes:
- while no company and no search is in effect: "Add a company board or a saved search: runs and
  the other pages need one."
- while searches are set but `JSEARCH_API_KEY` isn't: "Saved searches need JSEARCH_API_KEY in .env;
  runs refuse to start without it."

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

  A search's remote only and country stay unset until the owner fills them in. Unset, they show
  their defaults (off, `us`).

## Saving

| Result | The page shows |
|---|---|
| Stored | "Saved" beside the section's Save. The page reloads its data, and other sections' unsaved edits stay |
| Refused | Each problem beside its field, or its row, or at the top of the section; nothing stored; the section's edits stay |
| Couldn't run (the database is down, say) | "Couldn't save — try again" beside the section's Save, as on job rows; edits stay |

**Where a problem shows**:
- a cross-setting rule ("configure at least one company or search", unique names, the reserved
  name, the JSearch budget) and a bad runtime value in `config.json` show at the top of the section
  that was saved;
- until a source exists, every Preferences, Scoring or Filters save is refused with "configure at
  least one company or search", shown on that section.

**Messages** are zod's own, unprefixed, one per reason:
- "Too big: expected number to be <=100"
- "company and search names must be unique"
- "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours"
- "configure at least one company or search"
- `Invalid option: expected one of "greenhouse"|"lever"|"ashby"`

A boost term listed twice is refused on the second row with "this term is already boosted above".

## Server action

`saveSettingsSection(previous: SaveResult, request: SaveRequest): Promise<SaveResult>`, in
`web/lib/settingsActions.ts`, for `useActionState`. The types are in
[data-model.md](../data-model.md).
- A request of the wrong shape (an unknown section, another section's field, or a row with extra
  keys) gets `{ ok: false, problems: [{ field: null, entry: null, message: "not a settings section"
  }] }`.
- A failure while saving gets `{ ok: false, failed: true }`.
- The last save wins: there is no version check.

## Removed

- `npm start -- export-settings <path>` and `npm start -- import-settings <path>`.
- The automatic import of `config.json`'s search settings into an empty database, and the
  `settings_imported` trace event.
- `settings_file_ignored` and `settings_fallback` stay.
