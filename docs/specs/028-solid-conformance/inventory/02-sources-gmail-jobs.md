# Job sources, Gmail alerts, job rules (filters, boosts, normalising) and descriptions

Reviewed: 52 modules, 9 findings.

## Modules

| Module | Outcome |
|---|---|
| `src/sources/alertAccess.ts` | S1, S2 |
| `src/sources/boardLink.ts` | S5 |
| `src/sources/failure.ts` | S4 |
| `src/sources/fetchPhase.ts` | S1 |
| `src/sources/fetchPlan.ts` | S3 |
| `src/sources/fields.ts` | none |
| `src/sources/htmlText.ts` | none |
| `src/sources/ingest.ts` | S2 |
| `src/sources/module.ts` | S2 |
| `src/sources/registry.ts` | none |
| `src/sources/sourceHttp.ts` | none |
| `src/sources/testFetch.ts` | S3 |
| `src/sources/modules/ashby.ts` | none |
| `src/sources/modules/gem.ts` | none |
| `src/sources/modules/gmailAlerts.ts` | none |
| `src/sources/modules/greenhouse.ts` | none |
| `src/sources/modules/jsearch.ts` | none |
| `src/sources/modules/lever.ts` | none |
| `src/sources/modules/slugBoard.ts` | S5 |
| `src/sources/modules/workday.ts` | none |
| `src/gmail/alertFetch.ts` | S8 |
| `src/gmail/alertLookupStep.ts` | S9 |
| `src/gmail/alertStore.ts` | none |
| `src/gmail/alerts.ts` | none |
| `src/gmail/check.ts` | S6, S8 |
| `src/gmail/connection.ts` | S6, S8 |
| `src/gmail/imap.ts` | none |
| `src/gmail/imapAlerts.ts` | none |
| `src/gmail/imapErrors.ts` | none |
| `src/gmail/seal.ts` | S7 |
| `src/gmail/secretKey.ts` | S7 |
| `src/gmail/alertJobs/budget.ts` | none |
| `src/gmail/alertJobs/html.ts` | none |
| `src/gmail/alertJobs/lookup.ts` | none |
| `src/gmail/alertJobs/parse.ts` | none |
| `src/gmail/alertJobs/read.ts` | none |
| `src/gmail/alertJobs/source.ts` | none |
| `src/gmail/alertJobs/usable.ts` | S4 |
| `src/jobs/age.ts` | none |
| `src/jobs/bodyFilter.ts` | none |
| `src/jobs/boosts.ts` | none |
| `src/jobs/company.ts` | none |
| `src/jobs/companyFilter.ts` | none |
| `src/jobs/filterMatch.ts` | none |
| `src/jobs/job.ts` | none |
| `src/jobs/normalize.ts` | none |
| `src/jobs/publisherDomain.ts` | none |
| `src/jobs/titleFilter.ts` | none |
| `src/descriptions/cap.ts` | none |
| `src/descriptions/readable.ts` | none |
| `src/descriptions/toMarkdown.ts` | none |
| `src/descriptions/webAddress.ts` | none |

## Findings

### S1 · OCP · `src/sources/fetchPhase.ts:70`
- **Breach**: the generic fetch phase carries Gmail-alerts-only steps: it builds alert access (`alertAccess`, which itself branches on `saved.module !== "gmail_alerts"`, `alertAccess.ts:9`), records an alert read after each page (`recordAlerts`, lines 107-112, `recordAlertRead`), and starts the careers lookup for alert jobs when a page had alerts (line 70, `lookUpAlertJobs`). A module needing its own pre-fetch access or post-store step is added by editing `fetchPhase.ts` and `alertAccess.ts`, not beside the others.
- **Why it matters**: the next account or email source (the module list already names kind `email` and scope `account` as general) has to thread itself through the shared loop; the loop's tests have to set up Gmail stores even for board sources.
- **Decision**: fix
- **Fix**: add a per-module run hook registry, `src/sources/runHooks.ts`: `interface RunHook { access?(context, saved): Promise<object>; afterPage?(context, page): Promise<void>; afterFetch?(context, read): Promise<Partial<SourceRun>> }` keyed by module id, with `gmailAlertsHook` in `src/sources/hooks/gmailAlerts.ts` holding today's `alertAccess`, `recordAlerts` and the `lookUpAlertJobs` call. `readPages`/`fetchSource` call `hookFor(saved.module)` generically. Touches `fetchPhase.ts`, `alertAccess.ts` (moves), `Read.alerts` handling; trace, stored rows and `SourceRun` are unchanged.
- **Size**: M
- **Done**: S3b

