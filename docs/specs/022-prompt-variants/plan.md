# Implementation Plan: Prompt variants

**Branch**: `022-prompt-variants` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/022-prompt-variants/spec.md`

## Summary

The re-score's system message becomes one template, `STEPS + RUBRIC`, filled by one function,
`fillTemplate` (`src/agent/rubric.ts`), which the code, the run and every variant share. A variant
is that template saved as `data/evals/variants/<name>.md` (a small versioned header, then the text),
exported from the code and edited by hand. `eval run --variant <name>` scores the cases with it
after checking its markers (`{data}`, `{threshold}`, `{preferences}`, nothing else), warns when the
code's template has changed since export, and records the variant on the run. `eval prompt diff`
shows changed lines between variants or a variant and the code. A series
(`data/evals/series/<name>.json`) is a saved list of tests (a variant or the code's prompt, with an
optional model) over the same cases and repeats; `eval series run` runs them one after another as
ordinary runs, and `eval series report` sets them side by side. Nothing touches the database or
what scheduled runs and Re-score send.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx)

**Primary Dependencies**: none new. zod 4, 020's `EvalFiles`/`FilePort`, `contentId`, `runCases`,
`summarize`

**Storage**: files under `data/evals/` (variants as `.md` with a header; series and series runs as
JSON); 020's run record gains two optional fields

**Testing**: vitest `node` (unit, in-memory file port, scripted chat); the run prompt snapshot test
guards the template refactor

**Target Platform / Project Type**: the owner's checkout and the container; CLI in the single
project

**Performance Goals**: a series takes the sum of its runs; checks before any model call are instant

**Constraints**: FR-012/SC-003 (no effect on scheduled runs, Re-score or stored scores); the
data-marker sentence can't be dropped (FR-008); reports print no description text

**Scale/Scope**: a handful of variants, series of up to 10 tests

## Constitution Check

Checked against constitution **v2.4.0**.

| Principle | Check |
|---|---|
| I. Habit-hooks clean | Every sitting ends green; new modules reached from `src/evals/command.ts` in the sitting that creates them; files ≤ 200 lines (series split into `series.ts` and `seriesReport.ts`) |
| II. Test-first, mix | Pure functions for filling, marker checks, header parsing, diff, series selection and tables, each unit-tested; the prompt snapshot pins the refactor. Planned +22 unit, +0 integration, +0 UI |
| III. Purpose comments | One-line doc comment per function |
| IV. Dependencies | No new library; the line diff is ~30 lines of our own (research R8) |
| V. docs/specs | This directory |
| Workflow (2.4.0) | Not UI work: S1 changes `src/agent/rubric.ts` and `src/rescore/prompt.ts` (the run and re-score path) and the CLI the container runs, so the Docker stack is stopped from the first code change until the feature merges. The whole feature is one sitting and one PR (owner decision, 2026-11-04) |

Gate: passes.

## Project Structure

### Documentation (this feature)

```text
docs/specs/022-prompt-variants/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/eval-cli.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

The whole feature is one sitting; the `S1`–`S4` marks below are its phases (foundation and export,
variant runs, diff, series), in task order.

```text
src/agent/rubric.ts          fillTemplate; scoringRubric through it (S1)
src/rescore/prompt.ts        rescoreSystemTemplate(); rescoreMessages through fillTemplate (S1)
src/evals/variant.ts         header parse/format, marker check, name rule (S1)
src/evals/variantCommand.ts  eval prompt export (S1), eval prompt diff (S3)
src/evals/experimentFiles.ts variants, series and series runs read/write (S1, S4)
src/evals/seriesFormat.ts    series and series-run schemas (S4)
src/evals/check.ts           counts variants (S1), series (S4); refused variants
src/evals/format.ts          run: optional variant, promptChanged (S2)
src/evals/session.ts         promptFor/scoreCase take an optional template (S2)
src/evals/runCases.ts        executeRun split from argument parsing; --variant, refusal, drift warning (S2); executeRun reused by series (S4)
src/evals/reportText.ts      variant and drift in the header (S2)
src/evals/lineDiff.ts        line diff (S3)
src/evals/series.ts          series save and run (S4)
src/evals/seriesReport.ts    series report tables (S4)

tests/
├── rubric.test.ts or prompt.test.ts (fillTemplate; snapshot unchanged) (S1)
├── evalVariant.test.ts (S1), evalVariantRun.test.ts (S2), evalLineDiff.test.ts (S3),
│   evalSeries.test.ts, evalSeriesReport.test.ts (S4)
```

**Structure Decision**: extend `src/evals/`; the only production code outside it is the one-line
reshaping of how the rubric and re-score prompt are filled, guarded by the existing snapshot.

## Complexity Tracking

None.
