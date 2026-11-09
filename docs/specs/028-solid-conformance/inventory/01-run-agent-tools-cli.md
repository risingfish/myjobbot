# Run, agent loop, scoring tools, CLI, config and shared helpers

Reviewed: 53 modules, 5 findings.

## Modules

| Module | Outcome |
|---|---|
| `src/agent/budget.ts` | none |
| `src/agent/compact.ts` | none |
| `src/agent/llm.ts` | none |
| `src/agent/loop.ts` | none |
| `src/agent/markers.ts` | none |
| `src/agent/ownerMessage.ts` | A5 |
| `src/agent/prompt.ts` | A4 |
| `src/agent/rubric.ts` | A4 |
| `src/agent/trace.ts` | none |
| `src/agent/wrapped.ts` | none |
| `src/app/beforeAgent.ts` | A2 |
| `src/app/gmailState.ts` | none |
| `src/app/importPlan.ts` | none |
| `src/app/importSqlite.ts` | none |
| `src/app/lookalikes.ts` | none |
| `src/app/run.ts` | A2 |
| `src/app/runAll.ts` | none |
| `src/app/runLines.ts` | none |
| `src/app/runLogs.ts` | none |
| `src/app/runParts.ts` | none |
| `src/app/runSettings.ts` | none |
| `src/app/usersToRun.ts` | none |
| `src/config/boostCarryOver.ts` | none |
| `src/config/load.ts` | none |
| `src/config/parse.ts` | none |
| `src/config/resolve.ts` | none |
| `src/config/resumeFile.ts` | none |
| `src/config/schema.ts` | none |
| `src/config/searchSettings.ts` | none |
| `src/http/client.ts` | none |
| `src/http/clock.ts` | none |
| `src/http/errors.ts` | none |
| `src/http/limiter.ts` | none |
| `src/http/readCapped.ts` | none |
| `src/tools/careersStep.ts` | A1, A3 |
| `src/tools/context.ts` | A2 |
| `src/tools/dispatch.ts` | none |
| `src/tools/finish.ts` | A1 |
| `src/tools/getJobDetails.ts` | none |
| `src/tools/jobLog.ts` | none |
| `src/tools/jobSummary.ts` | none |
| `src/tools/listSources.ts` | A1 |
| `src/tools/nextJobs.ts` | A1 |
| `src/tools/recordMatches.ts` | A3 |
| `src/tools/registry.ts` | none |
| `src/tools/searchBudget.ts` | none |
| `src/tools/sources.ts` | A1 |
| `src/tools/tool.ts` | none |
| `src/tools/unscored.ts` | A1 |
| `src/cli.ts` | none |
| `src/cliUser.ts` | none |
| `src/errors.ts` | none |
| `src/contentId.ts` | none |

## Findings

