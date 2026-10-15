# Quickstart: checking the Gmail panel

## One-time Google setup (owner)

1. In Google Cloud Console, create a project, then enable the **Gmail API**.
2. Set up the OAuth consent screen:
   - External; your address as a test user.
   - Then **Publish app** (in production), so access doesn't expire after 7 days. Google may
     show "unverified app"; that's expected for personal use.
3. Under Credentials, choose Create OAuth client ID → **Desktop app**. Keep the client ID and
   secret.
4. In `.env`, add `MYJOBBOT_SECRET_KEY=` followed by the output of `openssl rand -base64 32`.
   It takes effect only when the containers are recreated (`docker compose up -d`, not
   `restart`) or the dev server (`npm run web`) is restarted.
5. If `.env` sets `MYJOBBOT_HOSTS`, it must include `localhost:8080`. Otherwise the tunnel and
   Google's return trip get "421 Misdirected Request".

## Automated

```bash
npm run check      # unit (seal, connect request, alerts, connection service, panel view) + UI
npm run check:db   # store contract incl. Gmail cases, migration 002 on myjobbot_test
```

## Manual

Before the merge (T031), this runs against `myjobbot_test` with
`MYJOBBOT_DB_NAME=myjobbot_test npm run web`, so production isn't migrated early. After the merge
(T034), steps 3 and 5 are repeated on production.

1. From the laptop, run `ssh -L 8080:localhost:8080 <server>` and open
   `http://localhost:8080/settings`.
2. The Gmail panel says "Not connected". Enter the client ID and secret, then Save. The secret
   field comes back empty and says "secret saved".
3. Connect Gmail, then approve on Google. You return with "Connected as you@gmail.com".
4. Check now: the count matches Gmail's search (with conversation view turned off in Gmail's
   settings, since the API counts messages, not threads)
   `from:(jobalerts-noreply@linkedin.com OR jobs-noreply@linkedin.com OR alert@indeed.com OR donotreply@jobalert.indeed.com) newer_than:7d`.
5. Restart: before the merge, stop and start `npm run web`; after the merge (T034),
   `docker compose up -d --force-recreate`. It's still connected, and Check now works (SC-002).
6. Open `http://192.168.1.20:8080/settings`: it's connected, and Connect is disabled with the
   localhost hint.
7. Look for leaks (SC-003): search the database dump, `data/log`, `data/runs` and the saved page
   HTML for the secret's first 8 characters, and for `1//` (how Google refresh tokens usually
   start). There are 0 hits.
8. Disconnect and confirm. The panel shows "Not connected", and Google Account → Security → Third
   party access no longer lists the app.
9. Revoke from Google's side while connected, then Check now. The panel shows "Needs
   reconnecting".