### S2 · ISP · `src/sources/module.ts:16`
- **Breach**: `SourceContext`, the one interface every module's `fetch` receives, carries one module's access each: `jsearch?` (the API key and settings) and `alerts?` (Gmail stores, IMAP, the sealed-key status), and `SourcePage` carries `alerts?: AlertRead`. `sourceContext` (`ingest.ts:45`) hands the JSearch API key to every module, board modules included, and the shared `module.ts` imports Gmail's `AlertDeps`/`AlertRead`.
- **Why it matters**: board modules receive a secret and a Gmail container they never use; adding a module with its own access edits the shared interface, `sourceContext` and `alertAccess`, and every module's tests type against members of other modules.
- **Decision**: fix
- **Fix**: keep `SourceContext` to `http`, `sourceName`, `preview`, plus an `access: A` typed by the module (`SourceModule<P, A = undefined>`), supplied by the module's run hook from S1 (`access`) and by the web test-on-save composition; `jsearch` and `gmailAlerts` declare their own access types, and the alert read travels in the hook's `afterPage` instead of `SourcePage.alerts`. Touches `module.ts`, `ingest.ts` (`sourceContext`), `alertAccess.ts`, `modules/jsearch.ts`, `modules/gmailAlerts.ts`, `testFetch.ts` and its web caller. Best done together with S1.
- **Size**: M
- **Settled by the analysis (2026-11-08)**: the alert read travels in the Gmail hook's own access object (an `AlertSession` the module writes each page's read into; `afterPage` records it, `afterFetch` returns the summary). `SourcePage.alerts` and `Read.alerts` are removed (tasks T032).
- **Done**: S3b

### S3 · OCP · `src/sources/testFetch.ts:26`
- **Breach**: the shared `recordCost` records every unit of any page's `cost` as a `"jsearch"` API call, and `fetchPlan` (`fetchPlan.ts:35`) applies the budget skip to whichever module lists the `jsearch_key` requirement; the shared contract's `cost` therefore silently means "JSearch requests". A module spending another paid API would be booked against JSearch's budget. `recordCost`, used by the run's fetch phase, also lives in the test-on-save module, a second job in that file (SRP).
- **Why it matters**: the cost/budget pairing is hard-wired to one API, so a second metered source means editing shared code and the meaning of an existing field; `fetchPhase.ts` depends on `testFetch.ts` for an unrelated helper.
- **Decision**: fix
- **Fix**: add `limits.spends: "jsearch" | null` to `SourceLimits` (`jsearch` and `gmailAlerts` say `"jsearch"`, boards `null`); move `recordCost` to `src/sources/cost.ts` taking the module and recording against `module.limits.spends`; `fetchPlan`'s budget skip keeps keying on the `jsearch_key` requirement (so Gmail alerts still aren't skipped) or names it via a separate `limits.skipWhenBudgetUsed`. Callers: `fetchPhase.ts`, `testFetch.ts`. Rows written are identical.
- **Size**: S
- **Settled by the analysis (2026-11-08)**: the budget skip becomes `limits.skipWhenBudgetUsed` (`jsearch: true`, others `false`), so `fetchPlan.ts` no longer names `jsearch_key` (tasks T031).
- **Done**: S3b

