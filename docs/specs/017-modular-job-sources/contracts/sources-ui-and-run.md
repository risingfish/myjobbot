# Contract: the Sources section, the run, and the model's tools

## The Settings page's Sources section

The section has three parts.

**The list.** One row per saved source:

| Column | Shows |
|---|---|
| Source | the module's name, as a badge, and the source's name |
| On | a switch; turning it off stops it being fetched from the next run |
| Last fetch | time, jobs read, and the outcome: "ok", "stopped at the limit (continues next run)", or "failing: <reason>" |
| | Edit, Delete (Delete asks to confirm) |

Gmail alerts is listed once Gmail is connected, with the switch only.

**Add a source.** Two ways in:
- a **link box**: "Paste a jobs page link". A recognised link opens that module's form, filled in,
  with a suggested name. Otherwise: "Not a supported job board link (Greenhouse, Lever, Ashby,
  Workday). Choose a source type below to fill it in by hand.";
- a **module picker**, listing each module's name and description, which opens its form.

A module whose `requires` aren't met shows why ("Needs JSEARCH_API_KEY in .env") and can't be saved.

**A source's form.** Its name, then its module's fields, then Save and Cancel.

| Save result | Shows |
|---|---|
| Saved and tested | "Saved. Test found N jobs." |
| Saved, test failed | "Saved, but its test fetch failed: <reason>. It will be tried again on the next run." |
| Refused | each problem beside its field, or at the top; nothing stored |
| Couldn't run | "Couldn't save — try again" |

**Problems are refused before storing**:
- the module's field rules, with zod's own messages;
- "a source with this name already exists", with names compared ignoring case;
- "\"Gmail alerts\" is a reserved source name";
- "this board is already saved as <name>";
- "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours".

## Server actions (`web/lib/sourceActions.ts`)

| Action | Does | Returns |
|---|---|---|
| `recognizeSourceLink(link)` | tries each module's `fromUrl` | `{ module, params, name }` or `null` |
| `saveSource(previous, request)` | checks, stores, then tests the source | `{ ok: true, test }`, `{ ok: false, problems }` or `{ ok: false, failed: true }` |
| `setSourceEnabled(id, on)` | turns a source on or off and clears its cursor | `{ ok: true }` or `{ ok: false }` |
| `deleteSource(id)` | deletes a source; its jobs keep their label | `{ ok: true }` or `{ ok: false }` |

## The run

1. **Before the agent**, the fetch phase reads every saved source that is on, is available, and is
   due, within its limits. It records each source's outcome. Trace events:
   - `source_fetch`: source, module, pages, jobs, cost, outcome;
   - `source_skipped`: source and why: off, not due, budget used, not set up, or the module is
     missing.
2. **The agent** scores what was fetched. It never fetches.
3. **With no source on**, the run finishes at once. Its summary is "no sources are on".

## The model's tools

| Tool | Before | Now |
|---|---|---|
| `list_sources` | the sources it could fetch, with progress | each source that is on: its fetch outcome this run, and its unscored count |
| `fetch_jobs` | fetched a source, then returned 25 unscored jobs | removed |
| `next_jobs` | — | up to 25 unscored jobs from one source, plus `total_unscored`; fetches nothing |
| `get_job_details`, `record_matches`, `finish` | | unchanged |

The system prompt's steps become: call `list_sources`, then `next_jobs` and `record_matches` for each
source until its `total_unscored` is 0, then `finish`.
