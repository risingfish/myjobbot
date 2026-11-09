# Stores and the database layer, with the in-memory stores that implement them

Reviewed: 83 modules, 10 findings.

## Modules

| Module | Outcome |
|---|---|
| `src/db/accountStore.ts` | D2, D10 |
| `src/db/authenticatorStore.ts` | none |
| `src/db/careersStore.ts` | none |
| `src/db/columns.ts` | none |
| `src/db/companyStore.ts` | none |
| `src/db/connect.ts` | none |
| `src/db/database.ts` | none |
| `src/db/jobSource.ts` | none |
| `src/db/keyStore.ts` | none |
| `src/db/kysely/accountCreation.ts` | none |
| `src/db/kysely/accountStore.ts` | D2, D6, D10 |
| `src/db/kysely/alertStore.ts` | none |
| `src/db/kysely/apiCalls.ts` | D8 |
| `src/db/kysely/authenticatorStore.ts` | none |
| `src/db/kysely/careersStore.ts` | none |
| `src/db/kysely/companyRows.ts` | none |
| `src/db/kysely/companyStore.ts` | none |
| `src/db/kysely/gmailStore.ts` | none |
| `src/db/kysely/jobStore.ts` | D4 |
| `src/db/kysely/jobViews.ts` | none |
| `src/db/kysely/keyStore.ts` | none |
| `src/db/kysely/methodStore.ts` | none |
| `src/db/kysely/postingStore.ts` | none |
| `src/db/kysely/postingWrites.ts` | none |
| `src/db/kysely/rescoreLogStore.ts` | none |
| `src/db/kysely/resumeStore.ts` | D6 |
| `src/db/kysely/searchSettingsStore.ts` | D6 |
| `src/db/kysely/sessionStore.ts` | D1 |
| `src/db/kysely/sourcePlans.ts` | none |
| `src/db/kysely/sourceStore.ts` | D6 |
| `src/db/kysely/stores.ts` | D1, D2, D3 |
| `src/db/kysely/tokenStore.ts` | D3, D5 |
| `src/db/kysely/userJobsQuery.ts` | none |
| `src/db/kysely/wayLock.ts` | none |
| `src/db/methodStore.ts` | none |
| `src/db/migrate.ts` | none |
| `src/db/migrations/index.ts` | none |
| `src/db/migrations/settingsDocuments.ts` | none |
| `src/db/postingStore.ts` | none |
| `src/db/rescoreLogStore.ts` | none |
| `src/db/resumeStore.ts` | none |
| `src/db/retry.ts` | none |
| `src/db/rows.ts` | none |
| `src/db/schema.ts` | none |
| `src/db/schema/accounts.ts` | none |
| `src/db/schema/careers.ts` | none |
| `src/db/schema/columns.ts` | none |
| `src/db/schema/gmail.ts` | none |
| `src/db/schema/jobs.ts` | none |
| `src/db/schema/rescore.ts` | none |
| `src/db/schema/resume.ts` | none |
| `src/db/schema/users.ts` | none |
| `src/db/searchSettingsStore.ts` | D6 |
| `src/db/sessionStore.ts` | D1 |
| `src/db/settings.ts` | none |
| `src/db/sourcePlans.ts` | none |
| `src/db/sourceStore.ts` | none |
| `src/db/store.ts` | D4, D8, D9 |
| `src/db/tokenStore.ts` | D3, D5 |
| `src/db/userStores.ts` | none |
| `tests/helpers/memoryAccountStore.ts` | D2, D7, D10 |
| `tests/helpers/memoryAlertStore.ts` | none |
| `tests/helpers/memoryAuthTables.ts` | D7 |
| `tests/helpers/memoryAuthenticatorStore.ts` | none |
| `tests/helpers/memoryCareersStore.ts` | none |
| `tests/helpers/memoryCompanies.ts` | none |
| `tests/helpers/memoryCompanyStore.ts` | none |
| `tests/helpers/memoryFilePort.ts` | none |
| `tests/helpers/memoryGmailStore.ts` | none |
| `tests/helpers/memoryJobStore.ts` | D4 |
| `tests/helpers/memoryJobViews.ts` | none |
| `tests/helpers/memoryKeyStore.ts` | none |
| `tests/helpers/memoryMailer.ts` | none |
| `tests/helpers/memoryMethodStore.ts` | none |
| `tests/helpers/memoryPostingStore.ts` | none |
| `tests/helpers/memoryRescoreLog.ts` | none |
| `tests/helpers/memoryResumeStore.ts` | D7 |
| `tests/helpers/memorySearchSettingsStore.ts` | D7 |
| `tests/helpers/memorySessionStore.ts` | D1 |
| `tests/helpers/memorySourcePlans.ts` | none |
| `tests/helpers/memorySourceStore.ts` | D7 |
| `tests/helpers/memoryStore.ts` | D7, D8 |
| `tests/helpers/memoryTokenStore.ts` | D3, D5 |

