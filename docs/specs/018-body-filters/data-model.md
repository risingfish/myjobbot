# Data Model: Body filters

No migration. The feature adds one search setting and one way to clear a score from existing
columns.

## Search setting `body_filter`

| | |
|---|---|
| Where | `user_settings`, the owner's search settings document (feature 015), top-level key `body_filter` |
| Type | object `{ include: string[], exclude: string[] }`; each list defaults to `[]` (`bodyFilterTerms` in `src/config/schema.ts`) |
| Entry rule | `filterTerm`: at least one letter or digit once normalized (FR-007); message "filter terms need at least one letter or digit" on that row |
| Settings fields | `body_include` ("Description must include one of", stored at `body_filter.include`) and `body_exclude` ("Description must not include", stored at `body_filter.exclude`) |
| Written by | `SearchSettingsStore`, only through the Settings page's Filters section (`saveSettingsSection`, section `filters`) |
| Bad stored value | sanitized per list like `title_filter`, through the same sanitizer (`filterLists`). An invalid entry is dropped with a notice naming `body_filter.include[i]` or `body_filter.exclude[i]` but not its value. A list left empty, or a non-list value, falls back to `[]`; a non-object value falls back to both lists empty. |
| Read by | `resolveSettings`, on every run and every web request; `isWanted` (runs), `filterNote` (All jobs), `rescoreStep` (Re-score) |

The setting does not touch `config.json`. As with every search setting, a `body_filter` key left
in `config.json` is never imported or used.

## Matching (`passesBodyFilter`)

| Input | Rule |
|---|---|
| no description (null or empty) | passes (FR-005) |
| both lists empty | passes |
| otherwise | text = `normalizeTitle(readableDescription(description, format))`; passes when (`include` is empty or some term satisfies `hasWord(text, term)`) and no `exclude` term satisfies `hasWord(text, term)` (whole word or phrase, optional plural "s"; FR-002, FR-003). Exclusion wins over inclusion. |

The title is never read (spec edge case).

## Job score fields (existing `jobs` columns)

| Column | After a verdict (run or Re-score) | After `clearScore` |
|---|---|---|
| `score`, `base_score`, `bonus_score` | the verdict's numbers | null |
| `reasons`, `gaps` | JSON lists | null |
| `scored_at` | the verdict's time | null |
| `hidden`, `applied`, `applied_on` | unchanged | unchanged |
| `verdicts` rows | one new row, with the run id or re-score id | unchanged (history kept) |

`JobViews.clearScore({ ats, jobId })` returns whether the job existed. A job with a null `score` is
unscored, so:
- Recommended leaves it out;
- the next run's `next_jobs` would offer it, unless a filter matches it, which is why it was
  cleared.

## Re-score step (state of one re-score)

```text
start ──▶ plan ──filtered(company|title|body)──▶ clearScore ──▶ "filtered" + note
            │
            ├─lookup (no description, not looked up yet)──▶ careers lookup ──▶ re-read job ──▶ plan
            │
            └─score──▶ one-job session ──verdict recorded──▶ "scored"
                                     └─error / no verdict──▶ "failed" (old score kept)
```

`rescoreStep(job, config, { lookedUp })` decides each step. The filters are checked through
`filterMatch` (`src/jobs/filterMatch.ts`), in the order company, then title, then body; a job with
no description passes the body filter, so it is looked up first. A lookup that finds nothing or
throws doesn't fail the re-score: the error is traced as `rescore_lookup_failed` and the job is
scored from what it has.
