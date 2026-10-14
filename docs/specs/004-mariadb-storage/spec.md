# Feature Specification: MariaDB Storage

**Feature Directory**: `docs/specs/004-mariadb-storage`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Move myjobbot's storage from SQLite (node:sqlite, data/myjobbot.db) to
the owner's existing MariaDB 10.11 server at 192.168.3.10 (database `myjobbot`, integration tests in
`myjobbot_test`), using Kysely with typed queries for all database access and its migrator for
schema changes, over the mysql2 driver. Copy the existing data across once. Restructure so decisions
live in plain functions and move the test suite toward 95% unit, 4% integration, 1% UI."

## Background

Today the agent and the web UI share one SQLite file in `data/`. Its schema updates itself on every
open, but only by adding tables and columns: it keeps no record of which changes ran, and it can't
rename, drop or reshape anything.

The owner already runs a MariaDB 10.11 server on the network and wants myjobbot's data there:
- **One place for data** the owner already operates and backs up, instead of a file inside the
  checkout that git ignores and nothing backs up.
- **Real schema changes**, recorded and repeatable, through a migration tool.
- **Typed database access**, so a renamed column or a wrong value type is a compile error rather
  than a runtime surprise.

The technology is named on purpose: the owner chose MariaDB (the existing server), Kysely (typed
queries and migrations) and the mysql2 driver after comparing options.

The same feature applies the constitution's new test mix (v1.4.0: 95% unit, 4% integration, 1%
UI). Today 135 of 236 tests touch a database, files, a server or a process, and 94 of those create
an in-memory SQLite database. Moving storage is the moment to separate decisions from storage.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The agent and the UI work exactly as before, on the new server (Priority: P1)

The owner notices no difference in behaviour. Scheduled runs fetch, store and score jobs. The web
UI shows the same pages with the same rows, scores, notes and links, and Hide and Unhide still work.
The data now lives on the MariaDB server.

**Why this priority**: Moving storage must not break the product.

**Independent Test**: Run the agent once against the new store and open all four pages. Results
match what the same data showed before the move, and the SQLite file is no longer written.

**Acceptance Scenarios**:

1. **Given** the new store, **When** a scheduled run finishes, **Then** its new jobs, scores and
   verdict history are in the MariaDB database, and the run reports the same outcome it would have
   before.
2. **Given** the new store, **When** the owner opens Recommended, All jobs and Reasoning, **Then**
   every row, score, note and link matches what the old store showed for the same data.
3. **Given** a job, **When** the owner hides it and reloads, **Then** it stays hidden, and a later
   fetch of the same posting keeps it hidden.
4. **Given** job text with accents, emoji or symbols (for example "Zürich", "C++", "🚀"),
   **When** it is stored and shown, **Then** it appears exactly as fetched.
5. **Given** two job identifiers that differ only in letter case, **When** both are stored,
   **Then** they stay two separate jobs, as they did before.

---

### User Story 2 - Existing data moves across once, intact (Priority: P1)

The owner's history comes along: every job, score, reason, gap, verdict, API-call record and hidden
flag.

**Why this priority**: Weeks of fetched and scored jobs, and the owner's hide choices, must not be
lost or re-fetched (re-fetching costs API budget).

**Independent Test**: Run the copy against a copy of the real SQLite file. Row counts match per
table, and a sample of rows matches field by field.

**Acceptance Scenarios**:

1. **Given** the SQLite file, **When** the copy runs, **Then** each table has the same number of
   rows in MariaDB (today about 754 jobs, 720 verdicts, 45 API-call records and 196 hidden jobs),
   and the copy reports the counts.
2. **Given** the copy has already run, **When** it runs again, **Then** it refuses or changes
   nothing, rather than duplicating rows.
3. **Given** the copy fails partway, **When** the owner looks at the target, **Then** it is either
   complete or untouched, never half-copied.
4. **Given** the month's API-call records, **When** they are copied, **Then** the monthly request
   cap still counts them, so the move never causes extra paid requests.

---

### User Story 3 - Schema changes are recorded and repeatable (Priority: P2)

When a future feature needs a new column, a rename or a removed field, the change is written once
as a numbered step. Each database records which steps it has had, applies only the missing ones,
and applies them identically on the production and test databases.

**Why this priority**: This is the limit that started the discussion. It matters at the next schema
change, not immediately.

**Independent Test**: Apply all steps to an empty test database, then to an already-current one.
The first ends with the full schema, the second changes nothing, and both report which steps ran.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** the app starts, **Then** every schema step runs in order
   and is recorded.
2. **Given** a current database, **When** the app starts, **Then** no step runs again.
3. **Given** the agent and the web UI start at the same moment, **When** both find a pending step,
   **Then** it runs once, not twice.
4. **Given** a step that renames a column, **When** it runs, **Then** existing values are kept
   under the new name.

---

### User Story 4 - Tests are mostly fast and exact (Priority: P2)

The owner's check runs constantly. Most tests check decisions on in-memory data. A small set checks
the real queries against the test database, and a very small set checks rendered UI.

**Why this priority**: It's the constitution's new test mix, and the 94 database-bound tests are
the biggest part of today's gap.

**Independent Test**: Classify the suite after the change. The mix has moved substantially toward
95/4/1, and the integration tests that remain cover every query against the real test database.

**Acceptance Scenarios**:

1. **Given** the finished feature, **When** tests are counted by kind, **Then** unit tests are at
   least 80% of the suite, integration at most 10%, and UI at most 10%, with the plan saying how the
   rest of the gap closes.
2. **Given** an integration test, **When** it runs, **Then** it uses only the test database and
   starts from empty tables, so tests can run repeatedly, alongside the unit and UI tests.
