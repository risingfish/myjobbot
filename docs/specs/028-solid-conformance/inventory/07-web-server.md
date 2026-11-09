# Web UI server side: server actions, loaders, routes and the request gate

Reviewed: 70 modules, 10 findings.

## Modules

| Module | Outcome |
|---|---|
| `web/proxy.ts` | none |
| `web/next.config.ts` | none |
| `web/app/api/rescores/[id]/route.ts` | W10 |
| `web/app/(app)/account/page.tsx` | none |
| `web/app/(app)/applied/page.tsx` | none |
| `web/app/(app)/jobs/page.tsx` | none |
| `web/app/(app)/layout.tsx` | none |
| `web/app/(app)/page.tsx` | none |
| `web/app/(app)/reasoning/page.tsx` | none |
| `web/app/(app)/recommended/page.tsx` | none |
| `web/app/(app)/settings/page.tsx` | W2 |
| `web/app/error.tsx` | none |
| `web/app/layout.tsx` | none |
| `web/app/not-found.tsx` | none |
| `web/app/(public)/create-account/page.tsx` | none |
| `web/app/(public)/layout.tsx` | none |
| `web/app/(public)/link/page.tsx` | none |
| `web/app/(public)/sign-in/page.tsx` | none |
| `web/lib/accountAction.ts` | none |
| `web/lib/accountActions.ts` | none |
| `web/lib/accountState.ts` | none |
| `web/lib/actions.ts` | none |
| `web/lib/actor.ts` | none |
| `web/lib/adminActions.ts` | W9 |
| `web/lib/appliedRequest.ts` | none |
| `web/lib/appliedTime.ts` | none |
| `web/lib/authDeps.ts` | W3 |
| `web/lib/authenticatorActions.ts` | none |
| `web/lib/currentSession.ts` | none |
| `web/lib/database.ts` | none |
| `web/lib/env.ts` | none |
| `web/lib/gmailActions.ts` | none |
| `web/lib/gmailDeps.ts` | none |
| `web/lib/guard.ts` | none |
| `web/lib/jobParam.ts` | none |
| `web/lib/keyActions.ts` | none |
| `web/lib/keyBrowser.ts` | none |
| `web/lib/markdown.ts` | none |
| `web/lib/myStores.ts` | none |
| `web/lib/pageRows.ts` | W7 |
| `web/lib/pages.ts` | none |
| `web/lib/panelActions.ts` | none |
| `web/lib/position.ts` | none |
| `web/lib/proxySteps.ts` | none |
| `web/lib/requestAuth.ts` | none |
| `web/lib/resumeActions.ts` | none |
| `web/lib/resumeRows.ts` | none |
| `web/lib/rows.ts` | W4, W5 |
| `web/lib/saveOutcome.ts` | none |
| `web/lib/session.ts` | none |
| `web/lib/settingsActions.ts` | none |
| `web/lib/signInActions.ts` | W8 |
| `web/lib/sourceActions.ts` | W6 |
| `web/lib/sourceDeps.ts` | none |
| `web/lib/uiState.ts` | W1, W2 |
| `web/lib/useApplied.ts` | none |
| `web/lib/useAutoSave.ts` | none |
| `web/lib/useExtract.ts` | none |
| `web/lib/useHide.ts` | none |
| `web/lib/useJobChanges.ts` | none |
| `web/lib/useJobDetails.ts` | none |
| `web/lib/useOpenJob.ts` | none |
| `web/lib/usePageRows.ts` | W7 |
| `web/lib/useProfileSave.ts` | none |
| `web/lib/useRescoreLog.ts` | none |
| `web/lib/useRescoreTerminal.ts` | none |
| `web/lib/useRescore.ts` | none |
| `web/lib/useSave.ts` | none |
| `web/lib/useSectionSave.ts` | none |
| `web/lib/useWhenVisible.ts` | none |

Notes on "none" outcomes that were looked at closely:
- `web/proxy.ts` and `web/lib/proxySteps.ts` read the clock, `process.env`, `randomBytes` and `openedStores()` directly, but they are the request gate's composition root; every decision (`gateDecision`, `originDecision`, `csrfDecision`, `securityHeaders`) is a pure function in `src/web/security/` that is handed its inputs.
- `sourceDeps.ts`, `gmailDeps.ts`, `actions.ts`, `resumeActions.ts` read `process.env`, build `HttpClient` or call `new Date()` at the action entry and hand the result to decisions in `src/` or `rows.ts`/`resumeRows.ts`; that is the composition root.
- `accountActions.ts` reads proofs through `PROOF_WAYS` and `CHOICE_KINDS`; no per-way branch.

