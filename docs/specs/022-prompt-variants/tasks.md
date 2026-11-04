---

description: "Tasks for feature 022: prompt variants"
---

# Tasks: Prompt variants

**Input**: Design documents from `docs/specs/022-prompt-variants/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/eval-cli.md, quickstart.md

**Tests**: required by the constitution (Principle II); each test task names its kind and count.

**Organization**: one phase per user story, all in **one sitting, S1, and one PR** (owner decision,
2026-11-04: "do it all in one sitting").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1 export, US2 variant runs, US3 refusals, US4 diff, US5 series

## Sitting S1 (the whole feature, PR 1)

- Changes `src/agent/rubric.ts` and `src/rescore/prompt.ts` (the run and re-score path) and the CLI
  the container runs: the Docker stack is **stopped** (`docker compose stop`) from T001 until the
  PR merges (not UI work; constitution 2.4.0).
- `.specify/sitting-in-progress` is created in T001 and deleted in T024, once `npm run check` and
  `npm run check:db` are green; commit and PR only when the owner asks.
- Every new export is reached from `src/evals/command.ts` by the end of the sitting (knip's
  production pass); tests come before the code they cover.
- New modules keep files under 200 lines: series schemas in `src/evals/seriesFormat.ts` (not
  `format.ts`, 146 lines) and variant and series file access in `src/evals/experimentFiles.ts` (not
  `files.ts`, 141 lines).

---

## Phase 1: Setup

- [x] T001 Stop the Docker stack, create `.specify/sitting-in-progress` naming "S1: 022 prompt variants", record the baseline counts (unit 867, integration 67, UI 64) in the ledger

---

## Phase 2: Foundational: one template, one fill function

**Purpose**: research R2; everything a variant does goes through the same fill as the code.

- [x] T002 Write unit tests (2) in `tests/promptTemplate.test.ts`: `fillTemplate(template, rubricValues(config, markers))` replaces every `{data}`, `{threshold}` and `{preferences}` in one pass, so preferences holding the text `{threshold}` stay as written, and `rubricValues` gives `(none given)` for empty or blank preferences, as `scoringRubric` does today; `fillTemplate(rescoreSystemTemplate(), …)` equals today's re-score system message for a test config, with preferences and with none, and `scoringRubric` is unchanged (the run prompt snapshot in `tests/__snapshots__/prompt.test.ts.snap` must not change)
- [x] T003 In `src/agent/rubric.ts` add `rubricValues(config, markers)` (the data sentence, the threshold as text, and `preferences.trim() || "(none given)"`, the one place that rule lives) and `fillTemplate(template, values)` (one regex `/\{(data|threshold|preferences)\}/g`), and route `scoringRubric` through both; export the raw `RUBRIC` template's text via a function; in `src/rescore/prompt.ts` export `rescoreSystemTemplate()` (`STEPS + RUBRIC`) and build `rescoreMessages`' system message with `fillTemplate`, the user message unchanged

**Checkpoint**: `npm run check` green with the snapshot untouched.

---

## Phase 3: User Story 1 - Start a variant from today's prompt (P1) 🎯 MVP

**Goal**: FR-001–FR-003, FR-011. **Independent Test**: quickstart §1.

- [x] T004 [P] [US1] Write unit tests (4) in `tests/evalVariant.test.ts` for `src/evals/variant.ts`: `formatVariant`/`parseVariant` round-trip a header (`schema: 1`, `exportedAt` ISO time, `exportedFrom` 16 hex, `gitCommit` string or `null`) and keep the body byte for byte; a missing closing `---`, a header line that isn't `key: value`, an unknown key or `schema: 2` is refused naming the problem (`needs upgrade (schema 2)`); `markerProblems(text)` gives `missing {data}`, `missing {threshold}`, `missing {preferences}` and `unknown marker {thresold}` for each that applies, none for today's template; `variantName` accepts `[a-z0-9][a-z0-9-]{0,39}`, refuses `Big One`, `a/b` and the reserved `code`
- [x] T005 [P] [US1] Write unit tests (2) in `tests/evalVariantCommand.test.ts` for `eval prompt export` over the memory port: it writes `evals/variants/<name>.md` whose body is `rescoreSystemTemplate()` and whose `exportedFrom` is its content id, printing `exported variant <name> · N lines · from prompt <id>`; an existing variant is left alone (`exists: <name>`) unless `--fresh`
- [x] T006 [US1] Write a unit test (1) in `tests/evalCheck.test.ts`: `eval check` counts variants, series and series runs, names a variant file that doesn't parse, and lists a variant whose body fails `markerProblems` as `bad: variants/<name>.md: missing {data}`
- [x] T007 [US1] Create `src/evals/variant.ts` (`parseVariant`, `formatVariant`, `markerProblems`, `variantName`, the header's zod schema) and `src/evals/experimentFiles.ts` (`variants()` returning `{ items, bad }`, `variant(name)`, `writeVariant` through `.tmp` + rename, rooted under `evals/`)
- [x] T008 [US1] Create `src/evals/variantCommand.ts` with `eval prompt export <name> [--fresh]`; wire `prompt` (subcommands `export`, `diff`) in `src/evals/command.ts`; extend `src/evals/check.ts` with the variant counts and problems (series counts come with T021)

---

## Phase 4: User Story 2 - Run the cases with a variant (P1)

**Goal**: FR-006, FR-006a, FR-007, FR-008a, FR-009, FR-012. **Independent Test**: quickstart §2.

- [x] T009 [P] [US2] Write unit tests (2) in `tests/evalVariantRun.test.ts` over the memory port and `usageChat`: `eval run --variant short` scores every attempt with the variant's text (the stored prompt is the variant filled per profile, differing from a plain run's) and records `variant: "short"`, `promptChanged: false`; a variant whose `exportedFrom` isn't today's template id still runs, prints `warning: the code's prompt has changed since short was exported` and records `promptChanged: true`
- [x] T010 [P] [US2] Write a unit test (1) in `tests/evalReport.test.ts`: the report header adds `· variant short` and `· prompt changed since export`, and a run without the new fields (an old 020 run) reads as the code's prompt
- [x] T011 [US2] In `src/evals/format.ts` give the run schema `variant: z.string().nullable().optional()` and `promptChanged: z.boolean().optional()` (old files stay valid); in `src/evals/session.ts` let `promptFor` and `scoreCase` take an optional template (the code's by default) filled through `fillTemplate` and `rubricValues`; split `src/evals/runCases.ts` into the argument parsing and an exported `executeRun(options, deps)` (options `{ tags, ids, repeats, model, variant }`, already parsed; returns the run and its results), which `eval run` calls and the series (T020) reuses; read `--variant`, load it and check it with T013's `variantRefusal`, warn on drift, record both fields; in `src/evals/reportText.ts` show them in the header

---

## Phase 5: User Story 3 - Refuse a variant that drops a safeguard (P1)

**Goal**: FR-008. **Independent Test**: quickstart §2's refusal.

- [x] T012 [P] [US3] Write unit tests (2) in `tests/evalVariantRun.test.ts`: `eval run --variant` with a variant missing `{data}` and holding `{thresold}` is refused with `refused variant <name>: missing {data}, unknown marker {thresold}` and exit 1, and the scripted model is never called; a variant that doesn't exist, or a bad name, is refused the same way
- [x] T013 [US3] Create `variantRefusal(experimentFiles, name)` in `src/evals/variant.ts` (null, or the refusal line naming each problem: missing, unparseable, bad name, `markerProblems`), written before T011 uses it; `executeRun` calls it before `started()`

---

## Phase 6: User Story 4 - See what changed between two variants (P2)

**Goal**: FR-010. **Independent Test**: quickstart §3.

- [x] T014 [P] [US4] Write unit tests (2) in `tests/evalLineDiff.test.ts` for `lineDiff(a, b)` in `src/evals/lineDiff.ts`: two edited lines among 50 give one `@@ line N` group with exactly those `- `/`+ ` lines and no unchanged lines; identical texts give no groups; a line added at the end and one removed at the start each show alone
- [x] T015 [US4] Create `src/evals/lineDiff.ts` (longest common subsequence over lines) and add `eval prompt diff <a> <b>` to `src/evals/variantCommand.ts` (`code` names `rescoreSystemTemplate()`; prints `--- a`, `+++ b`, the groups, or `no differences`)

---

## Phase 7: User Story 5 - Run a series of tests and compare them together (P2)

**Goal**: FR-006b–FR-006d. **Independent Test**: quickstart §4.

- [x] T016 [P] [US5] Write unit tests (2) in `tests/evalSeries.test.ts` for `src/evals/seriesFormat.ts` and `eval series save`: a series parses with `tags`, `cases`, `repeats` (1..20), 1..10 `tests` each `{ label, variant: string | null, model: string | null }` with labels `[a-z0-9][a-z0-9-]{0,39}` and unique, and `createdAt`; `--test now=code --test short=short-rubric --test big=short-rubric@llama3` saves those three tests, a repeated label, a bad label or no `--test` is refused, an existing series is kept unless `--fresh`
- [x] T017 [P] [US5] Write unit tests (2) in `tests/evalSeries.test.ts` for `eval series run`: a series naming a missing or refused variant is refused before any model call, naming the test and problem; a series of two tests runs them in order as two ordinary runs over the same cases and repeats (the second on its own model), the series run's record is written with every test `null` and `endedAt: null` before the first and filled in after each; running the series a second time writes a second series-run record with new run ids
- [x] T018 [P] [US5] Write unit tests (2) in `tests/evalSeriesReport.test.ts` for `src/evals/seriesReport.ts`: per test its label, variant (or `code`), model, pass rate, tokens and time, matching each run's own `summarize`; cases whose states differ between tests come first; a test whose run is `null` shows `not run`, and a drifted variant shows `(prompt changed since export)`; no description text appears
- [x] T019 [US5] Create `src/evals/seriesFormat.ts` (series and series-run schemas per data-model.md) and add `series()`, `seriesRuns()`, `writeSeries`, `writeSeriesRun` to `src/evals/experimentFiles.ts`
- [x] T020 [US5] Create `src/evals/series.ts`: `eval series save` (parses `--test <label>=<variant|code>[@model]`) and `eval series run` (checks every test first with `variantRefusal`, then calls `executeRun` per test with the series' tags, cases and repeats and the test's variant and model, writing the series run record before and after each; every `series run` makes a new series-run record and new runs, never resuming)
- [x] T021 [US5] Create `src/evals/seriesReport.ts` (pure tables) and `eval series report <name> [--run <id>]` (latest series run by default); wire `series` (subcommands `save`, `run`, `report`) in `src/evals/command.ts`; add series and series-run counts to `src/evals/check.ts`

---

## Phase 8: Polish

- [x] T022 [P] README "Evals": a "Prompt variants and series" part (export, edit, run with `--variant`, diff, series save/run/report; the three markers; the drift warning; promoting a winner is a normal code change)
- [x] T023 [P] CLAUDE.md: extend the evals paragraph (one template filled by `fillTemplate` for the code and every variant; a variant needs `{data}`, `{threshold}` and `{preferences}` and nothing else; variants and series live in `data/evals/`; nothing a variant does reaches scheduled runs or Re-score) and the Commands line
- [x] T024 Run `npm run check` and `npm run check:db` until green; quickstart §1–§5 with the real model in a scratch data folder; fill the ledger's last row; delete the marker; when the owner asks, commit and open the PR; restart the stack once it merges

---

**As built:**
- `rubricTemplate()` exposes the rubric's raw template; `rescoreMessages` takes an optional template,
  filled through `fillTemplate` and `rubricValues`. Before and after the refactor the re-score's
  messages were compared byte for byte (identical), and the run prompt snapshot is unchanged.
- The variant check is `loadVariant` in its own `src/evals/variantCheck.ts` (it needs
  `ExperimentFiles`, which imports `variant.ts`).
- Series and series runs are read and written through 020's `EvalFiles` (`series()`,
  `seriesRuns()`, `writeSeries`, `writeSeriesRun`), their schemas in `seriesFormat.ts` registered
  with `parseFile`, rather than through `experimentFiles.ts`, which holds only variants: the same
  readers, versioning and `.tmp` writes, no copy.
