# Contract: Storage settings, commands and store interfaces

## Environment (`.env`, never committed)

| Variable | Required | Default | Used by |
|---|---|---|---|
| `MYJOBBOT_DB_HOST` | yes | — | agent, web, tests |
| `MYJOBBOT_DB_PORT` | no | `3306` | agent, web, tests |
| `MYJOBBOT_DB_NAME` | no | `myjobbot` | agent, web |
| `MYJOBBOT_DB_USER` | yes | — | agent, web, tests |
| `MYJOBBOT_DB_PASSWORD` | yes | — | agent, web, tests; never printed |
| `MYJOBBOT_TEST_DB_NAME` | no | `myjobbot_test` | integration tests only; the test helper refuses any name not ending in `_test` |

Errors name the variable (`MYJOBBOT_DB_HOST is not set`) or the problem (`MariaDB at
192.168.3.10:3306 rejected user myjobbot`). They never contain the password.

## Commands

| Command | Does |
|---|---|
| `myjobbot run` | As today. Connects (3 tries, 10 s apart), runs pending schema steps, runs the agent, closes the pool |
| `myjobbot import-sqlite <path>` | The one-time copy (research R7). Prints per-table counts. Exit 0 on success. Exit 1, with nothing written, if the target isn't empty, a row doesn't fit, or the counts or sample don't match |
| `npm test` | Unit and UI projects, plus the integration project against `MYJOBBOT_TEST_DB_NAME`. If the test database is unreachable, only the integration tests fail, each saying why |

## Store interfaces (`src/db/store.ts`)

All methods are async. Their behaviour is today's, pinned by `tests/helpers/storeContract.ts`.

| Interface | Methods |
|---|---|
| `JobStore` | `upsertAll(jobs, seen, source)`, `unscoredSince(source, seen)`, `unscoredForSource(source)`, `boardCompaniesWithTitle(normalizedTitle)`, `recordVerdict(verdict, stamp) → boolean`, `earliestSeen(company, normalizedTitle)`, `pruneLastSeenBefore(cutoff) → number`, `findJob(jobId)` |
| `JobViews` | `scoredFrom({ sources, minScore })`, `setHidden({ ats, jobId, hidden }) → boolean`, `allJobs(page)`, `countAllJobs()`, `verdictHistory(page)`, `countVerdicts()` |
| `ApiCallLog` | `record(api, source, calledAt)`, `lastCallAt(api, source)`, `countSince(api, since)`, `pruneBefore(cutoff)` |

## Web UI

- **Footer**: shows `myjobbot @ <host>` (database and host), in place of the SQLite path.
- **Unreachable server**: a page that can't reach the server shows the error page with the
  connection message.
- **Unchanged**: pages, Hide and their speed targets.