## Findings

### W1 · SRP · `web/lib/uiState.ts:52`
- **Breach**: one module does four unrelated jobs: it opens the signed-in user's stores (`getStores`), loads the data pages' state (`getUiState`), loads the Settings page's state including the Sources view and its needs (`getSettingsState`, `sourcesView`, `metNeeds`), and reads config.json for actions that need nothing else (`sourceConfig`, `runtimeSettings`, `alertSenders`, `dataDir`).
- **Why it matters**: `gmailActions.ts` imports the page loader module only to read the alert senders, and `settingsActions.ts`, `sourceActions.ts` and `sourceDeps.ts` only to read config.json; a change to either page's loader touches the module every action depends on, and a test of any action that mocks `uiState.js` (as `tests/client/settings.test.tsx` does) has to stand in for all four jobs.
- **Decision**: fix
- **Fix**: move `dataDir`, `sourceConfig`, `runtimeSettings`, `alertSenders` to `web/lib/fileConfig.ts`; move `getSettingsState` and `sourcesView` (and the `SettingsState` type) to `web/lib/settingsState.ts`, and `metNeeds`, which reads the Gmail store and the environment, to its own `web/lib/sourceNeeds.ts`, so `sourceDeps.ts` imports neither a page loader nor the file config; `uiState.ts` keeps `getStores` and `getUiState`. Callers: `gmailActions.ts`, `settingsActions.ts`, `sourceActions.ts`, `sourceDeps.ts`, `web/app/(app)/settings/page.tsx`, `tests/webIsolation.test.ts`, `tests/client/settings.test.tsx` (mock path).
- **Size**: M
- **Done**: S6b

### W2 · ISP · `web/lib/uiState.ts:22`
- **Breach**: `UiState` carries `gmail`, `alerts` and `key`, which no production caller of `getUiState` reads (`actions.ts` and `DataPage.tsx` use only `views`, `rescoreLog`, `config`, `sourceNames`); and `SettingsState` (line 38) hands the raw `gmail` and `alerts` stores and the key to the Settings page, whose `gmailView` (`web/app/(app)/settings/page.tsx:40`) then finishes the loading itself, so the page both loads and renders.
- **Why it matters**: every data page and job action opens a dependency on the Gmail stores and the sealing key it never uses, and the Gmail panel's loading can't be tested with the rest of the Settings loader; a change to how the Gmail view is built has to be made in a page component.
- **Decision**: fix
- **Fix**: drop `gmail`, `alerts`, `key` from `UiState`; build the `GmailPanelView` inside `getSettingsState` (move `gmailView` there) and return `gmail: GmailPanelView` instead of the two stores and the key; the page renders `state.gmail`. Callers: `settings/page.tsx`, `tests/webIsolation.test.ts` (its admin and Gmail isolation cases read `ui.gmail` / `settings.gmail` and would read the stores through `myStores()` or the view instead), `tests/client/settings.test.tsx` (mocked state shape). Rendered output unchanged.
- **Size**: M
- **Done**: S6b

### W3 · SRP · `web/lib/authDeps.ts:17`
- **Breach**: the module holds two unrelated jobs: reading the UI's public address, trusted proxies and cookie names (`webSettings`, used by the proxy, the guard, `currentSession`, `requestAuth` and every action) and assembling the account flows' context with its process-wide mailer (`authContext`, `mail`).
- **Why it matters**: the request gate (`proxy.ts`), `guard.ts` and `currentSession.ts` depend on a module that imports the mailer, the secret key and the database just to read a URL; a test that mocks the flows' context (`tests/accountAction.test.ts` mocks `authDeps.js` with `authContext` only) silently removes `webSettings` as well.
- **Decision**: fix
- **Fix**: move `WebSettings` and `webSettings` to `web/lib/webSettings.ts`; `authDeps.ts` keeps `authContext` and `mail`, importing `webSettings` from there. Callers: `proxy.ts`, `proxySteps.ts`, `actor.ts`, `accountAction.ts`, `adminActions.ts`, `keyActions.ts`, `signInActions.ts`, `currentSession.ts`, `guard.ts`, `requestAuth.ts`.
- **Size**: M
- **Done**: S6b

