# Research: MariaDB Storage

**Method.** Each unknown was settled with a spike on 2026-10-14, using throwaway projects in the
scratchpad. Nothing in the repository changed. The spikes ran against the real `myjobbot_test`
database on the owner's MariaDB 10.11.14 server at 192.168.3.10. Results are quoted below.

## R1. Library and driver

- **Decision**: Kysely 0.29.6 with its built-in MySQL dialect over **mysql2 3.24.6**, both
  exact-pinned.
- **Rationale**:
  - The owner chose Kysely after comparing it with Umzug, Postgrator, Drizzle and Knex, and wants
    typed queries as well as migrations.
  - Kysely's MySQL dialect is built on mysql2's connection pool, and works with MariaDB.
  - mysql2 is MIT-licensed, released 2026-10-13, and has 7 small dependencies. Kysely has none.
- **Alternatives considered**: the `mariadb` connector, which Kysely doesn't support directly.
- **Approval (constitution IV)**: the owner approved Kysely, and approved mysql2 as the driver on
  2026-10-14.

## R2. Character set and comparison rules

- **Spike evidence**:
  - The server's default is `latin1`, and it ignores the character set a client asks for at
    connect time. Without an explicit setting, `é` was stored double-encoded (`C383C2A9`).
  - With `SET NAMES utf8mb4 COLLATE utf8mb4_bin`, run in Kysely's `onCreateConnection` hook, the
    connection reported `utf8mb4` / `utf8mb4_bin`. `Zürich C++ 🚀` round-tripped byte-for-byte
    (`…F09F9A80…`).
  - With tables created `DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`, `abc` and `ABC` were stored
    as two rows, and a lookup for `abc` found exactly one.
- **Decision**:
  - Every connection runs `SET NAMES utf8mb4 COLLATE utf8mb4_bin`.
  - Every table is created `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`.
- **Rationale**: SQLite compares text byte for byte, so `utf8mb4_bin` on whole tables keeps every
  comparison, uniqueness rule and sort order exactly as today. That covers more than the spec's
  minimum list of identifier columns: titles, companies and sources match exactly too, as they do
  now. The databases keep their `utf8mb4_general_ci` default, so they stay identical to each other
  as the owner wanted, and the tables don't depend on that default.
- **Alternative considered**: binary comparison on identifier columns only. Rejected: company and
  source equality checks would quietly become case-insensitive, which changes behaviour.

## R3. SQLite-only SQL

Four statements need MariaDB forms. All were checked on the server.

| Today (SQLite) | MariaDB 10.11 | Checked |
|---|---|---|
| `INSERT … ON CONFLICT (ats, job_id) DO UPDATE SET x = excluded.x` | Kysely `.onDuplicateKeyUpdate({ x: eb => eb.fn("VALUES", [eb.ref("x")]) })` | Spike: the second insert updated the title and `last_seen` |
| `UPDATE … RETURNING ats` (in `recordVerdict`) | `SELECT ats … FOR UPDATE`, then `UPDATE`, in one transaction. MariaDB has `RETURNING` on `INSERT` and `DELETE` only | Plan; covered by a contract test |
| `MIN(MIN(first_seen), COALESCE(MIN(posted_at), MIN(first_seen)))` | `LEAST(MIN(first_seen), COALESCE(MIN(posted_at), MIN(first_seen)))` | Spike: returned the earliest value |
| `verdicts.rowid` | An `id BIGINT UNSIGNED AUTO_INCREMENT` primary key. The copy sets `id` from SQLite's `rowid`, keeping the order | Plan |

Other differences:
- Updated-row counts come back as BigInts (`1n`); wrap them in `Number()`.
- `mysql2` should be created with `dateStrings: true`, so the ISO-text columns come back as plain
  strings.

## R4. Column types

Measured on the real data (2026-10-14):

| Column | Longest today | Type chosen |
|---|---|---|
| `ats` | 7 | `VARCHAR(32)` |
| `job_id` | 36 | `VARCHAR(255)` |
| `company`, `source` | 44, 24 | `VARCHAR(255)` |
| `title`, `normalized_title` | 120, 116 | `VARCHAR(500)` |
| `url` | 175 | `VARCHAR(2048)` |
| timestamps (`posted_at`, `first_seen`, `scored_at`, …) | 24 | `VARCHAR(32)`: ISO-8601 text, as today |
| `description` | 13,736 | `MEDIUMTEXT` |
| `reasons`, `gaps`, `requirements`, `skills`, `preferred_skills` | 445 | `TEXT` (JSON lists, as today) |
| `score`, `base_score`, `bonus_score` | — | `INT NULL` |
| `hidden`, `is_remote` | — | `TINYINT` |

- **Indexes**: `PRIMARY KEY (ats, job_id)` is 287 characters, 1,148 bytes; `(company,
  normalized_title)` is 3,020 bytes, inside InnoDB's 3,072-byte limit. `(source, scored_at)`,
  `api_calls (api, called_at)` and `verdicts (scored_at)` are small.
- **Timestamps stay text**, as today. Every value is ISO-8601 UTC (`2026-08-11T17:38:11.368Z`), so
  text order is time order and nothing involving time zones changes. Moving to `DATETIME` is a
  later, separate step, and now a cheap one.

## R5. Migrations and starting up together

- **Decision**:
  - Kysely's `Migrator` with migrations listed in code, not loaded from a folder, so Next.js and
    tsx need no file scanning.
  - `001_initial` creates today's full schema directly. There is no add-columns history to replay,
    because the data arrives by copy.
  - Both the agent and the web app run `migrateToLatest()` once per process before their first
    query.
