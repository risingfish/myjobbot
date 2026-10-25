# Contract: search settings

## Which keys are search settings

`companies`, `searches`, `preferences`, `match_threshold`, `title_filter`, `title_boosts`,
`exclude_companies`, and `jsearch.exclude_publishers`.

Everything else in `config.json` is a runtime setting and stays there: `jsearch`'s cap, refresh and
posting window, `agent`, `http`, `gmail`, `careers_lookup`, `company_search`, `ghost_threshold_days`
and `job_retention_days`.

## Commands

| Command | Does | Exit code |
|---|---|---|
| `npm start -- export-settings <path>` | writes the stored search settings, in `config.json`'s shape (`{}` when none) | 0 |
| `npm start -- import-settings <path>` | checks the file, then replaces the stored search settings | 0 stored, 1 refused |

`import-settings` refuses, storing nothing, when:
- **the file isn't JSON:** "`<path>` is not valid JSON: …", today's message worded for that file;
- **it holds a key that isn't a search setting:** "`http` belongs in config.json, not in imported
  settings" (also for an unknown key, and for a `jsearch` key other than `exclude_publishers`);
- **any rule fails**, checked against the current `config.json`: today's message for each issue,
  e.g. "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours". A file
  with no company or search, `{}` included, is refused with "configure at least one company or
  search".

Only the command-line import refuses runtime keys. The upgrade import takes the search part of
`config.json` and leaves the rest of the file in use.

## Run trace events

```json
{ "type": "settings_imported", "keys": ["companies", "searches", "title_boosts"] }
{ "type": "settings_fallback", "setting": "match_threshold", "reason": "Too big: expected number to be <=100" }
{ "type": "settings_fallback", "setting": "jsearch.exclude_publishers[2]", "reason": "not a valid domain entry" }
{ "type": "settings_file_ignored", "keys": ["searches", "jsearch.exclude_publishers"] }
```

- **`settings_imported`** (PR 1b): written once, when a run does the upgrade import. That run
  writes no `settings_file_ignored`.
- **`settings_fallback`** (PR 2): one per fallback at the start of a run. `setting` is the key, plus
  the entry's position for a list or map entry (`companies[1]`, `title_boosts[3]`).
- **`settings_file_ignored`** (PR 1b): written on each later run while `config.json` still holds
  search settings. Keys are named as in `config.json`.

None of these events holds a setting's value.

## Settings page

A **Settings notices** panel, first on the page above Scoring, shown only when there is a
`fallback` or `file_ignored` notice:
- **Fallbacks**: each setting that fell back, and why.
- **The file**: "`config.json` still holds search settings (`searches`, `title_boosts`), which are
  no longer used. They can be removed from the file."
