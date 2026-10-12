# Quickstart: validating domain exclusion

## Automated

```bash
npm run check          # typecheck + vitest + habit-hooks, must be green
npx vitest run tests/publisherDomain.test.ts tests/companyFilter.test.ts tests/config.test.ts tests/searchSources.test.ts
```

What the tests must show (see [contract](contracts/exclude-publishers-config.md)):

| Scenario | Expected |
|---|---|
| `jobmesh.io` vs hosts `jobmesh.io`, `JobMesh.IO.`, `www.jobmesh.io`, `notjobmesh.io` | match, match, no, no |
| `*.trabajo.org` vs `trabajo.org`, `us.trabajo.org`, `jobs.eu.trabajo.org`, `trabajo.org.example.com` | match, match, match, no |
| `https://user@jobmesh.io:8443/x` vs `jobmesh.io` | match |
| Links `garbage`, `/jobs/view/1` with any domain entry | no match |
| `jobmesh.io` vs link `jobmesh.io/job/1` (no scheme) | match |
| `["jobmesh.io", "JOBMESH.IO"]` vs `https://jobmesh.io/job/1` | match (duplicates harmless) |
| `bücher.de` vs link `https://Bücher.DE/x` | match |
| Name entry `dailyremote`, publisher "DailyRemote", link elsewhere | excluded (unchanged) |
| Domain entry `trabajo.org`, publisher "Trabajo.org", link `https://www.example.com/` | kept |
| `null` publisher, link on an excluded domain | excluded |
| Each malformed entry in the contract's load-error list | config load throws, message contains the entry |
| Search fixture with `exclude_publishers: ["*.linkedin.com"]` | LinkedIn result not stored; `skipped_publishers: 1` |
| Fixture result matched by a name entry and a domain entry | `skipped_publishers: 1` |

## Manual, against your own data (read-only)

Before the change, count what each entry would catch:

```bash
sqlite3 -readonly data/myjobbot.db \
  "select count(*) from jobs where ats='jsearch' and url like 'https://%trabajo.org/%';"   # 15 on 2026-10-12
```

After the change, with `"*.trabajo.org"` in `data/config.json`:

```bash
npm start -- run
grep '"search_fetch"' data/runs/*.jsonl | tail -n 5   # skipped_publishers > 0 when trabajo results came back
sqlite3 -readonly data/myjobbot.db \
  "select count(*) from jobs where ats='jsearch' and url like 'https://%trabajo.org/%' and first_seen > date('now','-1 day');"   # 0
```

Then put a bad entry (`"trabajo.*"`) in the config and run `npm start -- run`. It must exit
straight away with an error naming `trabajo.*`.
