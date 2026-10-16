# Quickstart: validating the careers lookup

Prerequisites:
- `.env` with the `MYJOBBOT_DB_*` and LLM settings, plus `MYJOBBOT_SEARXNG_URL`
- Gmail connected (feature 006)
- the Docker stack stopped during the feature (spec-kit sittings)

Never print `.env`.

## 1. Checks

```sh
npm run check      # unit + UI + habit-hooks
npm run check:db   # MariaDB contract tests on myjobbot_test, including careers_pages, careers_audit, jobs.description_*
```

## 2. SearXNG answers JSON

```sh
curl -s "$MYJOBBOT_SEARXNG_URL/search?q=Vetcove+careers&format=json" | head -c 200
```

You should see JSON starting `{"query": "Vetcove careers", "results": [`. A `403` means `json` is
missing from `search.formats` in SearXNG's `settings.yml`.

To try the bundled service instead:

```sh
docker compose --profile search up -d searxng
```

Then set `MYJOBBOT_SEARXNG_URL=http://searxng:8080`.

## 3. Live run on the test database first

Run the agent against `myjobbot_test`, with the database name overridden for this shell only.

Prepare the test database first (it starts with no Gmail connection, because `check:db` empties
`gmail_connection`, and an empty `api_calls`, so JSearch's monthly count would read 0):
1. Point the web UI at `myjobbot_test` (`npm run web` with the same override) and connect Gmail
   in Settings.
2. Leave `JSEARCH_API_KEY` unset for this run, so no real JSearch requests go out; every alert
   job then reaches the careers lookup.
3. Do not run `npm run check:db` between connecting and the run (it would empty the tables
   again).

- **Expected in the run output and trace** (`data/runs/*.jsonl`): an event
  `{ "type": "careers", "looked_up": N, "found": F, "failed": {…} }`, and lookup conversation
  events tagged `"lookup": "linkedin:li_…"`.
- **Expected in the database**:

  ```sql
  SELECT step, outcome, reason, chars, cut, more_pages, url FROM careers_audit ORDER BY id;          -- the step trail per job (US2)
  SELECT reason, COUNT(*) FROM careers_audit WHERE warning = 1 GROUP BY reason;                    -- SC-003
  SELECT company, description_source, CHAR_LENGTH(description) FROM jobs WHERE source = 'Gmail alerts';  -- US1
  SELECT * FROM careers_pages;                                                                     -- US3
  ```

- **Check**:
  - Jobs with `description_source = 'careers'` are scored on their description: their reasons
    name the stack, not "(none provided)".
  - No `chars` value is above `page_chars` (SC-002).
- **Record in tasks.md**: counts and reasons only. No page, job or email text.

## 4. Remembered page (US3)

Run again with a new alert from a company already in `careers_pages`. Its audit trail starts with
`remembered`, not `search`.

## 5. Search off (SC-005)

Unset `MYJOBBOT_SEARXNG_URL` and run. There should be one `skipped` / `search_unavailable` audit
row, and the run otherwise matches 007's behaviour.

## 6. After a week (SC-001)

```sql
SELECT (description_source = 'careers') AS from_careers, COUNT(*) FROM jobs
WHERE source = 'Gmail alerts' AND first_seen >= :merge_date GROUP BY from_careers;
```

Fill `:merge_date` with the merge date recorded at T050. Count only jobs that pass the title
filter (check the list against `config.json`'s `title_filter`, or read the run traces' `careers`
events, which only cover filtered jobs). At least half should be `from_careers = 1`.