### S4 · OCP · `src/sources/failure.ts:31`
- **Breach**: the shared failure mapper `failureReason` imports Gmail's `AlertsUnavailable` and `ALERT_NOTES` and translates the alert notes into reasons (`alertReason`, lines 42-45). One module's error vocabulary is decoded by per-variant branches in shared code.
- **Why it matters**: any module with its own fixed failure kinds must edit `failure.ts`; a new alert note silently maps to "not set up" unless someone remembers this file.
- **Decision**: fix
- **Fix**: introduce `class SourceFailure extends Error { constructor(readonly reason: FailureReason, message) }` in `failure.ts` (make `NotSetUp` one of them); `AlertsUnavailable` extends it, its reason chosen beside `ALERT_NOTES` in `usable.ts` (a `NOTE_REASONS` map). `reasonOf` checks `instanceof SourceFailure` and drops the Gmail imports. Touches `failure.ts`, `gmail/alertJobs/usable.ts`; reasons produced are unchanged.
- **Size**: S
- **Done**: S3b

### S5 · OCP · `src/sources/boardLink.ts:14`
- **Breach**: link recognition for all five board modules lives in one shared file, under a closed `BoardKind` union (line 1) and a `HOST_LINKS` table naming each board's hosts and path shape, while `slugBoard.ts:6` repeats a closed `SlugBoardId` union. Each board module's `fromUrl` calls back into this file and filters by its own kind.
- **Why it matters**: adding a board means editing `boardLink.ts` (union, host table, a parser) and `slugBoard.ts`'s union besides adding the module and registering it; the board's knowledge is split across files.
- **Decision**: fix
- **Fix**: each board declares its link reader with its module (`SlugBoardDef.link(url): { slug, postingId } | null` with today's `slugAndId`/`greenhouseLink`/`gemApiLink` moved into the board files; `workdayLink` into `workday.ts`), exposed as `SourceModule.boardLink?(url): BoardLink | null`; `parseBoardLink` moves beside the registry (`src/sources/boardLinks.ts`) and loops over `MODULES`, with `kind` the module id. `fromUrl` derives from the module's own reader. Callers keep the same `parseBoardLink` signature: `careers/readPage.ts`, `careers/boardPages.ts`, `careers/embeddedBoard.ts`, `companies/pickAddresses.ts`.
- **Size**: M
- **Amended by the analysis (2026-11-08)**: `parseBoardLink` loops over `BOARD_MODULES` (`src/sources/boardModules.ts`), from which `MODULES` is built, so a board is listed once and the careers lookup never imports the Gmail alerts module (tasks T034).
- **Done**: S3b

### S6 · ISP · `src/gmail/check.ts:13`
- **Breach**: `check` takes the whole `GmailDeps` (`gmail`, `alerts`, `sources`, `key`, `imap`) but uses only `gmail`, `key` and `imap`; `disconnect` (`connection.ts:47`) uses only `gmail` and `alerts`. Only `keyChanged` narrows with `Pick`.
- **Why it matters**: tests of the connection check must build alert and source stores it never touches, and the signature hides what the check can change.
- **Decision**: fix
- **Fix**: `check(deps: Pick<GmailDeps, "gmail" | "key" | "imap">, ...)`, `disconnect(deps: Pick<GmailDeps, "gmail" | "alerts">)`. Callers (`web/lib/gmailActions.ts`) still pass a full `GmailDeps`, which satisfies both.
- **Size**: S

### S7 · SRP · `src/gmail/seal.ts:3`
- **Breach**: sealing secrets with `MYJOBBOT_SECRET_KEY` (`seal.ts`) and reading that key (`secretKey.ts`) are app-wide jobs, used by accounts (`accounts/ways/authenticator.ts`, `accounts/terminal.ts`, `web/lib/authDeps.ts`) as much as by Gmail, yet they live in `src/gmail/`, whose `SealedField` union lists the accounts field `totp_secret`.
- **Why it matters**: the Gmail module owns another area's secret type, so accounts depend on `src/gmail/` and any new sealed field edits a Gmail file; it misleads a reader looking for where secrets are handled.
- **Decision**: fix
- **Fix**: move both files unchanged to `src/secrets/` (`seal.ts`, `secretKey.ts`); field names and the sealed text format stay the same, so stored values still open. Update imports in `src/gmail/*`, `src/accounts/*`, `src/app/run.ts`, `src/app/runAll.ts`, `src/app/gmailState.ts`, `src/tools/context.ts`, `web/lib/authDeps.ts`, `web/lib/uiState.ts`, the tests, and the `src/gmail/seal.ts` mentions in CLAUDE.md.
- **Size**: M

### S8 · DIP · `src/gmail/alertFetch.ts:112`
- **Breach**: the alert read, the connection check (`check.ts:19`) and connect (`connection.ts:36`) each pick the real IMAP client themselves with `(deps.imap ?? imapApi)`; `imap` is optional in `AlertDeps`, `GmailDeps` and `ToolContext.gmail`, and no composition root passes it, so production relies on the decisions' own fallback.
- **Why it matters**: a test that forgets `imap` opens a real connection to imap.gmail.com instead of failing to compile; the decisions are not handed their network dependency.
- **Decision**: fix
- **Fix**: make `imap: ImapFactory` required in `AlertDeps`, `GmailDeps` and the run context's `gmail`; pass `imapApi` at the composition roots (`src/app/run.ts`, `web/lib/gmailDeps.ts`, the Gmail web actions) and drop the `?? imapApi` fallbacks and their `imapApi` imports from `alertFetch.ts`, `check.ts`, `connection.ts`.
- **Size**: M

### S9 · DIP · `src/gmail/alertLookupStep.ts:69`
- **Breach**: the alert description lookup calls a concrete source module's function (`fetchJsearch` from `sources/modules/jsearch.ts`) instead of a search it is handed, so Gmail logic depends on one module's implementation (and `sources/module.ts` in turn imports Gmail types, a two-way dependency).
- **Why it matters**: unit tests of the lookup planning and matching must fake JSearch's HTTP answer shape rather than a plain `search(query) => Job[]`; swapping or reusing the lookup search means editing Gmail code.
- **Decision**: fix
- **Fix**: `LookupDeps` gets `search(query: string): Promise<Job[]>` in place of `http`/`apiKey`/`settings` for the search (keeping `settings` for the allowance); `alertAccess` (or the S1 hook) builds it with `fetchJsearch` and the 7-day/US request it uses today. Touches `alertLookupStep.ts`, `alertAccess.ts`, `tests/helpers/alertFetchSetup.ts`.
- **Size**: S
- **Done**: S3b

## Mechanical checks

- **No module-id branches outside the modules** (S1, S5): a test, like `tests/wayBranches.test.ts`, reads every `src/**/*.ts` outside `src/sources/modules/` and the run-hook files and fails on a comparison of a string literal equal to any `MODULES[].id` (`/[!=]==\s*"(gmail_alerts|jsearch|greenhouse|...)"/`, ids taken from `MODULES`). Today it would also flag `src/tools/careersStep.ts:18` (outside this area).
- **Shared source code imports no Gmail code** (S2, S4): files directly under `src/sources/` (not `modules/` or hooks) have no import from `../gmail/`; a test scans their import specifiers.
- **Gmail code imports no source module** (S9): no file under `src/gmail/` imports from `src/sources/modules/`.
- **The real IMAP client is chosen only at composition roots** (S8): `imapApi` is referenced only in `src/gmail/imap.ts`, `src/app/` and `web/lib/`; a test greps for the identifier elsewhere.
- **Secrets live outside Gmail** (S7): no file under `src/accounts/` or `web/lib/authDeps.ts` imports from `src/gmail/`.
