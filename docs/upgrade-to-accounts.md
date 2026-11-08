# Runbook: upgrading to accounts and per-user data

For a deployment that has never had an account: it creates the first user and gives that user every
job, score, mark and setting already stored. It covers a Kubernetes deployment through the Helm chart
([Kubernetes](deploying.md#kubernetes)); with Docker Compose, the same steps apply with
`docker compose` in place of `kubectl` and `helm`.

## What changes

Two things happen, in this order:

1. **The data becomes user 1's.** Database steps 020–023 run once, automatically, the first time
   the new release opens the database:
   - `020_user_jobs`: creates user 1 if missing, then copies every job's score, marks, source and
     dates into `user_jobs` as user 1's view
   - `021_history_owners`: gives every verdict and re-score run to user 1
   - `022_gmail_by_user`: makes the Gmail connection and its alert progress user 1's
   - `023_jobs_without_user_columns`: drops the copied columns from `jobs`, last, once everything is
     copied

   Sources, search settings and the uploaded resume are already user 1's (steps 011, 012 and 017),
   and `data/resume.md` stays user 1's resume. A deployment older than accounts also runs steps
   016–019 first, which add boosts, the resume tables and the sign-in tables.
2. **User 1 gets a sign-in.** `account init <email>` gives user 1 an email, a password and the
   admin mark. Until then, nobody can sign in, because every page needs a sign-in from 024 on.

MariaDB can't undo a schema change, so a step that fails partway leaves a half-moved database. The
backup in step 4 is the way back: restore it, never re-run the upgrade on a half-moved database.

## You need

- `kubectl` and `helm` for the cluster, and the release's name and namespace. The commands below
  use `RELEASE=myjobbot` and the current namespace; the chart names the resources
  `$RELEASE-web` and `$RELEASE-agent`.
- The `mariadb` and `mariadb-dump` clients and a login on the MariaDB server that can read and
  write the production database, and drop and create it (only a rollback needs that). Keep it in
  an option file so no password is on a command line:

  ```bash
  umask 077
  cat > ~/.myjobbot-admin.cnf <<'EOF'
  [client]
  host=<database host>
  user=<admin login>
  password=<its password>
  EOF
  DB=myjobbot
  sql() { mariadb --defaults-extra-file="$HOME/.myjobbot-admin.cnf" -t "$DB" -e "$1"; }
  ```

- A release to deploy that holds feature 027. The chart is published on `v*` tags only, as
  `oci://ghcr.io/risingfish/charts/myjobbot` with the same version and an image of that version, so
  tag a release after the merge (for example `v0.2.0`). The chart changed after `v0.1.0`
  (`web.baseUrl`, `web.trustedProxies`), so upgrade the chart too, not just the image.
- About 30 minutes when nothing else is running. Runs and the web UI are stopped for most of it.

## 1. See where production is

```bash
RELEASE=myjobbot
helm list --filter "^$RELEASE$"                      # chart and app version now deployed
helm history "$RELEASE" | tail -3                    # the revision to roll back to
kubectl get deploy "$RELEASE-web" -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
sql "SELECT name FROM kysely_migration ORDER BY name DESC LIMIT 1"
sql "SELECT id, name FROM users"
```

Note the revision, the image and the last step. With a last step of `023_jobs_without_user_columns`
the upgrade has already run: skip to [step 7](#7-create-the-first-user). With `019_session_details`
or earlier, carry on.

If the last step is before `018_accounts`, the release adds sign-in. Check that the Secret has the
keys it needs (names only; this never prints a value). The Secret is the one named by
`secret.existingSecret` (`helm get values "$RELEASE"`), `myjobbot-env` in the chart's example:

```bash
kubectl get secret myjobbot-env -o go-template='{{range $k, $v := .data}}{{$k}}{{"\n"}}{{end}}'
```

- `MYJOBBOT_SECRET_KEY` must be there; it seals the Gmail app password and authenticator secrets.
- The mail settings (`MYJOBBOT_SMTP_*`, `MYJOBBOT_MAIL_FROM`, all or none) are optional. Without
  them, "Email me a link" and "Forgot password" say mail isn't set up.
- The chart sets `MYJOBBOT_BASE_URL` from the ingress host, and the address must be `https://`
  (sign-in cookies need it). Check `web.baseUrl` and `web.trustedProxies` in
  [Account settings](deploying.md#account-settings) and
  [Proxies and the sign-in limits](deploying.md#proxies-and-the-sign-in-limits).

## 2. Count what is there now

These queries work at any step up to `019`, while `jobs` still holds the scores. Save the output;
step 6 compares against it.

```bash
sql "SELECT COUNT(*) AS jobs, SUM(scored_at IS NOT NULL) AS scored, SUM(hidden) AS hidden, SUM(applied) AS applied FROM jobs" | tee before.txt
sql "SELECT (SELECT COUNT(*) FROM verdicts) AS verdicts, (SELECT COUNT(*) FROM rescore_runs) AS rescores, (SELECT COUNT(*) FROM gmail_connection) AS gmail" | tee -a before.txt
sql "SELECT user_id, COUNT(*) AS sources FROM user_sources GROUP BY user_id" | tee -a before.txt
```

## 3. Stop runs and the web UI

```bash
kubectl patch cronjob "$RELEASE-agent" -p '{"spec":{"suspend":true}}'
kubectl get jobs                                     # wait until no myjobbot job is running
kubectl scale deploy "$RELEASE-web" --replicas=0
kubectl rollout status deploy "$RELEASE-web"
```

Nothing writes to the database now, so the backup and the counts stay true.

## 4. Back up the database

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
mariadb-dump --defaults-extra-file="$HOME/.myjobbot-admin.cnf" --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 "$DB" > "myjobbot-pre-027-$STAMP.sql"
tail -1 "myjobbot-pre-027-$STAMP.sql"                # must read "-- Dump completed on ..."
ls -lh "myjobbot-pre-027-$STAMP.sql"
```

Keep the file somewhere off the database server until the upgrade is verified. It holds every job,
the sealed Gmail app password and the account tables, so treat it as a secret.

## 5. Deploy the new release

Keep the CronJob suspended through the upgrade: `helm upgrade` sets `suspend` from the values, and
would otherwise turn it back on. `--reset-then-reuse-values` keeps your values and takes the new
chart's defaults for the settings it added; `--reuse-values` would leave those out.

```bash
VERSION=0.2.0                                        # the release tagged after the merge
helm upgrade "$RELEASE" oci://ghcr.io/risingfish/charts/myjobbot --version "$VERSION" \
  --reset-then-reuse-values --set agent.suspend=true
kubectl scale deploy "$RELEASE-web" --replicas=1
kubectl rollout status deploy "$RELEASE-web"
```

The new web pod runs the database steps the first time it opens the database. Step 7's
`account init` opens it too, so the steps run by then at the latest. Steps run once even when
two processes start together.

## 6. Check that the data moved

```bash
sql "SELECT name FROM kysely_migration ORDER BY name DESC LIMIT 1"     # 023_jobs_without_user_columns
```

If it is still at `019` or earlier, the web pod hasn't opened the database yet: do step 7 first,
whose `account init` runs the steps, then come back here. Then compare with `before.txt`:

```bash
sql "SELECT COUNT(*) AS jobs FROM jobs"
sql "SELECT user_id, COUNT(*) AS jobs, SUM(scored_at IS NOT NULL) AS scored, SUM(hidden) AS hidden, SUM(applied) AS applied FROM user_jobs GROUP BY user_id"
sql "SELECT 'verdicts' AS t, user_id, COUNT(*) FROM verdicts GROUP BY user_id UNION ALL SELECT 'rescores', user_id, COUNT(*) FROM rescore_runs GROUP BY user_id UNION ALL SELECT 'gmail', user_id, COUNT(*) FROM gmail_connection GROUP BY user_id"
```

Every row must belong to `user_id` 1, and each count must equal its `before.txt` value: `jobs` in
both tables, `scored`, `hidden`, `applied`, verdicts, re-score runs and the Gmail row. If a step
failed (the web pod's log shows it, and the last step is between `020` and `022`), or a count is
off, stop and [roll back](#rolling-back).

## 7. Create the first user

```bash
kubectl exec -it deploy/"$RELEASE-web" -- npm start -- account init you@example.com
```

It asks for the password twice at a hidden prompt (`-it` gives it the terminal it needs) and
prints `account you@example.com: ready`. `account init: user 1 already has an email` means user 1
already had a sign-in, and nothing changed.

```bash
sql "SELECT id, name, email, is_admin FROM users"     # user 1: your email, is_admin 1
```

Then sign in at the UI's address and check:

- **Recommended** and **All jobs** show the jobs, with their scores; **Applied** shows the applied
  ones; hidden jobs stay hidden
- **Settings** shows your sources, search settings, resume and the Gmail connection
- a job's **History** shows its earlier scores and re-scores

Set up a second way of signing in (an authenticator app or a hardware key) on the Account tab,
and keep the recovery codes.

## 8. Turn runs back on

```bash
helm upgrade "$RELEASE" oci://ghcr.io/risingfish/charts/myjobbot --version "$VERSION" \
  --reset-then-reuse-values --set agent.suspend=false
kubectl create job --from=cronjob/"$RELEASE-agent" myjobbot-after-027   # optional: one run now
kubectl logs -f job/myjobbot-after-027
```

The run now prints one line per user: `user 1: run <id> finished after <N> steps: ...`, then the
summary. Until someone else has an account, that is the only line. Delete the backup once a few
scheduled runs have gone well.

## Rolling back

Restore the backup and go back to the previous release; never re-run the upgrade on a half-moved
database.

```bash
kubectl patch cronjob "$RELEASE-agent" -p '{"spec":{"suspend":true}}'
kubectl scale deploy "$RELEASE-web" --replicas=0
mariadb --defaults-extra-file="$HOME/.myjobbot-admin.cnf" -e "DROP DATABASE $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci"
mariadb --defaults-extra-file="$HOME/.myjobbot-admin.cnf" "$DB" < "myjobbot-pre-027-$STAMP.sql"
helm rollback "$RELEASE" <revision from step 1>
```

Dropping the database keeps its grants, which MariaDB holds per database name. `helm rollback`
brings back the previous release's values, so the web UI and the CronJob come back on with it.
Check the restore with step 2's queries; they match `before.txt`.