3. **Given** the test database is unreachable, **When** the check runs, **Then** unit and UI tests
   still run and pass, and the integration tests fail with a message naming the database problem.

### Edge Cases

- **The server is unreachable** (laptop off the home network, server rebooting, network blip): a
  scheduled run retries briefly, then stops with a clear message and loses no data; the next
  scheduled run tries again. The web UI shows a clear error page, not a crash or a blank screen.
- **Wrong or missing credentials**: both the agent and the UI say which setting is missing or
  rejected, without printing the password.
- **A run and the UI write at the same moment** (a run scores a job while the owner hides it): both
  changes land; neither overwrites the other.
- **Long text** (job descriptions, model reasons): stored in full, never cut off.
- **The test database drifts** from production (different character set or comparison rules): a
  test catches it.
- **The copy finds rows the new schema would reject** (bad dates, over-long values): the copy stops
  and lists them, rather than silently dropping or truncating data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All of myjobbot's stored data (jobs, scores, verdict history, API-call records, hidden
  flags) MUST live in the `myjobbot` database on the owner's MariaDB server, for both the agent and
  the web UI. The SQLite file MUST no longer be read or written in normal operation.
- **FR-002**: All database access MUST go through Kysely typed queries, and the tables' shape MUST
  be described once in code, so a mismatch between query and schema fails the type check.
- **FR-003**: Schema changes MUST be numbered steps run by Kysely's migrator. Each database MUST
  record which steps have run. Steps MUST run once even when the agent and the web UI start
  together. The first step creates today's schema.
- **FR-004**: Text MUST be stored and returned exactly as fetched, including accents and emoji.
  Every connection MUST set its character set to `utf8mb4` explicitly, because the server ignores
  the character set a client asks for.
- **FR-005**: Identifier values (board name, job ID, run ID, URLs) MUST compare exactly, letter case
  included, as they do today. Every table MUST state its character set and comparison rules
  explicitly rather than depend on the database default.
- **FR-006**: A one-time copy MUST move every row from the SQLite file to MariaDB, report per-table
  counts, verify that they match, refuse to run into a non-empty target, and leave the target
  untouched if it fails.
- **FR-007**: The server address, database name, user and password MUST come from the environment
  (`.env`), never from committed files, and MUST never be printed in logs or errors.
- **FR-008**: When the server is unreachable or rejects the login, the agent MUST retry briefly,
  then end the run with a clear message and no partial writes. The web UI MUST show its error page
  with that message.
- **FR-009**: Integration tests MUST use only the `myjobbot_test` database and MUST each start from
  empty tables. They MUST run in parallel with the unit and UI tests, and one at a time among
  themselves, because they share that one database (research R9). A test MUST confirm that
  `myjobbot` and `myjobbot_test` use the same character set and comparison rules.
- **FR-010**: Decisions currently made inside database code (which jobs count as recommended, paging,
  hide rules, the monthly request budget, import checks) MUST live in plain functions with unit
  tests. Database code MUST be a thin layer covered by integration tests.
- **FR-011**: The new tests MUST follow the constitution's 95/4/1 mix, and existing database-bound
  tests MUST be rewritten to meet acceptance scenario 4.1.
- **FR-012**: No new Docker container. The agent and web services MUST reach the existing server
  over the network.
- **FR-013**: New dependencies (Kysely, mysql2) MUST be pinned exactly and installed through the
  lockfile, keeping every optional platform package.
- **FR-014**: The web UI's pages and Hide MUST keep their speed targets from feature 003: first rows
  within 1 second with 1,000 jobs, Hide within 0.5 seconds.

### Key Entities

- **Job**: a posting from a board or search, with its identity (board, job ID), text, posting date,
  first/last seen times, score, reasons, gaps and hidden flag.
- **Verdict**: one scoring decision for a job, with its run, time, score and reasons; the history
  behind the Reasoning page.
- **API call**: one paid search request, used to enforce the monthly cap and the refresh interval.
- **Schema step**: one numbered, recorded change to the database's shape.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the copy, 100% of rows in each table are present in the new store, with matching
  counts and a field-by-field match on a sample of at least 50 jobs and 50 verdicts.
- **SC-002**: For the same data, every page shows identical rows, scores, notes and links before and
  after the move.
- **SC-003**: Pages show their first rows within 1 second with 1,000 jobs, and Hide responds within
  half a second, on the home network.
- **SC-004**: At least 80% of tests are unit tests, at most 10% integration and at most 10% UI, and
  the full check finishes no slower than today.
- **SC-005**: Scheduled runs keep succeeding through the move, with no run lost and no extra paid
  search requests.
- **SC-006**: The next schema change (for example a column rename) needs one new numbered step and
  no hand-written repair code.

## Assumptions

- **The server is reachable whenever myjobbot runs.** The owner's MariaDB server at 192.168.3.10 is
  on the home network, as the web UI already is. Away from that network, runs fail clearly and the
  next scheduled run tries again.
- **The owner backs up the MariaDB server.** myjobbot doesn't add its own backups.
- **Both databases exist and match**: `myjobbot` and `myjobbot_test`, `utf8mb4` with
  `utf8mb4_general_ci`, with the `myjobbot` account limited to them (verified 2026-10-14).
- **Run traces and logs stay files** in `data/runs/` and `log/`; only the database moves.
- **No dual running.** After the copy, the SQLite file is kept as a read-only backup but no longer
  used. There is no period of writing to both.
- **Behaviour doesn't change.** This feature moves storage and restructures tests; it adds no new
  user-facing feature.
- **Constitution v2.0.0** applies, including the 95/4/1 test mix, the 20-line function limit and
  planning in sittings that each end green.