- `seriesReport` (the command) and its tables live in `seriesReport.ts`; `aligned`, `shortened` and
  `duration` are shared from `reportText.ts`, `contextOf` from `reportCommand.ts`.
- `eval series save` doesn't check a test's variant; `eval series run` does, before any model call.
- Quickstart §1–§4 against the real model on two real cases in a scratch folder: an unedited
  export scored with the same stored prompt id as the code (63bc878fda5e5d59, also 020's), the
  diff showed the one edited line, a variant without `{data}` and a series using it were refused,
  a strict variant's run and a two-test series reported side by side; §5 by the byte comparison
  and the snapshot. Tests: 22 unit, as planned.

## Added during the sitting (owner request, 2026-11-04)

- [x] T025 Add migration `src/db/migrations/015_lookup_indexes.ts` (listed in `src/db/migrations/index.ts`): `jobs_by_job_id` on `jobs (job_id)`, since `findJob`, `flagInjection` and `recordVerdict`'s `select … for update` and update look jobs up by `job_id` alone, which the `(ats, job_id)` primary key can't serve (each read every row, and the `for update` locked them all); and `verdicts_by_job` on `verdicts (ats, job_id, scored_at)` for `jobVerdicts`. Indexes rather than passing `ats`, since the model's tools name a job by `job_id` alone. Integration test (1) in `tests/integration/lookupIndexes.test.ts`; the migration-name lists in `tests/integration/migrate.test.ts` and `companyMigrations.test.ts` gain the step.

## Dependencies & Execution Order

- T001 → T002–T003 (foundation) → US1 (T004–T008) → US2/US3 (T009–T013, they share `runCases`; T013's `variantRefusal` is written before T011's `executeRun` calls it) →
  US4 (T014–T015) and US5 (T016–T021, needs US2's variant runs) → polish (T022–T024).
- Within each story, its tests come first and fail first.

## Parallel Opportunities

- T004 and T005; T009, T010 and T012; T014; T016–T018; T022 and T023.

## Implementation Strategy

- **MVP**: Phases 2–5 (export, run with a variant, refusals): change the words, measure the change.
- **Then**: the diff and the series, in the same sitting and PR.

## Test ledger (constitution Principle II, target 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (2026-11-04, T001) | 867 (86.87%) | 67 (6.71%) | 64 (6.41%) |
| Planned new | 22 (T002 2, T004 4, T005 2, T006 1, T009 2, T010 1, T012 2, T014 2, T016 2, T017 2, T018 2) | 0 | 0 |
| Planned removed | 0 | 0 | 0 |
| Planned after | 889 (87.16%) | 67 (6.57%) | 64 (6.27%) |
| After the PR (T024, T025) | 889 (87.08%) | 68 (6.66%) | 64 (6.27%) |

## Notes

- Never print `.env`; evals write only `data/evals/`; scheduled runs and Re-score keep the code's
  prompt.