### A1 · ISP · `src/tools/sources.ts:7`
- **Breach**: The source and paging helpers in `src/tools/` take the whole 19-member `ToolContext` although each reads two or three members: `sourcesOn` and `findSource` (`sources.ts:7`, `:22`) read only `saved.list` and `gmail.connected`; `unscoredJobs` (`unscored.ts:9`) only `run.sources`, `store.unscoredForSource`/`unscoredSince` and `config`; `sourceProgress`/`sourceStatus` (`listSources.ts:20`), `finish`/`remainingWork` (`finish.ts:22`) and `jobPage` (`nextJobs.ts:24`) only those plus `run` or `postings.earliestSeen`/`now`. The tool builders `listSourcesTool`, `nextJobsTool` and `finishTool` and the private helpers `freshJobs`/`retriedJobs` in `careersStep.ts` do the same. Their neighbours `getJobDetails.ts`, `jobSummary.ts`, `recordMatches.ts`, `searchBudget.ts` and `app/lookalikes.ts` already take a `Pick<...>`, so the area is inconsistent.
- **Why it matters**: A unit test of `sourcesOn`, `unscoredJobs` or `finish` has to build a full `testContext()`, with a chat function, HTTP clients, a page renderer, a DNS lookup and a careers store, none of which the code under test touches. A reader also can't tell from a signature what a helper depends on. And the re-score path can't reuse these helpers with its own smaller context.
- **Decision**: fix
- **Fix**: Give each helper a narrow type, following the `DetailsContext`/`SummaryContext` pattern already in `getJobDetails.ts` and `jobSummary.ts`. For example, `type OnContext = { saved: Pick<SavedSources, "list">; gmail: Pick<GmailAccess, "connected"> }` for `sourcesOn`/`findSource` (export `SavedSources`/`GmailAccess` or Pick through `ToolContext["saved"]`); `type UnscoredContext = Pick<ToolContext, "run" | "config"> & { store: Pick<JobStore, "unscoredForSource" | "unscoredSince"> }` for `unscoredJobs`; then intersect these for `sourceProgress`, `finish` and `jobPage`. Leave the builders in `registry.ts` taking `ToolContext`, which is fine at that composition point. Callers keep passing the full context, so no call sites change. `tests/helpers/context.ts` keeps working, and new tests can pass small literals.
- **Size**: M
- **Added by the analysis (2026-11-08), rule OCP, fixed with A1 and not counted separately**: `sourcesOn`'s `readsGmail` (`src/tools/sources.ts:13`) checks the `"gmail"` requirement by name. It is fixed with A1 by an `OFF_WHILE_UNMET: Record<Requirement, boolean>` table beside `Requirement`, with `Met` moved to `src/sources/module.ts` (tasks T029). Each place builds its own `Met`: `sourcesOn` from `gmail.connected`, the fetch phase from `gmail.usable`.
- **Done**: S3a

### A2 · ISP · `src/tools/context.ts:32`
- **Breach**: `ToolContext` is the container the project rule says not to build ("a container holds stores, not operations"). It mixes stores (`store`, `postings`, `sourcePlans`, `apiCalls`, `companies`, `saved.store`, `gmail.store`/`alerts`, `careers.store`) with operations (`chat`, `now`, `http`, `sources`, `trace`, `jobLog`, `careers.renderer`/`lookup`/`pages`) and with mutable per-run state (`run`: `finished`, `summary` and the `sources` map, written by `finish.ts` and `fetchPhase.ts` and read by `app/run.ts`). `beforeAgent` (`app/beforeAgent.ts:8`) and, outside this area, `fetchSources`, `searchCompanies` and `alertAccess` take it whole.
- **Why it matters**: Every new run-time dependency gets added to this one type, and every consumer and test fixture then carries it. `tests/helpers/context.ts` already has to stub 19 members, most of them rejecting functions. The mutable `run` state sits beside injected services, so any holder of the context can end the run, and code review can't see which modules write it.
- **Decision**: fix
- **Fix**: Split the type into three named parts and make `ToolContext` their intersection, assembled only in `app/run.ts#buildContext` and `tests/helpers/context.ts`: `RunStores` (stores only), `RunPorts` (`chat`, `now`, `http`, `sources`, `trace`, `jobLog`, the careers access and Gmail key/IMAP), and `RunIdentity` (`run`, `runId`, `markers`, `config`, `jsearchApiKey`; the existing `RunState` type of `run` keeps its name). Consumers then name the part they use: after A1, the tool helpers mostly need `RunStores` and `RunState`. `beforeAgent`, `fetchSources`, `searchCompanies` and `alertAccess` move to the intersections they actually read. This changes no runtime shape (the same object is passed), only types. Do A1 first. The out-of-area callers (`src/sources/fetchPhase.ts`, `src/sources/alertAccess.ts`, `src/companies/searchCompanies.ts`) should be coordinated with their area's review.
- **Size**: L
- **Done**: S3a

