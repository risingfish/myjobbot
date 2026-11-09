# Runbook: upgrading from 0.2.0 to the 028 release

For a deployment on `v0.2.0` (feature 027, at database step `023_jobs_without_user_columns`). It
covers a Kubernetes deployment through the Helm chart, as
[the 0.2.0 runbook](upgrade-to-accounts.md) does, and uses its setup: `RELEASE`, the admin option
file and the `sql` helper from its [You need](upgrade-to-accounts.md#you-need). With Docker Compose,
the same steps apply with `docker compose` in place of `kubectl` and `helm`.

## What changes

Feature 028 is a refactor of the code: no behaviour, output, setting or file a deployment depends
on changes. For a deployment, one thing is different:

- **Database step `024_jobs_without_digest_mark`** drops the column `jobs.emailed_at`. Nothing has
  ever written it, so it holds no data. The step runs once, the first time the new release opens
  the database. If any posting does hold a value, the step changes nothing and the release won't
  start, with:

  ```text
  schema step 024_jobs_without_digest_mark failed: <N> postings have an email-digest mark, which nothing should have written; restore or clear it before upgrading
  ```

Nothing else needs doing:

- The chart, the image's build and the dependencies are unchanged, and the Secret needs no new
  key.
- `MYJOBBOT_LOG_STDOUT` is new and optional. It defaults to off, and the chart doesn't set it;
  only the dev stack (`compose.yaml`) turns it on.
- Eval run files gain an optional `userId`. They live in a checkout's `data/evals/`, not in the
  deployment.

**Rolling back needs the backup.** A `v0.2.0` pod refuses to start on a database that has run step
024 (`corrupted migrations: previously executed migration 024_jobs_without_digest_mark is missing`).
So going back means restoring the backup from step 3 as well as rolling back the release. That
is the one difference from the 0.2.0 rollback.

## You need

- Everything in [the 0.2.0 runbook's You need](upgrade-to-accounts.md#you-need): `kubectl`, `helm`,
  the `mariadb` clients, the admin option file and the `sql` helper.
- A release tagged after 028 merged (for example `v0.3.0`). The chart is published on `v*` tags only.
- About 15 minutes when nothing else is running.

## 1. See where production is

```bash
RELEASE=myjobbot
helm history "$RELEASE" | tail -3                    # the revision to roll back to
sql "SELECT name FROM kysely_migration ORDER BY name DESC LIMIT 1"
```

The last step must be `023_jobs_without_user_columns`. With `024_jobs_without_digest_mark` the
upgrade has already run; with anything earlier, first follow
[the 0.2.0 runbook](upgrade-to-accounts.md).

Check that no posting holds a digest mark, and save the counts step 5 compares against:

```bash
sql "SELECT COUNT(*) AS marked FROM jobs WHERE emailed_at IS NOT NULL"   # must be 0
sql "SELECT (SELECT COUNT(*) FROM jobs) AS jobs, (SELECT COUNT(*) FROM user_jobs) AS views, (SELECT COUNT(*) FROM verdicts) AS verdicts, (SELECT COUNT(*) FROM rescore_runs) AS rescores, (SELECT COUNT(*) FROM users) AS users" | tee before-028.txt
```

If `marked` isn't 0, something wrote the column although no code does. Stop and find out what
before going on: the step will refuse until the values are cleared or restored.

## 2. Stop runs and the web UI

```bash
kubectl patch cronjob "$RELEASE-agent" -p '{"spec":{"suspend":true}}'
kubectl get jobs                                     # wait until no myjobbot job is running
kubectl scale deploy "$RELEASE-web" --replicas=0
kubectl rollout status deploy "$RELEASE-web"
```

## 3. Back up the database

The step drops a column and can't be undone, and the old release won't start after it, so this
backup is the way back.

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
mariadb-dump --defaults-extra-file="$HOME/.myjobbot-admin.cnf" --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 "$DB" > "myjobbot-pre-028-$STAMP.sql"
tail -1 "myjobbot-pre-028-$STAMP.sql"                # must read "-- Dump completed on ..."
```

Keep it off the database server until the upgrade is verified, and treat it as a secret: it holds
the accounts and the sealed secrets.

## 4. Deploy the new release

```bash
VERSION=0.3.0                                        # the release tagged after 028 merged
helm upgrade "$RELEASE" oci://ghcr.io/risingfish/charts/myjobbot --version "$VERSION" \
  --reset-then-reuse-values --set agent.suspend=true
kubectl scale deploy "$RELEASE-web" --replicas=1
kubectl rollout status deploy "$RELEASE-web"
```

The new web pod runs step 024 the first time it opens the database.

## 5. Check the step ran and nothing else moved

```bash
sql "SELECT name FROM kysely_migration ORDER BY name DESC LIMIT 1"     # 024_jobs_without_digest_mark
sql "SELECT COUNT(*) AS emailed_at FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'emailed_at'"   # 0
sql "SELECT (SELECT COUNT(*) FROM jobs) AS jobs, (SELECT COUNT(*) FROM user_jobs) AS views, (SELECT COUNT(*) FROM verdicts) AS verdicts, (SELECT COUNT(*) FROM rescore_runs) AS rescores, (SELECT COUNT(*) FROM users) AS users"
```

The counts must equal `before-028.txt`. If the last step is still `023`, the web pod hasn't opened the
database yet: sign in once, which opens it, and check again. If the web pod's log shows the step failing, or a count is
off, [roll back](#rolling-back).

Then sign in and check that **Recommended**, **All jobs**, **Settings** and a job's **History**
look as before.

## 6. Turn runs back on

```bash
helm upgrade "$RELEASE" oci://ghcr.io/risingfish/charts/myjobbot --version "$VERSION" \
  --reset-then-reuse-values --set agent.suspend=false
kubectl create job --from=cronjob/"$RELEASE-agent" myjobbot-after-028   # optional: one run now
kubectl logs -f job/myjobbot-after-028
```

The run prints one line per user, as on 0.2.0. Delete the backup once a few scheduled runs have
gone well.

## Rolling back

Restore the backup *and* go back to the previous release: `v0.2.0` won't start on a database that
has run step 024.

```bash
kubectl patch cronjob "$RELEASE-agent" -p '{"spec":{"suspend":true}}'
kubectl scale deploy "$RELEASE-web" --replicas=0
mariadb --defaults-extra-file="$HOME/.myjobbot-admin.cnf" -e "DROP DATABASE $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci"
mariadb --defaults-extra-file="$HOME/.myjobbot-admin.cnf" "$DB" < "myjobbot-pre-028-$STAMP.sql"
helm rollback "$RELEASE" <revision from step 1>
```

Check the restore with step 1's queries: the last step is `023_jobs_without_user_columns` and the
counts match `before-028.txt`.
