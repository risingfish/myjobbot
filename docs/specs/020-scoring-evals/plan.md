# Implementation Plan: Scoring evals

**Branch**: `020-scoring-evals` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/020-scoring-evals/spec.md`

## Summary

A new `src/evals/` module holds the eval format: strict zod schemas for profiles, cases, answer keys,
prompts, runs and results, each file carrying `schema: 1`, and an `EvalFiles` store that reads and
writes them under `<data>/evals/` (gitignored) through a small file-system port, so the store is
unit-tested in memory and checked once on a real directory. Commands arrive through the CLI as
`npm start -- eval <sub>`, one per pull request, the format first; each part of the store is built
in the sitting of its first production caller:

1. `eval check`: read everything, report counts and any bad file by name (the format's readers).
2. `eval capture <ats> <job_id> | --recent N`: freeze stored jobs as cases from the database (the
   profile and case writers, ids), with the job's age computed as of its observed score (FR-004),
   the description-arrival flag (FR-005) and whether production read the full details (FR-005a).
3. `eval answer-key <case-id> …`: write an answer key on the fixed scale, keeping its history.
4. `eval run [--tag] [--case] [--repeats N] [--model M]`: score each case in a one-job session that
   shares the re-score's agent deps, prompt and `record_matches`, with a `get_job` that returns the
   case's frozen job; prompts per profile, results and the trace to `runs/<run-id>/`.
5. `eval report <run-id> [--against <run-id> | observed] [--reasons]`: pass rate, per-case tokens
   and time, spread, moves, fixed and broken counts.

Nothing here changes the database's contents, a run, or a stored score; capture only reads.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx)

**Primary Dependencies**: no new ones. zod 4 for the format, `node:crypto` (SHA-256, `randomUUID`),
`node:fs/promises` behind a port, `node:util` `parseArgs` per subcommand, the existing OpenAI client
(`createChat`) and agent loop (`runAgent`) for runs

**Storage**: JSON files under `<data>/evals/` (owner decision); reads the existing MariaDB stores
during capture only, through two new read queries (`JobViews.recentlyScored`,
`CareersStore.descriptionFoundAt`); no migration

**Testing**: vitest `node` (unit: in-memory file port, memory stores, scripted chat with usage),
`integration` (one real temporary-directory round trip; the two new queries' contract cases on
`myjobbot_test`)

**Target Platform**: the owner's checkout and the `myjobbot` container (same CLI)

**Project Type**: CLI module in the existing single project

**Performance Goals**: capture 20 jobs in under a minute (SC-001); a run is bounded by the model

**Constraints**: data stays in `data/` (FR-014); evals never run in `npm run check` (FR-015); job
text reaches the model only inside data markers built from a random id per attempt (feature 009);
reports print no description text (FR-013); writes are atomic (`.tmp`, then rename)

**Scale/Scope**: tens to a few hundred cases; runs of a few hundred attempts

## Constitution Check

Checked against constitution **v2.4.0**.

| Principle | Check |
|---|---|
| I. Habit-hooks clean | Every sitting ends with `npm run check` green; functions ≤ 20 lines, files ≤ 200 (`store.ts` is at 199, so `CareersStore` moves to its own file before growing; capture and its command are separate files); each export reached from `src/cli.ts` in the sitting that creates it (knip's production pass), so writers and ids arrive with their first callers |
| II. Test-first, mix | Decisions (schemas, ids, age as scored, observed read, judging, failure codes, spreads, moves) are plain functions with unit tests; files, database and model behind ports. Planned: +50 unit, +3 integration, +0 UI (ledger in tasks.md); moves toward 95/4/1 |
| III. Purpose comments | One-line doc comment on every function |
| IV. Dependencies | No new libraries; zod, Kysely, `parseArgs`, OpenAI used their own way |
| V. docs/specs | This directory |
| Workflow (2.4.0) | Not UI work: the sittings change `src/cli.ts`, `src/db/` and `src/rescore/session.ts`, which the `myjobbot` container runs from this checkout, so the Docker stack is stopped from the first code change until the feature merges, the docs sitting included |

Gate: passes; nothing in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
docs/specs/020-scoring-evals/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── eval-cli.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/evals/
├── format.ts           strict zod schemas and types (S1)
├── filePort.ts         FilePort and nodeFilePort, rooted at the data folder (S1)
├── files.ts            EvalFiles: readers (S1); profile/case writers (S2), answer key (S3), prompt/run/result (S4)
├── check.ts            eval check (S1)
├── ids.ts              caseId, contentId (S2); runId (S4)
├── capture.ts          profileOf, buildCase, asScoredDates (pure, S2)
├── captureCommand.ts   eval capture (S2)
├── observedRead.ts     details | summary | unknown from the observed trace (S2)
├── answerKey.ts        parseAnswerKeyArgs, rewritten, rangeWarning, answer-key command (S3)
├── judge.ts            pass rules (S4)
├── failure.ts          failureOf (S4)
├── session.ts          scoreCase: one case through the model (S4)
├── runCases.ts         eval run (S4)
├── report.ts           summaries, spreads, moves (pure, S5)
└── reportText.ts       report lines (S5)
src/cli.ts              command name only, raw arguments to each command; `eval` subcommands (S1)
src/db/careersStore.ts  CareersStore and AuditEntry moved out of store.ts, + descriptionFoundAt (S2)
src/db/store.ts         JobViews.recentlyScored (S2)
src/rescore/session.ts  oneJobAgentDeps exported, used by re-score and evals (S4)
src/rescore/traceSteps.ts  loggedCareers wraps descriptionFoundAt (S2)

tests/
├── evalFormat, evalFiles, evalCheck (S1); evalIds, evalFileWrites, evalCapture, evalObservedRead (S2);
│   evalAnswerKey (S3); evalJudge, evalFailure, evalSession, evalRunCases (S4); evalReport (S5)
├── helpers/memoryFilePort.ts (S1), helpers/usageChat.ts (S4)
├── toolDeclarations.test.ts (S4: the eval get_job)
├── helpers/careersStoreContract.ts and helpers/storeContract.ts (S2: the two queries)
└── integration/evalFiles.test.ts (S1: real directory)
```

**Structure Decision**: a self-contained `src/evals/` module, like `src/rescore/`, knowing nothing
about Next.js; the web page that browses runs (a later feature) will read the same files through
`EvalFiles`.

## Complexity Tracking

None.
