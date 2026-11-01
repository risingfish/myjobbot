---

description: "Task list for feature 018, body filters and Re-score"
---

# Tasks: Body filters

**Input**: Design documents from `docs/specs/018-body-filters/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: required by constitution Principle II. Each sitting writes its tests before its code, and
each test task names its kind (unit, integration or UI) and how many tests it adds. The ledger is at
the end.

**Organization**: tasks are grouped by user story. Phases follow the order of dependency, and
sittings follow the PRs in [plan.md](plan.md) (Delivery):
- US2 (the setting) is a prerequisite of the others, so it comes first.
- US3 lands with it, so the owner can see what a term catches before runs act on it.
- US1 follows in S2.
- US4 runs from S2 to S4.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: the user story the task belongs to (US1–US4). Sitting-boundary tasks (start a sitting,
  end it green) carry no story label, because a sitting can span stories.

## Sitting rules (constitution Principle I and Development Workflow)

- **Where:** every sitting runs in the main checkout on `018-body-filters`, with the Docker stack
  stopped (`docker compose stop`, no `docker:watch`) until the feature merges.
- **Start:** create `.specify/sitting-in-progress` naming the sitting.
- **End:** end green with `npm run check` and `npm run check:db`, then delete the marker.
- **Commits:** commit only at a sitting's end, only when the owner asks, with no attribution lines.
- **Habit-hooks:** its output is a direct instruction. Each finding becomes a task and is fixed
  before other work continues.
- **Code rules:**
  - Every new function gets a one-line `/** … */` purpose comment. Tests stay uncommented.
  - Limits: functions ≤ 20 lines, ≤ 3 parameters; files ≤ 200 lines.
  - Every new export is reached from production in the sitting that adds it.

---

## Phase 1: Setup

### Sitting S0: the design docs (docs PR)

- [ ] T001 Commit `docs/specs/018-body-filters/` (spec, plan, research, data model, contracts, quickstart, checklist and this file) when the owner asks, and open the docs PR
- [ ] T002 Run `npm run check` and `npm run check:db` on `main` after the docs PR merges, and correct the ledger's baseline row below if the counts differ from 735 unit / 59 integration / 62 UI

---

## Phase 2: Foundational (the setting and the matching rule)

**Purpose**: the `body_filter` setting (`include` and `exclude`) and `passesBodyFilter`, which every story reads

### Sitting S1: the setting, its Settings fields and the All jobs note (PR 1)

- [ ] T003 Stop the Docker stack (`docker compose stop`), confirm `docker:watch` isn't running, and create `.specify/sitting-in-progress` naming S1
- [ ] T004 [P] Write unit tests (10) in `tests/bodyFilter.test.ts` for `passesBodyFilter(description, format, filter)`, covering the examples table in [contracts/body-filter.md](contracts/body-filter.md):
  - exclude "security clearance" matches "Active Security-Clearance required";
  - exclude "php" doesn't match "PHPUnit";
  - exclude "php" matches "PHP and Go";
  - a null description passes, with terms in both lists;
  - a Markdown link's words match;
  - a Markdown link's address doesn't;
  - both lists empty passes;
  - include "typescript", "golang" fails "We write Java" and passes "TypeScript-first team";
  - include "go" doesn't match "A good team";
  - a description matching both an include and an exclude term fails.
- [ ] T005 [P] Write unit tests (2) in `tests/searchSettings.test.ts` for the `body_filter` sanitizer:
  - a stored `exclude` entry `"---"` is dropped, with a fallback notice whose setting is `body_filter.exclude[1]` and whose reason doesn't contain the value, and the stored `include` list is kept;
  - a stored non-object value falls back to both lists empty.
- [ ] T006 Export `bodyFilterTerms = z.object({ include: z.array(filterTerm).default([]), exclude: z.array(filterTerm).default([]) })` from `src/config/schema.ts`, beside `titleFilterTerms`, and add `body_filter: bodyFilterTerms.prefault({})` to `fileConfigSchema`
- [ ] T007 Create `src/jobs/bodyFilter.ts` with `passesBodyFilter(description: string | null, format: DescriptionFormat | null, filter: FileConfig["body_filter"]): boolean` (research R2):
  - return `true` when both lists are empty or the readable text is null or empty;
  - otherwise normalize `readableDescription(description, format)` with `normalizeTitle`, and return `(filter.include.length === 0 || filter.include.some(has)) && !filter.exclude.some(has)`, where `has` is `(term) => hasWord(text, term)`.
- [ ] T008 In `src/config/searchSettings.ts`, rename `SearchFallbacks.titleFilter(value)` to `filterLists(value, name)` (the name prefixes each notice, as `title_filter.include[0]` does today), update its purpose comment, and use it for `title_filter` and a new `body_filter` entry in `SANITIZERS`, so T005 passes and the title filter's sanitizer tests still pass untouched

**Checkpoint**: the setting resolves for runs and web requests. Typecheck passes, and `passesBodyFilter` gets its production caller in T014.

---

## Phase 3: User Story 2 - Edit body filters on the Settings page (Priority: P1)

**Goal**: the owner adds, edits, removes and resets body filter terms in the Filters section.

**Independent Test**: add "clearance", save and reload, and it is kept. Add "---" and the save is
refused, with the message on that row. Reset, and the list is empty.

### Tests for User Story 2

- [ ] T009 [P] [US2] Write unit tests (3):
  - in `tests/settingsSave.test.ts`, saving the `filters` section stores `body_filter.include` and `body_filter.exclude` with the other lists;
  - in `tests/settingsSave.test.ts`, a `body_exclude` entry `"---"` refuses the whole save, with the problem at field `body_exclude`, entry 0;
  - in `tests/settingsSave.test.ts`, add `body_include` and `body_exclude` to the `filters()` helper, so their edits reach the save (no new count);
  - in `tests/settingsView.test.ts`, the `body_include` and `body_exclude` fields show `[]` with `isDefault: true` when nothing is stored, and the stored lists when there are some.

### Implementation for User Story 2

- [ ] T010 [US2] Add `"body_include"` and `"body_exclude"` to `FieldName`, and to `SECTIONS` in `src/web/settingsSections.ts` add `{ name: "body_include", section: "filters", stored: ["body_filter", "include"], check: ["body_filter", "include"] }` and the same for `body_exclude` at `["body_filter", "exclude"]`. Update `tests/settingsSections.test.ts` (existing test, 0 new): 10 fields, `"body_filter"` added to `SEARCH_KEYS`, and the test's name to match.
- [ ] T011 [US2] Add `body_include` and `body_exclude` in `src/web/settingsView.ts` to:
  - `FieldValues` (`string[]`) and `SHOWN` (`terms`);
  - `DEFAULTS` (`bodyFilterTerms.shape.include.parse(undefined)` and `.exclude`);
  - `shownFields` and `defaultValues`.

  Also add both, as `termList`, to `ROW_SHAPES` in `src/web/settingsForm.ts`.
- [ ] T012 [US2] In `web/components/settings/FiltersSection.tsx`:
  - add `"body_include"` and `"body_exclude"` to `TermName`;
  - add `["body_include", "Description must include one of"]` and `["body_exclude", "Description must not include"]` to `LISTS`, after `"Also excluded"`;
  - add both to `listsOf`;
  - update `FiltersSection`'s purpose comment to name the description lists.

**Checkpoint**: the owner can edit and save the list in Settings.

---

## Phase 4: User Story 3 - See which jobs a body filter hides (Priority: P2)

**Goal**: All jobs notes a job whose description matches as "hidden by body filter".

**Independent Test**: with a term saved, a job whose description holds it shows the note, a job
without it shows none, and a job hidden by both title and description names the title filter.

### Tests for User Story 3

- [ ] T013 [P] [US3] Write unit tests (4):
  - in `tests/filterMatch.test.ts`, `filterMatch` names `"company"` before `"title"` before `"body"` for a job all three match, and gives null for a job none matches;
  - in `tests/pageData.test.ts`, a scored job whose description contains a `body_filter.exclude` term gets `filterNote: "hidden by body filter"` and still appears on Recommended (FR-008);
  - a job whose description contains no `body_filter.include` term gets the same note;
  - a job matching both the title filter and the body filter gets `"hidden by title filter"`.

### Implementation for User Story 3

- [ ] T014 [US3] Create `src/jobs/filterMatch.ts` (research R4) with:
  - `interface FilterSet { excludedCompanies: string[]; titleFilter: FileConfig["title_filter"]; bodyFilter: FileConfig["body_filter"] }` and `filterSet(config: FileConfig): FilterSet`;
  - `filterMatch(job: Pick<JobRow, "title" | "company" | "description" | "description_format">, filters: FilterSet): "company" | "title" | "body" | null`, checking `isExcludedCompany`, `passesTitleFilter`, then `passesBodyFilter`, in that order;
  - `FILTER_NOTES: Record<"company" | "title" | "body", string>`, the three notes from [contracts/body-filter.md](contracts/body-filter.md).

  In `src/web/rowViews.ts`, make `RowContext` extend `FilterSet` (adding `bodyFilter`), and have `filterNote` return `FILTER_NOTES[match]` or null; update its purpose comment.
- [ ] T015 [US3] Build `rowContext` from `filterSet(config)` in `src/web/pageData.ts`, and fix any `RowContext` literal in `tests/` that typecheck flags
- [ ] T016 Run `npm run check` and `npm run check:db` until green (fix every habit-hooks finding), delete `.specify/sitting-in-progress`, and when the owner asks, commit S1 and open PR 1

**Checkpoint**: PR 1. Terms can be saved and their effect seen on All jobs. Runs don't act on them yet.

---

## Phase 5: User Story 1 - Filter jobs by what their description says (Priority: P1) 🎯 MVP

**Goal**: a run never sends a job whose description matches a term to the model.

**Independent Test**: save a term, run against jobs where some descriptions contain it, and those
jobs are not scored while the others are.

### Sitting S2: the run skips matching jobs, and Re-score prep (PR 2)

- [ ] T017 Create `.specify/sitting-in-progress` naming S2 (stack still stopped)

### Tests for User Story 1

- [ ] T018 [P] [US1] Write unit tests (3) in `tests/nextJobs.test.ts`, using the memory store and `testContext`:
  - a job whose description contains a `body_filter.exclude` term, and one that contains none of the `body_filter.include` terms, are absent from `next_jobs`' `jobs` and not counted in `total_unscored`;
  - a job with a null description passes and is offered;
  - with only a body-filtered job left, `finish` succeeds, and `list_sources` reports `total_unscored: 0` for its source.

### Implementation for User Story 1

- [ ] T019 [US1] In `src/tools/unscored.ts`:
  - widen `isWanted`'s parameter to `Pick<JobRow, "title" | "company" | "description" | "description_format">` and make it `filterMatch(row, filterSet(config)) === null`, so runs, the All jobs note and Re-score share one order of checks;
  - update the purpose comments of `isWanted` and `unscoredJobs` to name the body filter.

  The callers in `careersStep.ts` pass whole `JobRow`s, so they need no change.

**Checkpoint**: runs leave matching jobs unscored (US1 complete).

### Re-score prep in S2 (no behaviour change; reached from the run path)

- [ ] T020 [P] [US4] Move `openRunLogs` and `openJsonl`, with the `RunLogs` interface, from `src/app/run.ts` into a new `src/app/runLogs.ts`, exported. `run.ts` imports them.
- [ ] T021 [US4] After T020, move `runClients` and `pageRenderer`, with the `RunClients` interface, from `src/app/run.ts` into a new `src/app/runParts.ts`, exported:
  - `pageRenderer` takes `{ logs, stores }` as `Pick<RunParts, …>` or an equivalent small interface, and `run.ts` imports both;
  - they take small seam types of their own (`{ lookup? }` and `{ browser? }`) rather than `run.ts`' `RunSeams`, so `runParts.ts` doesn't import `run.ts`;
  - confirm `run.ts` is well under 200 lines.
- [ ] T022 [P] [US4] Narrow context types, the store included, to what each function reads, so T035's one-job store fits them:
  - `recordMatchesTool`, `record` and `withAlertNote` in `src/tools/recordMatches.ts` take `{ store: Pick<JobStore, "findJob" | "recordVerdict"> } & Pick<ToolContext, "now" | "runId">`;
  - `summarizeJob` in `src/tools/jobSummary.ts` takes `{ store: Pick<JobStore, "earliestSeen"> } & Pick<ToolContext, "now" | "config">`;
  - in `src/tools/getJobDetails.ts`, `details` is renamed `jobDetails(context: { store: Pick<JobStore, "findJob" | "earliestSeen"> } & Pick<ToolContext, "now" | "config">, jobId: string)`, and `getJobDetailsTool` calls it;
  - `reportLookalike` in `src/app/lookalikes.ts` takes `{ store: Pick<JobStore, "flagInjection"> } & Pick<ToolContext, "trace" | "now">`;
  - name each narrowed type once, beside its function. Like `jobDetails`, a type is exported only in S3, when the re-score first imports it, so knip stays clean in S2.

  A full `ToolContext` still satisfies every one of these, so the run's callers don't change.

  knip must stay clean: `jobDetails` is exported only once T036 imports it. Until then, keep it module-private and only rename it.
- [ ] T023 Run `npm run check` and `npm run check:db` until green, delete the marker, and when the owner asks, commit S2 and open PR 2

**Checkpoint**: PR 2.

---

## Phase 6: User Story 4 - Re-score a job (Priority: P2)

**Goal**: the panel's Re-score button scores one job at once:
- a job with no description is looked up first;
- a job a filter now matches loses its score;
- a failure keeps the old score.

**Independent Test**: note a scored job's score, change a preference, press Re-score, and its score,
reasons, gaps and scored time are replaced. See [quickstart.md](quickstart.md) §4.

### Sitting S3: the re-score core and its CLI command (PR 3)

The core's production entry point in this sitting is a CLI command, `npm start -- rescore <ats> <job_id>`
(`src/cli.ts`). It uses the same `openRescore` the server action uses in S4, so knip stays clean
and the owner can try PR 3 from a terminal.

- [ ] T024 Create `.specify/sitting-in-progress` naming S3

#### Tests for User Story 4 (S3)

- [ ] T025 [P] [US4] Write the contract `tests/helpers/rescoreContract.ts` with `rescoreContract(make)`. After a verdict, `views.clearScore({ ats, jobId })`:
  - returns `true`;
  - leaves `score`, `base_score`, `bonus_score`, `reasons`, `gaps` and `scored_at` null in `jobDetail`;
  - keeps `hidden`, `applied` and `applied_on`;
  - keeps `jobVerdicts`' rows.

  For an unknown key it returns `false`. Run it from `tests/storeContract.test.ts` (unit, 1) and `tests/integration/storeContract.test.ts` (integration, 1).
- [ ] T026 [P] [US4] Write unit tests (5) in `tests/rescorePlan.test.ts` for `rescoreStep(job, config, { lookedUp })`:
  - an excluded company gives `filtered`/`company` even with a matching title and body;
  - a title-filtered job gives `filtered`/`title`, and no `lookup` is planned for it;
  - a job whose description matches an exclude term, and one that misses every include term, give `filtered`/`body` (one test, two cases);
  - no description with `lookedUp: false` gives `lookup`;
  - no description with `lookedUp: true` gives `score`.
- [ ] T027 [P] [US4] Write unit tests (2) in `tests/oneJobStore.test.ts` for `oneJobStore(store, key)`:
  - `findJob` gives the job for its id and null for any other;
  - `recordVerdict` for another job id returns `false`, writes nothing and leaves `recorded()` false, while for its own id it writes through and `recorded()` turns true.
- [ ] T028 [P] [US4] Write a unit test (1) in `tests/prompt.test.ts`, before T032 runs:
  - the run's system prompt equals a fixed copy of today's text (`toMatchInlineSnapshot`), so T032's move is checked byte for byte;
  - the run's system prompt and the re-score's system prompt both contain the same `scoringRubric` text;
  - the re-score prompt, nudge and compaction notice name `get_job` and `record_matches`, and never `next_jobs`, `get_job_details`, `list_sources` or `finish`;
  - no job field or job id appears in either prompt.
- [ ] T029 [P] [US4] Write unit tests (6) in `tests/rescore.test.ts` for `rescore(deps, key)`, with the memory stores, `scriptedChat` (`tests/helpers/chat.ts`), a fake `deps.lookUp` and a memory trace:
  - **(a) scored:** the model calls `get_job`, whose tool result is wrapped in the markers, then `record_matches`. The result is `scored`, the verdict's `run_id` is the re-score's id, and the trace holds `{ type: "rescore", ats, job_id }` before the session's `start`. A key whose `ats` differs from the stored job's gives `failed`.
  - **(b) filtered:** a body-filtered job makes no chat call, its score is cleared, and the result is `filtered` with "hidden by body filter".
  - **(c) lookup:** a job with no description triggers one lookup that stores a description containing a term. The result is `filtered`/body, with no scoring chat call.
  - **(d) failed:** the chat throws. The result is `failed`, and the job's old score and verdicts are unchanged.
  - **(e) lookup finds nothing:** the job is scored from its alert fields, and the verdict carries the "scored from the alert only" gap.
  - **(f) lookup throws:** the error is traced as `rescore_lookup_failed`, and the job is still scored.
- [ ] T030 [US4] Update `tests/toolDeclarations.test.ts` so the expected map also holds the re-score's tools, `get_job: true` and `record_matches: false`, by adding `rescoreTools(...)` to the listed tools (existing test, 0 new). Also write an integration test (1) in `tests/integration/openRescore.test.ts`: `openRescore` against a temporary data folder (a `config.json` and `resume.md`) and the memory stores builds deps whose run id names a new trace file, and `close()` resolves; no model call is made.

#### Implementation for User Story 4 (S3)

- [ ] T031 [P] [US4] Add `clearScore(key: JobKey): Promise<boolean>` to `JobViews` in `src/db/store.ts`, then implement it:
  - in `src/db/kysely/jobViews.ts`, with `updateTable("jobs").set({ score: null, base_score: null, bonus_score: null, reasons: null, gaps: null, scored_at: null }).where("ats", "=", …).where("job_id", "=", …)`, reporting `numUpdatedRows > 0`;
  - in `tests/helpers/memoryJobViews.ts`, to match. T025 passes.
- [ ] T032 [P] [US4] Move the scoring rules, rubric and preferences block out of `SYSTEM_PROMPT` in `src/agent/prompt.ts` into `src/agent/rubric.ts`, as `scoringRubric(config: AppConfig, markers: DataMarkers): string`:
  - it holds only what both prompts share: the `{data}` sentence, the ghost line, "Copy job_id values exactly", the rubric and the preferences block, filling `{data}`, `{threshold}` and `{preferences}`. The line naming `next_jobs` and `get_job_details` stays in the run's own prompt;
  - `systemPrompt` builds the run's steps plus `scoringRubric`;
  - the run's prompt text stays byte-for-byte the same, which `tests/prompt.test.ts`' existing tests check.
- [ ] T033 [P] [US4] Move `careersDeps` from `src/tools/careersStep.ts` into `src/careers/deps.ts`, exported as `careersDeps(parts: CareersParts): CareersDeps`, where `CareersParts` is a plain interface in `deps.ts` (store, searxngUrl, lookup, pages, boards, renderer, settings, chat, trace, jobs, runId, now, http, markers), so `src/careers` still never reads the tool context (research R9). `careersStep.ts` maps its context onto `CareersParts`. Move `soughtJob` alongside it, exported.
- [ ] T034 [US4] Create `src/rescore/plan.ts`:
  - `type RescoreStep = { kind: "filtered"; by: "company" | "title" | "body" } | { kind: "lookup" } | { kind: "score" }`;
  - `rescoreStep(job: JobRow, config: FileConfig, progress: { lookedUp: boolean }): RescoreStep`: `filtered` when `filterMatch(job, filterSet(config))` names a filter (T014; a job with no description passes the body filter there), then `lookup` when there is no description and `lookedUp` is false, else `score`. The notes come from `FILTER_NOTES` in `src/jobs/filterMatch.ts`.
- [ ] T035 [US4] Create `src/rescore/oneJobStore.ts`: `oneJobStore(store: JobStore, key: JobKey): OneJobStore`, where `OneJobStore` is `Pick<JobStore, "findJob" | "recordVerdict" | "earliestSeen" | "flagInjection"> & { recorded(): boolean }`:
  - `findJob` and `recordVerdict` answer only for `key.jobId`, and the rest delegate;
  - `recorded()` reports whether a `recordVerdict` for the job has returned `true`;
  - the type satisfies every narrowed store type from T022.
- [ ] T036 [US4] Create `src/rescore/session.ts`:
  - `rescoreTools(context)` returns `[getJobTool(context), recordMatchesTool(context)]`. `get_job` has no parameters and `outsideText: true`, and calls `jobDetails(context, key.jobId)`, now exported from `getJobDetails.ts`. Its description never names the job.
  - `rescoreMessages(config, markers)` returns a system message (the re-score steps, then `scoringRubric`) and a user message ("My resume:\n\n<resume>\n\nRe-score the job now.").
  - `scoreOne(deps)` calls `runAgent` with:
    - `tools: rescoreTools(...)`, `limits: { ...config.file.agent, max_steps: RESCORE_MAX_STEPS, max_wall_clock_min: RESCORE_MAX_MINUTES }` where `RESCORE_MAX_STEPS = 6` and `RESCORE_MAX_MINUTES = 3` (SC-005);
    - `isFinished: () => store.recorded()`, where `store` is the session's `oneJobStore`;
    - `onLookalike: (hit) => reportLookalike(...)`;
    - the re-score's own `RESCORE_NUDGE` ("Respond only with tool calls: get_job, then record_matches.") and compaction notice, never the run's, which name tools the session doesn't have.

    It returns whether the verdict was recorded.
- [ ] T037 [US4] Create `src/rescore/rescore.ts`:
  - `interface RescoreDeps { config: AppConfig; store: JobStore; views: JobViews; chat: ChatFn; trace: Trace; runId: string; now: () => Date; lookUp: (job: SoughtJob) => Promise<unknown>; markers: DataMarkers }`;
  - `rescore(deps, key): Promise<RescoreOutcome>` (`{ outcome: "scored" } | { outcome: "filtered"; note } | { outcome: "failed" }`) follows [contracts/rescore.md](contracts/rescore.md) Flow:
    1. trace `{ type: "rescore", ats, job_id }`;
    2. read the job with `store.findJob(key.jobId)`, treating a missing row or `row.ats !== key.ats` as unknown;
    3. loop on `rescoreStep`: `lookup` runs `deps.lookUp(soughtJob({ row, retry: false }))` once, and a thrown lookup error is traced (`{ type: "rescore_lookup_failed", error: describeError(error) }`) and the loop carries on with `lookedUp: true` (spec edge case); `filtered` runs `views.clearScore`;
    4. `score` runs `scoreOne`;
    5. an unknown job, or any other thrown error, is traced (`{ type: "rescore_failed", error: describeError(error) }`) and returns `failed`.

  Keep each function ≤ 20 lines by splitting the steps into helpers.
- [ ] T038 [US4] Create `src/rescore/open.ts` with `openRescore(environment: Environment, stores: Stores): Promise<OpenRescore>`, returning `{ deps: RescoreDeps; close(): Promise<void> }`:
  - load `loadConfig(environment)`;
  - open `openRunLogs(loaded)` and resolve `settingsForRun(loaded, stores.searchSettings, logs.trace)`;
  - create `createChat(config.env, logs.llm)`, `runClients(config, {})` and `pageRenderer(config, {}, { logs, stores })`;
  - build `CareersParts` from those parts with `dataMarkers(logs.runId)`, and `lookUp: (job) => lookUpCareers(careersDeps(parts), [job])`;
  - `close` closes the renderer.
- [ ] T039 [US4] Add a `rescore` command to `COMMANDS` in `src/cli.ts`:
  - `rescoreCommand(environment, [ats, jobId])` opens the stores like `runOnce` (`openStores(parseDbSettings(environment))`), calls `openRescore` and then `rescore`, and prints `rescore <ats> <job_id>: <outcome>` (plus the note when filtered);
  - it closes the renderer and the stores in `finally`, and returns 0 for `scored`/`filtered` and 1 for `failed`;
  - update `USAGE` to `usage: myjobbot run | rescore <ats> <job_id> | import-sqlite <path>`, and `tests/cli.test.ts` to expect the new line (existing test, 0 new);
  - add the command to CLAUDE.md's Commands list in T053.
- [ ] T040 Run `npm run check` and `npm run check:db` until green, delete the marker, and when the owner asks, commit S3 and open PR 3

**Checkpoint**: PR 3. `npm start -- rescore <ats> <job_id>` re-scores one job end to end, with a lookup or a filter as needed, and the web UI is unchanged.

### Sitting S4: the Re-score button (PR 4)

- [ ] T041 Create `.specify/sitting-in-progress` naming S4

#### Tests for User Story 4 (S4)

- [ ] T042 [P] [US4] Write unit tests (2):
  - in `tests/rescoreNote.test.ts`, for `rescoreNote(result)`: `scored` gives null; `filtered` gives "Not re-scored: hidden by body filter" (and the title and company texts); `failed` gives "Re-score failed; the old score is kept"; every non-null output is one of that fixed set of messages;
  - in `tests/pageRows.test.ts`, `withJobRow(rows, key, row, page)` replaces the job's row on All jobs, and on Recommended removes it when `row.score` is null.
- [ ] T043 [P] [US4] Write a UI test (1) in `tests/client/panelRescore.test.tsx`, mocking `web/lib/rescoreActions.js`:
  - pressing Re-score disables the button and shows "Re-scoring…" until the action settles;
  - a `failed` answer shows the failure note and calls no refresh callback.

#### Implementation for User Story 4 (S4)

- [ ] T044 [P] [US4] Create `src/web/rescoreNote.ts` with `rescoreNote(result: RescoreResult): string | null`, and add the `RescoreResult` type (`{ outcome: "scored"; row } | { outcome: "filtered"; note; row } | { outcome: "failed" }`, with `row: JobRowView`) to `src/web/api.ts`
- [ ] T045 [US4] Create `web/lib/rescoreActions.ts`, the `"use server"` action `rescoreJob(ats, jobId): Promise<RescoreResult>`:
  - check the input with `jobRequest` from `web/lib/rows.ts` (exported, with this as its new caller), returning `failed` when it is invalid, before any model call;
  - load the root `.env` as `uiState.ts` does, take the cached stores (`getStores()`), call `openRescore(process.env, stores)` and then `rescore`, and close in `finally`;
  - on `scored` or `filtered`, add `row`, the job's `JobRowView` rebuilt through `views.jobDetail` and `toJobRowView` with `rowContext(config.file, new Date())`;
  - map any error to `{ outcome: "failed" }`.
- [ ] T046 [US4] Create `web/lib/useRescore.ts` (not `useSave`: its result isn't `{ ok }`, and "Couldn't save" is the wrong message; research R10). `useRescore(job, onRescored)` returns `{ working, note, press }`:
  - `press` calls `rescoreJob(job.ats, job.jobId)`;
  - it sets `note` from `rescoreNote`;
  - on `scored` or `filtered`, it calls `onRescored(result.row)`;
  - a rejected promise is shown as `failed`.
- [ ] T047 [US4] Create `web/components/panel/PanelRescore.tsx`, a button with the class `outline secondary`, labelled "Re-score" or "Re-scoring…" and disabled while working, followed by its note. In `web/components/panel/PanelHeader.tsx`, render `<PanelRescore …>` first in `details-actions` when `row !== null`, take an `onRescored` prop, and update the purpose comment. Update the existing UI tests that render the panel or the list (`tests/client/panelPostingLink.test.tsx`, `panelHeader.test.tsx`, `panelSections.test.tsx`, `detailsPanel.test.tsx`, `hide.test.tsx`, `applied.test.tsx`, `loadMore.test.tsx`, `rowsList.test.tsx`):
  - add `vi.mock("../../web/lib/rescoreActions.js", …)` in each test file (not in `tests/helpers/panelPage.tsx`), so no server module loads in the `dom` project;
  - in `panelHeader.test.tsx`, expect the buttons `["Re-score", "Applied", "Hide", "Close"]` and `headerButtons()[0] === "Re-score"`;
  - pass `onRescored={vi.fn()}` where they render `PanelHeader` directly.

  These are edits to existing tests, with no new count.
- [ ] T048 [US4] Wire the refresh:
  - **Details reload:** `useJobDetails(key, refresh = 0)` in `web/lib/useJobDetails.ts` takes an optional `refresh` count, defaulting to 0, and adds it to its effect's dependencies. `DetailsPanel.tsx` keeps a `refresh` count, bumps it on `onRescored`, and passes `onRescored` through `PanelContent` to `PanelHeader`.
  - **List row:** `web/lib/pageRows.ts` gains the plain `withJobRow` (T042), `usePageRows.ts` gains `replaceRow(job, row)` built on it, and `useJobChanges.ts` gains `markRescored(job, row)`, which calls `rows.replaceRow` and `panel.noteChange(job, row)`. On Recommended a re-scored job left with no score leaves the list, as a hidden one does. `RowsList.tsx` passes `changes.markRescored` to `DetailsPanel` as `onRescored`.
  - Keep every function ≤ 20 lines, and `DetailsPanel.tsx` ≤ 200 lines.
- [ ] T049 [US4] In `compose.yaml`, give the `web` service `networks: [default, browser]` (research R9). Check it with `docker compose config --quiet`, never plain `config`.
- [ ] T050 Run `npm run check` and `npm run check:db` until green, delete the marker, and when the owner asks, commit S4 and open PR 4

**Checkpoint**: PR 4. All four stories work. After merging, rebuild the stack (`npm run docker:up`) and walk through [quickstart.md](quickstart.md) §4.

---

## Phase 7: Polish & Cross-Cutting Concerns

### Sitting S5: documentation (PR 5)

- [ ] T051 Create `.specify/sitting-in-progress` naming S5
- [ ] T052 [P] Update `README.md`:
  - "Configuration knobs", "Filters": the description lists (must include one of, must not include);
  - "How scoring works", step 1: the body filter beside the title filter;
  - "Web UI": the panel's Re-score button and what it does to a filtered job or a job with no description;
  - "Run": the `rescore <ats> <job_id>` command;
  - "Deploy with Docker": `web` on the `browser` network.
- [ ] T053 [P] Update `CLAUDE.md` Conventions with a body filters and Re-score paragraph:
  - `body_filter` (`include` and `exclude`) in `user_settings`;
  - matching through `passesBodyFilter` on `readableDescription`, and one order of checks in `filterMatch` (`src/jobs/filterMatch.ts`);
  - `isWanted` as the one gate;
  - Re-score in `src/rescore/`, run by the `rescoreJob` server action, as a one-job `runAgent` session through `get_job` and a one-job store, with job text only in wrapped tool results; its careers lookup is built from `CareersParts` (`src/careers/deps.ts`);
  - the Re-score button uses `useRescore`, not `useSave`, the one exception to the job-action rule, and a running re-score holds up the page's other actions (Next runs one server action at a time);
  - `clearScore` keeping history;
  - fixed messages from `rescoreNote`;
  - `web` on the `browser` network.

  Add `npm start -- rescore <ats> <job_id>` to Commands. Keep `.specify/memory/constitution.md` in agreement (no principle changes expected).
- [ ] T054 Run [quickstart.md](quickstart.md) §1–§5 against the rebuilt stack. Fill the ledger's last row with the real counts. Run `npm run check` and `npm run check:db`, delete the marker, and when the owner asks, commit S5 and open PR 5.

---

## Dependencies & Execution Order

### Phase and sitting dependencies

- **S0 (Setup)** → **S1 (Foundational + US2 + US3)** → **S2 (US1 + US4 prep)** → **S3 (US4 core)** → **S4 (US4 UI)** → **S5 (Polish)**.
- Each PR is merged and tested by the owner before the next sitting starts (small PRs).

### User story dependencies

- **US2**: needs the Foundational setting (T006, T008). It is the entry point that makes the setting editable.
- **US3**: needs `passesBodyFilter` (T007). It is independent of US1.
- **US1**: needs T006–T008. It is independent of US3. Values come from US2's Settings field, or from a test's settings.
- **US4**: needs US1's `isWanted` rules only indirectly, through `rescoreStep`. Its core needs the S2 prep (T020–T022).

### Within each sitting

- Tests (T004–T005, T009, T013, T018, T025–T030, T042–T043) are written before the code they cover, and fail first.
- A new module's first production caller lands in the same sitting:
  - `passesBodyFilter` and `filterMatch`: in T014 (`rowViews.ts`), then T019;
  - `rubric.ts`: in `prompt.ts`;
  - `deps.ts`: in `careersStep.ts`;
  - `plan.ts`: in `rescore.ts`;
  - `rescore.ts` and `open.ts`: in `src/cli.ts` (S3), then `rescoreActions.ts` (S4);
  - `rescoreNote.ts`: in `useRescore.ts`.

## Parallel Opportunities

- **S1:** T004 and T005 in parallel, then T006–T008. T009 and T013 in parallel with each other.
- **S2:** T020 → T021 (both edit `run.ts`), with T022 in parallel after T019.
- **S3:**
  - T025–T029 are all different test files.
  - T031, T032 and T033 are different modules.
  - T034 → T035 → T036 → T037 → T038 → T039 are sequential, each importing the last.
- **S4:** T042–T044 in parallel, then T045 → T046 → T047 → T048 (sequential). T049 is independent.
- **S5:** T052 and T053 in parallel.

### Parallel example: S3 tests

```text
Task: "T025 rescore contract in tests/helpers/rescoreContract.ts"
Task: "T026 rescoreStep unit tests in tests/rescorePlan.test.ts"
Task: "T027 oneJobStore unit tests in tests/oneJobStore.test.ts"
Task: "T028 shared rubric unit test in tests/prompt.test.ts"
Task: "T029 rescore flow unit tests in tests/rescore.test.ts"
```

---

## Implementation Strategy

### MVP

US1, the run skipping matching jobs, is the feature's purpose. It ships in PR 2, right after PR 1,
which gives the setting (US2) and the visible notes (US3) it relies on. After PR 2, body filters
are complete and useful on their own, before any Re-score work.

### Incremental delivery

1. **PR 1:** save terms and see on All jobs what they catch.
2. **PR 2:** runs skip those jobs (MVP).
3. **PR 3:** re-score one job from the CLI.
4. **PR 4:** the panel's Re-score button.
5. **PR 5:** the docs.

---

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (2026-11-01, T002) | 735 (85.86%) | 59 (6.89%) | 62 (7.24%) |
| Planned new | 39 (T004 10, T005 2, T009 3, T013 4, T018 3, T025's memory run 1, T026 5, T027 2, T028 1, T029 6, T042 2) | 2 (T025's MariaDB run, T030's `openRescore`) | 1 (T043) |
| Planned removed | 0 | 0 | 0 |
| Planned after | 774 (86.19%) | 61 (6.79%) | 63 (7.02%) |
| After PR 5 (T054) | | | |

Every share moves toward 95 / 4 / 1.

## Notes

- [P] tasks touch different files and depend on no unfinished task.
- Never print `.env`, and never query the production `myjobbot` database. Integration tests use
  `myjobbot_test` only.
- No new library is needed. If one turns out to be needed, present the options to the owner first
  (constitution IV).
