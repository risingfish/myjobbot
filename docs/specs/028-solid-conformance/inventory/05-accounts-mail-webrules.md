# Accounts, sign-in ways, sessions, mail, web security and the web's framework-free rules (src/web)

Reviewed: 75 modules, 8 findings.

## Modules

| Module | Outcome |
|---|---|
| `src/accounts/cli.ts` | none |
| `src/accounts/device.ts` | none |
| `src/accounts/emails.ts` | none |
| `src/accounts/events.ts` | none |
| `src/accounts/flows/accountChanges.ts` | none |
| `src/accounts/flows/admin.ts` | none |
| `src/accounts/flows/attempts.ts` | none |
| `src/accounts/flows/confirmIdentity.ts` | none |
| `src/accounts/flows/context.ts` | U8 |
| `src/accounts/flows/createAccount.ts` | none |
| `src/accounts/flows/emailLinks.ts` | none |
| `src/accounts/flows/linkSpends.ts` | none |
| `src/accounts/flows/mailLinks.ts` | none |
| `src/accounts/flows/mail.ts` | none |
| `src/accounts/flows/securityEvents.ts` | none |
| `src/accounts/flows/sessions.ts` | none |
| `src/accounts/flows/signIn.ts` | none |
| `src/accounts/geo.ts` | none |
| `src/accounts/keys.ts` | none |
| `src/accounts/limits.ts` | none |
| `src/accounts/messages.ts` | none |
| `src/accounts/methods.ts` | none |
| `src/accounts/names.ts` | none |
| `src/accounts/passwordDigest.ts` | none |
| `src/accounts/passwordRule.ts` | none |
| `src/accounts/returnPath.ts` | none |
| `src/accounts/stepUp.ts` | none |
| `src/accounts/terminal.ts` | none |
| `src/accounts/tokens.ts` | none |
| `src/accounts/totp.ts` | none |
| `src/accounts/ways/authenticator.ts` | none |
| `src/accounts/ways/catalog.ts` | none |
| `src/accounts/ways/emailLink.ts` | none |
| `src/accounts/ways/hardwareKey.ts` | none |
| `src/accounts/ways/password.ts` | none |
| `src/accounts/ways/recoveryCode.ts` | none |
| `src/accounts/ways/registry.ts` | none |
| `src/accounts/ways/usable.ts` | none |
| `src/mail/fromEnv.ts` | none |
| `src/mail/mailer.ts` | none |
| `src/mail/messages.ts` | none |
| `src/mail/queue.ts` | none |
| `src/mail/settings.ts` | none |
| `src/web/accountForms.ts` | none |
| `src/web/api.ts` | none |
| `src/web/boostViews.ts` | none |
| `src/web/gmailPanel.ts` | U4 |
| `src/web/history.ts` | none |
| `src/web/jobDetail.ts` | none |
| `src/web/linkFragment.ts` | U6 |
| `src/web/pageData.ts` | U1 |
| `src/web/rescoreNote.ts` | none |
| `src/web/rescoreStream.ts` | none |
| `src/web/resumeView.ts` | none |
| `src/web/rowViews.ts` | none |
| `src/web/saveSource.ts` | U2 |
| `src/web/security/baseUrl.ts` | none |
| `src/web/security/clientAddress.ts` | none |
| `src/web/security/cookies.ts` | none |
| `src/web/security/csrf.ts` | none |
| `src/web/security/gate.ts` | none |
| `src/web/security/headers.ts` | none |
| `src/web/security/origin.ts` | none |
| `src/web/settingsApply.ts` | none |
| `src/web/settingsForm.ts` | none |
| `src/web/settingsProblems.ts` | none |
| `src/web/settingsSave.ts` | none |
| `src/web/settingsSections.ts` | U7 |
| `src/web/settingsView.ts` | U3, U7 |
| `src/web/shortTitle.ts` | none |
| `src/web/signedOut.ts` | none |
| `src/web/sourceChoices.ts` | none |
| `src/web/sourceForm.ts` | none |
| `src/web/sourceRows.ts` | U4, U5 |
| `src/web/sourceRules.ts` | none |

## Findings

