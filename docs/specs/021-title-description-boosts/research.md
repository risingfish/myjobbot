# Research: Title and description boosts

No open questions were left by the spec (clarified 2026-11-04). This file records the design
decisions made while reading the code, each with what was rejected.

## R1. Setting names: keep `title_boosts`, add `description_boosts`

- **Decision**: `title_boosts` stays the stored key and now matches titles only;
  `description_boosts` is a new top-level search setting with the same shape
  (`z.record(filterTerm, boostPoints).default({})`).
- **Rationale**: the stored key already says "title", so only its meaning narrows; no rename of
  stored documents, no change to `splitSettings`/`mergeSettings` beyond the new key (both derive
  their keys from `SANITIZERS`).
- **Alternatives**: one `boosts: { title, description }` object (rejected: a rename of the stored
  key and of every field path for no gain; the Settings form addresses fields by flat names);
  renaming `title_boosts` to `description_boosts` and adding a new `title_boosts` (rejected: the
  carry-over is a copy into both, so a rename buys nothing).

## R2. Carry-over (FR-013): migration step `016_description_boosts`

- **Decision**: a numbered Kysely migration whose data step reads every `user_settings` row and,
  where the document has a `title_boosts` object and no `description_boosts` key, writes the
  document back with `description_boosts` set to a copy of `title_boosts`, key order otherwise
  kept. The decision is a plain function in its own module, `src/config/boostCarryOver.ts`
  (`withDescriptionBoosts(document)`, returning the new document or null when nothing changes),
  imported by the step, so it is unit-tested and reached from production code (an export used
  only by tests fails knip's production pass); the step itself gets one integration case. Typed with `db.withTables<...>()`, builders only, as `013_move_sources` does.
- **Rationale**: migrations run once per database (`src/db/migrate.ts`), so the copy happens
  exactly once and a later removal from one list is never undone (FR-013). Step 013 already
  rewrites the settings document this way, so it is the project's established pattern.
- **Alternatives**: a read-time fallback ("no `description_boosts` stored → use `title_boosts`")
  rejected: the fallback would last forever and would bring back every title boost the moment the
  owner reset the description list (a Reset removes the key). A one-off CLI command rejected: easy to forget, and the stack would show
  the wrong boosts until it ran.
- **Note**: `config.json` search settings are never imported (feature 016), so no file needs the
  copy. Default (`{}`) stays the default for both lists; a fresh install starts with both empty.

## R3. Matching and the both-lists rule

- **Decision**: a new pure module `src/jobs/boosts.ts` replaces `src/jobs/titleBoost.ts`:
  - `appliedBoosts(job, lists)` matches title boosts against `normalizeTitle(title)` and
    description boosts against `normalizeTitle(readableDescription(...))`, each with the existing
    `hasWord`; each term at most once per list.
  - Every entry of both lists is grouped by `normalizeTitle(term)`, so "React" and "react" are
    one term, whether in one list or across the two. Within one list a group counts once, at its
    highest points (the save refuses such repeats from now on, but older documents may hold them).
    A term matched by both lists gets `where: "both"` and `max(titlePoints, descriptionPoints)`;
    matched by one, that list's points.
  - Result: `{ points, applied: AppliedBoost[] }`, `applied` in title-list order then the
    description list's remaining terms, so the display is stable.
  - `maxBoost(lists)` (the Recommended pre-filter's headroom) sums the same groups, each at its
    highest value, built by the same helper as `appliedBoosts`, so it is never below any real
    job's boost (SC-004).
  - `boostedScore` is unchanged (cap at 100).
- **Rationale**: keeps every rule in one plain module, unit-tested; callers (`rowViews.ts`,
  `pageData.ts`, `jobDetail.ts`) only pass the job and the two lists.
- **Alternatives**: matching each list against title and description and then filtering
  (rejected: harder to explain "where"); merging by exact string (rejected: the Settings form
  already treats case-insensitive repeats as the same term, `putBoost`).
- Two *different* terms that overlap ("engineer", "software engineer") still both count, as today.
- Grouping by `normalizeTitle` also merges terms that differ only in punctuation (`c++`, `c#` → `c`),
  which used to add their points separately: SC-006's stated exception. The owner's stored list
  (8 terms, checked on a copy 2026-11-04) has no such pair.

## R4. Showing what applied (FR-007, FR-008)

- **Decision**: the table's score note keeps its form, listing each term with its points and
  place: `model 62 · +15 senior +5 (title), typescript +10 (description)`; a "both" term reads
  `react +10 (title and description)`. The panel's `ScoreDetail.boost` becomes
  `{ total: number; lines: string[] } | null` (null when none applied), shown as a
  "Boosts" fact with the total and one line per term, or "none". `Fact` holds one string, so the
  lines go through a sibling `FactLines` in `PanelSection` (the total, then a `<ul>` inside the
  `<dd>`), leaving `Fact` and its "unknown" unchanged (owner decision, 2026-11-04, to revisit
  after the feature is done). The text is built by one function
  (`boostText`) from the applied list alone, so table and panel agree.
- **Rationale**: one source of truth; the note already exists and the panel already has a fact
  list (`Fact` in `PanelSection`).
- **Alternatives**: a separate boosts table in the panel (rejected: heavier than the fact list for
  a handful of terms); widening `Fact` to take `string[]` (rejected: muddles its "unknown"); one
  joined value like the table note (rejected: long terms lists wrap and are hard to scan).

## R5. Settings layout and section

- **Decision**: both lists stay in the `scoring` section (one autosave with the threshold, as
  today). `ScoringSection` keeps the Threshold card and adds a Pico `.grid` of two `SettingCard`s,
  "Title boosts" and "Description boosts", each with `BoostTags`, its reset and its problems,
  exactly as `FiltersSection` lays out its groups. `BoostTags` takes the field name and label as
  props instead of hard-coding `title_boosts`. The two cards move into a new
  `web/components/settings/BoostCards.tsx` so `ScoringSection.tsx` stays small.
- **Rationale**: no new section name, server action or `SECTION_NAMES` entry; the grid is Pico's
  own (UI: use Pico).
- **Alternatives**: a separate "Boosts" section (rejected: splits the threshold from the boosts it
  is compared with and adds a section to `settingsSections.ts` and the save action for no gain).

## R6. Settings plumbing for a second boost field

- `settingsSections.ts`: add `description_boosts` (section `scoring`, stored and checked at
  `["description_boosts"]`) and a `BOOST_FIELDS` list, so `settingsApply.editedValue`,
  `settingsProblems.entryOf`/`repeatedBoosts` treat both fields alike instead of comparing to
  `"title_boosts"` (`settingsView` already keeps per-field maps and only gains entries).
- `repeatedBoosts` checks each boost field separately (FR-011): a term repeated within one list is
  refused on that list's row; the same term in both lists passes.
- `searchSettings.ts`: `Fallbacks.boosts(value, name)` takes the setting name so each list falls
  back on its own with its own notice (FR-012).

## R7. Where the work happens (shared checkout, feature 022 in parallel)

- **Decision**: the feature is worked in a git worktree, `../myjobbot-021-boosts`, on branch
  `021-title-description-boosts` (owner decision, 2026-11-04), not the main checkout.
- **Rationale**: another session is working feature 022 in the main checkout, which the Docker
  stack serves live. In the worktree, no code of this feature reaches the stack until it merges, so
  the stack could keep running for 022 even though this feature adds a migration. On 2026-11-04 the
  owner had the stack stopped anyway, as production moves to the Kubernetes cluster, so the
  constitution's stop-the-stack rule is met.
- **Consequences**: the worktree needs its own `npm ci` and a copy of `.env` (copied, never
  printed) for `npm run check:db`; the Stop hook checks the session's project folder (this worktree, when the session starts here), and `npm run check` must
  be run in the worktree explicitly; a live look at the UI uses the worktree's own dev server on
  another port. Each Claude session has its own database (owner decision, 2026-11-04: `myjobbot`
  belongs to the Kubernetes cluster, `myjobbot_dev` and `myjobbot_test` to the main checkout); this worktree's `.env`
  names `myjobbot_dev_alt` for the app and `myjobbot_test_alt` for `check:db` (quickstart §1). That keeps step 016
  out of every other database: a shared `myjobbot_test` would record it, and the 022 checkout,
  which has no step 016, would then fail Kysely's missing-migration check. 022 merged first (#106) with `015_lookup_indexes`, already run on `myjobbot`, so this feature's step is `016_description_boosts`, and the branch is fast-forwarded onto `main` 359b111 (2026-11-04).
