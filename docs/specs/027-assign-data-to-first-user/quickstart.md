# Quickstart: validating each user's own data (027)

Tables are in [data-model](data-model.md), commands in [contracts/cli](contracts/cli.md).

## 1. Before the upgrade

- Take a backup of the database being upgraded. The step drops the moved columns from `jobs`
  after copying them, and MariaDB commits DDL as it goes, so a step that fails partway is
  recovered by restoring the backup, not by re-running. For production, back up `myjobbot` before
  the deploy.
- Locally, run `scripts/copy-prod.sh myjobbot_dev` for real data, then record what user 1 sees:
  - the counts on Recommended, All jobs and Applied
  - three jobs with their scores, marks and History
  - Settings and sources
  - the Gmail status

## 2. The owner keeps everything (US1, SC-001, SC-006)

1. Start the app, which applies steps `020`–`023`. Sign in as user 1: the counts, the three jobs,
   Settings, sources and Gmail match §1.
2. Restart: no step runs, and nothing changes.
3. `SELECT COUNT(*)` from `user_jobs` equals the old `jobs` count, and every row has `user_id = 1`.

## 3. Separate users (US2, SC-002)

1. Make a second account (Settings → Admin → creation code, then `/create-account`).
2. As them:
   - Recommended, All jobs and Applied are empty.
   - Settings shows the defaults.
   - There are no sources, no resume (not even the owner's `data/resume.md`) and no Gmail.
3. As them, open `/jobs?job=<one of user 1's jobs>`, `/api/rescores/<user 1's run id>` and the
   panel's History for that job. Each answers as for a job or run that doesn't exist.
4. Give both users the same source. After a run, hide a job as one user: the other still sees it.
5. As an admin who isn't user 1, nothing of user 1's appears.

## 4. Runs for every user (US3, SC-003, SC-004)

1. The second user uploads a resume and turns a source on.
2. `npm start -- run`: one `user <id>:` line per user. `data/runs/` holds one new trace per user,
   each starting with its `userId`.
3. A posting both users' sources found:
   - It is one `jobs` row and two `user_jobs` rows, with different scores.
   - Its careers lookup or description lookup appears once in `careers_audit`, and its description
     survives the second user's refresh.
4. With JSearch sources for both users, the month's `api_calls` count stays within the budget. A
   refused source shows the budget reason.
5. A user with no resume: `user <id>: skipped (no resume)`.
6. Timing (SC-005): compare user 1's run duration, from the first to the last event time in its
   trace, with a run from before the upgrade on the same data. It is at most 10% longer.

## 5. Each user's Gmail (US4)

The second user connects their own Gmail. After a run, only their alert jobs are in their lists,
and user 1's alert progress is unchanged.

## 6. Command line (US5)

- `npm start -- rescore <ats> <job_id>` acts for user 1.
- `npm start -- rescore <ats> <job_id> --user second@example.com` acts for the second user.
- `--user nobody@example.com` prints `--user: no account with that email` and exits 1.

## 7. Checks

`npm run check` and `npm run check:db` pass after every sitting.
