# Implementation Plan: Jobs from Gmail job alerts

**Branch**: `007-gmail-alert-jobs` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/007-gmail-alert-jobs/spec.md`

## Summary

The agent gains a third kind of source, "Gmail alerts", next to company boards and saved
searches. On its first `fetch_jobs` call in a run:

1. **Read new alert emails.** It reads, read-only, the LinkedIn alert emails that arrived since
   the last read (7 days on the first run, at most 50), downloading only the plain-text part.
2. **Parse them into jobs.** It parses them with one parser per layout: saved-search alerts and
   recommendation digests.
3. **Drop copies.** It drops copies of jobs already stored from other sources.
4. **Look up descriptions.** It looks them up with **one JSearch search per email**, built from
   the alert's own keywords, and matches the results by LinkedIn ID or by company and title. It
   stays inside the share of the monthly JSearch budget left after saved searches.
5. **Store them.** It stores the jobs with `ats = linkedin` and `source = Gmail alerts`.
6. **Record the read.** It records the read marker and the run's counts.

Jobs are then scored like any other. Jobs with no description are marked as scored from the
alert only. The Gmail panel shows the last run's counts.

Indeed is left for later, since the owner had no Indeed alerts to design from. Its mail counts as
"not understood".

## Technical Context

**Language/Version**: TypeScript 6.0.3, Node 24

**Primary Dependencies**: existing only: imapflow 2.3.0 (006), Kysely, zod, and the JSearch
client in `src/sources/jsearch.ts`. **No new dependencies.**

**Storage**: MariaDB. Migration `003_gmail_alerts` adds `gmail_alert_state`. Jobs reuse the `jobs`
table.

**Testing**: vitest. Unit (`node`), UI (`dom`), integration (`integration`, `myjobbot_test`).

**Target Platform**: the agent container's scheduled runs, plus the web container for the panel
line

**Project Type**: CLI agent plus web UI, sharing `src/`

**Performance Goals**: on a typical run of 2–10 alert emails, the alert fetch adds at most about
60 s (IMAP plus up to one JSearch call per email, each ≤ 5 s). A 50-email backlog can take a few
minutes once, well within the run's 120-minute cap.

**Constraints**:
- Mail is read-only and only plain parts are downloaded.
- No email text is stored (FR-010).
- At most one JSearch request per email, within the R3 allowance.
- Habit-hooks limits.
- `src/` must not import `web/`.

**Scale/Scope**: about 2–10 alert emails and 10–40 jobs a day; at most 50 emails per run.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (constitution v2.2.0)

| Principle | Status |
|---|---|
| I. Habit-hooks clean at every sitting boundary | Pass: parsing, planning, matching and budgeting are small pure modules; each sitting wires what it adds through `fetch_jobs` or the Settings page |
| II. Test-first; `check` and `check:db` | Pass: split below; fixtures are synthetic alert emails shaped like the observed layouts (research R1) |
| III. Purpose comments only | Pass |
| IV. Bounded, locked dependencies | Pass: no new dependencies |
| V. Specs live in `docs/specs` | Pass |
| Storage rules (CLAUDE.md) | Pass: numbered step `003_gmail_alerts.ts`, `schema.ts`, an alert-state contract file, `utf8mb4_bin`. Before any migration is rewritten, both databases are checked (lesson from 006). |
| Workflow: sittings, main checkout, Docker stopped | Pass: S0 stops the stack, which runs production from this checkout, so production runs pause until the merge |

**New tests' split (Principle II)**, against node 248, dom 30, integration 23:
- **Unit**:
  - parsers: 6
  - read decisions (search and unread UIDs): 2
  - alert-state contract on the memory fake: 3
  - alert-job contract on the memory fake: 3
  - alert fetch service: 5 (happy path, read marker, repeats and copies, not understood, Gmail
    unusable)
  - tools and the Recommended page: 4
  - lookup query and matching: 5
  - budget reserve: 2
  - lookup steps in the fetch: 2
  - the reserved "Gmail alerts" source name in the config schema: 1
  - That is 33 unit (ledger in tasks.md: +24 in S1, +9 in S2). The existing list, finish and
    disconnect tests change in place.
- **Integration**: both contracts on MariaDB (6), and the migration test updated in place.
- **UI**: the Gmail panel's last-run line, folded into the existing panel test (+0).

The unit share moves from 82.4% to about 82.7% (281 / 29 / 30).

Post-design re-check: pass. No Complexity Tracking needed.

## Project Structure

### Documentation (this feature)

```text
docs/specs/007-gmail-alert-jobs/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/alert-source.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/gmail/alertJobs/
├── parse.ts         # plain part → ParsedAlert (layouts from research R1); pure
├── read.ts          # alertSearch (gmraw, uid range, 7-day fallback), unreadUids (> marker, newest 50); pure
├── usable.ts        # ALERTS_SOURCE, the fixed notes, alertsUsability(row, key), AlertsUnavailable; pure
├── lookup.ts        # planQuery per email; matchResults to alert jobs; pure
└── budget.ts        # lookupAllowance (R3, with the refresh grace); pure
src/gmail/imap.ts    # + readAlerts({ senders, marker, max }) → { uidValidity, emails }: opens, then decides the search; plain parts, read-only
src/gmail/alertFetch.ts  # fetchAlerts(deps): read → parse → merge repeats → markSeen / dedupe → lookup → store → record
src/gmail/connection.ts  # disconnect(deps) also clears the alert read marker; keyChanged takes Pick<GmailDeps, "key">
src/config/schema.ts     # "Gmail alerts" reserved as a source name
src/jobs/job.ts      # "linkedin" joins the job origins (not a board ATS)
src/sources/jsearch.ts   # unchanged; lookups reuse fetchJsearch with a synthetic search
src/app/run.ts           # raw environment → secretKeyStatus in runOnce; runWithStores settles usability into RunParts; trace on the context
src/tools/sources.ts     # + { kind: "alerts", name: ALERTS_SOURCE }, always listed
src/tools/alertSource.ts # runs fetchAlerts once per run; failures become notes; outcome seen: null
src/tools/fetchJobs.ts, listSources.ts, recordMatches.ts  # alerts source; notes; no-description gap
src/tools/context.ts     # + gmail { store, alerts, key, imap?, usable }, trace; failedFetches → Map
src/agent/prompt.ts      # sources line names Gmail alerts
src/web/pageData.ts      # Recommended includes ALERTS_SOURCE
src/db/migrations/003_gmail_alerts.ts, migrations/index.ts, schema.ts
src/db/store.ts          # + AlertStore, Stores.alerts; JobStore + companiesWithTitleOutside, markSeen
src/db/kysely/alertStore.ts
src/web/gmailPanel.ts    # + lastRun line
web/app/settings/page.tsx, web/components/settings/GmailPanel.tsx
tests/
├── alertParse.test.ts, alertRead.test.ts, alertLookup.test.ts, alertBudget.test.ts,
│   alertFetch.test.ts (unit)
├── helpers/alertEmails.ts (synthetic fixtures), alertStoreContract.ts, alertJobContract.ts,
│   memoryAlertStore.ts, fakeImap.ts (+ readAlerts); JSearch via the existing routedHttp
├── listSources / fetchJobs / recordMatches / pageData tests (+1 each),
│   gmailConnection and gmailPanel tests (in place)
└── integration/storeContract.test.ts, integration/migrate.test.ts (updated)
```

**Structure Decision**: alert logic sits in `src/gmail/alertJobs/` (pure) plus `src/gmail/alertFetch.ts`
(the service), reused by the agent tool layer in `src/tools/`. The web layer only reads the
summary.
