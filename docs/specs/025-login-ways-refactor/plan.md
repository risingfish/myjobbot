# Implementation Plan: Login ways refactor

**Branch**: `025-login-ways-refactor` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/025-login-ways-refactor/spec.md`

## Summary

This plan reorganises 024's sign-in code by way of signing in, without changing behaviour.

- **Catalog and registry.** A client-safe catalog of the five ways (names, positions, proof
  fields) replaces the three UI and store lists. A server registry of proof ways (`readProof`,
  `matches`) replaces the per-way branches in sign-in, "Confirm it's you" and proof parsing.
- **A module per way.** Each way's logic moves into its own module under `src/accounts/ways/`.
- **Shared pieces get their own homes.** Starting a session moves to `flows/sessions.ts`, the
  lockout to `flows/attempts.ts`, and the authenticator's storage to its own `AuthenticatorStore`.
- **Repeated rules written once.**
  - The keep-a-usable-way lock is one Kysely helper (`wayLock.ts`) and one memory helper.
  - The usable check is one `wayUsable`.
  - The 16 account actions share one `signedInAction` opening.
- **Kept honest by tests.** The existing suite holds behaviour fixed, and a new source-scan test
  keeps per-way branches out.

## Technical Context

**Language/Version**: TypeScript 6.0.3 on Node 24 (as 024)

**Primary Dependencies**: unchanged. Next.js 16.4, Kysely, zod, SimpleWebAuthn 14, otpauth
9.6.0, qrcode 1.5.4. No new dependency.

**Storage**: MariaDB through Kysely, with no schema change.

**Testing**: vitest projects `node` (unit), `dom` (UI) and `integration` (MariaDB). The store
contracts run every case on the memory stores and only the strict cases on MariaDB.

**Target Platform**: the existing web app and CLI (Linux, Docker, Kubernetes).

**Project Type**: web service plus CLI, single repository.

**Performance Goals**: none new. Sign-in timing must stay as it is: an unknown email still checks
the stand-in digest.

**Constraints**:
- No behaviour, message, wording or security change (FR-001).
- Existing tests' expectations stay unchanged (FR-003).
- Client components import only the catalog (R1).
- habit-hooks limits apply as always.

**Scale/Scope**: about 25 source files moved or edited, about 15 test files touched for imports
and store construction.

## Constitution Check

Checked against constitution **2.6.0** (functions at most 4 parameters, owner decision 2026-11-07; `ProofWay.matches(ctx, account, proof, address)` relies on it).

| Principle | Status |
|---|---|
| I. Habit-hooks clean | ✅ Every sitting ends green. The moves shrink files (none near 200 lines) and remove the duplicates jscpd would flag. Each new module is wired into its callers in the sitting that creates it, so knip sees no unused exports. |
| II. Test-first | ✅ The existing suite is the safety net and runs first. New tests are written before the code they cover: the catalog and registry cases, the wayLock memory/MariaDB parity case, the `signedInAction` cases and the branch scan. Split below. |
| III. Purpose comments | ✅ Moved functions keep their doc comments; new ones get one. |
| IV. Dependencies, libraries used their way | ✅ No new dependency. Kysely transactions and `forUpdate()` stay builders. Next.js server action files still export only guarded async functions; the wrapper lives in a plain module (R8). |
| V. docs/specs | ✅ `docs/specs/025-login-ways-refactor/`. |

**Stack (Development Workflow)**: S1 and S2 change server code (stores, flows), so they are not UI
work and run with the stack stopped. S3 (actions, components) is page wiring with no migration and
no run change. It may keep the stack running if the owner wants to watch, ending every turn clean.
No migration anywhere.

Re-check after design: no violations, and Complexity Tracking is empty.

### New tests and their split

| Kind | Count | What |
|---|---|---|
| Unit | +5 | catalog: card and choice orders, names and flags match 024 (1); registry: every choice kind has a proof way whose `readProof` reads its field (1); `wayUsable` honours mail being off (1); memory `changeKeepingAWay` refuses and applies (1); `signedInAction` answers `SIGNED_OUT` for bad input and when signed out, and passes the actor on (1) |
| Integration | +1 | the `wayBranches` source scan, which reads files (R9); the existing strict cases (`lastWayKept`, the key removal and the authenticator step) cover the Kysely `wayLock` and the new store; the authenticator strict case moves files without changing count |
| UI | +0 | the existing account and sign-in component tests cover the catalog-driven cards and radios |

That is 5 unit, 1 integration and 0 UI (83% unit). The mix stays at about 93/7/0 overall, near
the 95/4/1 target, because the count is small.

## Project Structure

### Documentation (this feature)

```text
docs/specs/025-login-ways-refactor/
├── spec.md
├── plan.md          # this file
├── research.md      # R1–R10
├── data-model.md    # code entities; no schema change
├── quickstart.md
├── checklists/requirements.md
└── tasks.md         # /speckit-tasks
```

No `contracts/`: the refactor adds no external interface. The web, CLI, env and mail contracts
of 024 hold unchanged.

### Source Code (repository root)

```text
src/accounts/
├── ways/                      # new: one home per way
│   ├── catalog.ts             # CARD_KINDS, CHOICE_KINDS, wayEntry; S3 adds cardName, choiceOf (client-safe; WAYS private)
│   ├── registry.ts            # ChoiceKind → ProofWay
│   ├── usable.ts              # wayUsable(ctx, userId, kind)
│   ├── password.ts            # proof way, changePassword, newPasswordDigest, setNewPassword
│   ├── emailLink.ts           # requestSignInLink, spendSignIn
│   ├── authenticator.ts       # from flows/authenticator.ts
│   ├── hardwareKey.ts         # from flows/keys.ts
│   └── recoveryCode.ts        # from flows/recoveryCodes.ts
├── flows/
│   ├── sessions.ts            # startSession, SessionCookies (from signIn.ts)
│   ├── attempts.ts            # signInLocked, recordFailure, actorTry (from passwordCheck.ts)
│   ├── signIn.ts              # signInWith, signInByWay via the registry, signOut
│   ├── confirmIdentity.ts     # via the registry
│   ├── mailLinks.ts           # mayMail, mailLink, emailKeyedRequest (no import cycle, R4)
│   ├── emailLinks.ts, linkSpends.ts   # mail-link plumbing, calling the way modules
│   └── accountChanges.ts, admin.ts, createAccount.ts, …   # imports updated
│   (passwordCheck.ts, authenticator.ts, keys.ts, recoveryCodes.ts removed)
├── methods.ts                 # usable, allMethods, afterChange, keepsAWay (pure, kinds from catalog)
src/db/
├── methodStore.ts             # general way state only; METHOD_KINDS gone
├── authenticatorStore.ts      # new interface
├── store.ts                   # Stores gains authenticators
└── kysely/
    ├── wayLock.ts             # changeKeepingAWay, storedWays
    ├── methodStore.ts, keyStore.ts   # use wayLock
    ├── authenticatorStore.ts  # new
    └── stores.ts              # builds it