### W4 · DIP · `web/lib/rows.ts:33`
- **Breach**: `loadRows` (line 33) and `loadDetailsFor` (line 56) call `new Date()` themselves, although they are the plain, unit-tested decisions behind the job actions, and their neighbour `setAppliedFor` is already handed `now`. The time decides each row's age and ghost mark (`rowContext`).
- **Why it matters**: `tests/webRows.test.ts` can't pin the clock for page rows or details, so ages and the ghost mark can't be asserted without faking global timers.
- **Decision**: fix
- **Fix**: give both a `now: Date` parameter (as `setAppliedFor` has) and pass `new Date()` from `loadMoreRowsAction` and `loadJobDetailsAction` in `actions.ts`. Callers: `actions.ts`, `tests/webRows.test.ts`.
- **Size**: S
- **Done**: S6b

### W5 · SRP · `web/lib/rows.ts:60`
- **Breach**: `rows.ts` loads and changes job rows (page rows, hide, applied, details), and also runs the re-score lifecycle (`startRescoreFor`, `carriedOut`: open, begin, close, carry out), a separate job with its own dependencies (`OpenedRescore`, `rescore`).
- **Why it matters**: the rows module imports the whole re-score path, and a change to how a re-score starts or closes is made in the module of row queries; the two are tested separately already (`startRescoreFor` cases in `tests/webRows.test.ts` share nothing with the row cases).
- **Decision**: fix
- **Fix**: move `startRescoreFor`, `carriedOut` and `StartedRescore` to `web/lib/rescoreStart.ts`. Callers: `actions.ts`, `tests/webRows.test.ts`; update the `startRescoreFor in web/lib/rows.ts` mention in CLAUDE.md.
- **Size**: S
- **Done**: S6b

