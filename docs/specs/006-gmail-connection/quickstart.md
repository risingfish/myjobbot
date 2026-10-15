# Quickstart: checking the Gmail panel

## One-time setup (owner)

1. Turn on 2-step verification for the Google account, if it isn't on.
2. Create an app password at https://myaccount.google.com/apppasswords (name it "myjobbot"). Keep
   the 16 letters it shows.
3. In `.env`, add `MYJOBBOT_SECRET_KEY=` followed by the output of `openssl rand -base64 32`. It
   takes effect only when the containers are recreated (`docker compose up -d`, not `restart`)
   or the dev server is restarted.

## Automated

```bash
npm run check      # unit (seal, key, alerts, errors, connection service, panel view) + UI
npm run check:db   # Gmail store contract and migration 002 on myjobbot_test
```

## Manual

Before the merge, this runs against `myjobbot_test` with
`MYJOBBOT_DB_NAME=myjobbot_test npm run web`, so production isn't migrated early. After the merge,
steps 2 and 4 are repeated on production.

1. Open `/settings`, from any address. The Gmail panel says "Not connected".
2. Enter the Gmail address and the app password (spaces are fine), then Connect. The panel shows
   "Connected as you@gmail.com since …" and the password field is empty.
3. Connect again with a wrong app password: nothing changes, and the panel says Gmail rejected it.
4. Check now: the count matches Gmail's web search, with conversation view off,
   `from:(jobalerts-noreply@linkedin.com OR jobs-noreply@linkedin.com OR alert@indeed.com OR donotreply@jobalert.indeed.com) newer_than:7d`.
   The newest subjects match too, and no message became read.
5. Restart: before the merge, stop and start `npm run web`; after it,
   `docker compose up -d --force-recreate`. It's still connected, and Check now works (SC-002).
6. Look for leaks (SC-003): search the database dump, `data/log`, `data/runs` and the saved page
   HTML for the app password's first 8 letters, which the owner types. There are 0 hits.
7. Delete the app password in Google, then Check now. The panel shows "Needs reconnecting: app
   password rejected; create a new one".
8. Disconnect and confirm. The panel shows "Not connected" and the reminder to delete the app
   password in Google.