Not findings, checked on purpose:
- `Stores.forUser` and `Stores.close` are the two operations the 027 design (R4) gave the container
  on purpose. Every other member of `Stores`, `SharedStores` and `UserStores` is a store, or `userId`.
- `PostingStore.prune` deletes verdicts and re-score runs that belong to other stores: clean-up
  across users was put there on purpose (027 R9/R14).
- `KeyStore` holds both keys and their challenges: both are only for the hardware-key way, so it is
  one job.
- `AccountStore.initOwner` and `createAccount` write the password row of `sign_in_methods` directly,
  because it has to be in the same transaction as the user row.
- No DIP findings: every store and helper is handed its times (`at`, `now`), its environment
  (`parseDbSettings`) and its sleep (`withRetry`); `connect.ts` and `database.ts` are composition
  roots.
- Memory stores checked against their Kysely ones method by method (ordering, unknown keys, keeping
  descriptions, first applied time, the last-way lock, spending once, step-up binding): they match,
  except for D7.

## Findings

### D1 · SRP · `src/db/sessionStore.ts:41`
- **Breach**: `SessionStore` holds two unrelated jobs: sessions (`sessions` table: `create`, `find`,
  `touch`, `end`, `endAllFor`, `rebindCsrf`, `pruneEnded`, `setVerified`, `activeFor`) and the
  sign-in attempt counters used for rate limits (`auth_attempts` table: `recordAttempt`,
  `countAttempts`). An attempt is keyed by an email or address digest, never by a session. That is
  SRP, and ISP for the callers.
- **Why it matters**: the rate-limit flows (`src/accounts/flows/attempts.ts`, `mailLinks.ts`,
  `createAccount.ts`) depend on the whole session store, and the session code (`web/proxy.ts`
  through `src/web/security/`) depends on the attempt methods. Changing how attempts are kept
  (retention, a new scope) means editing the session store, both of its implementations and the
  session contract.
- **Decision**: fix
- **Fix**: move `AttemptKind`, `AttemptKey` and an `AttemptStore` interface
  (`recordAttempt`, `countAttempts`) into `src/db/attemptStore.ts`. Add `KyselyAttemptStore` in
  `src/db/kysely/attemptStore.ts` and `MemoryAttemptStore` in `tests/helpers/memoryAttemptStore.ts`
  (still over `AuthTables.attempts`). Add `attempts: AttemptStore` to `SharedStores`. Wire it in
  `kysely/stores.ts` and `memoryStores`, and change the three flows to `stores.attempts`. Add
  `"attempts"` to the `Pick` in `src/accounts/flows/context.ts`, and move the attempt cases out of
  `sessionContract.ts` into their own contract.
- **Size**: M

### D2 · SRP · `src/db/accountStore.ts:38`
- **Breach**: `AccountStore` holds the account records (`users`: create, look up, admin mark, name,
  email) and also the security event log (`security_events`: `recordEvent`, `recentEvents`). The
  log is an append-only history with its own table and its own callers, a second job in the same
  interface (SRP, ISP).
- **Why it matters**: `recordSecurityEvent` (`src/accounts/flows/securityEvents.ts`) and the
  account page's event list (`web/lib/accountState.ts`) are the only callers of the two methods, and
  they get the whole account store. A test of event recording needs a full `AccountStore` fake, and
  a change to the event log (retention, a new field) edits the account store and its contract.
- **Decision**: fix
- **Fix**: move `SecurityEvent` and a `SecurityEventLog` interface (`record`, `recent`) into
  `src/db/securityEventLog.ts`. Add `KyselySecurityEventLog` and a memory twin over
  `AuthTables.events`, add `events: SecurityEventLog` to `SharedStores`, and wire it in both store
  factories. Callers to update: `securityEvents.ts`, `web/lib/accountState.ts`, the flow context
  `Pick`, `accountContract.ts`, and any test reading `MemoryAccountStore.events`.
- **Size**: M

