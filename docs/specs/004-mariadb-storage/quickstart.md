# Quickstart: checking MariaDB storage

## Setup

Add to `.env` (never commit it):

```bash
MYJOBBOT_DB_HOST=192.168.3.10
MYJOBBOT_DB_USER=myjobbot
MYJOBBOT_DB_PASSWORD=…
```

## Automated

```bash
npm run check
```

Tests must show:

| Area | Scenario | Expected |
|---|---|---|
| Contract, fake (unit) and MariaDB (integration) | Upsert refresh keeps `first_seen`, score and `hidden`; newest-first order; recommended filter; verdict history order and ties; pruning removes orphan verdicts; `abc` and `ABC` are two jobs; `Zürich C++ 🚀` round-trips; the monthly count | Same results from both implementations |
| Migrations | Empty test database, then run again | Every step runs once; the second run does nothing |
| Collation | `myjobbot` and `myjobbot_test` | Same character set and collation |
| Import | Copy a seeded SQLite file; copy again; a file with an over-long value | Counts match; second copy refused; nothing written |
| Settings | Missing variable; wrong password | The message names the variable or problem, never the password |
| Mix | Classify the suite | At least 80% unit, at most 10% integration, at most 10% UI |

## Manual (switch-over, with the agent stopped)

1. `docker compose top myjobbot` shows no run in progress, and `docker:watch` is stopped.
2. Snapshot `<main>` of `/recommended`, `/jobs` and `/reasoning`, without the footer, scripts and
   the "N days open" / "possible ghost" text (tasks T039, step 2).
3. Back up SQLite: `sqlite3 data/myjobbot.db ".backup 'data/myjobbot-pre-mariadb.db'"`.
4. Add the `MYJOBBOT_DB_*` lines to the main `.env`.
5. `npm start -- import-sqlite data/myjobbot-pre-mariadb.db` prints counts equal to:
   `sqlite3 -readonly data/myjobbot-pre-mariadb.db "select count(*) from jobs; select count(*) from verdicts; select count(*) from api_calls"`.
6. Merge, update `main` (pull before switching), and run `npm run docker:up` to rebuild with the
   new packages.
7. Snapshot the three pages again the same way and `diff` them against step 2's: identical.
   Hidden jobs stay hidden.
8. `docker compose run --rm myjobbot run` completes, and its new rows appear in MariaDB.
9. Stop the server briefly (or point `MYJOBBOT_DB_HOST` at a dead address in a scratch shell). A
   run ends after 3 tries with a clear message, and the UI shows its error page.
