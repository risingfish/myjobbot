# Quickstart: checking jobs from Gmail alerts

## Automated

```bash
npm run check      # unit: parsers on synthetic alert emails, lookup planning and matching,
                   # budget reserve, the alerts source with fake IMAP and JSearch; UI: panel line
npm run check:db   # alert-state store contract and migration 003 on myjobbot_test
```

## Manual (owner, on `myjobbot_test`, production untouched; tasks T030)

1. After the last `npm run check:db` (which empties the test tables), connect Gmail on the test
   database: `MYJOBBOT_DB_NAME=myjobbot_test npm run web`, then Settings → Connect with the app
   password.
2. Copy this month's `jsearch` rows from production `api_calls` into `myjobbot_test` with a
   guarded one-off script, so the test run sees the real JSearch budget. Note the count.
3. Run `MYJOBBOT_DB_NAME=myjobbot_test npm start -- run`. Its trace is the newest
   `data/runs/*.jsonl`, and in it:
   - an `alerts` event, where `emails` matches the number of LinkedIn alert emails in the last 7
     days (at most 50)
   - `searches` ≤ `emails`
   - `with_description` + `alert_only` = `stored`
   - `unsupported` counts any Indeed mail separately
4. In `myjobbot_test`, every job from those emails exists once with source `Gmail alerts` and a
   `linkedin.com/jobs/view/…` link. In All jobs, the Source column shows "Gmail alerts" for them.
   Good matches are in Recommended.
5. Settings → Gmail panel shows "Last run …: N alert emails, M jobs, K not understood".
6. Run again at once: `alerts.emails` is 0 (nothing new), and no job is duplicated or loses its
   description.
7. `api_calls` for `jsearch` grew by `searches`, which is at most the number of alert emails read
   (SC-002), and saved searches still refreshed on schedule. SC-003 is `with_description ÷
   looked_up`.
8. Disconnect Gmail in Settings, then run: "Gmail alerts" is listed with `fetch_failed` and the
   note "Gmail not connected", and the rest of the run is unaffected (SC-004).

Record only counts (emails, jobs found, stored, looked up, with description, not understood),
never job or email text.