### D3 · SRP · `src/db/tokenStore.ts:33`
- **Breach**: `TokenStore` groups three unrelated kinds of one-time value over three tables, each
  with different callers. Account creation codes (`makeCode`, `account_codes`) are used only by
  `src/accounts/flows/admin.ts`. Emailed links (`makeEmailToken`, `spendEmailToken`, `emailTokenFor`,
  `email_tokens`) are used only by `mailLinks.ts`, `linkSpends.ts` and `ways/emailLink.ts`. Recovery
  codes (`replaceRecoveryCodes`, `spendRecoveryCode`, `recoveryCodesLeft`, `recovery_codes`) are used
  only by `ways/recoveryCode.ts` and `web/lib/accountState.ts` (SRP, ISP).
- **Why it matters**: each sign-in way module (feature 025) is meant to stand alone, but the
  recovery-code way and the email-link way share one store interface. A new way that needs its own
  one-time value would be added to this interface too, and every fake of it grows.
- **Decision**: fix
- **Fix**: split it into `AccountCodeStore` (`makeCode`; `CODE_DAYS`), `EmailLinkStore`
  (`make`, `spend`, `lookup`; `LinkPurpose`, `linkExpiry`) and `RecoveryCodeStore` (`replace`,
  `spend`, `left`), each with its Kysely and memory implementation. In `SharedStores`, replace
  `tokens` with `accountCodes`, `emailLinks` and `recoveryCodes`. Update the six callers above, the
  flow context `Pick`, and split `tokenContract.ts` along the same lines.
- **Size**: M

### D4 · OCP · `src/db/kysely/jobStore.ts:47`
- **Breach**: `boardCompaniesWithTitle` decides which postings count as company-board postings by
  hard-coding two source ids, `j.ats not in ["jsearch", "linkedin"]`. The memory twin repeats the
  list (`tests/helpers/memoryJobStore.ts:50`). Whether a source supplies board postings is a property
  of the source module (`SourceModule.kind`, `"api"`/`"email"` vs `"ats"`), but here it is a
  per-variant list inside the store.
- **Why it matters**: adding another aggregator or email source means editing the SQL in the store
  and its memory twin. Forgetting to makes the duplicate check treat the new source's jobs as board
  postings, so JSearch copies are wrongly skipped, and nothing in the registry warns about it.
