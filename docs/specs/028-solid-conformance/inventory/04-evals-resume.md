# Evals and prompt variants, the resume and its profile

Reviewed: 35 modules, 9 findings.

## Modules

| Module | Outcome |
|---|---|
| `src/evals/answerKey.ts` | E8 |
| `src/evals/answerKeyRules.ts` | E1 |
| `src/evals/capture.ts` | none |
| `src/evals/captureCommand.ts` | E8 |
| `src/evals/caseTools.ts` | none |
| `src/evals/check.ts` | none |
| `src/evals/command.ts` | none |
| `src/evals/experimentFiles.ts` | none |
| `src/evals/failure.ts` | E7 |
| `src/evals/filePort.ts` | none |
| `src/evals/files.ts` | none |
| `src/evals/format.ts` | none |
| `src/evals/ids.ts` | none |
| `src/evals/judge.ts` | E1 |
| `src/evals/lineDiff.ts` | none |
| `src/evals/observedRead.ts` | none |
| `src/evals/report.ts` | none |
| `src/evals/reportCommand.ts` | E8, E9 |
| `src/evals/reportText.ts` | none |
| `src/evals/runCases.ts` | E3 |
| `src/evals/runText.ts` | none |
| `src/evals/series.ts` | E2 |
| `src/evals/seriesFormat.ts` | none |
| `src/evals/seriesReport.ts` | E8, E9 |
| `src/evals/session.ts` | E5 |
| `src/evals/variant.ts` | none |
| `src/evals/variantCheck.ts` | none |
| `src/evals/variantCommand.ts` | none |
| `src/resume/limits.ts` | none |
| `src/resume/read.ts` | E4 |
| `src/resumeProfile/extract.ts` | E6 |
| `src/resumeProfile/open.ts` | none |
| `src/resumeProfile/profile.ts` | none |
| `src/resumeProfile/prompt.ts` | none |
| `src/resumeProfile/usageLog.ts` | none |

`command.ts` and `resumeProfile/open.ts` are composition roots (CLI entry, model-backed extraction
entry), so their `new Date()`, `Math.random`, `execFileSync`, `loadConfig` and `createChat` are in
the right place.

## Findings

### E1 · OCP · `src/evals/answerKeyRules.ts:74`
- **Breach**: The pass rules per verdict exist twice as per-verdict `if` chains: `verdictHolds` in
  `judge.ts:17` (the rules CLAUDE.md names as the one source, "Pass rules are `judge`") and
  `passingBand` in `answerKeyRules.ts:74`, each with its own `BORDERLINE_BAND = 10`. Adding a
  verdict, or changing a band, means editing both chains in step.
- **Why it matters**: The `answer-key` command's range warning can silently disagree with what
  `judge` actually passes if only one copy is changed; no test ties them together, and a new verdict
  in `format.ts`'s enum falls through to the borderline branch in both without a compiler error.
