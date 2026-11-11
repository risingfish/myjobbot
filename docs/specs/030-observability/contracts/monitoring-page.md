# Contract: the Monitoring page and the user's fetch history

## `/monitoring` (admins only)

- Signed out: the usual redirect to sign in. Signed in, not an admin: `404`. The header's
  Monitoring link is shown to admins only.
- `?period=day|week|month` (default `week`; anything else is `week`). `?run=<id>` opens one run.
- Reads only `MonitoringReads`, reached through `myStores()` and only for an admin
  (`web/lib/monitoringState.ts`); nothing user-bound. A run that hit a failed write is marked
  "record incomplete"; a never-finished run's part that was in progress shows as running when it
  stopped.

| Panel | Shows |
|---|---|
| Runs | each run: start, duration, status (`running`, `finished`, `finished with errors`, `failed`, `never finished`), users, fetches and failures, jobs found and scored, model calls; a bar chart of runs per day by status |
| Run detail | each user's part by id: outcome and fixed reason, fetches, failures, jobs, lookups, searches, model calls and tokens |
| Sources | each module: fetches by outcome, pages, jobs, cost, top 3 failure reasons, sources failing repeatedly (count only); a bar chart of fetches per day by outcome |
| Lookups | by outcome and how pages were read |
| Company searches | searched, failed |
| Re-scores | by outcome, typical (median) and longest duration, model calls and tokens |
| Mail | sends by kind and outcome, failures by reason |

Empty states: "No runs yet", and "Nothing in this period" per panel. Times in the app's time zone.
Nothing on the page names a user other than by id, a source, a search term, an address, an email or
a job.

## Settings → Sources (each user)

Each of the user's sources gets "Recent fetches": its last 10 fetches (time, outcome, jobs, reason),
and "Failing repeatedly" when its last 3 fetches failed. Read through `myStores().fetches`.