### A3 · OCP · `src/tools/careersStep.ts:18`
- **Breach**: Two scoring-side modules branch on one source variant by name. `freshJobs` selects the jobs owed a careers lookup with `source.module === "gmail_alerts"`. `record` in `recordMatches.ts:47` adds the "scored from the alert only" gap when `job?.ats === "linkedin" && job.description === null`. The knowledge that "alert jobs come from the `gmail_alerts` module and are stored as ats `linkedin`" is spread across `src/tools/`, instead of being declared by the module (`src/sources/modules/gmailAlerts.ts`). `src/sources/alertAccess.ts:9` repeats the module-id comparison outside this area.
- **Why it matters**: Adding a second alert-style source, one that also brings jobs without descriptions (another mailbox provider, another alert sender with its own ats), means editing the careers step and the scoring tool. That is exactly the per-variant branching the rule forbids. The source registry was built to avoid it (`moduleFor(...)?.requires` is already used this way in `tools/sources.ts:13`).
- **Decision**: fix
- **Fix**: Add a declarative capability to `SourceModule` (`src/sources/module.ts`), for example `readonly descriptions: "included" | "careers_lookup"`, set to `"careers_lookup"` only in `gmailAlerts.ts`. `careersStep.freshJobs` then picks every on source whose `moduleFor(source.module)?.descriptions === "careers_lookup"`, so the decision stays in `careersStep.ts` as CLAUDE.md requires. For `recordMatches`, move the ats test into one exported predicate owned by the Gmail alert code (for example `isAlertJob(row)` in `src/gmail/alertJobs/`, beside `alertJobId`), so the tool asks "is this an alert job without a description" without knowing the ats. Behaviour, stored data and the gap text are unchanged. Touches `module.ts`, every module file (one new field, or make it optional with `"included"` as the default), `careersStep.ts`, `recordMatches.ts` and `alertAccess.ts`.
- **Size**: M
- **Done**: S3b

### A4 · ISP · `src/agent/rubric.ts:42`
- **Breach**: `scoringRubric` and `rubricValues` take a whole `AppConfig` (`env` with the LLM key, `resume`, `profile`, `dataDir`, `settings`) but read only `settings.match_threshold` and `settings.preferences`. `agent/prompt.ts#systemPrompt` passes a whole `AppConfig` along for the same reason.
- **Why it matters**: The rubric is the template shared by runs, re-scores and evals (`rescore/prompt.ts:27`, and eval runs through it). Each of those callers, and every test of the template, has to build a full application config with an environment just to fill two numbers and a string. Eval code that varies only settings (`evals/runCases.ts:73`) has to rebuild the whole `AppConfig` to do so.
- **Decision**: fix
- **Fix**: Change the parameter to `settings: Pick<Settings, "match_threshold" | "preferences">` in `rubricValues` and `scoringRubric`. The callers `agent/prompt.ts#systemPrompt` and `rescore/prompt.ts` pass `config.settings`. The output is unchanged, and the prompt snapshot (`tests/__snapshots__/prompt.test.ts.snap`) pins that.
- **Size**: S
- **Done**: S3a

### A5 · OCP · `src/agent/ownerMessage.ts:9`
- **Breach**: `ownerMessage` branches on each `resume_view` value (`"resume"`, `"resume_and_profile"`, otherwise `profile`) with `if` statements rather than a per-view table.
- **Why it matters**: Adding a fourth view means editing this function. That cost is small: the enum (`RESUME_VIEWS`) is closed and shown to users, and this is the only place it is dispatched.
- **Decision**: accept (owner approved, 2026-11-08)
- **Fix**: This function is the single, designated dispatch point for a three-value, user-visible enum (CLAUDE.md, feature 023), so a registry would add indirection without removing a second branch site anywhere.
- **Size**: S

## Mechanical checks

- **No source-variant names outside the sources modules (A3)**: scan every `src/**/*.ts` file outside `src/sources/modules/` and `src/gmail/` for a source-variant name in a comparison, `/\bmodule\s*[!=]==\s*["']/` and `/\bats\s*[!=]==\s*["'](linkedin|jsearch|workday|greenhouse|lever|ashby)["']/`, and fail on any hit not in a short explicit allow-list. The allow-list would hold the Kysely store's ats filter in `src/db/kysely/jobStore.ts` and migrations.
- **No whole `ToolContext` in tool helpers (A1)**: with the TypeScript compiler API (or a regex on `/\(\s*context:\s*ToolContext\s*[,)]/`), list the functions in `src/tools/` whose parameter type is exactly `ToolContext`, and fail if any is not one of the tool builders `buildTools`, `listSourcesTool`, `nextJobsTool`, `getJobDetailsTool`, `finishTool` or `lookUpAlertJobs`.
- **The rubric doesn't see the application config (A4)**: assert that `src/agent/rubric.ts` does not import `AppConfig` from `config/load.js`.
