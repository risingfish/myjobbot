---
description: "Tasks for feature 007: jobs from Gmail job alerts"
---

# Tasks: Jobs from Gmail job alerts

**Input**: Design documents from `docs/specs/007-gmail-alert-jobs/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/alert-source.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file.

**Organization**: by user story, planned in sittings.
- **Where the work happens**: a sitting may span turns, in the main checkout on
  `007-gmail-alert-jobs`, with the Docker stack stopped (it runs production from this checkout,
  so its scheduled runs pause until the merge).
- **How a sitting ends**: `npm run check` and `npm run check:db` green, then a commit of that
  sitting's files (owner rule: commit between sittings).
- **Wiring**: every new module and store method is reached from a production entry point within
  its sitting: `fetch_jobs`, `list_sources`, `record_matches`, the Recommended page, a server
  action or the Settings page.
- **Signatures**: services take one deps object first (eslint `max-params: 3`); test bodies stay
  within 20 lines, using helpers.
- **Fixtures**: synthetic only, shaped like research R1. No real email or job text is ever
  committed or printed.
- **Paths**: the pure alert logic lives in `src/gmail/alertJobs/`, separate from 006's
  `src/gmail/alerts.ts` (sender list, Check now summaries).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3 from spec.md

---

## Phase 1: Setup

### Sitting S0: stop the stack and get a green baseline (T001–T002)

- [X] T001 Run `docker compose top myjobbot` and confirm no run is in progress, then
  `docker compose stop` (no `docker:watch`). Create `.specify/sitting-in-progress` naming S0.
- [X] T002 Run `npm run check` and `npm run check:db` and record the baseline in the ledger
  (expected node 248, dom 30, integration 23). Add 006's post-merge result to
  `docs/specs/006-gmail-connection/tasks.md` (R012): after the rebuild, Settings still showed
  Connected and Check now worked. Delete the marker, then commit only `docs/specs/007-gmail-alert-jobs/`
  and that 006 note ("Plan jobs from Gmail alerts (007)").

---

## Phase 2: User Story 1, alert jobs appear in Recommended (P1) 🎯 MVP

**Goal**: each run reads new LinkedIn alert emails, stores their jobs as "Gmail alerts" jobs
(no duplicates, details never wiped, each email read once), scores them, shows the good ones in
Recommended, and records what it read. There are no JSearch lookups yet, so every alert job is
scored from the email and says so.

**Independent Test**: with the fake IMAP holding two synthetic alerts, one run of
`fetch_jobs("Gmail alerts")` stores every job once and returns them unscored. A scored one
appears in Recommended. A second run reads nothing new.

### Sitting S1: read, parse, store, score and recommend alert jobs (T003–T017)

Create `.specify/sitting-in-progress` naming S1 before T003.

#### Tests first

- [X] T003 [US1] Write `tests/helpers/alertEmails.ts`, synthetic plain-text bodies shaped like
  research R1, with made-up companies and titles and IDs over 2³¹:
  - `searchAlert(jobs, keywords)` for the `jobalerts-noreply` layout: a header, then per job
    title / company / location (and an optional extra line) followed by
    `https://www.linkedin.com/comm/jobs/view/<id>/?trackingId=…`, and a
    `…/comm/jobs/search-results/?keywords=<keywords>&geoId=…` line
  - `digest(jobs)` for the `jobs-noreply` layout: link `…/jobs/view/<id>?trackingId=…` (no slash
    before `?`), and a fixed boilerplate line after each job
  - `notification()`: no job links
  - `email(uid, from, body)`, which wraps a body as an `AlertEmail`
