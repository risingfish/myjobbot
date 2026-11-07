---

description: "Tasks for feature 025: login ways refactor"
---

# Tasks: Login ways refactor

**Input**: Design documents from `docs/specs/025-login-ways-refactor/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R10), data-model.md, quickstart.md

**Tests**: required by the constitution (Principle II). The existing suite is the guard for US1.
Every `expect` line already in `tests/` stays as it is: a task may change a test's imports, its
store construction, which contract file a case lives in, or, for a removed entry point, call its
replacement with the same inputs; never what it asserts (FR-003).

**Organization**: three sittings, one commit each, delivered as **one PR** (owner decision,
2026-11-07, replacing plan.md's one PR per sitting). Stories: **US1** nothing changes for account holders (held by every sitting's
check), **US2** each way has one home, **US3** adding a way touches one module, **US4** each
repeated rule written once.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1–US4 as above

## Sittings

| Sitting | Stories | Stack | PR | Why |
|---|---|---|---|---|
| S1 shared pieces | US2, US4 | stopped | 1 | stores, flows and the session start change (server code) |
| S2 way modules and registry | US2, US3 | stopped | 2 | sign-in and step-up go through the registry (server code) |
| S3 web | US3, US4 | owner's choice | 3 | actions and components only, no migration, no run change |

- Each sitting's first task creates `.specify/sitting-in-progress` naming it. Its last task runs
  `npm run check` and `npm run check:db` until green and deletes the marker. Commit and open the
  PR only when the owner asks.
- **Wire as you build**: every new module gets its production callers in the sitting that
  creates it. Every old module is deleted in the sitting that empties it. No re-export shims are
  left behind (knip reports them).
- **Each way's wording stays the same**: card names, radio names and order, field labels and
  `autoComplete`, `MESSAGES`, event names and methods are copied, never retyped.
- S2 touches about 20 files, against the roughly 10-file PR guide. It stays one sitting because
  the changes are mostly mechanical moves held by the unchanged suite (research R10).
- Before S1 starts, the stack is stopped (`docker compose stop`, no `docker:watch`). The owner
  restarts it after the last merge.

---

## Phase 1: Setup

- [X] T001 Stop the Docker stack, create `.specify/sitting-in-progress` naming S1, run `npm run check` and `npm run check:db` on `025-login-ways-refactor` and write the counts (unit 1100, integration 84, UI 78 expected) into the ledger's baseline row below

---

## Phase 2: Sitting S1, shared pieces (US2, US4) — PR 1

**Goal**:
- Sessions, attempts, the keep-a-way lock, the usable check and the authenticator store each
  get one home (FR-008, FR-009, FR-010, FR-011, and FR-007's lockout half).

**Independent Test**:
- The suite is green with unchanged expectations.
- `grep -rn "forUpdate" src/db/kysely/methodStore.ts src/db/kysely/keyStore.ts` finds nothing.
- `grep -rn 'row.kind === "' src/accounts` finds nothing (`wayUsable` compares against the kind it is given, not a literal).

### Tests (S1)

- [X] T002 [P] [US4] Write a unit test (1) in `tests/wayLock.test.ts` for the memory `changeKeepingAWay(tables, userId, { change, apply })` from `tests/helpers/memoryAuthTables.ts`:
  - it answers `"last_way"` without calling `apply` when the change would leave no usable way (password the only usable way, change `{ kind: "password", enabled: false, mailOn: true }`)
  - it calls `apply` once and answers `"ok"` otherwise
- [X] T003 [P] [US4] Write a unit test (1) in `tests/wayUsable.test.ts` for `wayUsable(ctx, userId, kind)` from `src/accounts/ways/usable.ts`, on `signedInOwner()`'s context:
  - `true` for a ready, enabled `email_link` with `ctx.mail` set; `false` for the same way with `ctx.mail = null`
  - `false` for a way never stored
- [X] T004 [US2] Move the authenticator cases out of `tests/helpers/methodContract.ts` into a new `tests/helpers/authenticatorContract.ts`:
  - `authenticatorSavedAndRemoved` goes to `authenticatorContract(make)`; `stepsAcceptedInOrder` goes to `authenticatorStrictCases(make)`
  - same test titles and `expect` lines, calling `authenticators.` instead of `methods.`
  - register them in `tests/storeContract.test.ts` and `tests/integration/storeContract.test.ts`
  - `methodStrictCases` keeps only `lastWayKept`

### Implementation (S1)

- [X] T005 [US2] Create `src/accounts/flows/sessions.ts` holding `startSession`, `SessionCookies` and `UNKNOWN_DEVICE`, moved unchanged from `src/accounts/flows/signIn.ts`, and point every importer at it:
  - `signIn.ts`, `accountChanges.ts`, `admin.ts`, `createAccount.ts`, `linkSpends.ts`
  - `web/lib/requestAuth.ts` and any other `web/lib/*` file importing `SessionCookies`
  - the tests importing them
- [X] T006 [US2] Create `src/accounts/flows/attempts.ts` holding `PasswordTry`, `reached`, `signInLocked`, `recordFailure` and `actorTry`, moved whole from `src/accounts/flows/passwordCheck.ts`:
  - `attempts.ts` imports nothing from a way: it is the shared lockout only
  - `passwordCheck.ts` keeps `passwordMatches` and `currentPasswordMatches` (the latter now importing the lockout from `attempts.ts`) until S2 moves both into `ways/password.ts`
  - update the imports in `signIn.ts`, `confirmIdentity.ts`, `accountChanges.ts` and the tests
- [X] T007 [US4] Create `src/db/kysely/wayLock.ts` with:
  - `storedWays(db, userId)`, the row reading now private in `KyselyMethodStore.stored` and copied in `keyStore.ts`
  - `changeKeepingAWay(db, userId, { change, apply })`: one transaction that locks `users` with `forUpdate()`, refuses with `"last_way"` when `keepsAWay(allMethods(rows), change)` fails, else runs `apply(trx)` and answers `"ok"`

  `KyselyMethodStore.setEnabled` and `KyselyKeyStore.removeKey` then call it, with the same statements inside `apply`.
- [X] T008 [US4] Add the memory twin `changeKeepingAWay(tables, userId, { change, apply })` and `storedWays(tables, userId)` to `tests/helpers/memoryAuthTables.ts`. Use them in `MemoryMethodStore.setEnabled` and `MemoryKeyStore.removeKey`, removing their inlined copies (T002 passes).
- [X] T009 [US2] Create the `AuthenticatorStore` (R7):
  - interface `src/db/authenticatorStore.ts`, with `AuthenticatorRow` moved from `src/db/methodStore.ts`
  - `src/db/kysely/authenticatorStore.ts`: `authenticator`, `saveAuthenticator`, `acceptStep` moved from `KyselyMethodStore`; `removeAuthenticator` through `changeKeepingAWay`
  - `tests/helpers/memoryAuthenticatorStore.ts`, likewise from `MemoryMethodStore`

  Delete those four members from `MethodStore` and both its implementations.
- [X] T010 [US2] Add `authenticators` to `Stores` (`src/db/store.ts`), build it in `src/db/kysely/stores.ts` and `tests/helpers/memoryStore.ts`, and add it to `AuthContext.stores` (`src/accounts/flows/context.ts`) and `tests/helpers/authContext.ts`. Switch every `ctx.stores.methods.{authenticator,saveAuthenticator,removeAuthenticator,acceptStep}` in `src/accounts/flows/authenticator.ts` and the tests to `ctx.stores.authenticators.` (T004 passes on both stores).
- [X] T011 [US4] Create `src/accounts/ways/usable.ts` with `wayUsable(ctx, userId, kind)` (`usable(row, { mailOn: ctx.mail !== null })` over `ctx.stores.methods.methods(userId)`). Replace the three inlined copies (T003 passes):
  - `emailLinks.ts` `requestSignInLink`, where mail is on at that point, so the answer is the same
  - `linkSpends.ts` `spendSignIn`
  - `keys.ts` `accountKey`
- [X] T012 Run `npm run check` and `npm run check:db` until green, update the ledger, delete `.specify/sitting-in-progress`. PR 1 when the owner asks.

**Checkpoint**: The shared pieces each have one home, and behaviour is unchanged.

---

## Phase 3: Sitting S2, way modules and the registry (US2, US3) — PR 2

**Goal**:
- One module per way.
- One catalog and one registry.
- Sign-in, proof reading and "Confirm it's you" look ways up (FR-004–FR-007).

**Independent Test**:
- The suite is green with unchanged expectations.
- `src/accounts/flows/` no longer holds `passwordCheck.ts`, `authenticator.ts`, `keys.ts` or `recoveryCodes.ts`.
- `confirmIdentity.ts` and `signIn.ts` have no `=== "<kind>"`.

### Tests (S2)

- [X] T013 Create `.specify/sitting-in-progress` naming S2.
- [X] T014 [P] [US3] Write a unit test (1) in `tests/waysCatalog.test.ts` that pins the catalog to 024's UI (data-model.md tables), reading only exports that have production callers in S2 (`CARD_KINDS`, `CHOICE_KINDS` and `wayEntry(kind)` for each of them; `WAYS` is never exported, since knip's production pass would report it as test-only), exactly:
  - `CARD_KINDS` is `["password", "email_link", "hardware_key", "authenticator"]`, with names "Password", "Email me a link", "Hardware keys", "Authenticator app"
  - `CHOICE_KINDS` is `["password", "authenticator", "recovery_code", "hardware_key"]`, with names "Password", "Authenticator app", "Recovery code", "Hardware key"
  - fields: the password field is named `password`, labelled "Password", `current-password`; the authenticator and recovery-code fields are named `code`, labelled "Code from your app" and "Recovery code", `one-time-code`; the hardware key's field is `{ kind: "key" }`
  - flags: `needsMail` and `readyWhenOn` are true for `email_link` and false for every other way
- [X] T015 [P] [US3] Write a unit test (1) in `tests/waysRegistry.test.ts`: for every kind in `CHOICE_KINDS`, `PROOF_WAYS[kind].kind === kind`, and `readProof` reads the way's own field.
  - password → `{ password }`
  - authenticator and recovery code → `{ code }`
  - hardware key → `{ response }`
  - a missing field → `null`

### Implementation (S2)

- [X] T016 [US3] Create `src/accounts/ways/catalog.ts` (client-safe, imports nothing from `src/db`, `src/mail`, `src/gmail` or Node; data-model.md "WayEntry"):
  - exported: `CARD_KINDS`/`CardKind`, `CHOICE_KINDS`/`ChoiceKind`, `wayEntry(kind)`
  - kept in the file, not exported: `WayEntry` (with `needsMail` and `readyWhenOn`), `ProofField`, `WAYS`
  - not `cardName`/`choiceOf` yet: their callers are S3's components (T031). Adding them here, or exporting `WayEntry`, `ProofField` or `WAYS`, would leave knip findings at S2's boundary

  `src/db/methodStore.ts` then takes `MethodKind = CardKind` and drops `METHOD_KINDS`. Update:
  - `src/accounts/methods.ts`: `allMethods` maps `CARD_KINDS`; `usable` uses `!wayEntry(row.kind).needsMail || options.mailOn`; `afterChange` uses `wayEntry(change.kind).readyWhenOn`
  - `src/accounts/flows/accountChanges.ts` `setMethodEnabled`: refuse with `mail_off` when `wayEntry(change.kind).needsMail && change.enabled && ctx.mail === null`
  - `src/db/kysely/wayLock.ts` (`isKind`), `web/lib/accountActions.ts` (`z.enum(CARD_KINDS)`), `web/lib/accountState.ts` and `web/components/account/AccountView.tsx`

  T014 passes, and `tests/accountMethods.test.ts` passes unchanged.
- [X] T017 [P] [US2] Create `src/accounts/ways/password.ts`, the `ProofWay` for `password` built on `passwordMatches`, and `currentPasswordMatches` (both moved from `flows/passwordCheck.ts`, which is then deleted; imports run `ways/password.ts` → `flows/attempts.ts`, never back), plus:
  - `changePassword`, moved from `flows/accountChanges.ts`
  - `newPasswordDigest(raw)`: `checkPassword` then `digestPassword`, giving `{ ok: true; digest }` or `{ ok: false; message }` with the rule's own message
  - (no `setNewPassword`: every caller checks the rule before acting, the reset before spending its link, so `newPasswordDigest` is the one shared step; done 2026-11-07)
  - callers: `changePassword`, `linkSpends.ts` `spendReset`, `createAccount.ts` and `src/accounts/cli.ts` (`account init` and `account reset`, which keep their hidden prompts and messages) use `newPasswordDigest`
  - afterwards no file but `ways/password.ts` imports `checkPassword` and `digestPassword` together
- [X] T018 [US2] Move `src/accounts/flows/authenticator.ts` to `src/accounts/ways/authenticator.ts`, adding its `ProofWay` (`readProof` → `{ code }`, `matches` → `appCodeMatches`), and delete the old file.
- [X] T019 [P] [US2] Move `src/accounts/flows/keys.ts` to `src/accounts/ways/hardwareKey.ts`, adding its `ProofWay` (`readProof` → `{ response }`, `matches` → `keyMatches`), and delete the old file.
- [X] T020 [P] [US2] Move `src/accounts/flows/recoveryCodes.ts` to `src/accounts/ways/recoveryCode.ts`, adding its `ProofWay` (`readProof` → `{ code }`, `matches` → `recoveryCodeMatches` with the address), and delete the old file.
- [X] T021 [US2] Break the email-link import cycle before moving anything (research R4):
  - move `mayMail`, `mailLink`, `emailKeyedRequest` and `MAIL_OFF` from `flows/emailLinks.ts` into a new `src/accounts/flows/mailLinks.ts`
  - move whatever `spendSignIn` shares with the other spends (`EXPIRED`, `LinkSpend`, `SpendAnswer`) from `flows/linkSpends.ts` into it as well
  - then create `src/accounts/ways/emailLink.ts` holding `requestSignInLink` (from `emailLinks.ts`) and `spendSignIn` (from `linkSpends.ts`), importing only `mailLinks.ts`, `sessions.ts` and `usable.ts`
  - `emailLinks.ts`'s `SPENDS` table imports `spendSignIn` from `ways/emailLink.ts`; nothing under `src/accounts/ways/` imports `emailLinks.ts` or `linkSpends.ts`
  - the web's `requestSignInLink` import moves to `ways/emailLink.ts`
- [X] T022 [US3] Create `src/accounts/ways/registry.ts`: `ProofWay` and `PROOF_WAYS: Record<ChoiceKind, ProofWay>` over the four proof ways (R3). T015 passes.
- [X] T023 [US3] Route the callers through the registry:
  - `confirmIdentity.ts`: `IdentityProof` keeps its flat shape (`{ method: ChoiceKind } & ProofFields`, data-model.md), so `tests/stepUp.test.ts`, `tests/recoveryCodesFlow.test.ts` and the step-up action in `web/lib/accountActions.ts` are unchanged in S2. `proofMatches` becomes `PROOF_WAYS[method].readProof(proof)`, a `null` proof refused like a wrong one, then `.matches`
  - `signIn.ts` gains `signInByWay(ctx, request, { kind, fields })`, which reads the proof with `readProof` (a `null` proof is refused like a wrong one) and calls `signInWith`
  - `web/lib/signInActions.ts` `signInByWay` and `web/lib/keyActions.ts` (`finishKeySignIn`) call it, with the way read from the form against `CHOICE_KINDS` (an unknown way falls back to `password`, as now)
  - remove `signInWithPassword`, `signInWithAuthenticator`, `signInWithRecoveryCode` and `finishKeySignIn`; keeping them for tests alone would be test-only code. Their tests call `signInByWay` with the same inputs and expectations (FR-003 as amended)
- [X] T024 [US2] Update every importer of the moved modules:
  - `web/lib/{accountActions,authenticatorActions,keyActions,signInActions,requestAuth}.ts`
  - `src/accounts/flows/{accountChanges,admin,createAccount,emailLinks,linkSpends}.ts`
  - the tests: `accountChanges`, `authenticatorFlow`, `keysFlow`, `recoveryCodesFlow`, `recoveryFlow`, `signInFlow` and any other the typecheck names
- [X] T025 Run `npm run check` and `npm run check:db` until green, update the ledger, delete the marker. PR 2 when the owner asks.

**Checkpoint**: Each way has one home, and sign-in and step-up look ways up.

---

## Phase 4: Sitting S3, the web (US3, US4) — PR 3

**Goal**:
- One opening for account actions (FR-012).
- The UI lists come from the catalog (FR-005, FR-006).
- No per-way branches remain, enforced by a test (SC-002).

**Independent Test**:
- `tests/wayBranches.test.ts` passes.
- `grep -rn "const SIGNED_OUT" web` finds one.
- `grep -rn "WAY_NAMES\|const WAYS\|METHOD_KINDS" src web` finds only `src/accounts/ways/catalog.ts`.

### Tests (S3)

- [ ] T026 Create `.specify/sitting-in-progress` naming S3, with the stack running only if the owner wants to watch (every turn then ends clean).
- [ ] T027 [P] [US4] Write a unit test (1) in `tests/accountAction.test.ts` for `signedInAction(parse, run)` from `web/lib/accountAction.ts`, mocking `./actor.js` and `./authDeps.js` the way `tests/actionGuards.test.ts` mocks web modules:
  - `SIGNED_OUT` when `parse` gives `null`, and when `actorNow()` gives `null`, without calling `run`
  - otherwise `run` gets the parsed input and the actor, and its answer is returned
- [ ] T028 [P] [US3] Write an integration test (1; it reads files, research R9, though it runs in `npm run check` like `actionGuards.test.ts`) in `tests/wayBranches.test.ts`:
  - read every `.ts`/`.tsx` under `src/` and `web/` (skipping `.next*`) as text
  - fail on any `=== "password"`, `=== "email_link"`, `=== "authenticator"`, `=== "hardware_key"` or `=== "recovery_code"` (and `!==`) outside `src/accounts/ways/`, `src/db/`, and `web/components/account/{PasswordControls,EmailLinkControls,AuthenticatorControls,KeyControls,RecoveryCodes}.tsx`
  - name each offending file and line
  - at this point it fails only on `WayCard.tsx`, `WayChoice.tsx`, `StepUp.tsx`, `SignInForm.tsx` and `accountActions.ts`, which T031 fixes

### Implementation (S3)

- [ ] T029 [US4] Create `web/lib/accountAction.ts`, a plain module with no `"use server"`:
  - `SIGNED_OUT`
  - `signedInAction<I, R>(parse: (...args: unknown[]) => I | null, run: (signedIn: { ctx: AuthContext; actor: Actor; settings: WebSettings }, input: I) => Promise<R>)`, returning the async action

  `Refused` is imported from `src/accounts/flows/context.ts`. T027 passes.
- [ ] T030 [US4] Rewrite the 16 signed-in actions in `web/lib/accountActions.ts` (9), `web/lib/authenticatorActions.ts` (4) and `web/lib/keyActions.ts` (3) as `guarded(signedInAction(...), options)`:
  - same options, answers, `revalidatePath` calls and cookie setting
  - delete each file's own `SIGNED_OUT` and `Refused`
  - `tests/actionGuards.test.ts` must pass unchanged
- [ ] T031 [US3] Add `cardName(kind)` and `choiceOf(kind)` to `src/accounts/ways/catalog.ts`, and export the `ProofField` type (used by `WayChoice` and `StepUp`), each with its callers below; then drive the UI from the catalog:
  - `WayCard.tsx`: the title from `cardName(kind)`; controls from a `Record<CardKind, (props) => JSX>` lookup in place of the if-chain
  - `WayChoice.tsx`: the radios from `CHOICE_KINDS`/`choiceOf`, the field from the entry's `field`, the key note when `field.kind === "key"`, and `Way` replaced by `ChoiceKind`
  - `StepUp.tsx` `useStepUpAnswers`: the value read by the chosen way's field (`field.kind === "key"` → `keyAnswer()`, else the field's `name`)
  - `SignInForm.tsx`: the key route (`form.get("way") === "hardware_key"`) becomes `choiceOf(way).field.kind === "key"`
  - `confirmIdentityAction` in `accountActions.ts` reads the proof with `PROOF_WAYS[kind].readProof`, replacing the zod union

  The existing UI tests (`tests/client/accountPage.test.tsx`, the sign-in and step-up component tests) must pass unchanged. T028 passes.
- [ ] T032 [P] Update CLAUDE.md's "Accounts (feature 024)" entry: ways live in `src/accounts/ways/` (catalog for the UI, registry for proofs); `AuthenticatorStore` is a sixth store; the keep-a-way lock is `wayLock.ts`; account actions open with `signedInAction`; `tests/wayBranches.test.ts` keeps per-way branches inside the way modules.
- [ ] T033 Run `npm run check` and `npm run check:db` until green, update the ledger, delete the marker. PR 3 when the owner asks.

**Checkpoint**: A sixth way would need its module, a catalog entry, a registry entry and its controls only (SC-005).

---

## Phase 5: Polish (US1)

- [ ] T034 [US1] After PR 3 merges, the owner rebuilds and restarts the stack and walks quickstart §3: password sign-in and the lock, "Confirm it's you", `last_way`, the email link, the authenticator, a recovery code and a hardware key. Every message, card name, radio order and recorded event matches 024 (SC-006).

---

## Dependencies & Execution Order

- S1 → S2 → S3, each merged before the next:
  - S2's way modules use S1's `attempts.ts`, `sessions.ts`, `wayUsable` and `AuthenticatorStore`
  - S3's UI and actions use S2's catalog and registry
- Within S1:
  - T004 before T009–T010
  - T002 before T008
  - T003 before T011
  - T005 and T006 are independent
  - T007 before T008 and T009
- Within S2:
  - T014 before T016
  - T015 before T022
  - T017, T019 and T020 [P] after T016; T018 after T020, since `authenticator.ts` imports `recordWayAdded` from the file T020 moves
  - T022 after them
  - then T023 and T024
- Within S3:
  - T027 before T029–T030
  - T028 before T031

## Parallel Example: S2

```text
T017 ways/password.ts   T019 ways/hardwareKey.ts   T020 ways/recoveryCode.ts
then T018 ways/authenticator.ts
```

## Implementation Strategy

There is no MVP here: US1 is the condition every sitting is held to. S1 alone already removes
the repeated lock and usable check, and is worth merging by itself. Stop after any PR if the next
isn't wanted.

## Test ledger (constitution Principle II)

| Point | Unit | Integration | UI |
|---|---|---|---|
| Baseline (T001, 2026-11-07) | 1100 | 84 (83 + 1 skipped) | 78 |
| S1 planned | +2 (T002, T003) | +0 (cases move files) | +0 |
| Actual after S1 (2026-11-07) | 1102 (+2) | 84 (+0) | 78 (+0) |
| S2 planned | +2 (T014, T015) | +0 | +0 |
| Actual after S2 (2026-11-07) | 1106 (+4: the catalog test split in three, by habit-hooks' function limit) | 84 (+0) | 78 (+0) |
| S3 planned | +1 (T027) | +1 (T028, a source scan) | +0 |
| Planned after | +5 | +1 | +0 |
| Actual | | | |