- **Spike evidence**: two processes started `migrateToLatest()` at the same instant. One printed
  `001_probe Success`, the other `nothing`. Kysely's MySQL adapter takes a server-side lock.
- **Retired**: `addMissingColumns`, `AFTER_COLUMNS` and `backfillVerdicts` in `src/db/open.ts`,
  which only existed to upgrade old SQLite files. The copy (R7) brings the data across.

## R6. Next.js and mysql2

- **Spike evidence**: a scratch Next.js 16.4.0 app with a server component querying MariaDB
  through Kysely and mysql2 compiled with no `serverExternalPackages` setting. It rendered
  `10.11.14-MariaDB` under both `next start` and `next dev`.
- **Decision**:
  - No extra Next.js configuration.
  - The web app creates its pool once per server process, cached on `globalThis` like today's
    `JobViews`, so dev reloads don't open new connections.
  - The pool is small (`connectionLimit: 4`).

## R7. The one-time copy

- **Decision**: a CLI command `myjobbot import-sqlite <path>`. It:
  1. opens the SQLite file read-only, with `node:sqlite`
  2. refuses unless the target's `jobs`, `verdicts` and `api_calls` tables are empty
  3. checks every row against the column limits from R4, and stops with a list if any would not
     fit, so nothing is silently truncated
  4. inserts everything inside **one** MariaDB transaction, in batches of 500, with verdict `id`s
     taken from SQLite's `rowid`
  5. compares per-table counts and a sample of 50 jobs and 50 verdicts field by field, and only
     then commits
  6. prints the counts
- **Rationale**: one transaction makes the copy all-or-nothing (spec US2.3). Refusing a non-empty
  target makes running it twice safe (US2.2).
- **When**: once, during the switch-over, with the agent stopped.

## R8. Unreachable server and credentials

- **Decision**:
  - Settings come from `MYJOBBOT_DB_HOST`, `MYJOBBOT_DB_PORT` (default 3306), `MYJOBBOT_DB_NAME`
    (default `myjobbot`), `MYJOBBOT_DB_USER` and `MYJOBBOT_DB_PASSWORD`, all in `.env` and
    checked with zod.
  - A missing setting names the variable. A rejected login says so without the password.
  - The agent tries to connect 3 times, 10 s apart (a plain, unit-tested schedule), then ends the
    run with a clear message before any work. The next scheduled run tries again.
  - The web app's first query failing reaches `error.tsx` with the same message.
- **Rationale**: runs are idempotent and scheduled every 8 hours, so failing cleanly beats long
  waits.

## R9. Making most tests unit tests

- **Decision**:
  1. **Store interfaces.** `src/db/store.ts` defines `JobStore`, `JobViews` and `ApiCallLog` as
     TypeScript interfaces with async methods. The Kysely classes implement them.
  2. **An in-memory fake** in `tests/helpers/memoryStore.ts` implements the same interfaces over
     arrays. Every agent-tool, page and run test uses it, which turns today's 94 SQLite-backed
     tests into unit tests.
  3. **One contract suite** (`tests/helpers/storeContract.ts`) states each method's behaviour
     once, covering ordering, filters, upsert refresh, verdict history, pruning, case-exact
     identifiers and hidden flags. It runs twice: against the fake as unit tests, and against
     MariaDB as integration tests, so the fake can't drift from the real queries. About 12 cases.
  4. **Pure parsing.** Config parsing gets a pure `parseFileConfig(text)` beside
     `loadFileConfig`, so most of `config.test.ts` (22 tests) becomes unit tests and only 1 (the
     leftover-YAML check) still reads files.
  5. **A separate test project.** The MariaDB tests live in `tests/integration/` and run in their
     own vitest project with files run one at a time. Each test starts by emptying the tables, so
     they never see each other's rows.
- **Spec amendment**: FR-009 says integration tests "MUST be able to run in parallel". They run in
  parallel with the unit and UI projects, but one at a time among themselves, because all of them
  share the one `myjobbot_test` database and this account can't create databases. With about 25
  tests that's a few seconds.
- **Projected mix** (about 275 tests):

  | Kind | Now | After |
  |---|---|---|
  | Unit | 72 (31%) | ~225 (82%) |
  | Integration | 135 (57%) | ~27 (≤10%): contract 12, migrate and collation 2, import 3, config file 1, walkthrough 3, LLM server 3, CLI 2 |
  | UI | 29 (12%) | ~23 (≤9%): load-more and dedupe cases move to unit tests of `pageRows.ts` |

  That meets the spec's at least 80/10/10. The rest of the way to 95/4/1 means fewer
  file-and-process tests, such as folding the CLI and walkthrough checks; the next features
  should do that.

## R10. Agent isolation and Docker

- **Agent isolation is unchanged**: `src/` still never imports `web/` or `next`.
- **Docker**: no new service and no compose changes beyond the environment. Both containers
  already reach 192.168.3.10:3306 (checked 2026-10-14), and read `MYJOBBOT_DB_*` from `.env`
  through `env_file`.
- **`data/` stays mounted** for `config.json`, `resume.md`, `runs/` and the SQLite backup.

## R11. Dependencies and the lockfile

- **Packages**: `kysely` 0.29.6 and `mysql2` 3.24.6, both exact-pinned. mysql2 brings 7 small
  dependencies.
- **Install**: through `npm install --save-exact`, then the optional-package count check
  (8 swc, 15 rolldown, 28 img).
- **Rebuild**: the Docker image must be rebuilt before the switch-over (`npm run docker:up`, with
  no run in progress), because `node_modules` is built into the image.
