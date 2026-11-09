# Quickstart: checking 028

## Every sitting

1. `npm run check` and `npm run check:db` are green.
2. `git diff --stat main -- tests/` shows no changed expectation, except a test asserting the
   structure the sitting changed, or (S1) an eval report line FR-009 changes. The run prompt snapshot (`tests/__snapshots__/prompt.test.ts.snap`)
   is untouched.
3. The sitting's guard tests fail when the breach is put back. Try one by hand, for example by
   adding a `module === "gmail_alerts"` check in `src/tools/`. Then remove it.
4. Each finding fixed in the sitting is marked `- **Done**: <sitting>` in its inventory file.
5. A review against Principle VI found nothing new, or what it found was fixed.

## S1: the 027 follow-ups

1. **Step 024 on a copy of a 027 database** (`scripts/copy-prod.sh myjobbot_dev`, then start the
   app):
   - the last step is `024_jobs_without_digest_mark`
   - `jobs` has no `emailed_at`
   - the counts in `docs/upgrade-to-accounts.md` step 6 are unchanged
2. **Refusal**: on the test database, set one posting's `emailed_at` before the step runs. The start
   fails with [contracts/upgrade-024.md](contracts/upgrade-024.md)'s message, and nothing changed.
   (`check:db` covers this.)
3. **Evals**: `npm start -- eval run --tag baseline` and `npm start -- eval run --tag baseline
   --user <second account>` (the local cases are tagged `baseline`):
   - each report's header names its user
   - `eval report <second> --against <first>` prints the different-users note
   - an older run reports `user not recorded`

## At the end (S8)

- Every inventory finding has a decision: fixed with its commit, or accepted with the owner's
  approval.
- A scheduled run on the dev stack:
  - takes no more than 10% longer than one on `main` before 028
  - has the same trace event types
  - prints the same lines
- The web UI, every sign-in way and Re-score work as before. Walk the 024 and 027 quickstarts'
  web steps once.
- The CLI and evals print as on `main`:
  - `eval report <an existing run>` and `eval check`, apart from FR-009's user line
  - a `rescore` CLI run's step lines
