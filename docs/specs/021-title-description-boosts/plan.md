# Implementation Plan: Title and description boosts

**Branch**: `021-title-description-boosts` (worktree `../myjobbot-021-boosts`) | **Date**: 2026-11-04 |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/021-title-description-boosts/spec.md`

## Summary

Split the one boost list into two: `title_boosts` (now title only) and a new `description_boosts`
(readable description only). Each term counts once per job; a term in both lists found in both
places counts once at the higher value. All matching moves into one pure module,
`src/jobs/boosts.ts`, which also returns the list of applied boosts (term, title/description/both,
points) that the table note and the details panel show. Settings gets two cards in a Pico grid
inside the Scoring section, like Filters. A migration data step, `016_description_boosts`, copies
the owner's current list into `description_boosts` once, so no score changes on the day it ships.
Boosts stay display-time only; the run, the model, re-score and evals are untouched.

## Technical Context

**Language/Version**: TypeScript (Node 24, ESM), Next.js web UI in `web/`

**Primary Dependencies**: existing only: zod, Kysely, React, Pico CSS. No new dependency.

**Storage**: MariaDB `user_settings` JSON document (one new key); one data-only migration step

**Testing**: vitest (unit, `dom` project for UI), MariaDB `myjobbot_test_alt` (this session's own) for integration

**Target Platform**: Linux server: production on the Kubernetes cluster; the local Docker stack (`web`, scheduled agent run) is stopped

**Project Type**: CLI agent + Next.js web app, one repo

**Performance Goals**: boosts are computed per job on page load; two `hasWord` passes per term
over title and description, the same order of work as today's single combined pass

**Constraints**: habit-hooks limits (20-line functions, 200-line files); settings sanitized per
key with value-free notices; worked in a worktree on its own databases (research R7)

**Scale/Scope**: one owner, tens of boost terms, a few thousand jobs per page load at most

## Constitution Check

Checked against constitution **2.5.0**.

| Principle | Status | How |
|-----------|--------|-----|
| I. Habit-hooks clean at every sitting boundary | Pass | Each sitting ends with `npm run check` green in the worktree. Every new module is wired in its own sitting (`boosts.ts` replaces `titleBoost.ts` in S1 with all callers switched; step 016 is listed in `migrations/index.ts` in S1; `BoostCards.tsx` is rendered by `ScoringSection` in S2). `rowViews.ts` (132 lines) and `searchSettings.ts` (160) stay under 200 because the new rules live in `boosts.ts`. |
| II. Test-first, checked before done | Pass | Tests come before code in each sitting; `check` and `check:db` gate each sitting. Mix below. |
| III. Purpose comments only | Pass | One-line doc comment per new function; renamed functions get updated comments. |
| IV. Bounded, locked dependencies; use libraries their way | Pass | No dependency. Step 016 uses Kysely builders with `db.withTables<...>()`, as 013 does; no `sql` tag. |
| V. Specs live in docs/specs | Pass | `docs/specs/021-title-description-boosts/`. |
| Workflow: sittings in the main checkout or a worktree, stack stopped for a migration; each checkout's own databases | Pass | Worked in a worktree, as 2.5.0 allows when another session works in the main checkout, with its own `npm ci`, `.env` and checks; the stack is stopped; this worktree uses `myjobbot_dev_alt` and `myjobbot_test_alt` (Development Workflow, Databases). |

Workflow, swap behind an interface: `titleBoost.ts` has two callers (`rowViews.ts`, `pageData.ts`); T024–T025 replace it and switch both in S1, which ends green, so no interface is needed for the swap.

Post-design re-check: passing, with no deviations.

### Test mix (new or changed tests, by count)

| Kind | Count | Where |
|------|-------|-------|
| Unit | ~35 new (6 moved), 9 changed | `tests/boosts.test.ts` (replaces `titleBoost.test.ts`, ~16), `tests/boostCarryOver.test.ts` (4), `tests/boostViews.test.ts` (4), changes to `config`, `searchSettings`, `settingsView`, `settingsApply`, `settingsProblems`, `settingsSave`, `settingsSections`, `settingsForm`, `pageData` (3 note expectations) and `jobDetail` (1) tests |
| Integration | 1–2 | step 016 on `myjobbot_test_alt` copies once and leaves other documents alone; the step lists in `migrate.test.ts`, `companyMigrations.test.ts` and `lookupIndexes.test.ts` gain `016_description_boosts` |
| UI | 0 new, 2 changed | none added in this PR (owner decision, 2026-11-04); `tests/client/settingsScoring.test.tsx`'s save expectation and `tests/client/panelSections.test.tsx`'s Boosts label are updated so they keep passing. The cards are checked by hand (quickstart §3, T035) |

About 97/3/0 by new cases (tasks.md ledger), moving the suite toward the 95/4/1 target.

## Project Structure

### Documentation (this feature)

```text
docs/specs/021-title-description-boosts/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R7 decisions
├── data-model.md        # setting keys, step 016, in-memory shapes
├── quickstart.md        # worktree setup, checks, live look on myjobbot_dev_alt
├── contracts/ui.md      # Settings cards, table note, panel facts
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/config/schema.ts                        + description_boosts in settingsSchema
src/config/searchSettings.ts                + description_boosts sanitizer; Fallbacks.boosts(value, name)
src/jobs/boosts.ts                          NEW (replaces titleBoost.ts): boostLists, appliedBoosts, boostedScore, maxBoost
src/jobs/titleBoost.ts                      DELETED
src/descriptions/readable.ts                purpose comment: both boost lists read it
src/config/boostCarryOver.ts                NEW: withDescriptionBoosts (the carry-over decision)
src/db/migrations/016_description_boosts.ts NEW data step, using boostCarryOver
src/db/migrations/index.ts                  + 016
src/web/settingsSections.ts                 + description_boosts field, BOOST_FIELDS
src/web/settingsForm.ts                     + description_boosts in ROW_SHAPES
src/web/settingsView.ts                     + description_boosts shown and default
src/web/settingsApply.ts                    boost rows → map for every BOOST_FIELDS entry
src/web/settingsProblems.ts                 repeats (normalized terms) and row lookup per boost field
src/web/boostViews.ts                       NEW: boostText (note) and boostDetail (panel)
src/web/rowViews.ts                         RowContext.boosts: BoostLists; note via boostViews' boostText (its own boostText removed)
src/web/jobDetail.ts                        ScoreDetail.boost → BoostDetail
src/web/api.ts                              BoostDetail type
src/web/pageData.ts                         Recommended with both lists; RowContext
web/components/settings/BoostCards.tsx      NEW: the grid of two boost cards
web/components/settings/BoostTags.tsx       field and label props
web/components/settings/ScoringSection.tsx  threshold card + BoostCards; saves three fields
web/components/panel/ScoreSection.tsx       "Boosts" fact with one line per term
web/components/panel/PanelSection.tsx       FactLines: a fact holding a total and a list of lines
tests/…                                     as in the test mix
README.md, CLAUDE.md                        the two lists described (FR-015)
docs/superpowers/specs/2026-10-04-web-ui-design.md  "largest possible boost" (FR-015)
```

**Structure Decision**: the existing single-repo layout (`src/` core, `web/` Next.js, `tests/`);
no new directories.

## Sittings and delivery

One PR for the whole feature (spec, Delivery). Sittings are worked in order in the worktree; the
Docker stack is stopped throughout (owner, 2026-11-04: production moves to the Kubernetes cluster).

| Sitting | Goal | Stack |
|---------|------|-------|
| S1 | Core: `description_boosts` setting and sanitizer with the settings plumbing it forces (sections, view, apply, problems), `boosts.ts` with every caller switched (rows, panel data, Recommended), step 016 + index, note and panel text with the panel's "Boosts" fact; tests first | stopped (owner, 2026-11-04) |
| S2 | UI: `BoostCards` grid, `BoostTags` per field, `ScoringSection` showing both cards; UI test | stopped (owner, 2026-11-04) |
| S3 | Docs: README boosts, Settings and panel text, CLAUDE.md line on boosts; final `check` + `check:db`; open the PR | stopped (owner, 2026-11-04) |

Adding `description_boosts` to `FieldName` forces `settingsView`'s `SHOWN`/`DEFAULTS` maps to
gain it at once, so that plumbing sits in S1; `/speckit-tasks` places each file in the first
sitting that can end green.

## Complexity Tracking

None: the worktree and the per-checkout databases are allowed by constitution 2.5.0 (2026-11-04).
