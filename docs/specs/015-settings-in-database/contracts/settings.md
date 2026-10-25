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
- **the file isn't JSON:** "config.json is not valid JSON: …", today's message, worded for the file;
- **it holds a runtime key:** "`http` belongs in config.json, not in imported settings";
- **any rule fails**, checked against the current `config.json`: today's message for each issue,
  e.g. "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours".

## Run trace events

```json
{ "type": "settings_imported", "keys": ["companies", "searches", "title_boosts"] }
{ "type": "settings_fallback", "setting": "match_threshold", "reason": "Too big: expected number to be <=100" }
{ "type": "settings_file_ignored", "keys": ["searches", "title_boosts"] }
```

- **`settings_imported`**: written once, when a run does the upgrade import.
- **`settings_fallback`**: one per fallback at the start of a run.
- **`settings_file_ignored`**: written on each run while `config.json` still holds search settings.

None of these events holds a setting's value.

## Settings page

A **Settings notices** panel, shown only when there is something to say:
- **Fallbacks**: each setting that fell back, and why.
- **The file**: "`config.json` still holds search settings (`searches`, `title_boosts`), which are
  no longer used. They can be removed from the file."
