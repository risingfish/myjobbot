---

description: "Task list for feature 021, title and description boosts"
---

# Tasks: Title and description boosts

**Input**: Design documents from `docs/specs/021-title-description-boosts/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: required by constitution Principle II. Each sitting writes its tests before its code;
each test task names its kind (unit, integration or UI) and roughly how many tests it adds or
changes. The ledger is at the end.

**Organization**: tasks are grouped by user story. US1–US3 (the matching rules) share one new
module, `src/jobs/boosts.ts`, so their tests come first and one task then writes the module.
Sittings S1–S3 follow [plan.md](plan.md) (Sittings and delivery). **One PR** for the whole
feature (spec, Delivery).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: the user story the task belongs to (US1–US5). Setup, foundational, sitting-boundary
  and polish tasks carry no story label.

## Sitting rules (constitution Principle I and Development Workflow, as adapted in plan.md)

- **Where:** every sitting runs in the worktree `/home/zac/code/myjobbot-021-boosts` on
  `021-title-description-boosts` (constitution 2.5.0, Development Workflow). The main checkout keeps its own databases
  (`myjobbot_dev`, `myjobbot_test`); nothing in this feature switches branches in it or writes to
  its git state.
- **Stack:** the Docker stack is stopped (owner, 2026-11-04: production moves to the Kubernetes
  cluster); don't start, rebuild or restart it from this branch, and never run this branch's web
  app or agent against `myjobbot`; a live look uses this session's own database, `myjobbot_dev_alt` (quickstart §3).
- **Start:** create `.specify/sitting-in-progress` **in the worktree**, naming the sitting.
- **End:** in the worktree, `npm run check` and `npm run check:db` green, then delete the marker.
  The Stop hook runs habit-hooks in the session's project folder, which is this worktree when the
  session starts here, so this worktree's own marker and findings apply; still run `npm run check`
  yourself before calling a sitting done.
- **Own database:** each Claude session gets its own database (owner decision, 2026-11-04;
  `myjobbot` is the Kubernetes cluster's, `myjobbot_dev` and `myjobbot_test` the main checkout's). This worktree's
  `.env` names `myjobbot_dev_alt` as `MYJOBBOT_DB_NAME` and `myjobbot_test_alt` as `MYJOBBOT_TEST_DB_NAME`, so nothing run here
  touches `myjobbot`, `myjobbot_dev` or `myjobbot_test`.
- **Commits:** only at a sitting's end, only when the owner asks, with no attribution lines.
- **Habit-hooks:** its output is a direct instruction; each finding becomes a task, fixed before
  other work continues.
- **Code rules:** one-line `/** … */` purpose comment on every new or changed function (tests
  uncommented); functions ≤ 20 lines, ≤ 3 parameters; files ≤ 200 lines; every new export reached
  from production in the sitting that adds it.

---

## Phase 1: Setup

**Purpose**: a working worktree with a measured baseline

- [X] T001 In `/home/zac/code/myjobbot-021-boosts`, run `npm ci` (lockfile only), once the owner has created `myjobbot_dev_alt`, `myjobbot_test_alt` and their user (quickstart §1), copy `.env` with `cp ../myjobbot/.env .env` and set `MYJOBBOT_DB_NAME` and `MYJOBBOT_TEST_DB_NAME` to them with `sed`/an append, never printing the file (the owner sets that user's `MYJOBBOT_DB_USER` / `MYJOBBOT_DB_PASSWORD`); confirm `git config core.hooksPath` is `.githooks`
- [X] T002 Run `npm run check` and `npm run check:db` in the worktree on the unchanged branch and write the unit / integration / UI test counts into the ledger's baseline row at the end of this file
- [X] T002a Add `MYJOBBOT_TEST_DB_HOST`/`_PORT`/`_USER`/`_PASSWORD` to `testEnvironment` in `tests/helpers/testDb.ts` (each falls back to its `MYJOBBOT_DB_*` setting when unset or blank; a name must hold `_test` at its end or before another `_`), with 4 unit tests in `tests/testDbSettings.test.ts`, the collation test comparing the app's own database, and `.env.example`, README and CLAUDE.md describing it (owner request, 2026-11-04)

---

## Phase 2: Foundational (the second setting and its plumbing)

**Purpose**: `description_boosts` exists, is sanitized on its own, is shown and saved by the
`scoring` section, and the owner's list is carried over once. Every story reads it.

### Sitting S1: settings, matching, carry-over, table and panel text

- [ ] T003 Create `.specify/sitting-in-progress` in the worktree naming S1
- [ ] T004 [P] Unit tests (2) in `tests/config.test.ts`: `testAppSettings().description_boosts` is `{}`; `description_boosts: { typescript: 10 }` is kept and points `0` or `101` throw, as the `title_boosts` cases there do
- [ ] T005 [P] Unit tests (2) in `tests/searchSettings.test.ts`: a stored `description_boosts: { typescript: 10, "---": 5 }` keeps `typescript`, drops `"---"` with a notice whose setting is `description_boosts[1]` and whose reason doesn't hold the value, while a good stored `title_boosts` is kept untouched; a non-object `description_boosts` falls back to `{}` with one notice naming `description_boosts` (FR-012)
- [ ] T006 [P] Unit tests (2 new, 1 changed) in `tests/settingsSections.test.ts` and `tests/settingsView.test.ts`: rewrite the existing "ten fields cover the seven search keys" case to eleven fields and eight keys (`description_boosts` added to its `SEARCH_KEYS`); `fieldsOf("scoring")` lists `match_threshold`, `title_boosts`, `description_boosts`; `settingsView` shows a stored `description_boosts` as rows `[["typescript", 10]]` with `isDefault: false`, and `[]` / `isDefault: true` when not stored, with `defaults.description_boosts` `[]`
- [ ] T007 [P] Unit tests (4 new, 2 changed) in `tests/settingsApply.test.ts`, `tests/settingsProblems.test.ts`, `tests/settingsSave.test.ts` and `tests/settingsForm.test.ts`: a scoring save stores `description_boosts` rows as a map in row order; `repeatedBoosts` puts "this term is already boosted above" on row 1 of `description_boosts` for `[["react", 5], ["react", 8]]`, also for `[["React", 5], ["react", 8]]` (terms compared as `normalizeTitle` does, as the form's `putBoost` already does), and returns nothing for `react` in both lists (FR-011, US5 scenarios 2–3); a refused points value in `description_boosts` is placed on that field's row; update the existing `sectionRequest("scoring", …)` case (`settingsForm.test.ts:55`) to pass and expect `description_boosts`, and add `description_boosts: { kind: "default" }` to the request in "a row with extra parts is refused" (`settingsForm.test.ts:71-73`) so it still fails on the row's shape, not on the field count
- [ ] T008 [P] Unit tests (4) in new `tests/boostCarryOver.test.ts` for `withDescriptionBoosts(document)` from `src/config/boostCarryOver.ts` (data-model, Migration): `{ preferences: "x", title_boosts: { go: 5 } }` → same keys in order plus `description_boosts: { go: 5 }`; no `title_boosts` → `null`; `description_boosts` already present (even `{}`) → `null`; `title_boosts` not an object → `null`
- [ ] T009 Add `description_boosts: z.record(filterTerm, boostPoints).default({})` to `settingsSchema` right after `title_boosts` in `src/config/schema.ts`
- [ ] T010 In `src/config/searchSettings.ts`, change `Fallbacks.boosts(value)` to `boosts(value, name)` (the name prefixes each notice, `${name}[${index}]`), update its purpose comment, and add `description_boosts: (value, fallbacks) => fallbacks.boosts(value, "description_boosts")` to `SANITIZERS` (T005 passes; `TOP_LEVEL_KEYS` picks it up)
- [ ] T011 In `src/web/settingsSections.ts`, add `"description_boosts"` to `FieldName`, a `scoring` entry `{ name: "description_boosts", section: "scoring", stored: ["description_boosts"], check: ["description_boosts"] }` after `title_boosts`, and export `BOOST_FIELDS = ["title_boosts", "description_boosts"] as const` (looped over by `repeatedBoosts`, T013, and by `BoostCards`, T033) with `isBoostField(name: FieldName): boolean`; in `src/web/settingsForm.ts`, add `description_boosts: z.array(z.tuple([anything, anything]))` to `ROW_SHAPES` (a `Record<FieldName, …>`, so typecheck needs it)
- [ ] T012 In `src/web/settingsView.ts`, add `description_boosts` to `FieldValues`, `SHOWN` (same transform as `title_boosts`), `DEFAULTS`, `shownFields` and `defaultValues` (T006 passes; file stays ≤ 200 lines)
- [ ] T013 In `src/web/settingsApply.ts` (`editedValue`) and `src/web/settingsProblems.ts` (`repeatedBoosts`, `entryOf`, `boostRows(request, name)`), replace each comparison with `"title_boosts"` by `isBoostField`, with `repeatedBoosts` looping over `BOOST_FIELDS` (its production use in S1) to check repeats within each boost field separately, comparing terms by `normalizeTitle`, and update the purpose comments (T007 passes)
- [ ] T014 First update the save expectation in `tests/client/settingsScoring.test.tsx:21` to include `description_boosts: { kind: "default" }` (UI, 1 changed; it fails until this task is done); then in `web/components/settings/ScoringSection.tsx`, keep `description_boosts` in state from `view.fields.description_boosts` and include it in every `autosave` call, so a scoring save never drops it (the two cards come in S2)
- [ ] T015 Integration test (1) in new `tests/integration/boostMigration.test.ts` using `migrateBefore(db, "016")` from `tests/helpers/migrationSteps.ts`: seed two `users` rows first (`user_settings` has a foreign key to `users`, as `companyMigrations.test.ts` seeds them), then two `user_settings` rows, one with `title_boosts: { go: 5, react: 8 }`, one with none; after `migrateToLatest` the first holds `description_boosts: { go: 5, react: 8 }` with `title_boosts` and `updated_at` unchanged, the second is untouched; append `"016_description_boosts"` to every expected step list in `tests/integration/` (today `migrate.test.ts`, `companyMigrations.test.ts`, and `lookupIndexes.test.ts:11`, whose `migrateToLatest` after `migrateBefore(db, "015")` then returns both 015 and 016)
- [ ] T016 Create `src/config/boostCarryOver.ts` exporting `withDescriptionBoosts(document: Record<string, unknown>): Record<string, unknown> | null` (T008 passes; its own module so production imports it, which knip's production pass requires), and `src/db/migrations/016_description_boosts.ts` exporting the migration `descriptionBoosts`, which imports it and whose `up(db: Kysely<unknown>)` uses `db.withTables<{ user_settings: { user_id: number; settings: unknown; updated_at: string } }>()`, selects `user_id`, `settings` ordered by `user_id`, parses each document with `z.record(z.string(), z.unknown())`, and for a non-null result runs `updateTable("user_settings").set({ settings: JSON.stringify(next) }).where("user_id", "=", id)`, leaving `updated_at` as it was; no `down`, no `sql` tag (research R2)
- [ ] T017 List `"016_description_boosts": descriptionBoosts` last in `MIGRATIONS` in `src/db/migrations/index.ts`
- [ ] T018 Confirm no search-key list needs `description_boosts` (checked 2026-11-04): `tests/resolveSettings.test.ts`'s `SEARCH_KEYS` lists only the keys in `FULL_CONFIG` (`tests/helpers/config.ts`, which leaves out `body_filter` too), and `tests/helpers/searchSettingsContract.ts`'s `DOCUMENT` is a sample; leave all three unchanged unless `npm run check` says otherwise

**Checkpoint**: both settings exist, sanitize, show and save; step 016 carries the owner's list over.

---

## Phase 3: User Stories 1–3 — matching (P1, P1, P2) 🎯 MVP

**Goal**: title boosts match titles only, description boosts descriptions only, each term once,
a term in both lists found in both places once at the higher value.

**Independent Test**: `tests/boosts.test.ts` on its own, then `tests/pageData.test.ts` for
Recommended with the two lists.

### Tests (write first; continue S1)

- [ ] T019 [US1] Unit tests (5) in new `tests/boosts.test.ts` (replacing `tests/titleBoost.test.ts`, whose 6 cases, cap and whole-word among them, move here inside T019–T021's counts, so about 10 of T019–T022's 16 are truly new): description boost `typescript: 10` on a description mentioning TypeScript four times → `points: 10`, one applied `{ term: "typescript", where: "description", points: 10 }`; title "TypeScript Developer" with a description never saying it → `points: 0`; a null description matches no description term; a Markdown link's address never matches, its words do; `boostLists` reads `title_boosts` and `description_boosts` from settings
- [ ] T020 [US2] Unit tests (3) in `tests/boosts.test.ts`: title boost `senior: 5` on "Senior Software Engineer" → `+5`, `where: "title"`; "Software Engineer" whose description says "senior engineers" → `0`; whole words only ("Nodejs Engineer" doesn't match `node`)
- [ ] T021 [US3] Unit tests (6) in `tests/boosts.test.ts`: `react` title 5 / description 10 found in both → one entry `where: "both"`, `points: 10`; title only → 5; description only → 10; title 10 / description 5 in both → 10; "React" in one list and "react" in the other are one term; "React" 5 and "react" 8 in the same list (stored before the save check compared normalized terms) are one term at 8; `boostedScore(95, …15)` is 100
- [ ] T022 [US3] Unit tests (3) in `tests/boosts.test.ts` for `maxBoost`: `{ title: { react: 5, senior: 5 }, description: { react: 10, go: 3 } }` → 18; `{ title: { React: 5, react: 8 }, description: {} }` → 8, never less than `appliedBoosts` gives any job; both empty → 0
- [ ] T023 [P] [US1] Unit tests (1 new, 2 changed) in `tests/pageData.test.ts`: rename the boost cases to the two lists (`title_boosts` for title matches, `description_boosts` for "boosts count matches in the description" and the Markdown case); add one where a job's real boost needs the combined `maxBoost` headroom to reach Recommended (SC-004)

### Implementation

- [ ] T024 [US1] Create `src/jobs/boosts.ts` (research R3, data-model In memory): `BoostLists`, `AppliedBoost`, `Boost` types; `boostLists(settings)` from `title_boosts` / `description_boosts` (used by `rowContext`, T025); `appliedBoosts(job: { title: string; description: string | null; description_format: DescriptionFormat | null }, lists)` matching with `hasWord` on `normalizeTitle(title)` and `normalizeTitle(readableDescription(...))`, grouping every entry of both lists by `normalizeTitle(term)` (within a list, the highest points of a group count; across lists, the higher of the two), with `applied` in title-list order then the rest of the description list; `boostedScore` (cap 100); `maxBoost(lists)` summing the same groups, built by the same helper so it can never fall below a real boost; update the purpose comment of `readableDescription` in `src/descriptions/readable.ts` ("the model and boosts read"); delete `src/jobs/titleBoost.ts` and `tests/titleBoost.test.ts` (T019–T022 pass)
- [ ] T025 [US1] Switch every caller to `src/jobs/boosts.ts`: `RowContext.boosts: BoostLists` and `scoreBoost` in `src/web/rowViews.ts`, `rowContext` (`boostLists(config.settings)`) and `recommendedJobs` (`maxBoost(lists)`, `appliedBoosts`) in `src/web/pageData.ts`, and `boostText` in `rowViews.ts` adapted to read `applied.map((boost) => boost.term)` so typecheck stays green until T027 replaces it (T023 passes)

**Checkpoint**: matching is right everywhere it's read and typecheck is green; the note still shows the old text (term names only) until US4.

---

## Phase 4: User Story 4 — see which boosts a job earned (P2)

**Goal**: the table note and the panel name each applied term, where it matched and its points.

**Independent Test**: `tests/jobDetail.test.ts` and the row-view tests, then the panel UI test.

### Tests (write first; continue S1)

- [ ] T026 [US4] Unit tests (4 new, 4 changed): new `tests/boostViews.test.ts` for `boostText` / `boostDetail`: senior +5 (title) and typescript +10 (description) → note part `+15 senior +5 (title), typescript +10 (description)` and `{ total: 15, lines: ["senior +5 (title)", "typescript +10 (description)"] }`; a both-places term reads `react +10 (title and description)`; no boost → `null` for both; a capped score (95 + 15) has `score.total` 100 while `boost.total` stays 15, with the boosts still listed. Change the four existing expectations to the new format: `tests/pageData.test.ts:43` (`"model 65 · +10 typescript"`), `:75` (`"… · +10 typescript"`), `:82` (`"model 62 · +5 terraform"`) and `tests/jobDetail.test.ts:40` (`boost: "+5 backend"` → `{ total: 5, lines: ["backend +5 (title)"] }`); these prove the format end to end, so `pageData.test.ts` gets no new note case (it is at 181 lines). Write after T023, which edits the same file

### Implementation

- [ ] T027 [US4] Create `src/web/boostViews.ts` with `boostText(boost): string | null` and `boostDetail(boost): BoostDetail | null`, built from `Boost.applied` alone (contracts/ui.md, data-model Display shapes); add `BoostDetail { total: number; lines: string[] }` to `src/web/api.ts` and make `ScoreDetail.boost: BoostDetail | null`; use them from `boostNote` in `src/web/rowViews.ts` (removing its old `boostText`) and `scoreDetail` in `src/web/jobDetail.ts` (T026 passes)
- [ ] T028 [US4] First update `tests/client/panelSections.test.tsx` to the new label "Boosts" with its lines, (UI, 1 changed; no new UI case, owner decision 2026-11-04: "none" is proved by T026's `boostDetail(null)` unit case); then in `web/components/panel/ScoreSection.tsx`, rename the fact to "Boosts" and show "none" or `+{total}` with one line per `lines` entry through a new `FactLines` in `web/components/panel/PanelSection.tsx` (the total, then a `<ul>` of the lines inside the `<dd>`; `Fact` unchanged)
- [ ] T029 S1 end: in the worktree run `npm run check` and `npm run check:db`, fix every finding, delete `.specify/sitting-in-progress`; commit only if the owner asks

**Checkpoint**: everything but the Settings layout is done and green.

---

## Phase 5: User Story 5 — edit both lists in Settings (P3)

**Goal**: two cards, Title boosts and Description boosts, in the Filters grid inside Scoring.

**Independent Test**: quickstart §3 on `myjobbot_dev_alt`, by hand (T035); no UI test is added in
this PR (owner decision, 2026-11-04).

### Sitting S2: the Settings cards

- [ ] T030 Create `.specify/sitting-in-progress` in the worktree naming S2
- ~~T031~~ Removed (owner decision, 2026-11-04: no UI tests are added in this PR). The cards' layout, per-card saves and Resets are checked by hand in T035; the save request with both lists is unit-tested in T007 (`sectionRequest`), and repeats per list in T007 (`repeatedBoosts`)
- [ ] T032 [US5] In `web/components/settings/BoostTags.tsx`, take `field: "title_boosts" | "description_boosts"` and `label` props instead of the hard-coded name, use them for the tag cloud label, the `Problems` field, the per-list input labels ("Title boost term", "Description boost points"), the per-list button labels ("Edit the title boost for senior", "Remove the description boost for react") and a confirm naming the list ("Remove the description boost for "react"?"), contracts/ui.md
- [ ] T033 [US5] Create `web/components/settings/BoostCards.tsx`: a Pico `<div className="grid">` of two `SettingCard`s, one per `BOOST_FIELDS` entry, each one `Setting` (label, default marker, Reset to `view.defaults[field]`) around `BoostTags` and `Problems` for its field, as `FiltersSection`'s groups are laid out
- [ ] T034 [US5] In `web/components/settings/ScoringSection.tsx`, make `useScoring` hold both lists (`lists: Record<BoostField, Boosts>`) and expose `changeBoosts(field)(next)`, which sets that list and autosaves all three fields; replace the single "Boosts" card with `<BoostCards view lists result onChange={changeBoosts} />` (props as contracts/ui.md), keep the Threshold card above it, and update the section's and hook's purpose comments
- [ ] T035 S2 end: `npm run check` and `npm run check:db` in the worktree; then quickstart §3 with the owner (`MYJOBBOT_PORT=8081 npm run web`, on `myjobbot_dev_alt` from the worktree's `.env`), required since T031 was removed: two cards in the grid, each saving and resetting its own list, a repeat refused on its card (US5, FR-010); delete the marker; commit only if the owner asks

**Checkpoint**: all five stories work.

---

## Phase 6: Polish & docs

### Sitting S3: docs and the PR

- [ ] T036 Create `.specify/sitting-in-progress` in the worktree naming S3
- [ ] T037 [P] In `README.md`, describe the two lists wherever `title_boosts` or "title boost" appears (Recommended row, the panel's Score facts, "The server does the deciding", the evals note "Title boosts are not applied" → "Boosts are not applied", the link-free copy note, and "Boosts and your choices adjust what's shown"), the Scoring list ("the match threshold and title boosts"), the settings table (a new `description_boosts` row beside `title_boosts`, whose text becomes "in the title"), the score-note example ("plus any boost"), and in `docs/superpowers/specs/2026-10-04-web-ui-design.md:73` "the largest possible title boost" → "the largest possible boost": title boosts match titles, description boosts descriptions, each term once, a term in both lists once at the higher value, carried over by step 016
- [ ] T038 [P] In `CLAUDE.md`, change "The model and title boosts read" (feature 012 line) to "The model and both boost lists read" and add `description_boosts` to the feature 015 list of search settings, then add a conventions line for boosts (feature 021): `title_boosts` (titles) and `description_boosts` (readable descriptions) in `user_settings`, matched only in `src/jobs/boosts.ts`, applied at display time, never stored per job, never seen by the run or the model; shown through `src/web/boostViews.ts`
- [ ] T039 Run quickstart.md §2 and tick its scenario table against the tests; note that FR-009 (no stored per-job boost) and FR-014 (the run and the model never see boosts) are covered indirectly, by the unchanged `tests/__snapshots__/prompt.test.ts.snap` and stores, and SC-005 only by hand (quickstart §3); for FR-015, `grep -rni "title boost" README.md CLAUDE.md docs/superpowers` and check that every hit left means titles only; fill in the ledger's final row
- [ ] T040 S3 end: `npm run check` and `npm run check:db` green in the worktree, delete the marker; when the owner asks, commit, push `021-title-description-boosts` and open the one PR (no attribution lines), noting in its body the test-database settings it also carries (`MYJOBBOT_TEST_DB_*`, `testEnvironment`, T002a) and that step 016 runs on production when the cluster first starts the merged image and listing quickstart §4's check
- [ ] T041 Once the feature is done, remind the owner to look at the panel's Boosts fact (`FactLines`, research R4) and tweak its layout as they want

---

## Dependencies & Execution Order

- **Setup (T001–T002a)** → **Foundational (T003–T018)** → **US1–US3 (T019–T025)** → **US4
  (T026–T029)** → **US5 (T030–T035)** → **Polish (T036–T041)**.
- T009 before T010–T012 (types); T011 before T012–T014; T015 (its test) before T016–T017; T016 before T017.
- T024 before T025; T025 before T027 (new `Boost` shape); T027 before T028.
- T014 keeps scoring saves whole until T034 replaces the card.
- Stories: US1–US3 share `boosts.ts` (one implementation task, T024); US4 needs T024; US5 needs
  only the Foundational phase and could run before US4.

## Parallel Opportunities

- T004–T008 (different test files) together.
- T023 alongside T019–T022 once T009 is in (T019–T022 share `tests/boosts.test.ts`, so they are written in sequence; T026 edits `pageData.test.ts` after T023).
- T037 and T038 together.

```text
# S1, tests first
T004 tests/config.test.ts      T005 tests/searchSettings.test.ts   T006 settingsSections/settingsView
T007 apply/problems/save       T008 tests/boostCarryOver.test.ts
# US1–US3 tests
T019 / T020 / T021 / T022 tests/boosts.test.ts (one file: write in sequence)   T023 tests/pageData.test.ts
```

## Implementation Strategy

- **MVP**: S1 (Foundational + US1–US4): correct matching and explanations with both lists, settings
  saved by the existing Scoring card (description list carried over, editable once S2 lands).
- **Then** S2 (US5 layout) and S3 (docs), all in the one PR.

## Test ledger (constitution Principle II)

| Point | Unit | Integration | UI |
|-------|------|-------------|----|
| Baseline (T002, on `main` 359b111) | 889 (+4 from the test-database settings, 893) | 67 (+1 skipped: real browser) | 64 |
| S1 adds/changes | ~35 new (6 of them moved from the deleted `titleBoost.test.ts`) + 9 changed (T004–T008, T019–T023, T026) | 1 new + 3 files' step lists (T015) | 2 changed (T014, T028) |
| S2 adds | 0 | 0 | 0 (T031 removed) |
| Final (T039) | — | — | — |

New cases ≈ 35 unit (29 net of the moved ones) / 1 integration / 0 UI, about 97/3/0, so the suite moves toward the 95/4/1
target (UI share falls from about 6.3%). No UI test is added in this PR (owner decision,
2026-11-04); T014 and T028 only update two existing UI cases the change would otherwise break.
