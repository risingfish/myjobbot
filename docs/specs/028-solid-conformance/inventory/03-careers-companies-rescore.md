# Careers lookup and page reading, company records and search, re-score and its log

Reviewed: 39 modules, 7 findings.

## Modules

| Module | Outcome |
|---|---|
| `src/careers/addresses.ts` | none |
| `src/careers/audit.ts` | C1 |
| `src/careers/boardPages.ts` | C4 |
| `src/careers/browser.ts` | none |
| `src/careers/deps.ts` | none |
| `src/careers/embeddedBoard.ts` | none |
| `src/careers/fetchPage.ts` | none |
| `src/careers/fitPage.ts` | none |
| `src/careers/lookUpJobs.ts` | none |
| `src/careers/lookUpJob.ts` | C1 |
| `src/careers/outcome.ts` | none |
| `src/careers/pageWalker.ts` | none |
| `src/careers/postingPage.ts` | none |
| `src/careers/prompt.ts` | none |
| `src/careers/rank.ts` | none |
| `src/careers/readPage.ts` | none |
| `src/careers/registry.ts` | none |
| `src/careers/renderState.ts` | C7 |
| `src/careers/render.ts` | C6 |
| `src/careers/searxng.ts` | none |
| `src/careers/session.ts` | none |
| `src/careers/skipHosts.ts` | none |
| `src/careers/tools.ts` | none |
| `src/careers/trim.ts` | none |
| `src/companies/hosts.ts` | none |
| `src/companies/keys.ts` | none |
| `src/companies/pickAddresses.ts` | none |
| `src/companies/searchColumns.ts` | none |
| `src/companies/searchCompanies.ts` | C3 |
| `src/rescore/log.ts` | none |
| `src/rescore/oneJobStore.ts` | C2 |
| `src/rescore/open.ts` | none |
| `src/rescore/plan.ts` | none |
| `src/rescore/prompt.ts` | none |
| `src/rescore/rescore.ts` | C2 |
| `src/rescore/session.ts` | C2, C5 |
| `src/rescore/steps.ts` | none |
| `src/rescore/tools.ts` | none |
| `src/rescore/traceSteps.ts` | C1 |

## Findings

### C1 · ISP · `src/careers/lookUpJob.ts:31`
- **Breach**: `LookupDeps.careers` (and `AuditDeps.careers` in `audit.ts:7`) is the whole `CareersStore`, eight members spanning the company's lookup page, the audit log, retry selection (`attempted`, `retries`), pruning and eval capture (`descriptionFoundAt`), while the lookup uses only `careersPage`, `setLookupPage`, `clearLookupPage` and `audit` (and `auditor`/`auditSkipped` only `audit`).
- **Why it matters**: the cost is visible in `src/rescore/traceSteps.ts:33`: `loggedCareers`, which exists only to tap `audit`, has to forward all eight methods, and must be edited whenever `CareersStore` gains a member that the lookup never calls; every lookup test fake must also stub retry, prune and eval methods it never exercises.
- **Decision**: fix
- **Fix**: add `type LookupCareers = Pick<CareersStore, "careersPage" | "setLookupPage" | "clearLookupPage" | "audit">` (in `lookUpJob.ts`) and use it for `LookupDeps.careers`; type `AuditDeps.careers` as `Pick<CareersStore, "audit">`. `loggedCareers(store: LookupCareers, log): LookupCareers` wraps four methods instead of eight. In `src/careers/deps.ts`, `CareersParts.careers` becomes `Omit<CareersAccess, "store"> & { store: LookupCareers }`, so `CareersAccess` (and `src/tools/careersStep.ts`, which needs `attempted`/`retries`) keep the full store. Callers touched: `deps.ts`, `traceSteps.ts`, `rescore/open.ts` (type only), lookup test helpers.
- **Size**: M

### C2 · ISP · `src/rescore/rescore.ts:18`
- **Breach**: `RescoreDeps` takes `views: JobViews` (13 members) to call only `clearScore`, `store: JobStore` (8 members) to call only `findJob` and `recordVerdict`, and `postings: PostingStore` (6 members) where the re-score path uses only `earliestSeen` (get_job) and `flagInjection` (look-alikes); `SessionDeps` in `session.ts:20` and `oneJobStore(store: JobStore, ...)` in `oneJobStore.ts:6` repeat the wide `JobStore`/`PostingStore`.
- **Why it matters**: the re-score's decision code advertises that it may list, hide, mark applied, upsert or prune, so a reader cannot see from its signature that it only reads one job, saves one verdict and clears one score, and every unit-test fake must satisfy 27 members to exercise three or four.
- **Decision**: fix
- **Fix**: type `RescoreDeps.views` as `Pick<JobViews, "clearScore">`, `RescoreDeps.store`/`SessionDeps.store`/`oneJobStore`'s parameter as `Pick<JobStore, "findJob" | "recordVerdict">`, and `postings` as `Pick<PostingStore, "earliestSeen" | "flagInjection">`. Callers (`rescore/open.ts`, which `src/cli.ts` and `web/lib/actions.ts` use) pass the full stores unchanged, which stay assignable; test fakes can shrink.
- **Size**: M