### W6 · DIP · `web/lib/sourceActions.ts:20`
- **Breach**: two source rules are decided inside the `"use server"` actions, against the stores, config.json and the clock they reach for themselves: whether turning a source on is refused (assembling `enableProblem`'s inputs from `sources.list`, `sourcePlans.sourcesOnForAll` and `sourceConfig()`), and that an account-scoped source can't be deleted (`moduleFor(source.module)?.scope === "account"`, line 37). Saving a source, by contrast, goes through `saveSource(deps, request)` in `src/web/saveSource.ts`.
- **Why it matters**: the "account sources can't be deleted" and "enabling re-checks the JSearch budget" rules can only be tested through the server action with mocked Next.js modules and session (`tests/webIsolation.test.ts`), not as plain functions on memory stores.
- **Decision**: fix
- **Fix**: add `src/web/switchSource.ts` with `setSourceEnabled(deps, request)` and `deleteSource(deps, id)`, where `deps` is `{ sources: Pick<SourceStore, "list" | "setEnabled" | "remove">, onForAll: () => Promise<...>, userId, jsearch, now }`; the actions parse input, build `deps` (reusing `sourceDeps`-style assembly) and revalidate. Callers: `sourceActions.ts`; new unit tests on memory stores.
- **Size**: M
- **Done**: S6b

### W7 · OCP · `web/lib/pageRows.ts:47`
- **Breach**: whether a changed job still belongs on a page is decided by branches on the page's name in three places: `rescoredChange` (`page === "recommended" && row.score === null`), `appliedChange` (`page === "recommended"` / `page === "applied"`) and `usePageRows.markHidden` (`hidden && name === "recommended"`, `web/lib/usePageRows.ts:27`, outside the pure module).
- **Why it matters**: a new list page, or a change to what a page lists, means finding and editing every branch; the hide rule isn't in the unit-tested module at all.
- **Decision**: fix
- **Fix**: in `pageRows.ts`, add `const LISTS: Record<PageName, (row: JobRowView) => boolean>` (recommended: not hidden, not applied, scored; applied: applied; jobs and reasoning: always), and one `changed(page, key, fields)` that applies the fields to the row and removes it when `LISTS[page]` rejects the result; `rescoredChange`, `appliedChange` and a new `hiddenChange` use it, and `usePageRows.markHidden` calls `hiddenChange`. Same rows removed and kept as today. Callers: `usePageRows.ts`, `tests/pageRows.test.ts`.
- **Size**: S
- **Done**: S6b

### W8 · OCP · `web/lib/signInActions.ts:66`
- **Breach**: the web layer branches on email-link variants by name: `requestLinkAction` takes `which: "signin" | "reset"` and picks the flow with `which === "signin" ? … : …`, and `spendEmailLinkAction` (line 93-94) sets cookies when `answer.kind === "signin"` and takes `next` when `answer.kind === "step_up"`, although the answer's own shape (`cookies`, `next`) already says what to do.
- **Why it matters**: a new link purpose that signs in or returns somewhere (the flows already dispatch purposes through the `SPENDS` registry) also needs this action edited.
- **Decision**: fix
- **Fix**: pass the flow itself, `requestLinkAction(form, requestSignInLink)` / `(form, requestPasswordReset)`; in `spendEmailLinkAction` use `"cookies" in answer` and `"next" in answer ? answer.next : "/"`. Only `signInActions.ts` changes; answers unchanged.
- **Size**: S
- **Done**: S6b

### W9 · SRP · `web/lib/adminActions.ts:25`
- **Breach**: the admin actions assemble the acting account themselves (`webSettings`, `requireSession`, `requestAddress`, built inline at lines 29-30 and 43-44, and `requireSession` alone at line 20), a job `actor.ts` / `signedInAction` already owns and that CLAUDE.md says every signed-in action goes through.
- **Why it matters**: a change to what an `Actor` holds or how it is read from the request must be made here as well as in `actor.ts`, and the signed-out handling `signedInAction` guarantees (and `tests/accountAction.test.ts` checks) doesn't cover these three actions.
- **Decision**: fix
- **Fix**: give `signedInAction` an optional third argument, the refusal for unreadable input (default `SIGNED_OUT`), and build the three admin actions with it (`MESSAGES.not_admin` for the mark, `MESSAGES.email_invalid` for the email change, `noInput` for the code), so every refusal text stays the same. Callers: `accountAction.ts`, `adminActions.ts`.
- **Size**: S
- **Done**: S6b

### W10 · DIP · `web/app/api/rescores/[id]/route.ts:60`
- **Breach**: the stream's following logic (`follow`, `tick`: when to stop, when the run counts as ended, when a heartbeat is due, which events to drop after the first read) lives in the route and uses the real timers and clock directly (`sleep`, `Date.now()`, `new Date()`), whereas the event building it feeds is the pure `streamEvents` in `src/web/rescoreStream.ts`.
- **Why it matters**: the heartbeat cadence and the "a run read as ended has all its steps" rule can't be unit-tested without real waits or global fake timers; `tests/rescoreStream.test.ts` covers only `streamEvents`.
- **Decision**: fix
- **Fix**: move `Feed`, `Tick`, `follow`, `tick` to `src/web/rescoreFollow.ts`, taking `{ store: Pick<RescoreLogStore, "run" | "stepsAfter">, sleep, now: () => Date, clockMs: () => number }`; the route passes `node:timers/promises` `setTimeout`, `() => new Date()` and `Date.now`. Callers: the route; new unit tests with memory stores and a fake clock.
- **Size**: M
- **Done**: S6b

## Mechanical checks

- **Page membership in one place** (W7): a test reads every file under `web/` and fails when any file other than `web/lib/pageRows.ts` compares a page name literal (`/(name|page)\s*===\s*"(recommended|applied|jobs|reasoning)"/`).
- **No action file calls `requireSession(` directly** (W9): a test reads every `"use server"` file
  in `web/lib/` and fails on `requireSession(`. Today only `adminActions.ts` calls it, and W9's fix
  routes it through `signedInAction`. Actions built with `guarded(...)` and `myStores()` are already
  gated by `guarded` (amended twice by the analysis, 2026-11-08: the earlier "uses
  `signedInAction`" wording can't pass, since five action files use `guarded` by design).
- **No clock in row decisions** (W4): a test reads `web/lib/rows.ts` and `web/lib/resumeRows.ts` and fails on `new Date()` or `Date.now(`; their callers pass the time.
- **Actions don't import page loaders** (W1): a test fails when a `web/lib/*Actions.ts` file imports `getSettingsState` or `getUiState`'s module for anything but `getStores`/`getUiState`, i.e. config readers come from `fileConfig.ts`.
