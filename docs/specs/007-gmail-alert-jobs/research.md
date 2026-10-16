# Research: Jobs from Gmail job alerts

## R1. What the alert emails look like (observed 2026-10-15, structure only)

The owner allowed a read-only look at the structure of recent alerts: line lengths, link shapes
with IDs masked, and hashes of repeated lines. No job text, subject or address was printed or
kept. Test fixtures are synthetic.

- **`jobalerts-noreply@linkedin.com`** (the owner's saved-search alerts):
  - multipart `text/plain` + `text/html`, both quoted-printable
  - in the plain part, each job is 3–4 short non-empty lines (title, company, location, sometimes
    one more line such as a status or salary) followed by a line with
    `https://www.linkedin.com/comm/jobs/view/<id>/?trackingId=…`
  - 2–4 jobs per email
  - one `…/comm/jobs/search-results/?keywords=…&geoId=…&distance=…&f_TPR=…` link, which is the
    alert's own search. `keywords` is present.
- **`jobs-noreply@linkedin.com`** (LinkedIn's recommendation digests):
  - same structure, link `…/comm/jobs/view/<id>?trackingId=…` (no slash before `?`)
  - about 5 jobs, each followed by the same boilerplate line (identical hash every time)
  - no search link
- **Other LinkedIn senders** (notifications) carry no job links. They aren't in
  `gmail.alert_senders`.
- **Indeed**: no alert email in the last 14 days, so there's no layout to design from.

**Decision**:
- **Parsers**: one parser per layout, reading the **plain-text part**. It is simpler and steadier
  than the HTML, and the structure is the same in both LinkedIn layouts.
  1. Split the part into blocks ending at a job link.
  2. In each block, the last 3–4 non-empty lines before the link are title, company and location,
     with an optional extra line.
  3. The extra line is recognised as salary when it matches a money pattern (`$`, `K`, `/yr`,
     `/hr`); otherwise it is ignored.
  4. The job ID is the digits after `/jobs/view/`. The posting link stored is the canonical
     `https://www.linkedin.com/jobs/view/<id>/`, without the tracking parameters.
- **Indeed**: no parser yet. Its mail counts as "not understood" until a sample exists. The spec's
  assumption is adjusted accordingly.
- **Recognising a layout**: by sender and by the presence of job links. An email from an alert
  sender with no job links counts as "not understood".

**Alternatives**:
- Parse the HTML: more markup to depend on, and it changes more often.
- A general mail parser (`mailparser`): a new dependency we don't need, since imapflow downloads
  a single decoded part.

## R2. Batching the description lookups (FR-006, SC-002)

- **What JSearch allows** (published references; its own docs page didn't load):
  - Each page of up to 10 search results costs one request, even when several pages come back
    in one call (`num_pages`).
  - `job-details` takes one posting per request.
  - So no call returns specific, chosen postings in bulk.
- **Decision**: one `search-v2` request (1 page, 10 results) per alert email.
  - **Which jobs**: the query covers only the email's pending jobs, meaning those still needing a
    description after de-duplication and the title and company filters
    (`planQuery({ alert, pending })`).
  - **Saved-search alerts**: the query is the email's own `keywords`, plus "in <location>" when
    at least half of the pending jobs share one location, with `country=us` and
    `date_posted=7days`.
  - **Recommendation digests**: the query is the most common normalised title among the pending
    jobs, plus "in <location>" by the same at-least-half rule.
  - **Matching results to jobs**:
    1. by LinkedIn ID: the trailing digits of the `/jobs/view/` path segment of the result's
       `url` (`fetchJsearch` stores `job_apply_link` there). This covers both `/jobs/view/<id>`
       and `/jobs/view/<slug>-<id>`, since JSearch's exact LinkedIn link format is unverified.
    2. otherwise by the same company (normalised) and the same normalised title
  - Matched jobs get the result's description, requirements and skills. Unmatched ones are
    scored on the email's details.
- **Rationale**: that is at most one request per email (FR-006). With 2–5 jobs per email, fewer
  after de-duplication, it gives about 2–5 times fewer requests than one per job (SC-002 asks for
  at least 2 times over a week). The alert's own keywords make it likely that its postings are in the first 10 results.
- **Owner approval** (2026-10-15): "Lookup via JSearch, but don't do it one at a time if
  possible". So one search per email is the agreed batching. If the live run or the week-long
  check (tasks T030, T033) shows SC-002 or SC-003 falling short, the owner decides on a
  follow-up.
- **Alternatives**:
  - one search per job (refused by the owner)
  - `job-details` per job (needs JSearch IDs, which we don't have, and costs one each)
  - several pages per email (costs a request per page, which is no saving)

## R3. Budget (FR-007)

- **Decision**: before looking up, compute what saved searches still need this month:
  `Σ over searches of ceil(hours left in the month / (refresh_hours − REFRESH_GRACE_HOURS))`.
  Searches refresh after `refresh_hours − 0.25`, as `fitsJsearchBudget` already assumes.
  `src/tools/alertSource.ts` computes the month's usage with `requestsThisMonth` and passes it
  in as a number, so `src/gmail` never depends on the tool layer. Lookups may then use
  `cap − used this month − that reserve`, with a floor of 0.
  - Lookups are logged in `api_calls` as `jsearch` with source `Gmail alerts`, so they count
    toward the same monthly cap.
  - When the allowance runs out mid-run, the remaining emails' jobs are scored without lookups.
- **Rationale**: saved searches are planned and capped by config validation already, and alerts
  take only what is left.

## R4. Reading only new mail (FR-001, FR-005)

- **Decision**:
  - **Read marker**: keep `uid_validity` and `last_uid` for the All Mail folder in a new
    one-row table, `gmail_alert_state`.
  - **Where the search is decided**: inside the IMAP session. `readAlerts({ senders, marker,
    max })` opens the folder first, because UIDVALIDITY is only known then (imapflow reports it
    as a `bigint`, converted with `Number()`). Then it applies the pure `alertSearch` and
    `unreadUids`.
  - **Search**: always `gmraw` `from:(…)` for the alert senders, reusing 006's `alertQuery`
    sender part.
    - When the folder's UIDVALIDITY matches the marker, it adds `uid: "<last+1>:*"`. IMAP's
      `n:*` returns the last message even when nothing is newer, so a pure `unreadUids` drops
      every UID ≤ the marker.
    - Otherwise (and on the first run) the query gets ` newer_than:7d`.
    - These choices live in `src/gmail/alertJobs/read.ts`, which is pure and unit-tested; the cap
      of 50 is applied there too.
  - **Reading**: each message's plain part is downloaded read-only (EXAMINE; `download()` uses
    BODY.PEEK).
  - **Saving the marker**: `last_uid` is stored after the run has stored the jobs, so a crash
    re-reads (duplicates are harmless) rather than skipping mail. A run with no new mail keeps
    the old `last_uid`. A marker whose `last_uid` is null counts as no marker.
- **Cap**: at most 50 emails per run (the newest), so a backlog can't take over a run.

## R5. Where it plugs into the agent

- **Decision**: a third source kind, `alerts`, named "Gmail alerts" (one exported constant,
  `ALERTS_SOURCE`, used by the source list and the Recommended page's source filter).
  - It is **always** listed. `ALERTS_SOURCE` and the fixed notes live in
    `src/gmail/alertJobs/usable.ts`, together with the pure `alertsUsability(row, key)`, so
    `src/gmail` never imports from `src/tools`.
  - **Usability is settled once per run.** `runWithStores` (already async) computes it from the
    Gmail row and the key, and passes it in the `RunParts` bundle, so `buildContext` keeps 3
    parameters and stays synchronous.
  - **The key** comes from the raw environment in `runOnce`: `config.env` is parsed by
    `envSchema`, which drops `MYJOBBOT_SECRET_KEY`.
  - **Listing**: `list_sources` reports the source as `fetch_failed` with its note whenever it
    isn't usable, before and after any fetch, and `configuredSources` stays synchronous. A
    company or search named "Gmail alerts" is refused by the config schema.
  - `fetch_jobs("Gmail alerts")` runs the alert fetch once per run (read, parse, de-duplicate,
    look up, store), then pages unscored jobs like any other source.
  - **Failures** are kept as notes: `RunState.failedFetches` becomes a map from name to note.
    `alertSource` throws `AlertsUnavailable(note)`, and `fetchOnce`'s existing catch records the
    note. A recorded failure makes later calls in the run throw again without reading, so
    nothing is retried. The finish rule already ignores failed sources.
  - **Tests**: the test context defaults to "Gmail not connected", so existing finish tests stay
    green.
  - The fetch outcome is `{ seen: null }`, so every unscored alert job is paged, including ones a
    previous run left unscored; emails are read only once.
- **Job identity**: `ats = "linkedin"`, `job_id = "li_<LinkedIn ID>"`, and
  `source = "Gmail alerts"`. The prefix matters because `recordVerdict` and `findJob` key on
  `job_id` alone, and plain LinkedIn numbers could collide with numeric Greenhouse IDs (JSearch
  uses `js_` for the same reason). Matching against JSearch compares the raw digits. `linkedin` joins the set of job origins without being a configurable
  company board.
- **Duplicates (FR-004)**:
  - **Within a run**: repeats are merged by LinkedIn ID.
  - **Already stored**: a job already stored as `ats=linkedin` is only `markSeen` (last_seen
    moves; description, salary and score are kept), and isn't looked up again. `upsertAll` would
    refresh the details and wipe a description found earlier.
  - **From other sources**: a new alert job is skipped when a stored job from another source has
    the same company and normalised title (`companiesWithTitleOutside`).
  - **The other direction**: `boardCompaniesWithTitle`, which saved searches use, now excludes
    `linkedin` as well as `jsearch`, so a saved search's JSearch result (which has a
    description) is never skipped as a copy of an alert job.
- **No description (FR-008)**: alert jobs without a description carry `description: null`.
  Job summaries never include descriptions anyway, and `get_job_details` already shows "(none
  provided)". `record_matches` appends "scored from the alert only (no description)" to the
  job's stored gaps at any score, overriding the prompt's "leave gaps empty below 40" for this
  note only. The prompt line about sources gains "Gmail alerts".

## R6. Run summary (FR-011)

- **Decision**:
  - **Trace**: `ToolContext` gains `trace`, the run trace in `data/runs/`, beside `jobLog`. The
    fetch writes one `alerts` trace event with the contract's summary fields, where
    `not_understood` is a list of `[{ from, subject }]`. Subject and sender stay in the owner's
    own trace file only.
  - **What counts**: an email is "not understood" only when it yields no jobs. Mail from senders
    with no layout (Indeed) is counted as `unsupported` instead.
  - **Database**: the counts (not the subjects) are stored in `gmail_alert_state` with the run
    time.
  - **Panel**: the Gmail panel shows "Last run <YYYY-MM-DD HH:mm>: N alert emails, M jobs, K not
    understood", with singular forms for 1 ("1 alert email", "1 job").

## R7. Keeping the agent and the web app apart

- **Decision**: alert reading lives in `src/gmail/alertJobs/` (pure: parse, read, lookup, budget),
  next to 006's `src/gmail/alerts.ts`, with the service in `src/gmail/alertFetch.ts`. The agent
  side is `src/tools/alertSource.ts`. Nothing in
  `src/` imports `web/`. The web panel only reads the summary row.
- **The key**: the agent needs `MYJOBBOT_SECRET_KEY` to open the app password; the agent container
  already reads `.env`.
