# Research: Deactivate and delete an account (029)

Checked against the code at `4b38380` (028 merged), 2026-11-09; revised after two deep analyses.

## R1. Where the state lives

- **Decision**: Two nullable `varchar(32)` columns on `users`, `deactivated_at` and `delete_after`
  (UTC ISO), added by step `025_account_status`. Active is `deactivated_at IS NULL`; a pending
  deletion has both set.
- **Rationale**: Read on every page (banner) and every run (skip), beside the email and admin mark.

## R1a. `account_codes` must let users go

- **Decision**: The same step drops `account_codes_creator_fk` and `account_codes_user_fk`, makes
  `created_by` nullable, and re-adds both keys with `onDelete("set null")`. `AccountCodesTable` and
  the memory code record follow (`created_by: number | null`).
- **Rationale**: Every account made with a code is that code's `used_by`, and an admin who made a
  code is its `created_by`; with keys and no delete rule, deleting such a user fails on MariaDB.
  Codes are the deployment's and stay, with the references cleared. Every other `user_id` key to
  `users` (no delete rule) is satisfied by deleting the child rows first (R4).

## R2. Runs skip deactivated accounts

- **Decision**: `UserFacts` gains `deactivated`; `planFor` in `src/app/usersToRun.ts` skips with
  `"deactivated"` first (the string inline, not exported). `runPlanned` in `runAll.ts` re-reads the
  account just before running a user and skips them if deactivated meanwhile.
- **Rationale**: The one plain function deciding who runs; the re-check covers deactivation
  mid-run for users later in id order.

## R3. What refuses while deactivated

- **Decision**: A plain `reactivateFirst(account): string | null` in `src/accounts/accountLifecycle.ts`
  gives `MESSAGES.reactivate_first` for a deactivated account. Used by: the web Re-score
  (`RescoreStart` gains `{ refused: string }`, shown through `rescoreNote`), `npm start -- rescore`
  (stderr, exit 1), and connecting Gmail. Everything else stays allowed (browsing, Hide, Applied,
  settings, sources, test on save, resume, profile extraction).
- **Owner, 2026-11-09**: categorizing and scoring stop; JSearch keeps running for other users;
  test on save and profile extraction stay allowed. A deleted user's files in `data/` stay.

## R4. Deleting: its own store

- **Decision**: A new interface `AccountRemoval` (`src/db/accountRemoval.ts`): `due(now): Promise<number[]>`
  and `remove(userId, now): Promise<"deleted" | "last_admin" | "not_due" | "gone">`. Kysely
  (`src/db/kysely/accountRemoval.ts`) in one transaction: lock the user row and the admin rows in
  one ordered select (`id = ? OR is_admin = 1 ORDER BY id FOR UPDATE`, the same order `setAdmin`
  takes); `"gone"` if the user is missing; `"not_due"` if `delete_after` is null or after `now`
  (a cancel that raced the run); `"last_admin"` if they are the only admin; else delete their rows
  from each per-user table, then `users`. Memory version in `tests/helpers/memoryAccountRemoval.ts`,
  built inside `memoryStores`: it removes the user from `Tables`/`AuthTables`, the mailboxes map
  (`mailboxes.delete(id)`) and `MemoryKeyStore` (a new `dropUser`). `Stores` (not `SharedStores`,
  which every `UserStores` extends) gains `removal`.
- **Order**: `user_jobs`, `verdicts`, `rescore_runs` (steps cascade), `gmail_alert_state`,
  `gmail_connection`, `resume_profiles`, `resumes`, `user_sources`, `user_settings`,
  `sign_in_methods`, `hardware_keys`, `recovery_codes`, `sessions`, `email_tokens`,
  `auth_challenges`, `security_events`, then `users` by id (not in the list).
- **Completeness is a type check**: in `src/db/kysely/accountRemoval.ts`, a type
  `UserTable` = every `Database` key whose table has `user_id`; the table list is
  `as const satisfies readonly UserTable[]`, and a type assertion that `Exclude<UserTable, listed>`
  is `never` makes `npm run typecheck` fail when a new per-user table is missing. Nothing exported
  for tests (knip); the check is part of the list's declared type, so no unused alias (eslint).