- **Decision**: fix
- **Fix**: give the method the ats values to leave out:
  `boardCompaniesWithTitle(normalizedTitle, notBoards: readonly string[])` (`src/db/store.ts:63`).
  The caller, `src/sources/ingest.ts:40`, passes a list derived from the registry (for example
  `nonBoardAts()` in `src/sources/registry.ts`, from each module's kind and the ats its jobs carry).
  Both stores then filter on the list they are given. Behaviour is unchanged while the list is
  `["jsearch", "linkedin"]`. The `storeContract` cases pass the list.
- **Size**: M

### D5 · OCP · `src/db/kysely/tokenStore.ts:27`
- **Breach**: `spendEmailToken` branches on one purpose by name,
  `if (spend.purpose === "step_up") query = query.where("session_digest", …)`, and the memory store
  repeats the branch (`tests/helpers/memoryTokenStore.ts:17`). The purposes' other rule, their
  lifetimes, is already a table (`LIFETIME_MINUTES` in `src/db/tokenStore.ts:5`). Session binding
  is a second per-purpose rule written as a branch in each implementation.
- **Why it matters**: a new link that must be spent from the sign-in that asked for it (for
  example, confirming a sensitive change) needs the same edit in both stores. If one is missed, the
  memory and MariaDB stores disagree on a security rule, and the unit tests can't tell.
- **Decision**: fix
- **Fix**: add `const SESSION_BOUND: Record<LinkPurpose, boolean>` and an exported
  `boundToSession(purpose)` beside `LIFETIME_MINUTES` in `src/db/tokenStore.ts` (or the
  `EmailLinkStore` module after D3). Both implementations call `boundToSession(spend.purpose)`
  instead of naming `"step_up"`.
- **Size**: S

### D6 · SRP · `src/db/kysely/searchSettingsStore.ts:25`
- **Breach**: creating the owner's user row (`ensureOwner`) and the owner's id (`OWNER_ID`,
  `src/db/searchSettingsStore.ts:3`) live in the search-settings store modules. Account, resume and
  source stores (`kysely/accountStore.ts:8`, `kysely/resumeStore.ts:7`, `kysely/sourceStore.ts:6`)
  and `src/cli.ts`, `src/cliUser.ts` and `src/config/resumeFile.ts` import them from there. Users are
  the accounts area's data, so the search-settings module carries a second, unrelated job. The
  callers also don't agree on the rule: settings and sources create the owner only when saving for
  `OWNER_ID`, but `KyselyResumeStore` calls `ensureOwner` on every save, whoever it is for.
- **Also (deep analysis, 2026-11-08)**: the SQLite import inserts the owner's row itself
  (`src/app/importSqlite.ts:84`), a fourth copy of the rule. It calls `ensureOwnerFor` too
  (tasks T017).
- **Why it matters**: changing how the first user comes to exist (the accounts area's concern)
  means editing the search-settings store, and the one rule ("first write for the owner creates the
  owner") is written three ways in three stores.
- **Decision**: fix
- **Fix**: move `OWNER_ID` to `src/db/owner.ts` and `ensureOwner` to `src/db/kysely/owner.ts`, with
  one helper `ensureOwnerFor(trx, userId, at)` that creates the row only when `userId === OWNER_ID`.
  The settings, source, resume and account stores call it. This changes nothing in practice: no
  other user can exist before the owner, since a creation code's `created_by` refers to an existing
  user. Update the six importers of `OWNER_ID`, plus the tests that import it from
  `searchSettingsStore.js`.
- **Size**: M

### D7 · LSP · `tests/helpers/memorySearchSettingsStore.ts:4`
- **Breach**: the memory stores have no shared notion of which users exist, so they break the
  MariaDB stores' contract where users matter:
  - `MemorySearchSettingsStore` keeps a private `users` list, unrelated to `AuthTables.users`. A user
    made through `MemoryAccountStore.createAccount` can't save settings in memory, though they can
    in MariaDB.
  - Saving the owner's settings, sources or resume creates user 1 in MariaDB (`ensureOwner`), so
    `accounts.userIds()` gives `[1]`. In memory it stays `[]`, and `tests/runAll.test.ts` calls
    `initOwner` to make up for it.
  - `MemoryResumeStore` and `MemorySourceStore` accept any user id, where MariaDB refuses an unknown
    user through the `resumes_user_fk`, `resume_profiles_user_fk` and `user_sources_user_fk` foreign
    keys.
- **Why it matters**: unit tests that pass on the memory stores can fail on MariaDB (a write for a
  user that doesn't exist), or need workarounds that hide the difference (seeding
  `searchSettings.users`, calling `initOwner`). So the in-memory contract no longer proves what the
  constitution says it proves.
- **Decision**: fix
- **Fix**: give `memoryStores` one users table: `AuthTables.users`, passed to
  `MemorySearchSettingsStore`, `MemoryResumeStore` and `MemorySourceStore`. Drop the private
  `users` list. Each store creates the owner on an owner write, as `ensureOwner` does, and refuses a
  write for an unknown user. Add a "write for an unknown user is refused" case to
  `resumeContract.ts` and `sourceContract.ts` (the settings contract has one already). Update
  `storesWithSettings`, the `storeContract.test.ts` hooks (`owners`, `seedUser`) and the
  `runAll.test.ts` workaround. This is test code only.
- **Size**: M
- **Test setup (added by the analysis, 2026-11-08)**:
  - `PerCallStores` takes the shared users table
  - `storesWithSettings` creates user 1, since its `put` and `seed` bypass owner creation
  - the memory `seedUsers` and `seedUser` hooks in `tests/storeContract.test.ts` add to
    `AuthTables.users`
  - `tests/runAll.test.ts` keeps `initOwner` where `createAccount`'s code check needs user 1's email

### D8 · ISP · `src/db/store.ts:100`
- **Breach**: `ApiCallLog.lastCallAt` is part of the interface but nothing in `src/` or `web/` calls
  it. Only its two implementations (`src/db/kysely/apiCalls.ts:14`,
  `tests/helpers/memoryStore.ts:35`) and one contract line (`tests/helpers/storeContract.ts:164`)
  use it. Every holder of an `ApiCallLog` depends on a method no caller needs, and every
  implementation must keep it (the known finding, FR-010).
- **Why it matters**: dead interface surface has to be implemented, faked and contract-tested for
  nothing, and suggests a "last fetched" refresh rule the app doesn't have.
- **Decision**: fix
- **Fix**: remove `lastCallAt` from `ApiCallLog`, `KyselyApiCallLog` and `MemoryApiCallLog`, and
  drop its two calls from the `storeContract.ts:164` expectation, keeping the `countSince` check.
- **Size**: S
- **Done**: S1

### D9 · SRP · `src/db/store.ts:59`
- **Breach**: `src/db/store.ts` still groups the interfaces of five unrelated stores:
  - `JobStore` and `JobViews`
  - `ApiCallLog` (the JSearch budget)
  - `GmailStore` and `AlertStore` (the Gmail connection and alert read state)
  - their row types
  - the `SharedStores`/`Stores` containers

  027 (R14) moved every other store's interface to its own file (`careersStore.ts`,
  `companyStore.ts`, `postingStore.ts`, `sourcePlans.ts`, ...). These five stayed behind.
- **Why it matters**: any Gmail, budget or job-view change edits the same file as the containers,
  which 63 modules import. The file is also near the 200-line limit, which makes the next store
  interface awkward to add (027 had to put `UserStores` in its own file for that reason).
- **Decision**: fix
- **Fix**: move only the types, with no change to their members:
  - `JobStore`, `JobRow`, `Verdict` and `VerdictStamp` to `src/db/jobStore.ts`
  - `JobViews` and its view and page types to `src/db/jobViews.ts`
  - `ApiCallLog` to `src/db/apiCallLog.ts`
  - `GmailStore`, `AlertStore` and their row types to `src/db/gmailStore.ts`

  `store.ts` keeps `JobKey`, `CompanyPage`, `FoundDescription` and the containers. Update the
  import paths in the importers, which is a type-only change.
- **Size**: L

### D10 · ISP · `src/db/accountStore.ts:37`
- **Breach**: `AccountStore.isAdmin(id)` is called by nothing outside `src/db/`. Only its two
  implementations and tests use it (`tests/helpers/accountContract.ts:32-33`,
  `tests/adminFlow.test.ts:34,47`). Callers read the admin mark from `account(id)`. Found by the
  deep analysis (2026-11-08), not the first review.
- **Why it matters**: an interface member with no caller widens what every implementation must
  provide, and the D8 guard ("every store method is called") can't pass with it.
- **Decision**: fix
- **Fix**: remove `isAdmin` from `AccountStore`, `KyselyAccountStore` and `MemoryAccountStore`. The
  two tests read `(await accounts.account(id))?.isAdmin`. Done in S1 with D8 (tasks T008).
- **Size**: S
- **Done**: S1

## Mechanical checks

- **No source ids in stores** (D4): a test scans `src/db/**/*.ts` and `tests/helpers/memory*.ts`
  for a comparison against a registered module id or `"linkedin"`: `[!=]==\s*"<id>"`, or the id in
  a `"not in", [...]` list. The list is built from `MODULES` in `src/sources/registry.ts`. A row
  literal such as `ats: "greenhouse"` in `memoryCompanies.ts` is data and passes. Applied migration
  steps are exempt (amended by the analysis, 2026-11-08).
- **No purpose names in token stores** (D5): a test greps `src/db/kysely/*Store.ts` and
  `tests/helpers/memory*Store.ts` for a `LinkPurpose` literal (`"signin"`, `"reset"`,
  `"email_change"`, `"step_up"`) used in a comparison (`=== "…"` / `!== "…"`).
- **Every store method is used** (D8): a test reads each `export interface …Store`/`…Log`/`…Views`
  in `src/db/*.ts`, lists its method names (TypeScript compiler API, or a regex over the interface
  body), and fails when a name is never called (`.name(`) in any file under `src/` or `web/` outside
  `src/db/`.
- **Containers hold stores** (027 R4, kept): a unit test over `memoryStores()` checks two things:
  - every member of `SharedStores` and of `forUser(n)` is an object, apart from `userId` (a number);
  - the only functions on `Stores` are `forUser` and `close`.

  The same test over `storesOver` with a Kysely instance that never connects checks the
  production factory.
- **One owner helper** (D6): a test fails if any file other than `src/db/kysely/owner.ts` inserts
  into `users` with `OWNER_ID` (a grep for `insertInto("users")` in `src/db/kysely/`, allowing
  `owner.ts` and `accountCreation.ts`), and if `OWNER_ID` is imported from anywhere but
  `src/db/owner.ts`.
- **One user list in memory stores** (D7): a contract case, not a grep. Each per-user store's
  contract (settings, resume, sources) refuses a write for an unknown user, and after an owner write
  `accounts.userIds()` contains `OWNER_ID`. It runs against both the memory stores and MariaDB.
