# Validation: Deactivate and delete an account (029)

Uses this checkout's dev database (`myjobbot_dev_alt`) and a second account made with a creation
code. Never production.

1. **Checks**: `npm run check` and `npm run check:db` green.
2. **Deactivate**: as the second account (a source on, a resume, Gmail connected), Deactivate on the
   Account tab. Expect: Gmail panel not connected; the banner on every page; sign out and back in
   works; `npm start -- run` prints `user N: skipped (deactivated)`; Re-score shows "reactivate
   first"; `npm start -- rescore <ats> <id> --user <email>` prints it on stderr and exits 1;
   Settings → Gmail Connect shows it; Hide and Applied still work.
3. **Reactivate**: banner gone; the next `npm start -- run` runs for the account.
4. **Request deletion**: Delete account asks to confirm it's you (after 10 minutes), then for the
   email; a wrong email is refused; the right one shows "Will be deleted on <date>".
5. **Cancel**: Cancel deletion leaves the account deactivated, no date.
6. **Carry out**: request again, set `delete_after` into the past in the dev database, run
   `npm start -- run`. Expect `user N: deleted`; signing in as that account fails like a wrong
   password; each table in data-model.md's removal list has 0 rows for that id; the account's
   creation code row remains with `used_by` null; user 1's jobs and the shared `jobs` count are
   unchanged.
7. **Last admin**: as the only admin, Delete account is greyed out with the reason.
