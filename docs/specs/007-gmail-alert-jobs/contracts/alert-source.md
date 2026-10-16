# Contract: the "Gmail alerts" agent source

## `list_sources`

"Gmail alerts" is **always** listed, after the boards and the saved searches. Whether it can be
fetched is settled once at the start of the run:

```json
{ "name": "Gmail alerts", "kind": "alerts", "fetched": false }
```

When it can't be fetched, it is listed with `"fetch_failed": true` and a fixed `"note"`:
- `"Gmail not connected"`
- `"Gmail needs reconnecting"`
- `"server key missing"`
- `"server key invalid"`
- `"server key changed"`
- `"Gmail couldn't be reached"`
- `"Gmail error"` (any other failure)

These are the alert source's own notes, defined in `src/gmail/alertJobs/usable.ts` and separate
from 006's Check now wording. The source shows them before and after any `fetch_jobs`. The
finish rule already treats failed sources as done.

## `fetch_jobs({ source: "Gmail alerts" })`

The first call in a run performs the alert fetch:
1. read new alert emails (R4), at most 50
2. parse them (R1)
3. drop copies of jobs stored from other sources (R5)
4. look up descriptions (R2, within the R3 allowance)
5. store the jobs with `source = "Gmail alerts"`
6. record the read marker and counts, and write the `alerts` trace event

Then, like any source, it returns up to 25 unscored jobs plus `total_unscored`, and extra fields:

```json
{ "source": "Gmail alerts", "total_unscored": 12, "jobs": [ … ],
  "alerts": { "emails": 3, "jobs_found": 14, "stored": 11, "seen_again": 2, "searches": 3,
              "looked_up": 11, "with_description": 8, "alert_only": 3, "not_understood": 1,
              "unsupported": 0 } }
```

- **`stored`**: new rows.
- **`seen_again`**: alert jobs already stored, whose last-seen date was updated.
- **`searches`**: JSearch requests made.
- **`looked_up`**: jobs sent to lookup.
- **`with_description` and `alert_only`**: split `looked_up` plus any jobs with no lookup.
- **`unsupported`**: emails from senders with no layout yet (Indeed).

Later calls in the same run only page unscored jobs. The outcome has `seen: null`, so this
includes alert jobs an earlier run left unscored. Job summaries never carry descriptions, and
`get_job_details` shows "(none provided)" for an alert job without one. `record_matches` adds
"scored from the alert only (no description)" to that job's gaps at any score (FR-008).

## Trace event `alerts`

```json
{ "type": "alerts", "emails": 3, "jobs_found": 14, "stored": 11, "seen_again": 2, "searches": 3,
  "looked_up": 11, "with_description": 8, "alert_only": 3, "unsupported": 0,
  "not_understood": [{ "from": "jobalerts-noreply@linkedin.com", "subject": "…" }] }
```

The sender and subject appear only for emails that weren't understood (FR-011), and only in the
owner's own trace file, never in the database or the UI.

## Gmail panel addition (Settings)

When connected and a summary exists: "Last run <YYYY-MM-DD HH:mm>: 3 alert emails, 14 jobs, 1 not
understood", with the time in the server's `TZ` (for example "Last run 2026-10-16 01:05: …"), and
singular forms for 1 ("1 alert email", "1 job"). Nothing else in the 006 panel changes.
