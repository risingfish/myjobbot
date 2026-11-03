---

description: "Tasks for feature 020: scoring evals"
---

# Tasks: Scoring evals

**Input**: Design documents from `docs/specs/020-scoring-evals/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/eval-cli.md, quickstart.md

**Tests**: required by the constitution (Principle II); each test task names its kind and count.

**Organization**: one phase per user story; work is done in sittings, one sitting per PR.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1 capture, US2 labels, US3 run, US4 report

## Sittings

- Every sitting changes code the `myjobbot` container runs from this checkout (`src/cli.ts`,
  `src/db/`, `src/rescore/`), so the Docker stack is **stopped** (`docker compose stop`) from
  T001 until the feature merges, the docs sitting included (not UI work; constitution 2.4.0).
- Each sitting's first task creates `.specify/sitting-in-progress` naming it; its last task runs
  `npm run check` and `npm run check:db` until green, deletes the marker, and commits and opens
  the PR only when the owner asks.
- Every export is reached from `src/cli.ts` in the sitting that creates it (knip's production
  pass): store writers and id functions arrive with their first callers.

---

## Phase 1: Setup

- [x] T001 Stop the Docker stack (`docker compose stop`), create `.specify/sitting-in-progress` naming S1, and record the baseline counts (unit 817, integration 64, UI 64) in the ledger

---

## Phase 2: Foundational: the format (S1, PR 1)

**Purpose**: the owner's first request, the data schema with its files and validation (FR-009,
FR-016), reached from production through `eval check`. Only the readers are built here.

### Sitting S1: format, readers and `eval check` (PR 1)

#### Tests (S1)

- [x] T002 [P] Create `tests/helpers/memoryFilePort.ts`: an in-memory `FilePort` (`read`, `write`, `append`, `list`, `rename`, `exists`) over a `Map<string, string>`, a missing folder listing as empty, recording writes in order
- [x] T003 [P] Write unit tests (6) in `tests/evalFormat.test.ts` for `src/evals/format.ts`: a full profile, case, label, prompt (`{schema, text}`), run and result parse; each refuses unknown fields (strict); a `schema` other than 1 is told apart as "needs upgrade (schema N)"; a case refuses `shiftedDays` ≠ `daysOpenAtCapture − daysOpenAsScored`, `job.days_open` ≠ `daysOpenAsScored`, and a shift other than 0 with `observed: null`; a label refuses verdict `maybe`, a score range breaking "0..100, min ≤ max" (`{min: 90, max: 80}`, `{min: -1, max: 5}`), base/bonus outside "0..50", more than 10 `mustMention` words or one over 60 chars, a note over 2,000 chars; tags must be `[a-z0-9-]{1,40}`, ≤ 20; a run needs ≥ 1 case and ≥ 1 `prompts` entry and `repeats` 1..20; a result refuses `failure` outside `no_record | invalid_tool_call | timed_out | model_error` and `attempt` < 1
- [x] T004 [P] Write unit tests (3) in `tests/evalFiles.test.ts` for the readers of `EvalFiles` (`src/evals/files.ts`) over the memory port: reading each kind returns the good items and `bad` entries naming each file (one broken JSON, one schema failure, one `schema: 2`, one file whose `id` differs from its name), each problem made only of zod issue paths and codes (e.g. `job.days_open: invalid_type`), never the file's text; `runs/<id>/results.jsonl` with a bad line reports `results.jsonl:<line>` and keeps the others; a missing `evals/` folder lists every kind as empty
- [x] T005 Write unit tests (2) in `tests/evalCheck.test.ts` for `checkEvals(files)` in `src/evals/check.ts`: counts per kind and `bad:` lines per contracts/eval-cli.md, exit 1 when any is bad and 0 when none; a label with no case and a case naming a missing profile are reported `orphaned`
- [x] T006 Write an integration test (1) in `tests/integration/evalFiles.test.ts`: `nodeFilePort` in a fresh `os.tmpdir()` folder writes (creating parent folders), lists, appends, renames and reads back, and a missing folder lists as empty

#### Implementation (S1)

- [x] T007 [P] Create `src/evals/format.ts`: strict zod schemas and types for Profile, Case, Label, Prompt, Run and Result exactly per data-model.md (rules quoted there; `schema: z.literal(1)`), the cross-field rules of T003 as `superRefine`s, and `problemOf(error)` (paths and codes only)
- [x] T008 [P] Create `src/evals/filePort.ts`: the `FilePort` interface and `nodeFilePort(root)` over `node:fs/promises` (plain `write` creating parent folders, `append`, `rename`, `list` empty on ENOENT), rooted at the data folder
- [x] T009 Create `src/evals/files.ts` with the readers only: `profiles()`, `cases()`, `labels()`, `prompts()`, `runs()`, `results(runId)`, each returning `{ items, bad }`, files under `evals/`
- [x] T010 Change `main` in `src/cli.ts` to take the command name without parsing flags and pass the raw remaining arguments on (research R12); `run`, `rescore` and `import-sqlite` parse their own positionals as before (their usage errors still exit 2); add `COMMANDS.eval` with a subcommand table and `eval check` (`src/evals/check.ts`, `checkEvals(files): { lines, code }`, the port rooted at `MYJOBBOT_DATA_DIR`); update `USAGE`
- [x] T011 Run `npm run check` and `npm run check:db` until green; quickstart §1; delete the marker; when the owner asks, commit S1 and open PR 1

**As built (S1):** the `FilePort` has no `exists` (a missing file reads as null) and `list` gives the names in a folder, sorted. A file's problem names its first zod issue only (`path: code`), so the message is stable and never holds file text; a missing `schema` field is an ordinary issue, any other version "needs upgrade". The `eval` subcommands live in a table in `src/evals/command.ts` (not in `src/cli.ts`); `main` passes the raw arguments on and wraps `run`, `rescore` and `import-sqlite` in `positional()`, which still refuses flags. Fixtures are shared in `tests/helpers/evalFixtures.ts`. Tests: 11 unit (T003 6, T004 3, T005 2) and 1 integration, as planned.

**Checkpoint**: PR 1. The format exists, is validated, and is reachable.

---

## Phase 3: User Story 1 - Capture real jobs as cases (P1) 🎯 MVP

**Goal**: freeze chosen stored jobs as cases (FR-001–FR-006, FR-005a).

**Independent Test**: quickstart §2.

### Sitting S2: `eval capture` (PR 2)

- [ ] T012 [US1] Create `.specify/sitting-in-progress` naming S2; move `CareersStore` and `AuditEntry` from `src/db/store.ts` to `src/db/careersStore.ts`, updating imports, with no behaviour change (`npm run check` green before going on)

#### Tests (S2)

- [ ] T013 [P] [US1] Write unit tests (3) in `tests/evalIds.test.ts` for `src/evals/ids.ts`: `caseId("greenhouse", "4012345")` is `greenhouse-4012345`; a job id with `/`, starting with `-`, or over 80 chars becomes `<ats>--<16 hex>`, stable across calls; `contentId` of two objects with the same fields in a different key order is equal
- [ ] T014 [P] [US1] Write unit tests (1) in `tests/evalFileWrites.test.ts` for the profile and case writers of `EvalFiles` over the memory port: a write goes to `<name>.tmp` then `rename`, and writing a profile that exists changes nothing
- [ ] T015 [P] [US1] Write unit tests (3) in `tests/evalCapture.test.ts` for `asScoredDates(...)` in `src/evals/capture.ts`: first seen 19 days before capture and scored 7 days and 5 hours before it gives 12 days as scored, shift 7, the ghost flag from 12; first seen at day 0, scored at day 0.6, captured at day 1.5 gives 0 as scored and 1 at capture (whole days as a run counts them); no observed score, or an observed score after the capture (clock skew), gives the capture age and shift 0, and an as-scored age below 0 (first seen after the score) is clamped to 0 with the ghost flag from 0
- [ ] T016 [P] [US1] Write unit tests (6) in `tests/evalCapture.test.ts` for `buildCase(input)` in `src/evals/capture.ts` (pure: the payloads at capture and as scored, the row's ats, title and company, the latest verdict, the profile id, the description arrival, the observed read, `capturedAt`, tags): `job` is the as-scored payload; `observed` copies the verdict's parts, reasons, gaps, `scoredAt`, run and read; a never-scored job has `observed: null`, its age at capture and shift 0; a careers description found after the verdict sets `descriptionChangedSinceScored`, one found before doesn't; a job with no description is a valid case with `"(none provided)"`; `profileOf(settings, resume)` gives the same id for the same resume, preferences and thresholds
- [ ] T017 [P] [US1] Write unit tests (2) in `tests/evalObservedRead.test.ts` for `observedRead(lines, jobId)` in `src/evals/observedRead.ts`: a run trace with an assistant `get_job_details` call whose `job_id` is that id (as a string or as a number) gives `details`, one without gives `summary`; a re-score trace (a `rescore` event for the job) with a `get_job` call gives `details`; no trace gives `unknown`
- [ ] T018 [P] [US1] Add a case to `tests/helpers/careersStoreContract.ts` for `descriptionFoundAt(key)`: the latest `finish`/`found` audit row's time for that job, null when none or for another job (unit 1 on memory, integration 1 on MariaDB)
- [ ] T019 [P] [US1] Add a case to `tests/helpers/storeContract.ts` for `JobViews.recentlyScored(limit)`: distinct job keys ordered by their latest verdict, newest first, a job re-scored twice appearing once, a cleared score (`clearScore`) still counting by its verdicts, and the limit applied (unit 1 on memory, integration 1 on MariaDB)
- [ ] T020 [US1] Write unit tests (1) in `tests/evalCapture.test.ts` for `captureCommand` over memory stores and the memory port: capturing an existing case reports `exists:` and leaves the file unchanged unless `--fresh`; `--recent 2` captures the two most recently scored jobs; an unknown job, or a job id under another `ats`, prints `unknown job` and exits 1; the note of research R13 prints once

#### Implementation (S2)

- [ ] T021 [US1] Add `descriptionFoundAt(key): Promise<string | null>` to `CareersStore` (`src/db/careersStore.ts`), the Kysely store (`selectFrom("careers_audit")`, `step = 'finish'`, `outcome = 'found'`, max `at`), the memory store and `loggedCareers` (`src/rescore/traceSteps.ts`); add `recentlyScored(limit): Promise<JobKey[]>` to `JobViews` (`src/db/store.ts`), the Kysely views (distinct keys by max `verdicts.scored_at`) and the memory views
- [ ] T022 [P] [US1] Create `src/evals/ids.ts` (`caseId`, `contentId` over canonical JSON with sorted keys) and `src/evals/observedRead.ts` (reads `runs/*-<runId>.jsonl` through the port when present)
- [ ] T023 [US1] Create `src/evals/capture.ts` (`asScoredDates` with the guards of research R4: a score after the capture uses the capture payload with shift 0, an as-scored age below 0 is clamped to 0 with `possible_ghost` recomputed; `buildCase`, `profileOf`) and add the profile and case writers (`.tmp` then `rename`) to `src/evals/files.ts`
- [ ] T024 [US1] Create `src/evals/captureCommand.ts`: `parseArgs` (`<ats> <job_id>` or `--recent N` 1..200, `--tag` repeated, `--fresh`); reads the row through `JobStore.findJob` checking its `ats`, the latest verdict through `JobViews.jobVerdicts`, the resume and settings through `settingsForRun`, `jobDetails` twice (`now = capturedAt` and `now = scoredAt`, research R4), `descriptionFoundAt` and `observedRead`; writes the profile once and the case; prints per contracts/eval-cli.md; wire `eval capture` in `src/cli.ts`
- [ ] T025 [US1] Run `npm run check` and `npm run check:db` until green; quickstart §2 on real jobs (read-only on the database); delete the marker; when the owner asks, commit S2 and open PR 2

---

## Phase 4: User Story 2 - Label cases on one scale (P1)

**Goal**: FR-007.

**Independent Test**: quickstart §3.

### Sitting S3: `eval label` (PR 3)

- [ ] T026 [P] [US2] Create `.specify/sitting-in-progress` naming S3; write unit tests (4) in `tests/evalLabel.test.ts` for `src/evals/label.ts`: `parseLabelArgs` turns `recommend --score 65-85 --bonus 25-40 --mention TypeScript --note "…"` into a label; a range `90-80`, `x-5` or outside its limits is refused with a message naming the flag; `relabeled(old, next)` puts the old label (without `history`) first in `history`, keeping at most 50; `rangeWarning(label, threshold)` warns for `recommend 65-85` at 70 and not for `recommend 70-85`; labeling a case id with no case file is refused
- [ ] T027 [US2] Create `src/evals/label.ts` (`parseLabelArgs`, `relabeled`, `rangeWarning`, `labelCommand`), add the label writer to `src/evals/files.ts`, and wire `eval label` in `src/cli.ts`
- [ ] T028 [US2] Run `npm run check` and `npm run check:db` until green; quickstart §3; delete the marker; when the owner asks, commit S3 and open PR 3

---

## Phase 5: User Story 3 - Run the cases against the model (P2)

**Goal**: FR-010, FR-011.

**Independent Test**: quickstart §4, and T031–T033 with a scripted model.

### Sitting S4: `eval run` (PR 4)

#### Tests (S4)

- [ ] T029 [P] [US3] Create `.specify/sitting-in-progress` naming S4; create `tests/helpers/usageChat.ts`: `usageChat(replies, usage)` gives a `makeChat(responseLog)` that answers from `scriptedChat` and writes `{ type: "llm_response", response: { usage } }` per reply (usage omitted when not given)
- [ ] T030 [P] [US3] Write unit tests (5) in `tests/evalJudge.test.ts` and `tests/evalIds.test.ts`: `judge(label, attempt, threshold)` per research R8 (recommend at 60 with threshold 60 passes, at 59 fails; borderline passes within 10 points either side; zero only at 0; a range or a `mustMention` word missing from reasons and gaps, case-insensitive, fails a passing verdict; a failed attempt never passes; no label gives null) in 4 tests; `runId(date, random)` is `yyyymmdd-hhmmss-<4 hex>` and sorts by time (1)
- [ ] T031 [P] [US3] Write unit tests (1) in `tests/evalFailure.test.ts` for `failureOf(result, tally)` in `src/evals/failure.ts`: a recorded verdict gives null; a reason starting `LLM error:` gives `model_error`; wall-clock exhaustion gives `timed_out`; calls that all failed give `invalid_tool_call`; anything else gives `no_record`
- [ ] T032 [P] [US3] Write unit tests (3) in `tests/evalSession.test.ts` for `scoreCase(caseFile, profile, deps)` in `src/evals/session.ts` with `usageChat`: a model that calls `get_job` then `record_matches` gives the parts, reasons and gaps, the `get_job` result being the case's `job` with its frozen `days_open`, wrapped in markers built from a random id (not the run id); an alert-only case (`"(none provided)"`, ats `linkedin`) gets the "scored from the alert only" gap; tokens are summed from the session's usage, null when the replies carry none
- [ ] T033 [P] [US3] Write unit tests (3) in `tests/evalRunCases.test.ts` for `runCases(args, deps)` in `src/evals/runCases.ts` over the memory port and `usageChat`: `--tag` and `--case` select cases and an empty selection is refused (exit 1); `--repeats 2` over 2 cases appends 4 results, a failing attempt in the middle doesn't stop the rest, each judged against the label as it is at run time; `run.json` is written with `endedAt: null` before the first attempt and its `endedAt` set at the end, with one `prompts` entry per profile used
- [ ] T034 [US3] Extend `tests/toolDeclarations.test.ts` (0 new) so the eval `get_job` is listed as declaring `outsideText: true`

#### Implementation (S4)

- [ ] T035 [US3] Export `oneJobAgentDeps` from `src/rescore/session.ts` (the re-score's 6 steps and 3 minutes) and use it in the re-score (no behaviour change; the re-score tests stay green)
- [ ] T036 [US3] Create `src/evals/judge.ts`, `src/evals/failure.ts`, `runId` in `src/evals/ids.ts`, and `src/evals/session.ts` (`scoreCase`: `runAgent` with `rescoreMessages` from the profile, `oneJobAgentDeps`, markers from `randomUUID()`, tools `get_job` returning the case's `job` with `outsideText: true` and `record_matches` over a one-case store whose `findJob` returns a minimal row and whose `flagInjection` only records; tokens from `makeChat`'s response log; the trace to `runs/<id>/trace.jsonl`)
- [ ] T037 [US3] Add the prompt, run and result writers to `src/evals/files.ts`; create `src/evals/runCases.ts` (`eval run` per contracts/eval-cli.md: `parseArgs` `--tag`, `--case`, `--repeats` 1..20, `--model`; prompts per profile with markers replaced by `{open}`/`{close}`; `gitCommit` from `git rev-parse HEAD` or null; one line per attempt and the summary; never a writing store) and wire `eval run` in `src/cli.ts` with `makeChat = (log) => createChat(env, log)`
- [ ] T038 [US3] Run `npm run check` and `npm run check:db` until green; quickstart §4 with the real model; delete the marker; when the owner asks, commit S4 and open PR 4

---

## Phase 6: User Story 4 - Read a run's report (P2)

**Goal**: FR-012, FR-013.

**Independent Test**: quickstart §5.

### Sitting S5: `eval report` (PR 5)

- [ ] T039 [P] [US4] Create `.specify/sitting-in-progress` naming S5; write unit tests (5) in `tests/evalReport.test.ts` for `src/evals/report.ts` and `reportText.ts`: pass rate, labeled count, and token and time totals per case and per run from known results; spread per case and `unstable` when pass states are mixed or the range is ≥ 10; against another run, moves (pass state changed, or medians ≥ 5 apart), fixed and broken counts, and the change in pass rate, tokens and time; against observed, cases with `read ≠ details` or a changed description left out and counted by reason; the text names title and company, never `job.description`, adds reasons and gaps only with `--reasons`, shows a run with `endedAt: null` as unfinished and notes a label changed since the run
- [ ] T040 [US4] Create `src/evals/report.ts` (pure summaries) and `src/evals/reportText.ts` (lines per contracts/eval-cli.md), and wire `eval report <run-id> [--against <run-id>|observed] [--reasons]` in `src/cli.ts`
- [ ] T041 [US4] Run `npm run check` and `npm run check:db` until green; quickstart §5–§6; delete the marker; when the owner asks, commit S5 and open PR 5

---

## Phase 7: Polish

### Sitting S6: documentation (PR 6, stack stopped)

- [ ] T042 [P] Create `.specify/sitting-in-progress` naming S6; add an "Evals" section to `README.md` (what a case, label, run and report are; the five commands; data in `data/evals/`, never in git; evals call the real model and aren't part of the checks) and a Commands entry
- [ ] T043 [P] Add an evals paragraph to `CLAUDE.md` (`src/evals/` knows nothing of Next.js; files only through `EvalFiles` over a `FilePort`, every file `schema: 1` and strict; cases replay the re-score path with a frozen `get_job`, markers from a random id; capture only reads the database; reports never print description text) and the commands
- [ ] T044 Fill the ledger's last row, run `npm run check` and `npm run check:db`, delete the marker; when the owner asks, commit S6 and open PR 6; restart the stack once the feature has merged

---

## Dependencies & Execution Order

- S1 → S2 → S3 → S4 → S5 → S6, each PR merged before the next (small PRs).
- S2 needs S1's format and readers; S3 needs S2's cases to label; S4 needs S1–S3 (judging reads
  labels); S5 needs S4's results.
- Within a sitting, its tests come first and fail first.
- First production callers (knip's production pass): `format`, `filePort`, the readers of `files`,
  `check` from `eval check` (S1); `ids.caseId`/`contentId`, the profile and case writers,
  `capture`, `captureCommand`, `observedRead`, `descriptionFoundAt`, `recentlyScored` from
  `eval capture` (S2); the label writer and `label` (S3); `runId`, `judge`, `failure`, `session`,
  the prompt/run/result writers, `runCases`, `oneJobAgentDeps` (S4); `report`, `reportText` (S5).

## Parallel Opportunities

- S1: T002–T004 together, then T007 and T008 together.
- S2: T013–T019 together after T012; T022 alongside T021.
- S4: T029–T033 together.
- S6: T042 and T043 together.

## Implementation Strategy

- **MVP**: S1–S3 give a labeled, validated case set from real jobs; S4 makes it measurable; S5
  makes it a decision.
- **Incremental**: PR 1 (format) → PR 2 (capture) → PR 3 (labels) → PR 4 (run) → PR 5 (report)
  → PR 6 (docs).

## Test ledger (constitution Principle II, target 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (2026-11-03, T001) | 817 (86.46%) | 64 (6.77%) | 64 (6.77%) |
| Planned new | 50 (S1 11: T003 6, T004 3, T005 2; S2 18: T013 3, T014 1, T015 3, T016 6, T017 2, T018 1, T019 1, T020 1; S3 4: T026; S4 12: T030 5, T031 1, T032 3, T033 3; S5 5: T039) | 3 (T006 1, T018 1, T019 1) | 0 |
| Planned removed | 0 | 0 | 0 |
| Planned after | 867 (86.87%) | 67 (6.71%) | 64 (6.41%) |
| After PR 6 (T044) | | | |

The unit share rises and the integration and UI shares fall, toward 95 / 4 / 1.

## Notes

- Never print `.env`; capture reads production jobs but writes only `data/evals/`; `eval run` never
  writes the database.
