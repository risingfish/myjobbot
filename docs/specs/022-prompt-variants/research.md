# Research: Prompt variants

## R1. What a variant holds

- **Decision**: a variant is the re-score's **system message template**: today's `STEPS` text
  (`src/rescore/prompt.ts`) followed by the shared `RUBRIC` template (`src/agent/rubric.ts`), with
  its three markers left in place: `{data}` (the data-marker sentence), `{threshold}` and
  `{preferences}`. The user message (`My resume: … Re-score the job now.`) and the two tools stay
  as the code has them (FR-004, FR-005).
- **Rationale**: the rubric already is a template with those markers, filled by `scoringRubric`;
  the re-score prefixes fixed steps. So "the whole system prompt" is one template string, and the
  resume never appears in it.
- **Alternatives**: rubric only (owner chose the whole prompt, Q1); a resume marker (the resume is
  in the user message, not the system prompt).

## R2. One fill function, so an unedited export is identical (FR-002, SC-002)

- **Decision**: `src/agent/rubric.ts` gains `rubricValues(config, markers)` (the data sentence,
  the threshold, and `preferences.trim() || "(none given)"`, so that rule lives in one place) and
  `fillTemplate(template, values)`, a single-pass replace of `{data}`, `{threshold}` and `{preferences}` (one regex,
  so a value that itself holds `{threshold}` is never re-substituted). `scoringRubric` becomes
  `fillTemplate(RUBRIC, …)`; `src/rescore/prompt.ts` exports `rescoreSystemTemplate()` (`STEPS +
  RUBRIC`) and builds its system message as `fillTemplate(rescoreSystemTemplate(), …)`. A variant
  is filled by the same function.
- **Rationale**: the export is the very template the code fills, and both go through one
  function, so filling an unedited export can't differ from the code. Today's `scoringRubric`
  replaces each marker once, in order, with preferences last; the single pass gives the same text
  for today's template (each marker appears once) and is safer for edited ones. The run prompt
  snapshot (`tests/__snapshots__/prompt.test.ts.snap`) pins that nothing changes.
- **Gate note**: this touches `src/agent/rubric.ts` and `src/rescore/prompt.ts`, the run and
  re-score path, so the Docker stack is stopped for the feature.

## R3. Variant file format

- **Decision**: `data/evals/variants/<name>.md`: a front-matter header, then the template text as
  written:
  ```
  ---
  schema: 1
  exportedAt: 2026-11-04T18:00:00.000Z
  exportedFrom: 63bc878fda5e5d59
  gitCommit: 25778fd…
  ---
  You are myjobbot, re-scoring one job …
  ```
  The header is a few `key: value` lines parsed by a small function and checked with a strict zod
  schema; the body is everything after the closing `---`, kept byte for byte.
- **Rationale**: a template is long prose with line breaks; editing it inside a JSON string means
  escaped newlines. Markdown with a header keeps it readable and diffable, and still carries a
  format version (FR-011).
- **Names**: `[a-z0-9][a-z0-9-]{0,39}`; anything else is refused naming the rule; `code` is
  reserved for the code's prompt.

## R4. Checking a variant (FR-008)

- **Decision**: before any model call, a variant's body must contain `{data}`, `{threshold}` and
  `{preferences}`, each at least once, and no other `{word}` marker (`/\{[a-z_]+\}/`). Each problem
  is named (`missing {data}`, `unknown marker {thresold}`).
- **Rationale**: `{data}` carries feature 009's rule; dropping `{preferences}` or `{threshold}`
  would silently test a prompt without the owner's settings; an unknown marker is almost always a
  typo that would reach the model as literal text.

## R5. Drift (FR-008a)

- **Decision**: `exportedFrom` is the content id (020's `contentId`) of `rescoreSystemTemplate()` at
  export. A run with a variant compares it with today's; when they differ, the run prints `warning:
  the code's prompt has changed since <name> was exported` and records `promptChanged: true`.
- **Rationale**: exact, cheap, and independent of git (the container has none).

## R6. Runs gain two optional fields

- **Decision**: 020's run schema gains `variant: string | null` (optional, read as null when
  absent) and `promptChanged: boolean` (optional, false when absent). Still `schema: 1`.
- **Rationale**: old run files stay valid without an upgrade; strict parsing still rejects unknown
  fields.

## R7. Series

- **Decision**:
  - A **series** is `data/evals/series/<name>.json`: `{ schema: 1, tags, cases, repeats, tests }`,
    each test `{ label, variant: string | null, model: string | null }`, labels unique, 1..10 tests.
    Written by `eval series save` (or by hand) and checked on read.
  - A **series run** is `data/evals/series-runs/<id>.json`: `{ schema: 1, id, series, startedAt,
    endedAt, runs: { <label>: <run id> | null } }`, written before the first test and updated after
    each, so a stopped series shows which tests ran.
  - `eval series run` checks every test's variant first (R4, existence), refusing the whole series
    on any problem; then runs each test through `executeRun`, the part of `eval run` that takes
    already-parsed options (split out of `runCases`), one after another. Each `series run` is new.
  - `eval series report <name>` reads the latest series run (or `--run <id>`), summarizes each run
    with 020's `summarize`, and prints a test table and a case-by-test table, cases whose states
    differ between tests first.
- **Rationale**: a series reuses runs unchanged, so every 020 report still works on each of its
  runs; one JSON file per series is easy to edit by hand.

## R8. Line differences (FR-010)

- **Decision**: a small longest-common-subsequence line diff in `src/evals/lineDiff.ts`, printing
  `- ` and `+ ` lines with `@@ line N` headers and no unchanged lines.
- **Rationale**: templates are a few dozen lines, so an O(n·m) table is instant; no library needed
  (a new one would need the owner's approval, constitution IV).

## R9. Test mix

- Baseline (main after #105): 867 unit, 67 integration, 64 UI (998). Planned new: 22 unit, 0
  integration, 0 UI → 889 / 67 / 64 (86.9% → 87.2% unit of 1,020). The unit share rises toward
  95/4/1.
