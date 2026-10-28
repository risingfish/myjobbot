# Quickstart: Modular job sources

Check each PR once it is merged and the stack is rebuilt (`npm run docker:up`). Before it is opened,
every PR also passes `npm run check` and `npm run check:db`. The modules are described in
[contracts/source-module.md](contracts/source-module.md), and the page, run and tools in
[contracts/sources-ui-and-run.md](contracts/sources-ui-and-run.md).

## PR 1: the module interface

A run fetches the same boards as before. Each `board_fetch` line in the jobs log shows the same job
counts. Nothing visible changes.

## PR 2: Workday, and the careers lookup on modules

1. An alert job whose company uses Workday still gets its description from the careers lookup:
   `SELECT page_source, board FROM careers_audit ORDER BY id DESC LIMIT 5;` shows `board` and
   `workday:…`.
2. A Greenhouse, Lever or Ashby alert job is read the same way as before.

## PR 3: the table

`SHOW TABLES LIKE 'user_sources';` lists it, empty. Nothing else changes.

## PR 4a: jobs linked to their source

Nothing visible changes. `SHOW COLUMNS FROM jobs LIKE 'source_id';` shows the column, and
`SELECT COUNT(*) FROM jobs WHERE source_id IS NOT NULL;` is 0 until PR 4b.

## PR 4b: your boards and searches become saved sources

1. `SELECT module, name, params, enabled FROM user_sources WHERE user_id = 1;` lists one row per
   former board and search, plus `gmail_alerts`, with the same names and fields (SC-002).
2. `SELECT JSON_KEYS(settings) FROM user_settings WHERE user_id = 1;` no longer lists `companies` or
   `searches`.
3. `SELECT COUNT(*) FROM jobs WHERE source_id IS NULL;` counts only jobs from sources you had already
   removed.
4. Recommended shows the same jobs in the same order as before the upgrade (SC-002).
5. The Settings page lists your saved sources, read-only for now, and the notices panel says any
   `companies` or `searches` left in `config.json` are no longer used.

## PR 5: the run fetches every source that is on

1. A run's trace has one `source_fetch` per source that is on, before the model's first turn. The
   model's tool calls are `list_sources`, `next_jobs`, `get_job_details`, `record_matches` and
   `finish`.
2. Break one board's id in the database (`UPDATE user_sources SET params = JSON_SET(params, '$.slug',
   'no-such-board') WHERE name = …;`). The run still fetches every other source (SC-005), and that
   source's `last_outcome` is `failing`.
3. Turn a source off (`UPDATE user_sources SET enabled = 0 …`). The next run has `source_skipped`
   for it, and its jobs are still on Recommended (SC-007).

## PR 6: the Sources section

1. Paste `boards.greenhouse.io/<company>` and save it. The form fills in by itself, the test reports
   its job count, and the source appears in the list in under 30 seconds (SC-001).
2. Paste a Workday jobs page link. Save it, and after a run the source shows its job count, or
   "stopped at the limit" for a large site. The next run continues (SC-004).
3. Paste a link to a single posting (`jobs.lever.co/<company>/<id>`). It is recognised as that
   company's board (SC-003).
4. Paste `example.com/careers`. The page says it isn't a supported board link.
5. Save a board with a misspelled id. It is saved and marked "failing: not found".
6. Add a saved search, then turn the switch off and on, edit it and delete it.

## PR 7: docs

The README describes sources as modules and saved sources, how to add one, and the module table.
