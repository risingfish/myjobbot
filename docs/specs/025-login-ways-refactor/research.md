# Research: Login ways refactor (025)

Each decision below resolves a design question the spec leaves to the plan. The code they refer to
is as merged in #114 (024).

## R1. Two halves of the registry: a client-safe catalog and server-side way modules

- **Decision**: The registry is split in two.
  - `src/accounts/ways/catalog.ts` holds plain data only: each way's kind, its names as shown, and
    its places in the UI. It imports nothing from the server, so the client components
    (`WayCard`, `WayChoice`, `StepUp`) can import it.
  - `src/accounts/ways/registry.ts` maps each way that takes a typed or key proof to its server
    module, which has its proof check, its setup and its removal.
- **Rationale**: `WayCard.tsx`, `WayChoice.tsx` and `StepUp.tsx` are `"use client"` files. A single
  registry that imported `seal.ts`, `qrcode` or the stores would pull server code into the client
  bundle (024 already hit this once with `geoip-lite` and `next/navigation`).
- **Alternatives**: One registry file with dynamic imports was rejected: it is harder to follow and
  type-check. Leaving the UI lists as they are was rejected because it fails FR-005 and SC-003.

## R2. Two places, two orders, one list

- **Decision**: The catalog is one array of `WayEntry`, and each entry says where it appears:
  - `card` (on the Account tab: its name and position): password, email link, hardware key,
    authenticator.
  - `choice` (as a radio on the sign-in form and in "Confirm it's you": its name, position and the
    field it asks for): password, authenticator, recovery code, hardware key.

  `CARD_KINDS` (which replaces `METHOD_KINDS` and keeps the stored kinds) and `CHOICE_KINDS` are
  derived from it, sorted by position.

  Only what has a production caller in a sitting is exported then. In S2 that is `CARD_KINDS`,
  `CHOICE_KINDS` and `wayEntry(kind)`. In S3 it adds `cardName`, `choiceOf` and the `ProofField`
  type. `WAYS` and `WayEntry` stay private to the file. knip's production pass reports exports
  used only by tests and unused exported types, so the catalog test reads the catalog through the
  same exports production does.

  Two flags carry the rules that differ by way:
  - `needsMail`: the email link is usable only while mail is set up, and can't be switched on
    without it.
  - `readyWhenOn`: the email link counts as set up once switched on.

  `methods.ts` (`usable`, `afterChange`) and `setMethodEnabled` read these flags instead of
  comparing against `"email_link"`.
- **Rationale**: The card names ("Hardware keys") and choice names ("Hardware key") differ, and the
  two orders differ. Keeping each on its entry keeps the wording and order byte-for-byte (FR-001)
  and leaves one list (SC-003).
- **Alternatives**: Reordering to share one order was rejected because the UI would change.

## R3. The WayModule shape

