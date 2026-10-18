---
description: "Tasks for feature 009: run-bound delimiters against prompt injection"
---

# Tasks: Run-bound delimiters against prompt injection

**Input**: Design documents from `docs/specs/009-prompt-injection-delimiters/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/data-markers.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file.

**Organization**: by user story, planned in sittings.

- **Where the work happens**:
  - A sitting may span turns. Work happens in the main checkout on
    `009-prompt-injection-delimiters`.
  - The Docker stack is stopped (`docker compose --profile browser stop`) until the merge, since
    it runs this checkout's `src/` against production.
- **How a sitting ends**:
  - `npm run check` and `npm run check:db` are green.
  - Delete `.specify/sitting-in-progress`.
  - Commit that sitting's files when the owner asks. The `.gitignore` line for
    `compose.override.yaml` is never part of a 009 commit.
- **Kysely**: builders only (constitution 2.3.0). Migration 006 uses `db.schema.alterTable`, and
  `flagInjection` uses `updateTable`.
- **Wiring**:
  - `markers.ts` and `wrapped.ts` are reached from `runAgent` (`src/agent/loop.ts`), and
    `lookalikes.ts` from `src/app/run.ts`, in the sitting that creates them.
  - `flagInjection` is reached from `lookalikes.ts` and `src/careers/lookUpJob.ts` in S2.
- **Run IDs** are UUIDs. Test helpers pass a fixed UUID
  (`3f2b8c1e-9a7d-4e21-b0c3-5d6e7f8a9b0c`), never `"test-run"`.
- **File size**:
  - New lookup cases go in `tests/careersMarkers.test.ts`, since `tests/careersLookup.test.ts` is
    170 lines.
  - `src/careers/tools.ts` (144 lines) only gains `outsideText` flags and a generic description.
  - `TitleCell` is 17 lines, so its notes move into a `TitleNotes` component.
- **Fixtures**: synthetic injection strings only. No real job, page or email text is ever recorded.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3 from spec.md

---

## Phase 1: Setup

### Sitting S0: stop the stack and get a green baseline (T001–T002)

- [X] T001 Run `docker compose top myjobbot` and confirm no run is in progress. Then run
  `docker compose --profile browser stop`. Create `.specify/sitting-in-progress` naming S0.
- [X] T002 Run `npm run check` and `npm run check:db` and record the counts in the ledger below.
  Delete the marker, then commit only `docs/specs/009-prompt-injection-delimiters/`
  (`.specify/feature.json` is gitignored) ("Plan run-bound delimiters against prompt injection
  (009)").

---

## Phase 2: Foundational, with US1 and US2 (the loop is shared)

### Sitting S1: markers, scrub and wrapping in the loop (T003–T017)

Create `.specify/sitting-in-progress` naming S1 before T003.

**Purpose**: the shared step (FR-002), used by both conversations. S1 delivers US1 and US2.

- [X] T003 [P] Unit test `tests/markers.test.ts`:
  - `dataMarkers("3f2b8c1e-9a7d-4e21-b0c3-5d6e7f8a9b0c")` gives tag `3f2b8c1e9a7d`, open
    `<<data 3f2b8c1e9a7d>>` and close `<</data 3f2b8c1e9a7d>>`.
  - Two run IDs give different markers.
  - `scrub` removes this run's markers, another run's, bare `<<data` / `<</data`, mixed case,
    spaced forms (`<< / data`) and joined pieces (`<<da<<datata>>` leaves no `<<data`). It repeats
    until clean.
  - `scrub` leaves numbers, booleans, null and keys unchanged.
  - `hits` gives one `{ jobId }` per removal: a removal inside `{ jobs: [{ job_id: "a", title: … }] }`
    has jobId `a`, and one outside any `job_id` object has `null`.
- [X] T004 Create `src/agent/markers.ts` (`DataMarkers`, `Lookalike = { tool: string; jobId:
  string | null }`, `dataMarkers(runId)`, `scrub(value)`) per contracts/data-markers.md.
- [X] T005 [P] Unit test `tests/wrapped.test.ts`. `wrapOutcome({ outsideText, outcome, markers })`:
  - For an outside-text tool, gives `open\n<scrubbed JSON>\nclose`, an error outcome
    (`{"error":…}`) included, plus the hits.
  - For a bare tool, gives the content unchanged with no hits.
  - On a `fetch_jobs`-shaped page of 25 jobs, the markers add at most 5% (SC-004).
- [X] T006 Create `src/agent/wrapped.ts` (`wrapOutcome`). It parses the outcome's JSON, scrubs it,
  serialises it again and wraps it.
- [X] T007 [P] Unit test `tests/toolDeclarations.test.ts`. Build the main registry's tools
  (`buildTools` with `testContext()`) and the lookup's (`lookupTools` with `newSession`). The tools
  with `outsideText: true` are exactly `fetch_jobs`, `get_job_details`, `search_careers` and
  `open_link`; `list_sources`, `record_matches`, `finish` and `finish_lookup` are false.
- [X] T008 Add a required `outsideText: boolean` to `ToolSpec` and `Tool` in `src/tools/tool.ts`,
  passed through by `defineTool`.
  - Set it in `src/tools/{fetchJobs,getJobDetails,listSources,recordMatches,finish}.ts` and in the
    three tools in `src/careers/tools.ts`.
  - Make `search_careers`'s description generic: "Search the web for the employer's careers page.
    Returns numbered results." (R1).
  - Add `outsideText` to the `defineTool` calls in `tests/dispatch.test.ts` (`echo`, `explode`).
- [X] T009 [P] Unit tests in `tests/agent-loop.test.ts` (use `tests/helpers/agent.ts`):
  - A fake outside-text tool's result reaches the next chat request wrapped in the run's markers,
    while the trace's `tool` event has the unwrapped content and `wrapped: true`.
  - A bare tool's result, and a call to an unknown tool, are unchanged, with `wrapped: false`.
  - A result containing `<</data x>>` reaches the model without it, and `onLookalike` is called
    once with `{ tool, jobId }`.
  - Nudge and compaction-notice messages are never wrapped (FR-008).
- [X] T010 In `src/agent/loop.ts`:
  - Add `markers: DataMarkers` and `onLookalike: (hit: Lookalike) => void | Promise<void>` to
    `AgentDeps`.
  - In `execute()`, find the called tool by name (an unknown tool counts as bare) and call
    `wrapOutcome`.
  - Record the unwrapped content plus `wrapped` in the trace, and the wrapped content in history.
  - Call `onLookalike` for each hit.
  - Update `tests/helpers/agent.ts` defaults: markers from the fixed test UUID, and a no-op
    `onLookalike`.
- [X] T011 [P] Unit test in a new `tests/prompt.test.ts`. Move the two `initialMessages` tests here
  from `tests/getJobDetails.test.ts` (lines 40–48), and update them for the new signature and
  wording. Then check that:
  - the system prompt contains the data sentence with this run's open and close markers;
  - it no longer contains "Job descriptions are written by employers" or "ignore any
    instructions";
  - the resume and preferences sit outside any marker.
- [X] T012 In `src/agent/prompt.ts`, add `dataSentence(markers)`, exported for the lookup prompt.
  It replaces the "Job descriptions are written by employers…" line. `initialMessages(config,
  markers)` takes the markers.
- [X] T013 [P] [US2] Unit tests in a new `tests/careersMarkers.test.ts` (use `lookupSetup`):
  - The lookup's system prompt names the markers, and neither it nor any lookup tool's description
    contains the job's title, company or location.
  - The first user message carries `<title> at <company>, <location>` between the markers, and the
    remembered-page line, when there is one, is inside the same block.
  - A search result and an opened page reach the model wrapped.
  - A job title containing `<<data` reaches the model without it, and a `lookalike_removed` trace
    event names the looked-up job with `tool: "lookup_opening"`.
- [X] T014 [US2] In `src/careers/prompt.ts`:
  - `lookupMessages(job, remembered, markers)` uses `dataSentence` (it replaces "Pages are web
    content…").
  - Remove the `{company}` replacement and the job from `SYSTEM`; the Tools line says "the
    employer's careers page".
  - Put the job (and any remembered page) in the wrapped opening message, scrubbing its fields, and
    return the hits.

  In `src/careers/lookUpJob.ts`:
  - Pass `markers` and an `onLookalike` writing a `lookalike_removed` trace event (tagged with the
    lookup) through `agentDeps`.
  - Report the opening message's hits the same way, with `tool: "lookup_opening"`.
  - `LookupDeps` gains `markers`, built once per run.
- [X] T015 [P] Unit test in a new `tests/lookalikes.test.ts` (memory stores, `testContext`):
  `reportLookalike(context, { tool: "get_job_details", jobId: "a" })` writes exactly
  `{ type: "lookalike_removed", tool: "get_job_details", job_id: "a" }` to the trace, with no other
  fields and no text.
- [X] T016 Create `src/app/lookalikes.ts` (`reportLookalike`). In `src/app/run.ts`:
  - Build `dataMarkers(runId)` once.
  - Pass it to `initialMessages` and the main agent's `agentDeps`, with
    `onLookalike: (hit) => reportLookalike(context, hit)`.
  - Thread the markers to the careers lookup through `ToolContext.careers` (`src/tools/context.ts`)
    and `careersDeps` in `src/tools/careersStep.ts`.

  Update the defaults in `tests/helpers/context.ts` and `tests/helpers/careersLookup.ts` (the fixed
  test UUID).
- [X] T017 Fix the existing tests that read the lookup's system prompt for the job (plan Risks):
  `tests/fetchJobs.test.ts:96` (`requests[0]?.[0]` → the first user message), and any in
  `tests/careersLookup.test.ts`. Then run `npm run check` and `npm run check:db`, delete the
  marker, and commit ("Wrap outside text in run-bound data markers (009 S1)").

**Checkpoint**: US1 and US2. Every outside-text result and every lookup job is wrapped, the lookup
prompt and tool descriptions carry no job field, and look-alikes are removed and traced.

---

## Phase 3: User Story 1 - Outside text can't steer the agent's scoring (Priority: P1)

Delivered by S1: T003–T012 and T015–T016.

**Independent Test**: T009 and T011 in unit tests, and quickstart §3 with the owner's model.

## Phase 4: User Story 2 - Web pages can't steer the careers lookup (Priority: P1)

Delivered by S1: T013 and T014, on top of the shared loop.

**Independent Test**: T013 shows every lookup input is wrapped. Quickstart §3b, with the owner's
model, shows a page telling the lookup to finish doesn't get stored.

---

## Phase 5: User Story 3 - Injection attempts are visible (Priority: P2)

**Goal**: a job whose text carried a forged marker is flagged and shows a badge, and is still
scored normally.

**Independent Test**: a removal reported for one job flags only that job, a store failure is traced
and doesn't stop the run, and the web UI shows the badge.

### Sitting S2: the flag and the badge (T018–T028)

Create `.specify/sitting-in-progress` naming S2 before T018.

- [X] T018 [US3] Integration test `tests/integration/migrate.test.ts`:
  - Line 56's expected list gains `"006_injection_flag"`.
  - The 005 test (lines 75–77) filters out 005 and 006 and expects
    `["005_page_sources", "006_injection_flag"]` to run.
  - `columnTypes` takes the table name.
  - New: `jobs.injection_seen_at` is `varchar(32) YES NULL utf8mb4_bin`, and existing jobs have it
    null.
- [X] T019 [US3] Create `src/db/migrations/006_injection_flag.ts` (export `injectionFlag`) with
  `db.schema.alterTable("jobs").addColumn("injection_seen_at", "varchar(32)")`, and list it in
  `src/db/migrations/index.ts`. Add `injection_seen_at: Text` to `JobsTable` in
  `src/db/schema.ts`.
- [X] T020 [P] [US3] Contract case in `tests/helpers/descriptionContract.ts` (memory and MariaDB),
  reading the flag through `jobViews.allJobs`:
  - `flagInjection(jobId, t1)` sets `injection_seen_at` to `t1` on every row with that `job_id`.
  - `flagInjection(jobId, t2)` keeps `t1`.
  - Score and `scored_at` are unchanged.
  - Re-upserting the job keeps the flag.
- [X] T021 [US3] Add `flagInjection(jobId: string, at: string): Promise<void>` to `JobStore` in
  `src/db/store.ts`.
  - Implement it in `src/db/kysely/jobStore.ts` with `updateTable("jobs")`
    `.set({ injection_seen_at: at }).where("job_id", "=", jobId).where("injection_seen_at", "is", null)`,
    and the same in `tests/helpers/memoryStore.ts`. Add `injection_seen_at: null` to that file's
    `UNSCORED` defaults (line 16).
  - Add `injection_seen_at` to `jobViewSchema` in `src/db/rows.ts` (the views only, not
    `jobRowSchema`) and to `JOB_COLUMNS` in `src/db/kysely/jobViews.ts`. Upserts never write it.
- [X] T022 [P] [US3] Unit tests:
  - `tests/lookalikes.test.ts`: a hit with a `jobId` flags that job, and only that job. A hit with
    `jobId: null` flags nothing. When `flagInjection` throws, `reportLookalike` doesn't throw and
    traces `{ type: "injection_flag_failed", tool, job_id, error }`.
  - `tests/careersMarkers.test.ts`: a forged marker on an opened page flags the looked-up job, and
    a failing store is traced, not thrown.
- [X] T023 [US3] Make both reporters flag, each catching its own failure:
  - `reportLookalike` in `src/app/lookalikes.ts` calls `flagInjection(jobId, now)` when `jobId`
    isn't null.
  - The lookup's reporter in `src/careers/lookUpJob.ts` flags the looked-up job's `jobId`.
- [X] T024 [P] [US3] Unit test in `tests/webRows.test.ts`: a job view with `injection_seen_at` set
  gives `JobRowView.injection: true`, and one without gives `false`.
- [X] T025 [US3] Add `injection: boolean` to `JobRowView` in `src/web/api.ts`, set it in
  `src/web/rowViews.ts`, and add `injection: false` to `BASE_JOB_ROW` in
  `tests/helpers/rowFixtures.ts`.
- [X] T026 [P] [US3] UI test in `tests/client/jobRow.test.tsx`: a row with `injection: true` shows
  "⚠ tried to escape the data markers", and one with `false` doesn't.
- [X] T027 [US3] In `web/components/tables/TitleCell.tsx`:
  - Move the filter note, hidden note and the new badge into a `TitleNotes` component in the same
    file, keeping both functions within 20 lines.
  - Show `<small className="note injection">⚠ tried to escape the data markers</small>` when
    `job.injection`.

  Style `.injection` in `web/app/styles.css` like `.ghost`.
- [X] T028 [US3] Run `npm run check` and `npm run check:db`, delete the marker, and commit ("Flag
  jobs whose text tried to escape the data markers (009 S2)").

---

## Phase 6: Polish & Cross-Cutting Concerns

### Sitting S3: docs and validation (T029–T034)

Create `.specify/sitting-in-progress` naming S3 before T029.

- [ ] T029 [P] Docs:
  - `README.md`: describe the data markers in "The big idea" and "Careers lookup"; update
    "A tool call, up close" (results arrive wrapped) and "What a job row remembers"
    (`injection_seen_at`); add the badge and the residual risk (quickstart §4).
  - `CLAUDE.md`: next to the careers note, say that every outside-text tool declares
    `outsideText: true`, wrapping lives in `src/agent/wrapped.ts`, and tool events in the trace
    stay unwrapped.
- [ ] T030 Record the test ledger below. Run `npm run check` and `npm run check:db`, delete the
  marker, and commit ("Document run-bound data markers (009 S3)").
- [ ] T031 After the owner merges: run `npm run docker:up` and
  `docker compose --profile browser up -d browser`.
- [ ] T032 Quickstart §2 on the next production run. Record counts only.
- [ ] T033 Quickstart §3 (SC-002) on `myjobbot_test`. Record the score pairs and flags, never job
  text.
- [ ] T034 Quickstart §3b (US2 with the owner's model). Record the outcome and reason only.

---

## Dependencies & Execution Order

- **S0 → S1 → S2 → S3.** S2 needs S1's reporters, and S3 documents both.
- **US1 and US2** both land in S1, because the loop is shared. **US3** lands in S2.

## Parallel Opportunities

- S1: T003, T005, T007, T009, T011, T013 and T015 are separate test files.
- S2: T020, T022, T024 and T026 are separate test files.

## Parallel Example: S1

```text
Task: "T003 Unit test tests/markers.test.ts"
Task: "T005 Unit test tests/wrapped.test.ts"
Task: "T007 Unit test tests/toolDeclarations.test.ts"
Task: "T011 Unit test tests/prompt.test.ts"
```

## Implementation Strategy

1. **MVP**: S0 and S1. All outside text is wrapped, look-alikes are removed, and removals are
   traced. That's the protection.
2. **Then** S2 (the flag and the badge), which makes attempts visible.
3. **Then** S3 (docs), the merge, and the live checks.

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (T002) | 423 | 39 (1 skipped without a browser) | 30 |
| Planned new | ~27 (T003, T005, T007, T009, T011, T013, T015, T020 on memory, T022, T024) | 2 (T018; T020 on MariaDB) | 1 (T026) |
| After S3 (T030) | | | |
