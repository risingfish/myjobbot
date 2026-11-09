# Contract: database step 024 (028)

`024_jobs_without_digest_mark` runs once per database, like every step, on the first start of the
release that holds it.

- **When no posting holds a digest mark** (always, since nothing has ever written one): it drops
  `jobs.emailed_at`. Every other column, row and count is unchanged.
- **When some do**: it changes nothing and fails with

  ```text
  schema step 024_jobs_without_digest_mark failed: <N> postings have an email-digest mark, which nothing should have written; restore or clear it before upgrading
  ```

  The migrator adds the `schema step … failed:` prefix (`src/db/migrate.ts`). The message gives the
  count only, never a posting or a value. The step isn't recorded as run, so
  it runs again on the next start once the cause is dealt with. The app doesn't start against a
  database whose steps failed, as for any step.

**Before deploying**: back up, as `docs/upgrade-to-accounts.md` describes. This step can't undo its
drop.