### C3 · ISP · `src/companies/searchCompanies.ts:9`
- **Breach**: `searchCompanies(context: ToolContext)` depends on the agent's whole tool context (19 members: run state, the job store, Gmail access, the chat function, source plans, JSearch key...) to use six things: two settings sections, `companies`, `careers.searxngUrl`, `http`, `trace` and `now`. `ToolContext` is a container mixing stores with operations and per-run state, the shape the rule calls out.
- **Why it matters**: the company search, documented as making no model calls and knowing nothing of alerts, cannot be called or tested without assembling a full tool context (`tests/searchCompanies.test.ts` goes through `tests/helpers/context.ts`), and any change to `ToolContext` reaches it.
- **Decision**: fix
- **Fix**: give it its own `CompanySearchDeps { settings: Pick<Settings, "company_search" | "careers_lookup">; companies: CompanyStore; searxngUrl: string | null; http: JsonGetter; trace: Trace; now: () => Date }` and pass that through its helpers; `afterAgent` in `src/app/run.ts` builds it from the context (`{ settings: context.config, companies: context.companies, searxngUrl: context.careers.searxngUrl, http: context.http, trace: context.trace, now: context.now }`). Touches `searchCompanies.ts`, `run.ts`, `tests/searchCompanies.test.ts`.
- **Size**: M
- **Done**: S3a

### C4 · OCP · `src/careers/boardPages.ts:86`
- **Breach**: `boardName` branches on `link.kind === "workday"` to build the board's name for the audit and the cache key; it is a per-board branch in shared careers code, outside the source modules and `boardLink.ts`, which otherwise hold every per-board difference (`HOST_LINKS`, `workdayLink`).
- **Why it matters**: a new board whose identity needs more than its slug (as Workday needs tenant and site) must be added by editing the careers lookup, and forgetting to would silently merge two boards' postings under one cache key (`postings`, line 57).
- **Decision**: fix
- **Fix**: have each parser in `src/sources/boardLink.ts` set the name on the link it returns (a new `BoardLink.board` field: `slugAndId`/`gemApiLink`/`greenhouseLink` give `${kind}:${slug}`, `workdayLink` gives `workday:${tenant}/${site}`), and replace `boardName(link)` with `link.board`. The strings are identical, so audit rows and cache keys do not change. Touches `boardLink.ts`, `boardPages.ts`, and tests that build `BoardLink` literals.
- **Size**: M
- **Done**: S3b

### C5 · DIP · `src/rescore/session.ts:61`
- **Breach**: `oneJobAgentDeps` hard-wires the agent loop's clock to `Date.now`, although the re-score is handed `now` (`SessionDeps.now`) and the career lookup's session in the same feature passes `() => deps.now().getTime()` (`lookUpJob.ts:78`).
- **Why it matters**: the re-score's 3-minute wall-clock limit cannot be tested with an injected clock, and a re-score built with a fixed `now` still reads the real time in its limit check.
- **Decision**: fix
- **Fix**: add `clock` to `OneJobSession` (`Pick<AgentDeps, ... | "clock">`) and drop the hard-wired value; `scoreOne` passes `() => deps.now().getTime()`, and `src/evals/session.ts` (the other caller) passes `Date.now`. Production behaviour is unchanged (`now` is `() => new Date()`).
- **Size**: S

### C6 · DIP · `src/careers/render.ts:18`
- **Breach**: `renderPage` reads `Date.now()` itself (lines 18 and 59) to set and spend its deadline, while its caller `PageRenderer` already holds an injected `now`.
- **Why it matters**: how the remaining time is split between navigation and settling can only be tested with real waits or global fake timers (`tests/careersRender.test.ts` passes `seconds: 15`), not with a plain clock function.
- **Decision**: fix
- **Fix**: add `clock: () => number` to `RenderRequest`; `PageRenderer.render` passes `() => this.deps.now().getTime()`; the two render tests pass a clock. No output changes.
- **Size**: S

### C7 · SRP · `src/careers/renderState.ts:77`
- **Breach**: `PageRenderer` both renders pages (connection, on/off state, fallbacks) and runs the once-per-run LAN reachability probe, writing its own trace event and a hand-built `careers_audit` row; it needs `careers`, `trace` and `runId` only for that probe.
- **Why it matters**: the rendering class carries audit-log and trace concerns, so every rendering test must supply a careers store and trace, and a change to the probe or to the audit row's shape edits the renderer.
- **Decision**: fix
- **Fix**: move the probe to `src/careers/lanCheck.ts` as `checkBrowserLan(deps: { settings, careers: Pick<CareersStore, "audit">, trace, runId, now }) => (port: BrowserPort) => Promise<string | null>` (returning the `LAN check not configured` note or null); `RendererDeps` takes `checkLan: (port) => Promise<string | null>` in place of `careers`, `trace` and `runId`, and still runs it once and adds a returned note to `said`. `pageRenderer` in `src/app/runParts.ts` builds it. Touches `renderState.ts`, the new file, `runParts.ts`, `tests/careersRenderState.test.ts`.
- **Size**: M

## Mechanical checks

- **Board kinds branch only in sources** (C4): a test in the style of `tests/wayBranches.test.ts` reads every `.ts` file outside `src/sources/` and fails on `kind === "ashby" | "gem" | "greenhouse" | "lever" | "workday"` (or a `switch` on `link.kind`).
- **No real clock in careers, companies and re-score decisions** (C5, C6): a test scans `src/careers/`, `src/companies/` and `src/rescore/` for `Date.now` and `new Date(` and allows them only in the composition root `src/rescore/open.ts`.
- **Company search and careers lookup never read the tool context** (C3): a test fails when any file under `src/companies/` or `src/careers/` imports `tools/context.js`.
- **Re-score dependencies stay narrow** (C2, C1): type tests (`expectTypeOf<keyof RescoreDeps["views"]>().toEqualTypeOf<"clearScore">()`, likewise for `RescoreDeps["store"]` and `LookupDeps["careers"]`) fail when a wide store type comes back.
