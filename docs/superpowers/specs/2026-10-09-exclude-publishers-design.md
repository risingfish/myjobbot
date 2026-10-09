# Exclude JSearch Publishers — Design Spec

**Date:** 2026-10-09
**Status:** Approved
**Parent spec:** `2026-10-04-jsearch-source-design.md`

JSearch results carry a `job_publisher`: the board the posting was found on (LinkedIn,
DailyRemote, Learn4Good, Jobgether, …). Some aggregators repost jobs with poor apply links and
are not wanted. `exclude_companies` cannot block them: on aggregator results `employer_name` is
the real employer (DailyRemote published a job whose company is "Advatix, Inc."), so the board
name only appears in `publisher`.

This adds a publisher exclude list. The first entry is DailyRemote.

## Behaviour

- New setting `jsearch.exclude_publishers: string[]`, default `[]`. Each entry is validated with
  the existing `filterTerm` rule (at least one letter or digit), like the other exclude lists.
- Matching is the same as `exclude_companies`: whole words, any case, on normalized text
  (`normalizeTitle` + `hasWord`). `"dailyremote"` matches "DailyRemote". A short term matches
  more than one board (`"remote"` would also match Remote.co, Remote Rocketship and Remote Quest
  Jobs), so the README tells users to write full board names.
- A job with no publisher (`publisher` is `null`) is never excluded.
- Excluded jobs are dropped at fetch time, in `refreshSearch`, before the board-duplicate check
  and before `upsertAll`. They are never stored, never shown to the agent, and never appear in
  the web UI.
- The JSearch request still counts against the monthly budget: the API has no parameter to
  exclude publishers.
- Jobs already stored from a publisher that is later excluded stay in the database. Removing a
  publisher from the list does not bring back jobs that were dropped earlier.

## Observability

The `search_fetch` jobs-log entry gains `skipped_publishers`: the number of results dropped by
the publisher list. `skipped_duplicates` keeps its meaning (board copies, counted among the
results that passed the publisher filter). Dropped jobs are not listed in `jobs`.

```json
{ "type": "search_fetch", "source": "Senior SWE remote US", "query": "...", "params": { ... },
  "requests_this_month": 37, "job_count": 8, "skipped_duplicates": 1, "skipped_publishers": 1, "jobs": [ ... ] }
```

## Components

- `src/jobs/companyFilter.ts`: add `isExcludedPublisher(publisher, excluded)`, returning `false`
  for a `null` publisher. It and `isExcludedCompany` share one private whole-word helper so the
  matching logic exists once.
- `src/config/schema.ts`: `exclude_publishers: z.array(filterTerm).default([])` in the `jsearch`
  object.
- `src/tools/searchFetch.ts`: `refreshSearch` filters the fetched jobs by publisher, then by
  board copy, upserts the rest, and passes both skip counts to `logSearchFetch`. Functions stay
  within the 12-line / 3-parameter limits; the filtering moves into a helper if needed.

## Files touched

| File | Change |
|---|---|
| `src/config/schema.ts` | `jsearch.exclude_publishers` |
| `src/jobs/companyFilter.ts` | `isExcludedPublisher`, shared word-match helper |
| `src/tools/searchFetch.ts` | Drop excluded publishers before storing; `skipped_publishers` in the log |
| `tests/config.test.ts` | Default is `[]`; a blank/punctuation-only term is rejected |
| `tests/companyFilter.test.ts` | Case-insensitive whole-word match; no match on a partial word; `null` publisher kept |
| `tests/searchSources.test.ts` | A fixture result from an excluded publisher is not stored, not in the log's `jobs`, and counted in `skipped_publishers` |
| `README.md` | Settings-table row for `jsearch.exclude_publishers`; a sentence in the JSearch section explaining publisher vs company |

## Rollout

`data/config.json` is gitignored user data. After merge, move `"dailyremote"` from
`exclude_companies` (where it has no effect) to `jsearch.exclude_publishers`.

## Out of scope

- Hiding already-stored jobs from excluded publishers, or a web UI note for them.
- Excluding configured company boards (Greenhouse/Lever/Ashby).
- Deleting the one DailyRemote job already in the database (can be done by hand).