- **Rationale (SOLID)**: removal is its own responsibility (SRP), not more members on
  `AccountStore`; callers take `AccountRemoval` (ISP); both versions pass one contract (LSP).

## R5. When deletions are carried out

- **Decision**: `carryOutDeletions(deps, now)` in `src/app/accountDeletions.ts`, called first in
  `runAll` (also with `--user`). For each `due(now)` id: read the account's name and email, call
  `remove(id, now)`; on `"deleted"`, send the notice and await it (failure logged by fixed reason);
  `"last_admin"` mails nothing; `"not_due"` and `"gone"` are skipped silently; an error for one id
  gives the existing `{ userId, failed }` (fixed reason) and the next id goes ahead. Results are
  `UserRun`s `{ userId, deleted: true }` or `{ userId, held: "last_admin" }`, printed by `runLine`
  ("deleted" / "deletion held (last admin)"); they don't change the exit code, though a named
  `--user` who is skipped (deactivated) still exits 1, as any skipped named user does.
- **Rationale**: Mail only after the delete happened, once; held ones don't mail. Runs happen at
  least daily in every supported setup (default every 8 hours).

## R6. Notices

- **Decision**: Events `account_deactivated`, `account_reactivated`, `deletion_requested`,
  `deletion_cancelled` through `recordSecurityEvent` (queued). The carried-out deletion's notice
  goes through a new awaited `sendMail(mailer, message, log)` beside `queueMail` in
  `src/mail/queue.ts` (sharing its private `failureReason`).

## R7. Gmail removal

- **Decision**: The flows take the user's mailbox as a narrow dependency,
  `Pick<UserStores, "gmail" | "alerts">`, and call the existing `disconnect` in
  `src/gmail/connection.ts` (which clears both). The server action builds it from the signed-in
  user's stores.

## R8. Flows and their dependencies

- **Decision**: `src/accounts/flows/accountStatus.ts` (deactivate, reactivate) and
  `src/accounts/flows/accountDeletion.ts` (requestDeletion, cancelDeletion). The actor's id is
  `actor.account.id`. Account state is written through a new `AccountStore.setStatus(userId,
  { deactivatedAt, deleteAfter })`, added in the sitting of its first caller. Flows take the full
  `AuthContext`, as every existing flow does (they record events through `recordSecurityEvent`).
  Request deletion is step-up and compares `checkEmail(typed).emailKey` with
  `normalizeEmail(account.email)` (`src/accounts/emails.ts`).

## R9. UI pattern

- **Decision**: The Account status panel follows `WaysPanel`: `useStepUp()`'s `run(() => action())`
  and `shownRefusal(answer)` in `role="alert"`, so refusals and the step-up dialog work. Not
  `useSave`. The delete form is its own component (`DeleteAccountForm.tsx`). The page's
  `AccountState` (`web/lib/accountState.ts`) gains `status` (`active` | `deactivated` |
  `pending_deletion` | `held`), `deactivatedAt`, `deleteAfter` and `onlyAdmin`.

## R10. When user 1 is gone

- **Decision**: `storesFor` (`src/cliUser.ts`) with no `--user` refuses "user 1 no longer exists;
  name an email with --user" when there is no user 1. The evals' user choice goes through the same
  check. `account init` and `import-sqlite` still make user 1 again if it is missing (by design:
  that is how a fresh owner is made); `docs/cli.md` says so.

## R11. Test split

Unit: `accountLifecycle` rules, `usersToRun`, the flows (memory stores; notices queued through the
memory mailer; every flow with `mail: null`), `carryOutDeletions`, `runLine`, `rescoreNote`,
`storesFor`, the contracts on memory. Integration: the migration, the account and removal contracts
on MariaDB (all user rows gone, shared and other users' rows unchanged, codes kept with null
references, last admin held, two removals at once). UI: `tests/client/accountStatus.test.tsx`.
About 38 unit, 7 integration, 9 UI cases in one file.
