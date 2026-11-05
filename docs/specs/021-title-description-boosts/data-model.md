# Data model: Title and description boosts

No new table or column. One new key in the stored search-settings document, one data step, and
in-memory shapes for the boosts a job earned.

## Stored search settings (`user_settings.settings`, one JSON document per user)

| Key | Shape | Default | Meaning |
|-----|-------|---------|---------|
| `title_boosts` | `{ [term]: points }` | `{}` | **Changed**: matched against the job's title only. |
| `description_boosts` | `{ [term]: points }` | `{}` | **New**: matched against the job's readable description only. |

- Term: `filterTerm` (at least one letter or digit after normalizing). Points: `boostPoints`
  (integer 1–100). Same rules for both lists.
- Within one list a term appears once: the save refuses a repeat on its row, comparing terms by
  `normalizeTitle` (server, `repeatedBoosts`), as the form's `putBoost` already does case-
  insensitively. The same term may appear in both lists.
- Each list is sanitized on its own (`sanitizeSearchSettings`): bad entries are dropped with a
  notice naming `title_boosts[i]` or `description_boosts[i]` and never the value; a list left
  empty takes its default.
- Written only through `SearchSettingsStore`, by the Settings page's `scoring` section.

## Migration `016_description_boosts` (data step only)

For each `user_settings` row, in `user_id` order:

- document has `title_boosts` as an object **and** has no `description_boosts` key → store the
  document with `description_boosts` added, a copy of `title_boosts` (same terms, points, order);
  `updated_at` is left as it was (the owner didn't edit anything).
- otherwise → row untouched (fresh install, owner never set boosts, or already carried over).

The decision is `withDescriptionBoosts(document): Record<string, unknown> | null` (null = leave
the row), in `src/config/boostCarryOver.ts`, which the step imports. `down` is not provided, as with the project's other data steps.

## In memory (not stored)

```text
BoostLists      { title: Record<term, points>; description: Record<term, points> }
                  built by boostLists(settings) from Settings.title_boosts and Settings.description_boosts

AppliedBoost    { term: string;                 // as written in the list that gave the points
                  where: "title" | "description" | "both";
                  points: number }              // the points actually added

Boost           { points: number;               // sum of applied[].points
                  applied: AppliedBoost[] }     // title-list order, then the rest of the description list
```

Rules (all in `src/jobs/boosts.ts`):

- A title-list term counts when `hasWord(normalizeTitle(title), term)`; a description-list term
  when `hasWord(normalizeTitle(readableDescription(description, format)), term)`; a job with no
  description matches no description term.
- Every entry of both lists is grouped by `normalizeTitle(term)`; within one list a group counts
  once, at its highest points (terms differing only in case or punctuation are one group). Matched by both lists → one entry,
  `where: "both"`, `points = max(title points, description points)`, `term` as written in the title
  list. One matched → that list's term and points. Unmatched terms never appear.
- `boostedScore(score, boost) = min(100, score + boost.points)` (unchanged).
- `maxBoost(lists)` = sum over the same groups (one helper builds them for both) of each group's
  highest value;
  Recommended asks the database for jobs scoring at least `threshold - maxBoost`, then applies the
  real boosts.

## Display shapes (`src/web/api.ts`)

```text
Score.note            string     "base 30 + bonus 32 · model 62 · +15 senior +5 (title), typescript +10 (description)"

ScoreDetail.boost     BoostDetail | null      // null: no boost applied → panel shows "none"
BoostDetail           { total: number; lines: string[] }   // lines: "senior +5 (title)", "react +10 (title and description)"
```

Both are built from `Boost` alone (`boostText`, `boostDetail`), never from job or page text
beyond the configured terms themselves.
