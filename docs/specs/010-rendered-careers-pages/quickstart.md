# Quickstart: validating 010

Contract: [contracts/page-reading.md](contracts/page-reading.md). Data: [data-model.md](data-model.md).

## 1. Checks

```bash
npm run check
npm run check:db                                  # migration 005, store contract
```

The real-browser test needs a browser that can reach the test's own `127.0.0.1` server, so run a
throwaway one with host networking (not the compose `browser` service, which the §3 rule keeps off
private addresses):

```bash
docker run --rm -d --name pw-test --network host --init --user pwuser --workdir /home/pwuser \
  mcr.microsoft.com/playwright:v1.64.1-noble npx -y playwright@1.64.1 run-server --port 3001 --host 127.0.0.1
MYJOBBOT_TEST_BROWSER_URL=ws://127.0.0.1:3001/ npm run check:db
docker stop pw-test
```

## 2. Start the browser service

Bundled (compose profile `browser`, Playwright 1.64.1; the client in `package.json` must be the
same version):

```bash
docker compose --profile browser up -d browser
docker compose config --quiet                     # never plain `config`: it prints .env
```

Set `MYJOBBOT_BROWSER_URL=ws://browser:3000/` in `.env` (or `ws://<host>:3000/` for a browser on
another machine), then `npm run docker:up`.

## 3. Recommended: keep the browser off the LAN

The `browser` service uses the `browser` network, subnet `172.31.250.0/24`. On the Docker host,
drop new connections from it to private ranges (replies to the agent are unaffected):

```bash
sudo iptables -I DOCKER-USER -s 172.31.250.0/24 -d 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16 \
  -m conntrack --ctstate NEW -j DROP
```

Then set `careers_lookup.lan_probe_url` in `data/config.json` to a LAN address that answers (for
example the router), so each run's first rendering checks the rule is working. A
`render_check` audit row with `warning = 1` means the browser can still reach the LAN.

## 4. One run

Run `docker compose exec -T myjobbot npm start -- run` and read the counts only:

```sql
SELECT page_source, fallback, step, outcome, COUNT(*) n, MAX(chars) max_chars
FROM careers_audit WHERE run_id = '<run id>' GROUP BY 1, 2, 3, 4;
SELECT step, outcome, reason, COUNT(*) FROM careers_audit
WHERE run_id = '<run id>' AND step IN ('finish', 'retry', 'render_check') GROUP BY 1, 2, 3;
```

Expect: `board` rows for Ashby/Greenhouse/Lever/Workday links, `rendered` rows only after blank
`html` reads, `max_chars` ≤ `page_chars` (SC-006), `retry` rows for jobs that failed unreadable
before 010 (FR-023), and found ≥ 4 in 10 (SC-001). Record counts only, never page or job text.

## 5. Rendering off

Unset `MYJOBBOT_BROWSER_URL` and run again: no `rendered` rows, `fallback = 'render_off'` on blank
pages, and the careers summary notes "page rendering not configured" (SC-004).

## 6. Resetting a job by hand

For a job that should be looked up again outside FR-023's one retry:

```sql
DELETE FROM careers_audit WHERE ats = '<ats>' AND job_id = '<job id>';
UPDATE jobs SET scored_at = NULL WHERE ats = '<ats>' AND job_id = '<job id>' AND description IS NULL;
```