- [X] T004 [P] [US1] **Unit**: write `tests/alertParse.test.ts` for `parseAlert(email)` from
  `src/gmail/alertJobs/parse.ts`. 6 tests:
  - a saved-search alert gives `layout: "linkedin_search"`, its `keywords` and every job (title,
    company, location, `linkedinId` as the raw digits) in order, including a 25-job email
  - a digest gives `layout: "linkedin_digest"` and `keywords: null`, and the boilerplate line is
    ignored
  - an extra line is `salary` only when it matches the money pattern (`$120K/yr`, `$55/hr`), and
    is otherwise ignored
  - a job whose link has no numeric ID is skipped, and the email still parses its other jobs
  - mail with no job links, or from a sender with no known layout (Indeed), gives
    `layout: null` and no jobs
  - a body with a stray `=3D` or a soft line break left in (imapflow's `download` already decodes
    quoted-printable) still parses the same jobs
- [X] T005 [P] [US1] **Unit**: write `tests/alertRead.test.ts` for `src/gmail/alertJobs/read.ts`
  (the pure reading decisions). 2 tests:
  - `alertSearch({ senders, marker, uidValidity })` always has `gmraw: from:(…)`, built with 006's
    `alertQuery` sender part (no second builder). With a marker whose `uid_validity` equals the
    folder's and whose `last_uid` is set, it adds `uid: "<last+1>:*"` and returns that `sinceUid`.
    Otherwise (no marker, a different UIDVALIDITY, or `last_uid` null) it adds ` newer_than:7d`
    with `sinceUid` 0.
  - `unreadUids(uids, sinceUid, max)` drops every UID ≤ `sinceUid`, so IMAP's `n:*` returning the
    last message again yields nothing, and keeps only the newest `max` (50).
- [X] T006 [P] [US1] **Unit and integration (contract)**: write
  `tests/helpers/alertStoreContract.ts` (`alertStoreContract(make)`, with a `CASES` list) with 3
  cases (data-model.md):
  1. `recordRead` then a second `recordRead` replaces the row
  2. `clear` empties the marker and counts
  3. `last_uid = 3000000000` round-trips

  Write `tests/helpers/alertJobContract.ts` (`alertJobContract(make)`) with 3 job-store cases:
  1. `companiesWithTitleOutside("Gmail alerts", title)` lists companies of jobs stored from other
     sources with that normalised title, and never alert jobs
  2. `markSeen([{ ats: "linkedin", jobId }], seen)` moves only `last_seen`; description, salary
     and score stay
  3. `boardCompaniesWithTitle` ignores `linkedin` jobs, so a saved search's JSearch result isn't
     skipped as a copy of an alert job

  Call both contracts from `tests/storeContract.test.ts` (memory fake) and
  `tests/integration/storeContract.test.ts` (MariaDB). `tests/helpers/storeContract.ts` stays
  under 200 lines.