- **Decision**: fix
- **Fix**: In `judge.ts`, keep one `PASS_BANDS: Record<AnswerKey["verdict"], (threshold: number) => [number, number]>`
  (recommend `[t, 100]`, reject `[0, t - 1]`, zero `[0, 0]`, borderline `[max(0, t - 10), min(100, t + 10)]`)
  and export `passingBand(verdict, threshold)`; `verdictHolds` becomes "score lies in the band"
  (equivalent, since scores are 0-100 by `format.ts`'s `total`). `answerKeyRules.ts` imports
  `passingBand` and drops its own copy and constant. The `Record` makes a new verdict a compile
  error until its band is given. Callers: none change.
- **Size**: M

### E2 · OCP · `src/evals/series.ts:9`
- **Breach**: The `TEST` regex spells out the resume views `(resume|resume_and_profile|profile)`
  instead of using the registry `RESUME_VIEWS` (`src/config/schema.ts:19`), which the rest of the
  file (`testOf`, line 96) and `runCases.ts` already use.
- **Why it matters**: Adding a view to `RESUME_VIEWS` makes `eval run --view` accept it but `eval
  series save --test a=code+newview` refuse it, until someone finds and edits this regex.
- **Decision**: fix
- **Fix**: Build the pattern from the list: `new RegExp(`^([a-z0-9][a-z0-9-]{0,39})=([^@+]+)(?:\\+(${RESUME_VIEWS.join("|")}))?(?:@(.+))?$`)`.
  Same matches today. Callers: none.
- **Size**: S

### E3 · OCP · `src/evals/runCases.ts:90`
- **Breach**: `viewRefusal` decides which views need a resume profile by comparing `view ===
  "resume"`; `ownerMessage` (`src/agent/ownerMessage.ts:10`) holds the same knowledge with its own
  `view === "resume"`. Which views read the profile is a property of each view, restated per caller.
- **Why it matters**: A new view (say a skills-only one) needs both places edited; if only
  `ownerMessage` learns it reads the profile, eval runs with it would start on cases captured
  without a profile instead of being refused.
- **Decision**: fix
- **Fix**: Next to `RESUME_VIEWS`, export `READS_PROFILE: Record<ResumeView, boolean>` (or
  `viewReadsProfile(view)`) and use it in `viewRefusal` and in `ownerMessage`'s first branch.
  Callers: `runCases.ts`, `ownerMessage.ts`.
- **Size**: M

### E4 · OCP · `src/resume/read.ts:16`
- **Breach**: `plainText` picks the reader with an `if` per file type (`pdf`, `docx`, else UTF-8),
  so a new `resumeFileType` (e.g. `odt`, `rtf`) is added by editing this chain, and an unhandled one
  silently falls into the UTF-8 branch.
- **Why it matters**: Adding a type to the enum in `src/db/resumeStore.ts` compiles cleanly and
  then decodes binary files as text; nothing forces the new reader to exist.
- **Decision**: fix
- **Fix**: A `READERS: Record<ResumeFileType, (bytes: Uint8Array) => Promise<string>>` in
  `read.ts` (`md` and `txt` share the UTF-8 reader), and `plainText` becomes `READERS[type](bytes)`.
  The `Record` turns a missing reader into a compile error. Callers: none.
- **Size**: S

### E5 · DIP · `src/evals/session.ts:28`
- **Breach**: `scoreCase` takes `SessionDeps` but reaches for `randomUUID()` (line 28),
  `Date.now()` (lines 32, 39) and `new Date()` (line 33) itself, and `oneJobAgentDeps`
  (`src/rescore/session.ts:61`) fixes the session clock to `Date.now`, although `RunDeps` already
  carries `now` and `random` for exactly this.
- **Why it matters**: The stored `ms` in `results.jsonl` and the markers can't be pinned in
  `tests/evalSession.test.ts`, and the `timed_out` path can't be driven without a real wait.
- **Decision**: fix
- **Fix**: Add `clock: () => number` and `markerTag: () => string` to `SessionDeps`; `oneAttempt`
  passes `clock: () => deps.now().getTime()` and a `markerTag` from a new `RunDeps.uuid`, which
  `command.ts`'s `withRunDeps` sets to `randomUUID`. Let `oneJobAgentDeps` take the clock from the
  session it is given (re-score keeps the clock C5 gives it). `scoreCase`'s `now` for
  `reportLookalike` (line 33) becomes `() => new Date(deps.clock())`. Callers: `session.ts`,
  `runCases.ts`, `command.ts`, `rescore/session.ts` and its re-score caller, test helpers that build
  `RunDeps`/`SessionDeps`.
- **Size**: M

### E6 · DIP · `src/resumeProfile/extract.ts:42`
- **Breach**: `agentDeps` hard-wires `clock: Date.now` into the extraction session although
  `extractProfile` is otherwise handed everything through `ExtractDeps`.
- **Why it matters**: The 3-minute wall-clock limit of the extraction can't be tested in
  `tests/resumeExtract.test.ts` without waiting; the clock is the one dependency the tests can't
  replace.
- **Decision**: fix
- **Fix**: Add `clock: () => number` to `ExtractDeps`; `open.ts` (the composition root) passes
  `Date.now`, tests pass a fake. Callers: `extract.ts`, `open.ts`, `tests/resumeExtract.test.ts`,
  `tests/toolDeclarations.test.ts`.
- **Size**: S

### E7 · DIP · `src/evals/failure.ts:4`
- **Breach**: `failureOf` classifies a session's end by copies of the agent loop's reason texts
  (`"wall-clock budget exhausted"` from `src/agent/budget.ts:37`, `"LLM error:"` from
  `src/agent/loop.ts:65`) instead of depending on a value the loop declares.
- **Why it matters**: Rewording either message in the agent loop compiles and passes the loop's
  tests, but every timed-out or model-error eval attempt is then stored as `no_record`, corrupting
  results without any error.
- **Decision**: fix
- **Fix**: Export `WALL_CLOCK_REASON` from `budget.ts` and `MODEL_ERROR_PREFIX` from `loop.ts`, use
  them where the reasons are built, and import them in `failure.ts`. Same strings, no output change.
  Callers: `budget.ts`, `loop.ts`, `failure.ts`.
- **Size**: M

### E8 · ISP · `src/evals/reportCommand.ts:10`
- **Breach**: Every eval command takes the whole `EvalFiles` class (18 readers and writers over
  profiles, cases, keys, prompts, runs, results, traces, series) while each uses a few: `report` and
  `series report` only read, `answer-key` reads three folders and writes keys, `capture` uses
  `hasCase`, `writeProfile`, `writeCase`. The codebase's own pattern (`CaptureDeps.stores` is a
  `Pick<UserStores, …>`, `series.ts`'s `FileDeps` is a `Pick<RunDeps, …>`) is the narrow form.
- **Why it matters**: The signatures don't say that the report commands never write, and any
  change to `EvalFiles` (e.g. moving the series methods to `ExperimentFiles`, whose own doc comment
  already claims "the series that compare them") touches every command's type instead of the two
  that use them.
- **Decision**: fix
- **Fix**: Type each deps field as the `Pick` it uses: `ReportDeps.files: Pick<EvalFiles, "cases" |
  "answerKeys" | "profiles" | "runs" | "results">`, the same for `seriesReport`'s deps plus
  `"series" | "seriesRuns"`, `AnswerKeyDeps.files: Pick<EvalFiles, "cases" | "profiles" |
  "answerKeys" | "writeAnswerKey">`, `CaptureDeps.files: Pick<EvalFiles, "hasCase" | "writeProfile"
  | "writeCase">`. `command.ts` still passes the full instance. Callers: `answerKey.ts`,
  `captureCommand.ts`, `reportCommand.ts`, `seriesReport.ts`.
- **Size**: M

### E9 · SRP · `src/evals/reportCommand.ts:42`
- **Breach**: `contextOf`, which loads the cases, answer keys and profiles a report judges against,
  lives in the `report` CLI command module, so `seriesReport.ts` imports from another command to get
  it; the module mixes the command (argument parsing, printing, exit codes) with a shared loader.
- **Why it matters**: A change to the `report` command's form now sits in a file the series report
  depends on, and the loader can't be reused or tested without pulling in a command.
- **Decision**: fix
- **Fix**: Move `contextOf` to its own module (`src/evals/reportContext.ts`), taking the narrow
  `Pick<EvalFiles, "cases" | "answerKeys" | "profiles">`; `reportCommand.ts` and `seriesReport.ts`
  import it from there. Callers: those two and any test importing `contextOf`.
- **Size**: S

## Mechanical checks

- **Clock and randomness only at roots** (E5, E6): a test lists every `.ts` under `src/evals/`,
  `src/resume/` and `src/resumeProfile/` except `src/evals/command.ts` and
  `src/resumeProfile/open.ts`, and fails on any match of `Date.now`, `new Date()` (no arguments),
  `randomUUID`, `Math.random`, `process.env` or `node:fs`/`execFileSync` imports (`filePort.ts`
  allowed for `node:fs`).
- **One home for the pass rules** (E1): no file under `src/evals/` other than `judge.ts` contains a
  comparison against a verdict literal (`=== "recommend"`, `"reject"`, `"zero"`, `"borderline"`),
  checked by a regex over the sources.
- **No restated resume views** (E2, E3): no `src/` file outside `src/config/schema.ts` holds the
  literal `resume_and_profile`, except `src/agent/ownerMessage.ts`, whose branch stays (A5,
  accepted). The `eval run` usage text is built from `RESUME_VIEWS`. `view === "resume"`
  comparisons are not scanned (amended by the analysis, 2026-11-08).
- **Failure reasons match the loop** (E7): a unit test drives a real `Budget` past its wall-clock
  limit and a chat that throws, and asserts `failureOf` gives `timed_out` and `model_error`; this
  catches drift even before the constants are shared.
