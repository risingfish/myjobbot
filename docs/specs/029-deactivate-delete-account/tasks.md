---

description: "Task list for 029: deactivate and delete an account"
---

# Tasks: Deactivate and delete an account

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/account-status.md](contracts/account-status.md),
[quickstart.md](quickstart.md)

**Tests**: Test-first (constitution II). Each test task names its kind; ledger at the end.

## Format: `[ID] [P?] [Story] Description`

## Sittings

Worked in `myjobbot_alt` (its own `myjobbot_dev_alt`/`myjobbot_test_alt`) on
`029-deactivate-delete-account`; its code doesn't reach the stack, which may keep running. Each
sitting starts by creating `.specify/sitting-in-progress` naming it and ends with `npm run check`
**and** `npm run check:db` green, then deletes the marker. Every new export and store method gets
its production caller in the sitting that adds it (knip's production pass); nothing is exported
for tests only. Commit only at a sitting's end, when the owner asks.

Contracts: `accountContract`'s own cases in `tests/helpers/accountContract.ts` run on memory only
(`tests/storeContract.test.ts`); its `accountStrictCases` group runs on memory (called by
`accountContract`) and on MariaDB (`tests/integration/storeContract.test.ts`), so a case for both
goes in `accountStrictCases` only.

---

## Phase 1: Setup

- [X] T001 Create `.specify/sitting-in-progress` containing `029 S1`.

---

## Phase 2: Foundational

### Sitting S1: Status columns, the run's skip, and the refusals

- [X] T002 [P] Integration test first, `tests/integration/accountStatusMigration.test.ts` (pattern of `tests/integration/accountsMigration.test.ts`): after migrating, `users` has nullable `varchar(32)` columns `deactivated_at` and `delete_after` (null for existing rows), `account_codes.created_by` is nullable, and deleting a user who is a code's `created_by` and `used_by` leaves the code with both null.
- [X] T003 Add `src/db/migrations/025_account_status.ts` (export `accountStatusColumns`): `alterTable("users").addColumn("deactivated_at", "varchar(32)").addColumn("delete_after", "varchar(32)")`; on `account_codes`, drop `account_codes_creator_fk` and `account_codes_user_fk`, `modifyColumn("created_by", "integer")` (nullable), and re-add both keys to `users.id` with `onDelete("set null")`. Kysely builders only; one-line doc comment. List `"025_account_status": accountStatusColumns` in `src/db/migrations/index.ts`, and append `"025_account_status"` to the expected step list in `tests/integration/migrate.test.ts`.
- [X] T004 Types: `src/db/schema/users.ts` gains the two columns as `ColumnType<string | null, string | null | undefined, string | null>`; `src/db/schema/accounts.ts` `AccountCodesTable.created_by` becomes `number | null` (and `MemoryCode` in `tests/helpers/memoryAuthTables.ts`). `Account` (`src/db/accountStore.ts`) gains `deactivatedAt: string | null` and `deleteAfter: string | null`, filled by `fromRow` (`src/db/kysely/accountStore.ts`), `MemoryUser` and `memoryUser()` (`tests/helpers/memoryAuthTables.ts`) and `toAccount` (`tests/helpers/memoryAccountStore.ts`); update every `Account` literal in tests (`grep -rn "isAdmin:" tests`, 24 in 9 files).
- [X] T005 [P] Unit tests first, `tests/accountLifecycle.test.ts`: `reactivateFirst(account)` returns `MESSAGES.reactivate_first` when `deactivatedAt` is set, else null.
- [X] T006 Implement `reactivateFirst` in `src/accounts/accountLifecycle.ts`; add `reactivate_first: "Your account is deactivated. Reactivate it on the Account tab first."` to `src/accounts/messages.ts`.
- [X] T007 [P] Unit tests first: in `tests/usersToRun.test.ts`, a user with `deactivated: true` is skipped `"deactivated"` before the sources and resume checks (add `deactivated: false` to the `ready` fixture and to the three literals that don't spread it); in `tests/runAll.test.ts`, a deactivated user gets no fetch, and a user deactivated after planning (set between users through the memory store) is skipped when reached. (Tests set `deactivatedAt` through a memory-store test helper.)
- [X] T008 Add `deactivated: boolean` to `UserFacts` and the skip to `planFor` (`src/app/usersToRun.ts`, the string inline); fill it in `userFacts` and re-check `stores.accounts.account(id)` in `runPlanned` (`src/app/runAll.ts`).
- [X] T009 [P] Unit tests first: `rescoreNote` (`tests/rescoreNote.test.ts`) shows a `{ refused }` start's message; `startRescoreFor` (`web/lib/rescoreStart.ts`, tested where it is tested today) returns `{ refused: MESSAGES.reactivate_first }` for a deactivated account before `open()` is called.
- [X] T010 Refusals: `RescoreStart` in `src/web/api.ts` gains `{ refused: string }`; `rescoreNote` (`src/web/rescoreNote.ts`) accepts and shows it; `useRescoreTerminal.ts` passes it through; `startRescoreFor` (`web/lib/rescoreStart.ts`) is given the account and refuses via `reactivateFirst` before `open()`; `startRescoreAction` (`web/lib/actions.ts`) passes the signed-in account. `rescoreCommand` (`src/cli.ts`) prints `reactivateFirst`'s message to stderr and exits 1; `connectGmailAction` (`web/lib/gmailActions.ts`) refuses with it. (The CLI and Gmail wiring call the unit-tested `reactivateFirst` and are checked in quickstart step 2.)
- [X] T011 Run `npm run check` and `npm run check:db`; when green, delete the marker. End of S1.

**Checkpoint**: A deactivated account (set in the database) is skipped and refused.

---

## Phase 3: User Story 1 - Deactivate my account (Priority: P1) 🎯 MVP

**Goal**: Deactivate and Reactivate on the Account tab; banner on every page.

**Independent Test**: [quickstart.md](quickstart.md) steps 2-3.

### Sitting S2: Deactivate and reactivate

- [ ] T012 Create `.specify/sitting-in-progress` containing `029 S2`.
- [ ] T013 [P] [US1] Contract case first (unit on memory and integration on MariaDB), in `accountStrictCases` (`tests/helpers/accountContract.ts`): `setStatus(userId, { deactivatedAt, deleteAfter })` stores both and `account()` returns them; other accounts unchanged.
- [ ] T014 [US1] Add `setStatus` to `AccountStore` (`src/db/accountStore.ts`), the Kysely store (`updateTable`) and `tests/helpers/memoryAccountStore.ts`.
- [ ] T015 [P] [US1] Unit tests first in `tests/accountLifecycle.test.ts`: `statusOf(account, now, onlyAdmin)` gives `active`, `deactivated`, `pending_deletion`, and `held` (due and only admin).
- [ ] T016 [US1] Implement `statusOf` in `src/accounts/accountLifecycle.ts`.
- [ ] T017 [US1] Unit tests first, `tests/accountStatusFlow.test.ts`, on memory stores: `deactivate(ctx, actor, mailbox)` (mailbox: `Pick<UserStores, "gmail" | "alerts">`) sets `deactivatedAt`, disconnects that user's Gmail and alert state only, records `account_deactivated` and queues one notice through the memory mailer; repeating it changes nothing; `reactivate` clears it and records `account_reactivated`, and refuses `deletion_pending` while `deleteAfter` is set; both work with `mail: null`. Add a `noticeFor`/label case for the two events.
- [ ] T018 [US1] Events `account_deactivated`, `account_reactivated` (labels "Account deactivated", "Account reactivated", mailed as notices) in `src/accounts/events.ts`; `deletion_pending: "Cancel the deletion first."` in `messages.ts`; flows `deactivate`/`reactivate` in `src/accounts/flows/accountStatus.ts`, taking `AuthContext` as every flow does (actor id `actor.account.id`; Gmail through the existing `disconnect` in `src/gmail/connection.ts`).
- [ ] T019 [P] [US1] UI test first, `tests/client/accountStatus.test.tsx`: Active shows **Deactivate account**; Deactivated (with its date) shows **Reactivate**; Deactivate asks a `window.confirm` (stubbed) and does nothing when declined; a refusal answer is shown in `role="alert"`.
- [ ] T020 [US1] Server actions `deactivateAccount`, `reactivateAccount` in `web/lib/accountActions.ts` (`signedInAction`, building the mailbox from the signed-in user's stores); `AccountState` in `web/lib/accountState.ts` gains `status`, `deactivatedAt`, `deleteAfter`, `onlyAdmin`; `web/components/account/AccountStatus.tsx` per the contract (`useStepUp()`'s `run`, `shownRefusal`, `window.confirm` on Deactivate, as `DisconnectButton.tsx`), last in `AccountView.tsx`; in S2 it renders without Delete account (T031 adds it).
- [ ] T021 [US1] Banner `web/components/sections/AccountBanner.tsx` (deactivated / will be deleted on <date>, linking to the Account tab) under `Nav` in `web/app/(app)/layout.tsx`; a case in `tests/client/accountStatus.test.tsx` or its own `.test.tsx` case for both texts.
- [ ] T022 Run `npm run check` and `npm run check:db`; when green, delete the marker. End of S2.

**Checkpoint**: US1 works on its own.

---

## Phase 4: User Story 2 - Delete my account (Priority: P2)

**Goal**: Request (step-up, typed email) and cancel; runs remove due accounts, then mail.

**Independent Test**: [quickstart.md](quickstart.md) steps 4-7.

### Sitting S3: Deletion

- [ ] T023 Create `.specify/sitting-in-progress` containing `029 S3`.
- [ ] T024 [US2] Removal contract first (unit on memory, integration on MariaDB), new `tests/helpers/accountRemovalContract.ts` wired into `tests/storeContract.test.ts` and `tests/integration/storeContract.test.ts`, with hooks `{ userRows(id): Promise<Record<string, number>>; sharedCounts(): Promise<Record<string, number>> }` (pattern of `CompanyHooks` in `tests/helpers/companyContract.ts` and `companyHooks()` in `tests/integration/storeContract.test.ts`; memory hooks `memoryRemovalHooks` in `tests/helpers/memoryAccountRemoval.ts`): (a) a second account with a row in every per-user table is removed: `"deleted"`, every per-user count 0, shared counts and user 1's rows unchanged, its creation code kept with null references, and a new account made with the same email reads back empty; (b) the only admin: `"last_admin"`, nothing changes; (c) unknown id: `"gone"`; (d) MariaDB only: two `remove` calls at once give `"deleted"` and `"gone"`, no error; (e) `due(now)` lists ids whose `delete_after <= now`, oldest first; (f) a deletion cancelled after `due` (`setStatus` clears `deleteAfter`) gives `"not_due"` from `remove(id, now)` and removes nothing.
- [ ] T025 [US2] `AccountRemoval` interface (`src/db/accountRemoval.ts`: `due(now)`, `remove(userId, now)` → `"deleted" | "last_admin" | "not_due" | "gone"`), `Stores.removal` (`src/db/store.ts`, not `SharedStores`). Kysely in `src/db/kysely/accountRemoval.ts`: one transaction, lock with one ordered select (`id = ? OR is_admin = 1 ORDER BY id FOR UPDATE`), re-check `delete_after <= now`, delete per-user rows in research R4's order, then `users`; the table list `as const satisfies readonly UserTable[]` with a type-level check that no `user_id` table of `Database` is missing (not exported). Wire in `src/db/kysely/stores.ts` (`storesOver`). Memory in `tests/helpers/memoryAccountRemoval.ts`, built in `memoryStores` (`tests/helpers/memoryStore.ts`): removes the user from `Tables`/`AuthTables`, `mailboxes.delete(id)`, and a new `dropUser(id)` on `MemoryKeyStore`.
- [ ] T026 [P] [US2] Unit tests first in `tests/accountLifecycle.test.ts`: `deletionDate(now)` = now + 30 days; `mayRequestDeletion(account, onlyAdmin)` false for the only admin.
- [ ] T027 [US2] Implement both in `src/accounts/accountLifecycle.ts`; add `email_mismatch` and `last_admin_delete` (texts in data-model.md) to `messages.ts`; events `deletion_requested`, `deletion_cancelled` (labels in data-model.md) to `events.ts`, with a `noticeFor` test case.
- [ ] T028 [US2] Unit tests first, `tests/accountDeletionFlow.test.ts`: `requestDeletion(ctx, actor, mailbox, { email })` refuses a non-matching email (`checkEmail(typed).emailKey` against `normalizeEmail(account.email)`) and the only admin; else sets `deactivatedAt` (if null) and `deleteAfter`, removes Gmail, records `deletion_requested`, queues a notice; `cancelDeletion` clears `deleteAfter`, keeps `deactivatedAt`, records `deletion_cancelled`; the typed email is in no event or log line; both work with `mail: null`.
- [ ] T029 [US2] Implement `src/accounts/flows/accountDeletion.ts`.
- [ ] T030 [P] [US2] UI test first in `tests/client/accountStatus.test.tsx`: Pending shows the date and **Cancel deletion**; Held shows its text; the only admin sees Delete account greyed out with `last_admin_delete`; the delete form shows data-model.md's delete summary, asks for the email, and shows `email_mismatch`.
- [ ] T031 [US2] Actions `requestAccountDeletion` (step-up, `{ email }`) and `cancelAccountDeletion` in `web/lib/accountActions.ts`; `web/components/account/DeleteAccountForm.tsx`; wire both into `AccountStatus.tsx`.
- [ ] T032 [P] [US2] Unit tests first: `tests/accountDeletions.test.ts` for `carryOutDeletions({ removal, accounts, send, log }, now)`: each due id is removed, then (on `"deleted"`) one notice (data-model.md's text) is sent to the address read before; `"last_admin"` sends nothing; `"not_due"`/`"gone"` are skipped silently; a `remove` that throws gives `{ userId, failed }` with a fixed reason and the next id still runs; a failing `send` is logged by fixed reason; results are `{ userId, deleted: true }` / `{ userId, held: "last_admin" }`; no email in any log line. `tests/runLines.test.ts`: `runLine` prints `deleted` and `deletion held (last admin)`, and `runExitCode` stays 0 for them. `tests/mail.test.ts`: `sendMail` awaits and logs a failure by reason. `tests/runAll.test.ts`: a due second account is removed and its `deleted` line comes before the user lines, also with `only`.
- [ ] T033 [US2] `sendMail` in `src/mail/queue.ts`; `accountDeletedNotice` in `src/mail/messages.ts`; `src/app/accountDeletions.ts`; `UserRun` and `runLine` (`src/app/runLines.ts`) gain the two variants; `runAll` calls `carryOutDeletions` first, before planning users, with the mailer built from the environment as `runAccountCommand` builds it.
- [ ] T034 [P] [US2] Unit test first, `tests/cliUser.test.ts`: with no `--user` and no user 1, `storesFor` refuses "user 1 no longer exists; name an email with --user".
- [ ] T035 [US2] Implement it in `src/cliUser.ts` (check `stores.accounts.account(OWNER_ID)`); the evals already choose their user through `storesFor` (`src/evals/command.ts`), so they refuse too.
- [ ] T036 Run `npm run check` and `npm run check:db`; when green, delete the marker. End of S3.

**Checkpoint**: US2 works end to end.

---

## Phase 5: Polish

### Sitting S4: Docs and validation

- [ ] T037 Create `.specify/sitting-in-progress` containing `029 S4`.
- [ ] T038 [P] Docs: `docs/how-it-works.md` "Accounts and signing in" gains "Deactivating and deleting"; `docs/database.md` Tables notes the two columns and `account_codes` keys; `docs/cli.md` notes the run lines, the rescore refusal and the user-1 refusal; `docs/cli.md` also says `account init` and `import-sqlite` make user 1 again if missing; `CLAUDE.md`'s re-score note names `web/lib/rescoreStart.ts`, and it gains "Account status (feature 029)": the columns, `accountLifecycle.ts`, the two flows, `AccountRemoval` and its type-checked table list, the run's skip and `accountDeletions.ts`.
- [ ] T039 Run [quickstart.md](quickstart.md) steps 1-7 against `myjobbot_dev_alt` with a second account; record outcomes below.
- [ ] T040 Run `npm run check` and `npm run check:db`; when green, delete the marker. End of S4.

---

## Dependencies & Execution Order

- S1 → S2 → S3 → S4. US2 builds on US1 (a pending deletion is deactivated).
- In each sitting, a test task precedes the code it covers.

### Parallel Opportunities

- S1: T002, T005, T007, T009 (different test files).
- S2: T013, T015, T019.
- S3: T024, T026, T030, T032, T034.

## Test ledger

| Kind | New tests (approx.) | Where |
|---|---|---|
| Unit | 38 | lifecycle rules, usersToRun, runAll, rescoreNote, webRows, both flows, accountDeletions, runLines, sendMail, cliUser, contracts on memory |
| Integration | 7 | migration, step list; status and removal contracts on MariaDB (incl. two removals at once, cancel race) |
| UI | 9 cases | `tests/client/accountStatus.test.tsx` |

## Implementation Strategy

- **MVP**: S1-S2 (deactivate, reactivate, runs skip, refusals).
- S3 adds deletion; S4 documents and validates.