- **Decision**: A server way module is a `ProofWay` with these members:
  - `kind`
  - `readProof(fields)`, which reads its proof from the submitted fields (the sign-in form, or step-up's `value`) or gives `null`
  - `matches(ctx, account, proof, address)`, which says whether the proof is right for the account
- **Where the rest lives**: Setup and removal stay as named exports of the same module (for
  example `startAuthenticatorSetup`). They are not members, because each way's setup has a
  different shape (a QR code, a WebAuthn ceremony, nothing for recovery codes). The registry
  only needs what confirming identity and signing in share.
- **Users**: `signInWith` takes `{ method, matches }` as it does now. The sign-in dispatch and
  `confirmIdentity` build that from `registry[kind]`.
- **Email link**: it is in the catalog (it has an Account tab card) but not in the registry, because its
  proof arrives through `/link`, not a typed field.
- **Alternatives**: A wider interface with optional setup members was rejected: it would force one
  shape on four different setups (interface segregation).

## R4. Where each way's code goes

| Today | After |
|---|---|
| `passwordMatches` in `flows/passwordCheck.ts`, `changePassword` in `accountChanges.ts`, `passwordRule.ts`, `passwordDigest.ts`, reset in `linkSpends.ts` | `ways/password.ts` (the proof way and `changePassword`), still using `passwordRule.ts` and `passwordDigest.ts` |
| `signInLocked`, `recordFailure`, `actorTry` | `flows/attempts.ts`, the shared lockout, importing no way |
| `currentPasswordMatches` | `ways/password.ts`, using `attempts.ts`'s lockout (imports run one way: password → attempts) |
| `flows/authenticator.ts` | `ways/authenticator.ts` |
| `flows/keys.ts` | `ways/hardwareKey.ts` |
| `flows/recoveryCodes.ts` | `ways/recoveryCode.ts` (`recordWayAdded` with it) |
| `requestSignInLink` in `emailLinks.ts`, `spendSignIn` in `linkSpends.ts` | `ways/emailLink.ts` |
| `mayMail`, `mailLink`, `emailKeyedRequest` in `emailLinks.ts` | `flows/mailLinks.ts` (new) |
| the rule-and-digest step in `accountChanges.ts`, `createAccount.ts`, `linkSpends.ts`, `cli.ts` | `ways/password.ts`: `newPasswordDigest(raw)` (rule check, then digest, or the rule's message) |
| `startSession`, `SessionCookies` in `flows/signIn.ts` | `flows/sessions.ts` |

`emailLinks.ts` and `linkSpends.ts` keep the mail-link plumbing (test email, email change, step-up
link, reset, and the `SPENDS` table) and call the way modules for their parts. The helpers that
both they and `ways/emailLink.ts` need (`mayMail`, `mailLink`, `emailKeyedRequest`) move to
`flows/mailLinks.ts`. Imports then run one way, `emailLinks.ts` → `ways/emailLink.ts` →
`mailLinks.ts`, with no cycle. Without the move, the `SPENDS` table, built as the module loads,
could hold `undefined` for sign-in links.

**Entry points**: `signInWithPassword`, `signInWithAuthenticator`, `signInWithRecoveryCode` and
`finishKeySignIn` are removed once the dispatch goes through `signInByWay`. Keeping them only for
tests would be test-only code that knip reports. Their tests call `signInByWay` with the same inputs
and expectations, which FR-003 allows.

Every caller (`createAccount.ts`, `cli.ts`, `changePassword` and the reset spend) uses
`newPasswordDigest`. Each checks the rule before acting (the reset before spending its link), so a
combined `setNewPassword` would have changed the order and was dropped (2026-11-07).

`passwordRule.ts`, `passwordDigest.ts`, `totp.ts` and `keys.ts` (the SimpleWebAuthn wrappers)
stay as the pure helpers the way modules use.

## R5. The keep-a-usable-way lock, once

- **Decision**:
  - The Kysely side gets `src/db/kysely/wayLock.ts` with `changeKeepingAWay(db, userId, { change, apply })`.
    In one transaction it locks the user row, reads the stored ways, refuses with `"last_way"` when
    `keepsAWay` fails, and otherwise runs `apply(trx)`. `setEnabled`, `removeAuthenticator` and
    `removeKey` call it.
  - The stored-row reading, now copied in the method and key stores, becomes one `storedWays(db, userId)`
    in the same file.
  - The memory stores get the same as one function in `tests/helpers/memoryAuthTables.ts`.
- **Rationale**: This is FR-010 and SC-004. The lock and the check live together, so no caller can do
  one without the other.

## R6. One usable check

- **Decision**: `wayUsable(ctx, userId, kind)` in `src/accounts/ways/usable.ts` reads the account's
  ways and applies `usable` with `mailOn: ctx.mail !== null`.
  - It replaces the three inlined copies: `emailLinks.ts` (`mailOn: true`, reached only when mail
    is on, so it behaves the same), `linkSpends.ts` and `keys.ts`.
  - `usable`, `allMethods`, `afterChange` and `keepsAWay` stay pure in `src/accounts/methods.ts`.

## R7. The authenticator's own store

- **Decision**: An `AuthenticatorStore` (`src/db/authenticatorStore.ts`, Kysely in
  `src/db/kysely/authenticatorStore.ts`, memory in `tests/helpers/memoryAuthenticatorStore.ts`)
  takes `authenticator`, `saveAuthenticator`, `removeAuthenticator` and `acceptStep` from
  `MethodStore`.
  - It is added to `Stores` as `authenticators` and to `AuthContext.stores`.
  - It still reads and writes the `authenticator` row of `sign_in_methods`; the table doesn't change.
  - `MethodStore` keeps the general state: `methods`, `setEnabled`, `passwordDigest` and `setPassword`.
  - Its contract cases move from `methodContract.ts` to a new `tests/helpers/authenticatorContract.ts`
    with their wording and expectations unchanged. The strict step case moves with them.
- **Rationale**: This is FR-009 and gives the store the same shape as `KeyStore`. Moving test
  cases between contract files counts as building fixtures, not asserting differently (FR-003).

## R8. One opening for account actions

- **Decision**: `web/lib/accountAction.ts` is not a `"use server"` file, so it may export a
  non-async helper. It exports `signedInAction(parse, run)`:
  - `parse` turns the raw arguments into input, or gives `null`.
  - The helper calls `actorNow()` and answers `SIGNED_OUT` when parsing fails or nobody is signed in.
  - Otherwise it calls `run({ ctx, actor, settings }, input)`.

  The 16 actions in `accountActions.ts`, `authenticatorActions.ts` and `keyActions.ts` become
  `guarded(signedInAction(...), options)`. `SIGNED_OUT` is declared once there, and the
  `Refused` type is imported from `src/accounts/flows/context.ts`.
- **Rationale**: This is FR-012 and SC-004. `tests/actionGuards.test.ts` keeps proving that every export is
  guarded.
- **Alternatives**: Folding this into `guarded` was rejected: `guarded` also serves public and
  non-account actions, and step-up is its concern, not input parsing.

## R9. Proving "no per-way branches" with a test

- **Decision**: A unit test, `tests/wayBranches.test.ts`, reads the source files under `src/` and
  `web/` as text, like `tests/actionGuards.test.ts` already does. It fails on any comparison of a
  way's kind as a literal (`=== "password"`, `"authenticator"`, `"hardware_key"`,
  `"recovery_code"`, `"email_link"`) outside `src/accounts/ways/`, their UI controls under
  `web/components/account/` and the stores.
- **Rationale**: This makes SC-002 a check that keeps holding, not a one-time review.
- **Kind**: Because it reads files, it is counted as an **integration** test under Principle II's
  definitions. It still runs in `npm run check` (the `node` project), as `actionGuards.test.ts` does.
- **Also routed**: `SignInForm.tsx`'s key route (`form.get("way") === "hardware_key"`) is replaced
  by the chosen way's `field.kind === "key"`.
- **Exceptions**: The stores (`sign_in_methods` rows are keyed by kind) and event names are not
  dispatch, so they are excluded by path, not by pattern.

## R10. Delivery

- **Decision**: Three sittings, each ending green and each a small, separately mergeable PR
  (`small-prs` memory):
  1. S1, shared pieces: sessions, attempts, wayLock, wayUsable, the authenticator store.
  2. S2, the way modules and the registry.
  3. S3, the web: `signedInAction`, the catalog in the UI, the branch test.
- **Size**: S2 touches about 20 files, against the roughly 10-file guide. The changes are mostly
  mechanical moves checked by the unchanged suite, so it stays one sitting and one PR (decision,
  2026-11-07).
- **Stack**: S1 and S2 change server code but add no migration and leave the run alone. S3 changes
  server actions and components. The stack is stopped for S1–S2, because they aren't UI work. S3 may
  keep it running only if the owner wants to watch: it changes components, but no look or wording.
