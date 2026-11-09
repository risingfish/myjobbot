# Implementation Plan: Deactivate and delete an account

**Branch**: `029-deactivate-delete-account` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/029-deactivate-delete-account/spec.md`

## Summary

An account gets two nullable dates on `users`: `deactivated_at` and `delete_after`. Deactivating
removes the user's Gmail connection and makes runs skip them (`usersToRun`), while sign-in and
browsing keep working; Re-score and connecting Gmail refuse. Requesting deletion (step-up, typed
email, never the last admin) deactivates and sets a date 30 days out; cancelling clears it. Each
scheduled run carries out due deletions first: every row of the user removed in one transaction
through a separate `AccountRemoval` store, then the notice mailed; shared data untouched. The Account tab gets an Account status panel and every page
a banner. See [research.md](research.md), [data-model.md](data-model.md),
[contracts/account-status.md](contracts/account-status.md).

## Technical Context

**Language/Version**: TypeScript 5 on Node 24; Next.js 16 (web)

**Primary Dependencies**: Kysely (MariaDB), existing account flows (`src/accounts/flows/`), mail
(`src/mail/`); no new dependency

**Storage**: MariaDB; step `025_account_status` adds `users.deactivated_at`, `users.delete_after` and sets the `account_codes` keys to `set null`

**Testing**: vitest; memory stores for unit tests, the account store contract on MariaDB for
integration, one `.test.tsx`

**Target Platform**: The agent (scheduled runs) and the web app, Docker and Kubernetes

**Project Type**: Web app + CLI agent

**Performance Goals**: N/A (one account at a time)

**Constraints**: Deletion all-or-nothing; last admin never removed; no email, password, code or
token in logs

**Scale/Scope**: 1 migration, ~4 flows, 4 server actions, 1 panel, 1 banner, run changes

## Constitution Check

*Checked against constitution 2.7.0.*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. Sittings are ordered so every new export and store method has a production caller in the sitting that adds it (knip's production pass); nothing is exported for tests only. |
| II. Test-first | Pass. New tests about **38 unit, 7 integration, 9 UI cases** (research R11). `check` and `check:db` end every sitting. |
| III. Purpose comments | Pass. |
| IV. Dependencies, libraries as designed | Pass: no new dependency; the migration, the status writes and the removal use Kysely's builders, including `modifyColumn` and the foreign keys. |
| V. Specs in docs/specs | Pass. |
| VI. SOLID | **S**: lifecycle rules (`src/accounts/accountLifecycle.ts`), status flows (`flows/accountStatus.ts`), deletion flows (`flows/accountDeletion.ts`), removal (`AccountRemoval`) and the run step (`src/app/accountDeletions.ts`) are separate. **O**: the per-user table list is checked against `Database` by type, so a new table is added to the list, not to branches. **L**: Kysely and memory `AccountRemoval` and `AccountStore` pass the same contracts. **I**: flows take the user's mailbox as `Pick<UserStores, "gmail" \| "alerts">` (and `AuthContext`, as every flow); `removal` sits on `Stores`, not on every `UserStores`; `carryOutDeletions` takes `AccountRemoval`, an account reader and a send function. **D**: the clock, mail and stores are handed in; everything is unit-tested on memory versions. |
| Workflow | Worked in `myjobbot_alt` (a separate clone used as the second session's checkout, with `myjobbot_dev_alt`/`myjobbot_test_alt`); its code doesn't reach the stack, which may keep running. |
| CLAUDE.md | Gets an "Account status (feature 029)" note. `docs/how-it-works.md`, `docs/database.md`, `docs/cli.md` are updated. |

Re-checked after the deep analysis: the design above replaces the first draft's store members and
sittings.

## Project Structure

### Documentation (this feature)

```text
docs/specs/029-deactivate-delete-account/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/account-status.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
src/db/migrations/025_account_status.ts      # users columns; account_codes keys set null
src/db/schema/users.ts, schema/accounts.ts   # new columns; created_by nullable
src/db/accountStore.ts (+ kysely, memory)    # Account fields; setStatus (S2)
src/db/accountRemoval.ts                     # AccountRemoval interface (S3)
src/db/kysely/accountRemoval.ts              # one-transaction removal + type-checked table list
tests/helpers/memoryAccountRemoval.ts        # memory version
src/accounts/accountLifecycle.ts                # rules: reactivateFirst, statusOf, deletionDate, mayRequestDeletion
src/accounts/flows/accountStatus.ts          # deactivate, reactivate
src/accounts/flows/accountDeletion.ts        # requestDeletion, cancelDeletion
src/app/usersToRun.ts, runAll.ts, runLines.ts, accountDeletions.ts
src/mail/queue.ts                            # sendMail (awaited)
src/cliUser.ts                               # user-1-gone refusal
src/web/api.ts, src/web/rescoreNote.ts, web/lib/rescoreStart.ts, web/lib/actions.ts, web/lib/gmailActions.ts, src/cli.ts  # refusals
web/lib/accountActions.ts, web/lib/accountState.ts
web/components/account/AccountStatus.tsx, DeleteAccountForm.tsx; web/components/sections/AccountBanner.tsx
```

**Structure Decision**: As 024/025/027: rules as plain functions, flows with no Next.js, stores
behind interfaces with memory and Kysely versions, thin server actions.

## Sittings (detail in tasks.md)

1. Migration, `Account` fields, `reactivateFirst`, the run's skip and re-check, the three refusals.
2. `setStatus`, `statusOf`, deactivate/reactivate flows, events, actions, panel, banner.
3. `AccountRemoval`, deletion rules and flows, delete form, `sendMail`, the run's deletions and
   lines, the user-1 refusal.
4. Docs and quickstart validation.

## Complexity Tracking

None.