### U1 · ISP · `src/web/pageData.ts:10`
- **Breach**: `PageInput.views` is the whole `JobViews` (13 members, including the writes `setHidden`, `setApplied`, `clearScore` and the evals' `recentlyScored`), but page loading only reads seven of them (`scoredFrom`, `allJobs`, `countAllJobs`, `appliedJobs`, `countApplied`, `verdictHistory`, `countVerdicts`).
- **Why it matters**: a unit test of `loadPageData` has to supply or stub every write and unrelated read, and the type says page loading may change job marks, which it must never do.
- **Decision**: fix
- **Fix**: declare `type PageViews = Pick<JobViews, "scoredFrom" | "allJobs" | "countAllJobs" | "appliedJobs" | "countApplied" | "verdictHistory" | "countVerdicts">` in `pageData.ts` and type `PageInput.views` (and `recommendedJobs`' `views`) with it. Callers (`web/lib/rows.ts`, `tests/pageData.test.ts`) still compile unchanged, since a full `JobViews` satisfies the `Pick`.
- **Size**: S
- **Done**: S6a

### U2 · ISP · `src/web/saveSource.ts:10`
- **Breach**: `SaveSourceDeps.store` is the whole `UserSourceStore` (seven operations, including `remove`, `setEnabled`, `linkCompany` and `ensureAccountSource`), while `saveSource` and `recordTest` use only `list`, `save` and `recordFetch`.
- **Why it matters**: tests must build a store with operations the save never calls, and the type hides that saving a source never removes, links or switches one.
- **Decision**: fix
- **Fix**: `store: Pick<UserSourceStore, "list" | "save" | "recordFetch">` in `SaveSourceDeps`, and the same `Pick` for `recordTest`'s parameter. Callers (`web/lib/sourceActions.ts`, `tests/saveSource.test.ts`) need no change.
- **Size**: S
- **Done**: S6a

### U3 · SRP · `src/web/settingsView.ts:74`
- **Breach**: the module that builds the Settings page's field view (stored search settings after fallback, each with its default mark) also reads `config.json`'s runtime part for Gmail, HTTP and JSearch (`gmailSettings`, `sourceSettings`, `runtimePart`). Those are two unrelated jobs over different data: user search settings from the database, and runtime settings from the file.
- **Why it matters**: a change to how runtime settings are read from `config.json` (for example a new runtime key the Sources section needs) edits the Settings-view module and its test, and `web/lib/uiState.ts` depends on the view module for config reading.
- **Decision**: fix
- **Fix**: move `gmailSettings`, `sourceSettings` and `runtimePart` to a new `src/config/runtimeParts.ts` (beside `splitSettings` in `src/config/searchSettings.ts`, which they already use). Update the import in `web/lib/uiState.ts:18` and move their cases from `tests/settingsView.test.ts` to a `tests/runtimeParts.test.ts`.
- **Size**: M
- **Done**: S6a

### U4 · SRP · `src/web/gmailPanel.ts:48`
- **Breach**: `localTime`, a general "stored UTC time to server-local YYYY-MM-DD HH:mm" formatter, is exported from the Gmail panel's view module and imported by `src/web/sourceRows.ts:3`, so the Sources list depends on the Gmail panel for a time format.
- **Why it matters**: a change to the Gmail panel module (or its removal or split) touches the Sources list, and the formatter can't be found or tested on its own.
- **Decision**: fix
- **Fix**: move `localTime` to `src/web/localTime.ts`; import it from there in `gmailPanel.ts` and `sourceRows.ts` (and any test that imports it from `gmailPanel.js`).
- **Size**: S
- **Done**: S6a

### U5 · OCP · `src/web/sourceRows.ts:69`
- **Breach**: `rowNote` branches on one requirement by name (`found.requires.includes("jsearch_key") && !hasSearchKey`), and `RowFacts` has one boolean per requirement (`hasSearchKey`, `gmailConnected`), while `sourceChoices.ts` already handles requirements generically through `Met` (`Record<Requirement, boolean>`) and a `NEEDS` table. A new `Requirement` in `src/sources/module.ts` must be added to `Met` and `NEEDS` (enforced by the compiler) and also by hand to `RowFacts` and `rowNote` (not enforced), or saved sources of that module never show what they need.
- **Why it matters**: adding a source module with a new requirement silently leaves the saved-source row without its note; the per-requirement branch is the kind the constitution says to replace with a registry.
- **Decision**: fix
- **Fix**: `sourceRows(saved, met: Met)` with a row-text table `ROW_NEEDS: Record<Requirement, string>` (`jsearch_key: "needs JSEARCH_API_KEY in .env"`, `gmail: "needs Gmail connected"`), `rowNote` returning the first unmet requirement's text after the existing `unavailable` / `needs fixing` checks, and the account filter reading `met.gmail`. Output is unchanged: `gmail` is required only by the account source, which is already left out when Gmail isn't connected. Caller `web/lib/uiState.ts:92` passes `met` directly; `tests/sourceRows.test.ts` changes its facts argument.
- **Size**: S
- **Done**: S6a

### U6 · OCP · `src/web/linkFragment.ts:3`
- **Breach**: the emailed-link purposes are listed again as an untyped `Set<string>` (`PURPOSES`) and the result is cast `as LinkPurpose`. `LinkPurpose` is a union in `src/db/tokenStore.ts`, and every other per-purpose table (`SPENDS` in `flows/emailLinks.ts`, `LIFETIME_MINUTES`, `BUTTONS` in `LinkButton.tsx`) is a `Record<LinkPurpose, …>` the compiler checks; this one isn't.
- **Why it matters**: a new link purpose compiles everywhere yet its links are rejected by `/link` as "not a link" until someone remembers this set; the cast hides the gap.
- **Decision**: fix
- **Fix**: in `src/db/tokenStore.ts` export `LINK_PURPOSES = ["signin", "reset", "email_change", "step_up"] as const` and derive `LinkPurpose` from it (the module has no runtime imports, so it stays safe for the client bundle); in `linkFragment.ts` replace `PURPOSES` and the cast with a type guard `isLinkPurpose(value): value is LinkPurpose` over `LINK_PURPOSES`.
- **Size**: S
- **Done**: S6a

### U7 · OCP · `src/web/settingsView.ts:90`
- **Breach**: a Settings field is described in several parallel places: the `FieldName` union and the `SECTIONS` list (`settingsSections.ts`), `ROW_SHAPES` (`settingsForm.ts`), and `FieldValues`, `SHOWN`, `DEFAULTS` and the hand-written `shownFields` object (`settingsView.ts`). The `Record`s are compiler-checked, but `FieldName` and `SECTIONS` are not tied: a name added to the union without a `SECTIONS` entry compiles, belongs to no section, never saves, and `storedValue` falls back to the empty path and hands the whole settings document to that field's schema, which fails only when the page loads.
- **Why it matters**: adding a search setting means editing seven places in three files, and the one link that isn't checked (union to section list) fails silently at run time rather than at compile time.
- **Decision**: fix
- **Fix**: make `SECTIONS` the source: declare it `as const satisfies readonly FieldSpec[]` with `name` as a string literal and derive `FieldName` as `(typeof SECTIONS)[number]["name"]`; build `shownFields` by mapping over `SECTIONS` (`Object.fromEntries(SECTIONS.map(({ name }) => [name, shownField(name, settings)]))`) instead of listing each field, and let `storedValue` take the `FieldSpec`. The remaining per-field `Record`s (`ROW_SHAPES`, `SHOWN`, `DEFAULTS`) stay; the compiler then forces each of them for any new section entry. Callers unchanged.
- **Size**: M
- **Amended by the analysis (2026-11-08)**: `FieldSpec.name` is typed `string` in the declaration, so `FieldName` can be derived from `SECTIONS` without a circular type.
- **Done**: S6a

### U8 · ISP · `src/accounts/flows/context.ts:18`
- **Breach**: every account flow takes the whole `AuthContext` (six stores, clock, randomness, mail, secret key, relying party) even when it uses one store, e.g. `saveName` uses only `stores.accounts`, `signOut` only `stores.sessions` and the clock.
- **Why it matters**: in principle a test must build the full context for any flow, and a flow's signature doesn't say which stores it touches.
- **Decision**: accept (owner approved, 2026-11-08)
- **Fix**: accept: `AuthContext` is a container of stores and injected primitives (no operations), already narrowed with `Pick<Stores, …>`, every member is in-memory in `tests/helpers/authContext.ts`, and flows call each other (`recordSecurityEvent`, `startSession`, `mailTo`), so per-flow `Pick`s would just grow back to the whole context.
- **Size**: L

## Mechanical checks

- **Page and source decisions take narrow store views (U1, U2)**: a test reads every `.ts` file under `src/web/` and fails on a field or parameter typed with a bare `JobViews`, `UserSourceStore`, `SourceStore` or `Stores` (regex `:\s*(JobViews|UserSourceStore|SourceStore|Stores)\b` not followed by `>`, so `Pick<JobViews, …>` passes).
- **No requirement is branched on by name outside the source registry (U5)**: a test scans `src/` and `web/` for a string comparison or `includes(...)` with a `Requirement` literal (`"jsearch_key"`, `"gmail"`) and allows only `src/sources/` and the `Record<Requirement, …>` tables (`src/web/sourceChoices.ts`, `src/web/sourceRows.ts`), in the style of `tests/wayBranches.test.ts`.
- **Every link purpose opens on /link (U6)**: a unit test loops over `LINK_PURPOSES` and asserts `parseLinkFragment("#p=<purpose>&t=<43-char token>")` returns that purpose; together with `SPENDS: Record<LinkPurpose, …>` this keeps the parser and the spends in step.
- **Every Settings field belongs to exactly one section (U7)**: a unit test asserts the names in `SECTIONS` are unique and that `settingsView(null).fields` has exactly the `SECTIONS` names as keys (after the fix the type makes the first half structural, the test guards duplicates).