web/lib/
├── accountAction.ts           # signedInAction, SIGNED_OUT
├── accountActions.ts, authenticatorActions.ts, keyActions.ts   # use it
└── signInActions.ts           # sign-in dispatch via the registry
web/components/account/
├── WayCard.tsx, WayChoice.tsx, StepUp.tsx   # names, order and fields from the catalog
tests/
├── wayBranches.test.ts, waysCatalog.test.ts, accountAction.test.ts   # new
├── helpers/authenticatorContract.ts, memoryAuthenticatorStore.ts     # new (moved cases)
└── helpers/memoryAuthTables.ts      # changeKeepingAWay for the memory stores
```

**Structure Decision**: Way-specific code lives in `src/accounts/ways/`. Shared machinery stays in
`src/accounts/flows/`, named for what it does. The UI reads only the catalog. Each controls
component (`PasswordControls` and the others) remains the way's UI part, chosen by a
`Record<CardKind, Component>` in `WayCard.tsx`, which is a lookup, not a branch.

## Sittings (detailed in tasks.md)

| Sitting | Delivers | Stack | PR |
|---|---|---|---|
| S1 shared pieces | `flows/sessions.ts`, `flows/attempts.ts`, `wayLock.ts` and the memory twin, `wayUsable`, `AuthenticatorStore` (FR-008–FR-011) | stopped | 1 |
| S2 ways | catalog, registry, the five way modules, sign-in and step-up through the registry (FR-004–FR-007) | stopped | 2 |
| S3 web | `signedInAction` across 16 actions, UI lists from the catalog, `wayBranches` test, CLAUDE.md entry (FR-005, FR-012, SC-002) | owner's choice | 3 |

Each PR runs `npm run check` and `npm run check:db` and is merged before the next starts. The
owner does the browser walk (quickstart §3) after S3.

## Complexity Tracking

None.
