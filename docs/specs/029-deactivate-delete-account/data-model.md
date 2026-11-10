# Data model: Deactivate and delete an account (029)

## Step `025_account_status`

`users`:

| Column | Type | Meaning |
|---|---|---|
| `deactivated_at` | `varchar(32)`, null | When the account was deactivated; null while active |
| `delete_after` | `varchar(32)`, null | When a requested deletion is due (requested + 30 days); null when none |

`account_codes`: `created_by` becomes nullable; `account_codes_creator_fk` and
`account_codes_user_fk` are re-made with `on delete set null`.

Rule: `delete_after` is set only while `deactivated_at` is set. `Account` gains `deactivatedAt` and
`deleteAfter`.

## Status (`src/accounts/accountLifecycle.ts`, plain functions)

`statusOf(account, now, onlyAdmin)`: `active` | `deactivated` | `pending_deletion` | `held`
(`held` = due and the only admin).

```text
active ──deactivate──▶ deactivated ──reactivate──▶ active
active / deactivated ──request deletion──▶ pending_deletion
pending_deletion ──cancel──▶ deactivated
pending_deletion ──due, run──▶ (removed)      or ──▶ held (only admin), until another admin exists or cancel
```

| From | Action | Allowed when | Effect |
|---|---|---|---|
| active | deactivate | always | `deactivated_at = now`; Gmail removed; event `account_deactivated` |
| deactivated | reactivate | no deletion pending | `deactivated_at = null`; event `account_reactivated` |
| active or deactivated | request deletion | not the only admin; step-up; email matches | `deactivated_at = now` if null; `delete_after = now + 30 days`; Gmail removed; event `deletion_requested` |
| pending / held | cancel deletion | always | `delete_after = null`; event `deletion_cancelled` |
| due | run removes | still due under the lock; not the only admin | rows removed; then notice mailed (awaited) |

## Removal (`AccountRemoval`)

Per-user tables, in order: `user_jobs`, `verdicts`, `rescore_runs` (→ `rescore_steps`),
`gmail_alert_state`, `gmail_connection`, `resume_profiles`, `resumes`, `user_sources`,
`user_settings`, `sign_in_methods`, `hardware_keys`, `recovery_codes`, `sessions`, `email_tokens`,
`auth_challenges`, `security_events`; then `users` by id. Kept: `jobs`, `companies`,
`careers_audit`, `api_calls`, `auth_attempts`, `account_codes` (references cleared by the keys).

## Fixed texts

- `MESSAGES.reactivate_first`: "Your account is deactivated. Reactivate it on the Account tab first."
- `MESSAGES.email_mismatch`: "Type your account's email to confirm."
- `MESSAGES.last_admin_delete`: "Make another admin before deleting your account."
- `MESSAGES.deletion_pending`: "Cancel the deletion first."
- Event labels: "Account deactivated", "Account reactivated", "Account deletion requested",
  "Account deletion cancelled".
- Run lines: `user N: skipped (deactivated)`, `user N: deleted`, `user N: deletion held (last admin)`.
- CLI: `user 1 no longer exists; name an email with --user`.
- Delete summary: "Deleting removes your jobs and their scores, your history and re-score logs, your
  sources, settings, resume and profile, your Gmail connection and your ways of signing in, on
  <date>. Until then you can sign in and cancel. Shared postings stay."
- Deletion notice: "Your myjobbot account <name> has been deleted, as you asked on <requested>."
