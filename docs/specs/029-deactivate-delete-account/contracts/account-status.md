# Contract: Account status (029)

## Account tab: "Account status" panel (last on the tab)

| Status | Shows | Buttons |
|---|---|---|
| `active` | "Active: runs fetch and score jobs for you." | **Deactivate account**, **Delete account** |
| `deactivated` | "Deactivated since <date>. Runs do nothing for you; Gmail is disconnected." | **Reactivate**, **Delete account** |
| `pending_deletion` | "Will be deleted on <date>." | **Cancel deletion** |
| `held` | "Due for deletion, held: make another admin first." | **Cancel deletion** |
| only admin, not pending | Delete account greyed out, with `MESSAGES.last_admin_delete` | |

- Deactivate asks one confirm ("Runs will stop and Gmail will be disconnected."); Reactivate and
  Cancel deletion don't.
- **Delete account** opens `DeleteAccountForm`: what is removed and the date, an email field,
  submit.
- Actions run through `useStepUp()`'s `run(...)`; a refusal shows via `shownRefusal` in
  `role="alert"`, and a `stepUp` answer opens the existing step-up dialog (as `WaysPanel`).

## Banner (every signed-in page, `web/app/(app)/layout.tsx`)

`deactivated`: "Your account is deactivated." `pending_deletion`/`held`: "Your account will be
deleted on <date>." Each links to the Account tab ("Reactivate" / "Cancel deletion").

## Server actions (`web/lib/accountActions.ts`, `signedInAction`)

| Action | Guard | Input | Answer |
|---|---|---|---|
| `deactivateAccount` | signed in | none | `AccountAnswer` |
| `reactivateAccount` | signed in | none | `AccountAnswer`; refused `deletion_pending` while pending |
| `requestAccountDeletion` | signed in, step-up | `{ email }` | `AccountAnswer`; refused `email_mismatch` / `last_admin_delete` |
| `cancelAccountDeletion` | signed in | none | `AccountAnswer` |

On success the page is revalidated; no new answer fields.

## Refusals elsewhere

- Web Re-score: `RescoreStart` gains `{ refused: string }`; `rescoreNote` shows it.
- `npm start -- rescore`: `MESSAGES.reactivate_first` on stderr, exit 1.
- `connectGmail`: `MESSAGES.reactivate_first`.

## Run output

`user N: skipped (deactivated)`, `user N: deleted`, `user N: deletion held (last admin)`. The
deletion lines don't change the exit code; a named `--user` who is skipped exits 1, as today. Due
deletions are carried out on every run, `--user` included.