- [X] T007 [US1] **Unit**: write `tests/alertFetch.test.ts` for `fetchAlerts(deps)` from
  `src/gmail/alertFetch.ts`. This task extends `tests/helpers/fakeImap.ts` with `readAlerts`; T013
  only adds the real type. It uses the memory stores and a recording trace, and keeps setup in a
  helper module, `tests/helpers/alertFetchSetup.ts`, so each test stays within 20 lines. 5 tests:
  - **Happy path**: 2 emails with 3 + 2 jobs give 5 stored jobs (`ats` `linkedin`, `job_id`
    `li_<id>`, `source` `Gmail alerts`, `url` `https://www.linkedin.com/jobs/view/<id>/`, and the
    email's salary as `compensation`). The summary is
    `{ emails: 2, jobs_found: 5, stored: 5, seen_again: 0, searches: 0, looked_up: 0,
    with_description: 0, alert_only: 5, not_understood: 0, unsupported: 0 }`, and one `alerts`
    trace event carries the counts. `stored` counts new rows only.
  - **Read marker**: after storing, the marker records the folder's UIDVALIDITY and the highest
    UID read. If storing throws, the marker is unchanged. The next run passes the stored marker to
    `readAlerts`. A run with no new mail keeps `last_uid` (it is never reset to null).
  - **Repeats and copies**: the same LinkedIn ID twice in one run, from a digest and a search
    alert, is stored once. A job already stored as `ats=linkedin` is only `markSeen`, so its
    description and score are kept. A job whose company and normalised title match a stored job
    from another source isn't stored.
  - **Not understood**: an email counts as `not_understood` only when it yields no jobs. A
    LinkedIn notification counts as `not_understood: 1`, and the trace event lists its
    `{ from, subject }`. An Indeed email counts as `unsupported: 1` instead, so a LinkedIn layout
    break isn't hidden. The database row stores only the counts.
  - **Gmail unusable**: `alertsUsability(row, key)` from `src/gmail/alertJobs/usable.ts`, a pure
    function also used by `src/app/run.ts`, gives the contract's fixed notes for: not
    connected, needs reconnecting, a missing key, an invalid key, and a key that can't open the
    password. `fetchAlerts` throws `AlertsUnavailable(note)` for those, and for `unreachable` and
    `unknown`. Nothing is stored or read, and `bad_login` also moves the connection to
    needs_reconnect.
- [X] T008 [US1] **Unit** (after T003 and T007, whose fixtures and fake it uses): 4 tests in
  existing files, plus 1 in `tests/config.test.ts`:
  - **`tests/listSources.test.ts`**: "Gmail alerts" is always listed with `kind: "alerts"`. When
    `context.gmail.usable` isn't `true`, it shows `fetch_failed: true` and the fixed `note`, both
    before any `fetch_jobs` and after one. When a fetch throws `AlertsUnavailable`, the same
    holds.
  - **`tests/fetchJobs.test.ts`**: `fetch_jobs("Gmail alerts")` pages all unscored alert jobs,
    including ones left unscored by an earlier run (the outcome has `seen: null`), with the
    `alerts` summary on the page.
  - **`tests/recordMatches.test.ts`**: recording a verdict for an `ats=linkedin` job with no
    description appends "scored from the alert only (no description)" to its gaps at any score.
    Other jobs get no such gap.
  - **`tests/pageData.test.ts`**: a scored "Gmail alerts" job at or above the threshold appears in
    Recommended (FR-003).
  - **`tests/config.test.ts`**: a company or saved search named "Gmail alerts" (any case) is
    refused, since that name is reserved for the alerts source.
- [X] T009 [US1] **Unit, changed in place (+0)**: in `tests/gmailConnection.test.ts`, the
  disconnect test also asserts the alert read marker is cleared (the `deps()` helper gains
  `alerts`).

#### Implementation

- [X] T010 [US1] Create the pure modules:
  - **`src/gmail/alertJobs/parse.ts`**: `parseAlert`, the layouts from research R1, the money
    pattern and the canonical URL
  - **`src/gmail/alertJobs/read.ts`**: `alertSearch` (reusing `alertQuery`'s sender part from
    `src/gmail/alerts.ts`) and `unreadUids`
  - **`src/gmail/alertJobs/usable.ts`**: `ALERTS_SOURCE = "Gmail alerts"`, the fixed notes
    (contract), `alertsUsability(row, key)` and `AlertsUnavailable`

  `src/gmail` is where `ALERTS_SOURCE` lives. `src/tools`, `src/web` and the config schema
  import it from there. In `src/config/schema.ts`, `hasUniqueSourceNames` also refuses the
  reserved name. T004 and T005 pass.
- [X] T011 [US1] Write migration `src/db/migrations/003_gmail_alerts.ts` creating
  `gmail_alert_state` (data-model.md: `id TINYINT PK`, `uid_validity BIGINT NULL`,
  `last_uid BIGINT NULL`, `last_run_at VARCHAR(32) NULL`, `emails_read INT NOT NULL DEFAULT 0`,
  `jobs_found INT NOT NULL DEFAULT 0`, `not_understood INT NOT NULL DEFAULT 0`, `utf8mb4_bin`).
  - Before writing it, confirm with read-only queries that neither `myjobbot` nor
    `myjobbot_test` has a `003_*` step recorded (006 lesson).
  - List it in `src/db/migrations/index.ts` and add it to `src/db/schema.ts`.
  - Add the table to `TABLES` in `tests/helpers/testDb.ts`.
  - Update `tests/integration/migrate.test.ts`: the steps become `001_initial`, `002_gmail`,
    `003_gmail_alerts`, and the collation list becomes `api_calls`, `gmail_alert_state`,
    `gmail_connection`, `jobs`, `verdicts`.
  - Parse the BIGINT columns with `z.coerce.number()`.
- [X] T012 [US1] Add the stores:
  - `AlertStore` (`state`, `recordRead`, `clear`) and `Stores.alerts` in `src/db/store.ts`
  - `src/db/kysely/alertStore.ts`, wired in `src/db/kysely/stores.ts`
  - `tests/helpers/memoryAlertStore.ts`, added to `memoryStores()`
  - `JobStore` gains `companiesWithTitleOutside(source, normalizedTitle)` and
    `markSeen(keys, seen)`. `boardCompaniesWithTitle` excludes `ats IN ('jsearch', 'linkedin')`
    (doc comment updated). All of this goes in `src/db/kysely/jobStore.ts` and
    `tests/helpers/memoryStore.ts`; if `memoryStore.ts` passes 200 lines, the new methods move to
    a helper module.

  T006 passes.
- [X] T013 [US1] Job model and IMAP:
  - **`src/jobs/job.ts`**: `Job.ats` gains `"linkedin"`. It is not in `ATS_NAMES`, which remain
    the configurable boards. Check every switch on `ats`.
  - **`src/gmail/imap.ts`**: `ImapApi` gains `readAlerts(request: { senders, marker, max })`,
    returning `{ uidValidity, emails: AlertEmail[] }`. Inside one session, all within `guarded()`:
    1. Open All Mail read-only. Read `uidValidity` from the opened mailbox and convert the bigint
       with `Number()`.
    2. Call `alertSearch({ senders, marker, uidValidity })`, run `client.search(search,
       { uid: true })`, and apply `unreadUids(uids, sinceUid, max)`.
    3. For each kept UID, fetch `{ envelope, bodyStructure }`, pick the `text/plain` node, then
       `download(uid, part, { uid: true })` (BODY.PEEK) and read the stream into a string.
       `AlertEmail.from` is the bare sender address.
  - The fake is extended in T007; this task only changes the real type.
- [X] T014 [US1] Create `src/gmail/alertFetch.ts`: `AlertDeps` (`gmail`, `alerts`, `store`,
  `key: SecretKeyStatus`, `imap?`, `senders`, `trace`, `now`) and `fetchAlerts(deps)`:
  1. `alertsUsability(row, key)`; when it gives a note, throw `AlertsUnavailable(note)`. These
     are the alert notes from `usable.ts`, separate from 006's `check.ts` wording.
  2. `readAlerts` with the stored marker
  3. `parseAlert` each email
  4. drop repeats within the run by LinkedIn ID
  5. split the rest into stored (`ats=linkedin`, so `markSeen`) and new
  6. drop new jobs matching `companiesWithTitleOutside`
  7. `upsertAll(new, now, ALERTS_SOURCE)`, with `job_id` `li_<id>`
  8. `alerts.recordRead`, only after storing
  9. one `alerts` trace event (`not_understood` gets `{ from, subject }` here only)

  Returns the summary (the contract's fields). Keep each function within 20 lines. If the file
  nears 200 lines in S2, the lookup step moves to `src/gmail/alertLookupStep.ts`. T007 passes.
- [X] T015 [US1] Agent wiring:
  - **`src/app/run.ts`**:
    - `runOnce` computes `secretKeyStatus(environment)` from the raw environment
      (`config.env` has the key stripped by `envSchema`).
    - `runWithStores`, already async, loads the Gmail row and computes
      `alertsUsability(row, key)`. It puts both, as `gmail: { key, usable }`, into the `RunParts`
      bundle it already passes, so `buildContext` keeps 3 parameters and stays synchronous.
  - **`src/tools/context.ts`**:
    - `ToolContext` gains `gmail: { store, alerts, key, imap?, usable: true | string }` and
      `trace: Trace` (the run trace, as well as `jobLog`).
    - `RunState.failedFetches` becomes `Map<string, string | null>` (name to note). Update every
      `.add`, `.has` and `.delete` call.
  - **`tests/helpers/context.ts`**: `testContext()` defaults `gmail.usable` to
    `"Gmail not connected"`, so existing finish paths treat the alerts source as already failed.
  - **`src/tools/sources.ts`**: `Source` gains `{ kind: "alerts"; name: ALERTS_SOURCE }`, which
    `configuredSources` always appends; it stays synchronous.
  - **`src/tools/listSources.ts`**: `sourceStatus` reports the alerts kind as
    `fetch_failed: true` with `note` whenever `context.gmail.usable` isn't `true` or
    `failedFetches` has a note for it, before and after any fetch. `notFetched` shows a stored
    note for any source. The description names the alerts source.
  - **`src/tools/alertSource.ts`** (new):
    - when `usable` isn't `true`, or a failure is already recorded, it throws
      `AlertsUnavailable(note)` without reading
    - otherwise it calls `fetchAlerts` once per run and returns `{ seen: null, note: null,
      alerts }`
    - `FetchOutcome` gains `alerts?`
  - **`src/tools/fetchJobs.ts`**: `fetchOnce` routes `kind: "alerts"` to `alertSource`. Its catch
    records `failedFetches.set(name, error instanceof AlertsUnavailable ? error.note : null)`;
    the existing cache delete stays, because the recorded failure stops a retry. The page adds
    `alerts` (contract). The tool description names "Gmail alerts".
  - **`src/tools/recordMatches.ts`**: for `ats=linkedin` jobs with a null description, the gap
    is appended at any score (the store's `findJob` tells it).
  - **`src/agent/prompt.ts`**: line 10 reads "company job boards, saved job searches and Gmail
    alerts". Update any prompt test that pins the text.
  - **`src/web/pageData.ts`**: `sourceNames` includes `ALERTS_SOURCE` (FR-003).
  - **Existing tests, changed in place (+0)**: `tests/listSources.test.ts` (lines 14–36),
    `tests/searchSources.test.ts:120` and `tests/finish.test.ts:11` now expect the "Gmail alerts"
    entry (failed, with its note). Finish, run and e2e tests stay green through `testContext()`'s
    default.

  T008 passes.
- [X] T016 [US1] Disconnect clears the read marker:
  - In `src/gmail/connection.ts`, `GmailDeps` gains `alerts`, and `disconnect(deps)` also calls
    `deps.alerts.clear()`. `keyChanged` narrows its parameter to `Pick<GmailDeps, "key">`, so
    `web/app/settings/page.tsx:27` still typechecks.
  - `web/lib/gmailDeps.ts` supplies `alerts`, through `web/lib/uiState.ts`, which exposes the
    alert store.

  T009 passes.
- [X] T017 [US1] Run both checks; fix findings; update the ledger. Then close S1: delete the
  marker and commit ("Read LinkedIn alert emails into jobs (007 S1)").

S1 notes (2026-10-16):
- **Results**: node 273 (+25), dom 30, integration 29 (+6). The +25 is one more than the ledger:
  the usability check got its own test.
- **Parsing changed from the plain-text part to the HTML part.** A further structure-only probe
  (lengths, word counts, separator names; no text) showed the plain-text lines can't reliably be
  told apart by position.
  - In the HTML of both LinkedIn layouts, each job has an image link and a text link to
    `/jobs/view/<id>` whose text is the title.
  - The next `<p class="text-system-gray-100 …">` holds "Company &middot; Location".
  - Any later such paragraph may hold a salary.
  - `readAlerts` downloads the `text/html` part (BODY.PEEK); `src/gmail/alertJobs/html.ts`
    decodes entities.
- **Smaller decisions**:
  - `ALERTS_SOURCE` lives in its own tiny module, `src/gmail/alertJobs/source.ts`, so the config
    schema can import it without pulling in `node:crypto`.
  - `readAlerts` is in `src/gmail/imapAlerts.ts`, and a shared `withAllMail` helper takes the
    read-only lock.
  - Alert storage is in `src/gmail/alertStore.ts`.
  - `clear()` deletes the alert-state row.
- **Production untouched**: neither database had a `003` step before the migration was written.

**Checkpoint**: US1 is complete. Alert jobs flow in, are scored from the email, and reach
Recommended.

---

## Phase 3: User Story 2, scored on the full description (P2)

**Goal**: one JSearch search per alert email, within the left-over budget, filling in
descriptions by LinkedIn ID or by company and title.

**Independent Test**: with the routed HTTP fake returning a JSearch page for each email query, a
run looks up each email once, gives matched jobs their description, and leaves unmatched ones
marked "alert only". With the allowance at 0, no lookup is made.

### Sitting S2: batched lookups (T018–T023)

Create `.specify/sitting-in-progress` naming S2 before T018.

- [X] T018 [P] [US2] **Unit**: write `tests/alertLookup.test.ts` for `src/gmail/alertJobs/lookup.ts`.
  5 tests:
  - `planQuery({ alert, pending })` (`pending` is the email's jobs still needing a description
    after de-duplication and filtering) for a search alert is its keywords, plus "in <location>"
    when at least half of `pending` share one location
  - for a digest, it is the most common normalised title in `pending`, plus "in <location>" by
    the same at-least-half rule
  - an empty `pending` (all already stored, filtered by title, or from an excluded company) gets
    no plan
  - `matchResults(jobs, results)` matches first by LinkedIn ID: the trailing digits of the
    `/jobs/view/` path segment in a result's `url` (`fetchJsearch` puts `job_apply_link` there),
    so both `/jobs/view/<id>` and `/jobs/view/<slug>-<id>` match
  - then by normalised company and title; a result never matches two jobs; unmatched jobs stay
    without a description, and a matched job's salary is used only when the email had none
- [X] T019 [P] [US2] **Unit**: write `tests/alertBudget.test.ts` for
  `src/gmail/alertJobs/budget.ts`. 2 tests:
  - `lookupAllowance({ cap, usedThisMonth, searches, refreshHours, now })` is
    `cap − used − Σ ceil(hours left / (refresh_hours − REFRESH_GRACE_HOURS))`, floored at 0
  - with no saved searches the reserve is 0, and on the last hour of the month it is 1 per search
- [X] T020 [P] [US2] **Unit**: add 2 tests to `tests/alertFetch.test.ts`, using
  `tests/helpers/http.ts`'s `routedHttp` and the existing `jsearch.json` fixture shape (no new
  fake):
  - **One request per email**: 3 emails give at most 3 searches, each recorded in `api_calls` as
    `jsearch` with source `Gmail alerts`. Matched jobs are stored with the description,
    requirements and skills. The summary counts `searches` (requests), `looked_up` (jobs sent to
    lookup), `with_description` and `alert_only`. A job failing the title filter causes no lookup.
    One shared `routedHttp` body serves every query (it routes by host).
  - **Allowance and failures**: an allowance of 1 looks up only the newest email. A JSearch
    error, or a missing `JSEARCH_API_KEY`, leaves the jobs stored without a description, and the
    run carries on.
- [X] T021 [US2] Create `src/gmail/alertJobs/lookup.ts` and `src/gmail/alertJobs/budget.ts`.
  Lookups reuse `fetchJsearch` from `src/sources/jsearch.ts` with a synthetic search
  (`{ name: "Gmail alerts", query, remote_only: false, country: "us" }`) and
  `date_posted: "7days"`, adding no new HTTP code. T018 and T019 pass.
- [X] T022 [US2] In `src/gmail/alertFetch.ts`, add the lookup step between de-duplication and
  storing:
  - `AlertDeps` gains `jsearch` (`http`, `apiKey`, `settings`), `apiCalls`, `filters`
    (`title_filter`, `exclude_companies`), `searches` and `usedThisMonth`
  - `src/tools/alertSource.ts` computes `usedThisMonth` with `requestsThisMonth(context)` and
    passes the number in, so `src/gmail` never takes a `ToolContext`
  - the step filters, plans, takes the allowance (at most one search per email, newest first),
    matches, then stores

  If `alertFetch.ts` nears 200 lines, this step goes in `src/gmail/alertLookupStep.ts`. T020 passes.
- [X] T023 [US2] Run both checks; fix findings; update the ledger. Close S2: delete the marker and
  commit ("Look up alert jobs through JSearch in batches (007 S2)").

S2 notes (2026-10-16):
- **Results**: node 282 (+9), dom 30, integration 29, matching the ledger.
- **Where the lookup lives**: `src/gmail/alertLookupStep.ts`, as planned. Storage is split into
  `sortAlertJobs` (merge repeats, `markSeen` known jobs, drop copies), then the lookups, then
  `alertJobRecord` and `upsertAll`.
- **Failed searches**: a failed JSearch search counts as finding nothing (only a `TypeError`, a
  programming error, is rethrown), and its request is still logged against the budget.
- **Usage counting**: `alertSource.ts` computes this month's usage and passes it in, so
  `src/gmail` never reads the tool context.

---

## Phase 4: User Story 3, see what the alerts produced (P3)

### Sitting S3: last-run line in the Gmail panel (T024–T027)

Create `.specify/sitting-in-progress` naming S3 before T024.

- [X] T024 [P] [US3] **Unit, changed in place (+0)**: in `tests/gmailPanel.test.ts`, the connected
  test asserts that, with an alert state, the view's `lastRun` matches the contract's string
  ("Last run <YYYY-MM-DD HH:mm>: 3 alert emails, 14 jobs, 1 not understood", time loosely
  matched), and that singulars read "1 alert email, 1 job". With no state, or when not connected, it is null.
- [X] T025 [P] [US3] **UI, changed in place (+0)**: in `tests/client/gmailPanel.test.tsx`, the
  connected test asserts the last-run line is shown.
- [X] T026 [US3] Changes:
  - **`src/web/gmailPanel.ts`**: `gmailPanelView(row, context)` takes the alert state through
    `context` and returns `lastRun`.
  - **`web/app/settings/page.tsx`**: reads `alerts.state()` through `getUiState()`.
  - **`web/components/settings/GmailPanel.tsx`**: shows the line.
  - **`tests/client/settings.test.tsx`**: the mock gains `alerts`.

  T024 and T025 pass.
- [X] T027 [US3] Run both checks; update the ledger. Close S3: delete the marker and commit
  ("Show the last alert run in the Gmail panel (007 S3)").

---

## Phase 5: Polish, with the owner

### Sitting S4: docs, review, live run, PR (T028–T033)

Create `.specify/sitting-in-progress` naming S4 before T028.

- [ ] T028 [P] Docs:
  - **`README.md`**:
    - the Gmail section says runs now read LinkedIn alerts into jobs
    - "Gmail alerts" is added to "The five tools" and "One run, start to finish"
    - the budget sharing, the 50-email cap and the Indeed limitation are noted
    - the `gmail.alert_senders` config row (README line 510) says the list is used by runs as well
      as by Check now, and that "Gmail alerts" is a reserved source name
  - **`CLAUDE.md`**: the Gmail note gains `src/gmail/alertJobs/` and the read-only, plain-part-only
    rule.
- [ ] T029 Run a read-only review agent over `git diff main`. It checks:
  - no email text stored (only job fields), and subjects only in trace files
  - mail opened read-only, with plain parts fetched with PEEK
  - at most one JSearch request per email, within the allowance
  - the read marker advances only after storing
  - imapflow's `logger: false` everywhere
  - `src/` never imports `web/`
  - the key comes from the raw environment

  Fix confirmed findings test-first.
- [ ] T030 Live run with the owner on `myjobbot_test`, with production untouched, after the last
  `npm run check:db` (which empties the test tables):
  1. Connect Gmail on the test database: `MYJOBBOT_DB_NAME=myjobbot_test npm run web`, then
     Settings → Connect with the app password.
  2. Copy this month's `jsearch` rows from production `api_calls` into `myjobbot_test` with a
     guarded one-off script, so the budget the test run sees is real.
  3. Run `MYJOBBOT_DB_NAME=myjobbot_test npm start -- run`.
  4. Check quickstart steps 3–8 against the trace and `myjobbot_test`, ending with the
     disconnect step (SC-004).
  5. Record only counts in Notes: emails, jobs found, stored, looked up, with description (the
     SC-003 ratio), not understood. Never job or email text (owner rule, 006).
- [ ] T031 Fix anything T030 finds (test-first), or record it as follow-up.
- [ ] T032 Close S4: both checks green; delete the marker; commit; push; open the PR with the
  owner's OK.
- [ ] T033 After the owner merges:
  1. Update `main` and run `npm run docker:up` (which migrates production to `003`).
  2. The next scheduled run reads the alerts.
  3. Confirm the panel's last-run line and the Gmail alerts jobs in All jobs, recording counts
     only.
  4. A week later, compare the `api_calls` rows with source `Gmail alerts` against the jobs looked
     up in that week's `alerts` trace events. SC-002 asks for at least 2 times fewer requests. If
     it falls short, or the description share misses SC-003's 70%, the owner decides on a
     follow-up.

---

## Dependencies & Execution Order

- **Sittings**: S0 → S1 → S2 → S3 → S4 → T033 (after the merge).
- **Within S1**:
  - Tests first: T003, then T004, T005 and T006 [P].
  - Then T007, which extends the fake IMAP client, then T008 and T009.
  - Then T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017.
- **Within S2**: T018 to T020 [P], then T021 → T022 → T023.
- **Within S3**: T024 and T025 [P], then T026 → T027.
- **Story dependencies**: US2 extends US1's fetch; US3 reads US1's state. Each can be checked
  independently with its tests.

## Parallel Example: Sitting S1

```text
Task: "Parser tests in tests/alertParse.test.ts"                        (T004)
Task: "Read-decision tests in tests/alertRead.test.ts"                  (T005)
Task: "Alert-state and alert-job contracts in tests/helpers/"           (T006)
```

These run after T003's fixtures. T007 (which extends the fake IMAP client), T008 and T009 follow
in sequence.

## Implementation Strategy

- **MVP**: S1. Alert jobs arrive, are scored from the email, and reach Recommended.
- **Then S2**: descriptions through batched JSearch lookups, for better scores.
- **Then S3**: the panel line.
- **Then S4**: docs, review and the live run.
- **Rollback**: revert while keeping `003_gmail_alerts.ts` and its index entry, or delete its
  `kysely_migration` row and `DROP TABLE gmail_alert_state`, as in 006's research R7 and its
  tasks.md Rollback. Stored alert jobs are
  ordinary rows and age out by `job_retention_days`.

## Test mix ledger (constitution Principle II, 95/4/1)

| | Unit (node) | Integration | UI (dom) |
|---|---|---|---|
| Baseline (T002) | 248 | 23 | 30 |
| S1 | +24 (parse 6, read 2, alert-state contract 3 + alert-job contract 3 on the fake, fetch 5, tools and page 4, reserved name 1; disconnect and existing list and finish tests in place) | +6 (both contracts on MariaDB) | 0 |
| S2 | +9 (lookup 5, budget 2, fetch 2) | 0 | 0 |
| S3 | 0 (in place) | 0 | 0 (in place) |
| Expected end | 281 | 29 | 30 |

The unit share moves from 82.4% to about 82.7% (281 / 29 / 30). Every contract case also runs
on MariaDB, as the project's store rules require.

## Notes

- **Email content**: never print or record email or job text from the owner's mailbox. Counts
  only.
- **Production**: the stack stays stopped from S0 until T033. Production gets `003` only at
  T033's `docker:up`.
