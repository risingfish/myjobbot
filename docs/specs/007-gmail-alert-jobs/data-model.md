# Data Model: Jobs from Gmail job alerts

## Jobs (existing table `jobs`, no schema change)

An alert job is an ordinary job row:

| Field | Value |
|---|---|
| `ats` | `linkedin` (new value; `job.ts`'s set of origins gains it, but it is not a configurable company board) |
| `job_id` | `li_<LinkedIn posting ID>` (the digits from `/jobs/view/<id>/`, prefixed so they can't collide with numeric board IDs) |
| `source` | `Gmail alerts` |
| `title`, `company`, `location` | from the email |
| `compensation` | the email's salary line when one matches the money pattern, else the JSearch match's salary, else null |
| `url` | `https://www.linkedin.com/jobs/view/<id>/` (tracking parameters removed) |
| `description`, `requirements`, `skills`, `preferred_skills`, `posted_at`, `is_remote`, `publisher` | from the matched JSearch result, else null |

**Repeats keep their details (FR-004)**:
- the same LinkedIn ID twice in one run is merged
- an alert job already stored is only `markSeen`, so `last_seen` moves and its description,
  salary and score stay; it isn't looked up again
- a new alert job whose company and normalised title match a stored job from another source is
  not stored (R5)

## `gmail_alert_state`: new table, at most one row (migration `003_gmail_alerts`)

| Column | Type | Rule |
|---|---|---|
| `id` | `TINYINT` PK | always 1 |
| `uid_validity` | `BIGINT` NULL | the All Mail folder's UIDVALIDITY at the last read |
| `last_uid` | `BIGINT` NULL | the highest UID read; the next run searches `UID > last_uid` |
| `last_run_at` | `VARCHAR(32)` NULL | ISO UTC time of the last alert fetch |
| `emails_read` | `INT` NOT NULL DEFAULT 0 | last run's count |
| `jobs_found` | `INT` NOT NULL DEFAULT 0 | last run's count of alert jobs parsed (before de-duplication) |
| `not_understood` | `INT` NOT NULL DEFAULT 0 | last run's count of emails from LinkedIn alert senders that yielded no jobs (Indeed and other layout-less senders are counted as `unsupported` in the trace, not here) |

`utf8mb4_bin` like every table. The BIGINT columns are parsed with `z.coerce.number()`.
`disconnect(deps)` in `src/gmail/connection.ts` (006) also calls `alerts.clear()`, so connecting
another account starts again from the last 7 days.

## `AlertStore` (`src/db/store.ts`, part of `Stores`)

```text
state(): Promise<AlertStateRow | null>
recordRead(read: { uidValidity, lastUid, emails, jobs, notUnderstood }, at): Promise<void>  # upsert row 1
clear(): Promise<void>                                                                        # marker and counts reset
```

## `JobStore` additions

```text
companiesWithTitleOutside(source, normalizedTitle): Promise<string[]>   # companies from any other source
markSeen(keys: Array<{ ats, jobId }>, seen): Promise<void>                # last_seen only
boardCompaniesWithTitle(...)                                             # now also excludes ats = 'linkedin'
```

The alert-job contract (`tests/helpers/alertJobContract.ts`) has three cases, each run on the
memory fake and on MariaDB, one for each method above.

The alert-state contract has three cases, each run on the memory fake (unit) and on MariaDB
(integration):
1. a first record, then a second replacing it
2. clear empties it
3. a large UID (above 2³¹) round-trips exactly

## In-memory shapes (pure, `src/gmail/alertJobs/`)

```text
AlertEmail   = { uid: number, from: string /* bare address */, subject: string, plain: string }   # never stored
ParsedAlert  = { layout: "linkedin_search" | "linkedin_digest" | null, keywords: string | null,
                 jobs: AlertJob[] }
AlertJob     = { linkedinId: string /* raw digits */, title: string, company: string, location: string | null,
                 salary: string | null }
LookupPlan   = { query: string, emailUid: number }        # planQuery({ alert, pending }); one per email with pending jobs
```

## Config

No new settings. Alert senders reuse `gmail.alert_senders`; the lookups reuse
`jsearch.monthly_request_cap` and `date_posted` is fixed at `7days`.
