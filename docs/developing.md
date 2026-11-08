# Developing

Working on myjobbot: the checks, the test database, copying production, the browser test, CI, Docker's development mode and where the code is.

[← README](../README.md)

## Checks

Run both before calling work done:

```bash
npm run check      # typecheck + unit and UI tests + habit-hooks
npm run check:db   # integration tests against myjobbot_test (needs the MYJOBBOT_DB_* settings)
```

On GitHub, the `Tests` workflow runs `npm test` (unit and UI tests) on every pull request and push
to `main`. Its `unit-tests` check is required by the `main: tests must pass` ruleset, which has no
bypass, so a pull request can't merge until it passes. The integration tests stay local: GitHub's
runners can't reach the MariaDB server. The `Image` and `Chart` workflows don't run on pull requests, only
on pushes to `main` and `v*` tags, so an image or chart problem shows up after the merge.

## Tests and the test database

Most tests run on in-memory stores; the same store contract runs against MariaDB in
`tests/integration/`, which only ever touches the test database (`myjobbot_test`, or
`MYJOBBOT_TEST_DB_NAME`, which must hold `_test` at its end or before another `_`, as in
`myjobbot_test_alt`). `MYJOBBOT_TEST_DB_HOST`, `_PORT`, `_USER` and
`_PASSWORD` connect to it with their own values, each falling back to its `MYJOBBOT_DB_*` setting.

## Copying production

To work on real data, copy production into a dev database:

```bash
scripts/copy-prod.sh myjobbot_dev       # or myjobbot_dev_alt; asks you to type the name, or pass --yes
```

It replaces every table in the target with a consistent snapshot of `myjobbot`
(`mysqldump --single-transaction`, streamed, no file left behind), including the record of which
migrations have run, so a branch's newer steps run on the next start. It copies the accounts and
their ways of signing in, but no rows of `sessions`, `email_tokens`, `auth_challenges`,
`auth_attempts` or `account_codes`: those tables arrive empty, so nobody is signed in to the copy
and no link or code from production works there. Only `myjobbot_dev` and
`myjobbot_dev_alt` are accepted as targets. Production is read with a read-only login,
`MYJOBBOT_COPY_DB_USER` / `MYJOBBOT_COPY_DB_PASSWORD` in `.env`, created once on the server:

```sql
CREATE USER 'myjobbot_copy'@'%' IDENTIFIED BY '…';
GRANT SELECT ON myjobbot.* TO 'myjobbot_copy'@'%';
```

The copy is written with `MYJOBBOT_DB_USER`, which needs full rights on the target database. It needs the `mysql` and `mysqldump` clients (MySQL 8
or MariaDB). The copied Gmail connection only opens if `.env`'s `MYJOBBOT_SECRET_KEY` is the one
production uses.

## The real-browser test

The real-browser rendering test runs only when `MYJOBBOT_TEST_BROWSER_URL` names a Playwright
1.64.1 server that can reach the test's own `127.0.0.1` server, so not the compose `browser`
service. A throwaway one:

```bash
docker run --rm -d --name pw-test --network host --init --user pwuser --workdir /home/pwuser \
  mcr.microsoft.com/playwright:v1.64.1-noble npx -y playwright@1.64.1 run-server --port 3001 --host 127.0.0.1
MYJOBBOT_TEST_BROWSER_URL=ws://127.0.0.1:3001/ npm run check:db
docker stop pw-test
```

## Docker development mode

`compose.yaml` runs the stack in development mode, from this checkout's code. Both services mount the host's `src/` read-only over the image's copy, so code changes need no
rebuild: each scheduled run starts a fresh process. The `web` service runs Next.js's development
server (`next dev`) on the host's `web/` and `src/`, so a saved change shows on the next reload.
It needs `MYJOBBOT_HOSTS` in `.env` and refuses to start without it. Its `web/` mount is writable,
because Next.js writes its build output (`web/.next-docker/`, gitignored) and `web/next-env.d.ts`
there. Without the mounts (plain `docker run`), the image's own copy of the code is used.

Dependencies are different: `node_modules` is baked into the image, so new code that imports a
new package crashes both services until the image is rebuilt. `npm run docker:watch` (or
`docker compose watch`) rebuilds the image and recreates both containers whenever
`package.json`, `package-lock.json`, `Dockerfile`, `docker/`, `web/next.config.ts` or
`web/tsconfig.json` changes. Two limits: it only
works while that command is running (a reboot or a plain `up -d` leaves nothing watching), and
recreating `myjobbot` stops a scheduled run that is in progress (check with
`docker compose top myjobbot` before changing dependencies near 01:00, 09:00 or 17:00).

## `tests/docker.sh`

`tests/docker.sh` builds the image and checks the container's behaviour (needs Docker). Its web
check uses this checkout's test database, chosen as the integration tests choose it
(`MYJOBBOT_TEST_DB_*`, default `myjobbot_test`).

## Where the code is

- **The app lives in `web/`.** Each page is a folder under `web/app/(app)/` (signed-in pages) or
  `web/app/(public)/` (sign-in pages) and is rendered on the server, so its first rows are in the
  HTML. Scrolling, Hide and the Settings page's buttons run in the browser, and they call server
  functions in `web/lib/` (`actions.ts`, `gmailActions.ts`, `sourceActions.ts`, the settings and
  account actions).
- **The server does the deciding.** The rules for scores, boosts and filter notes are shared with
  the agent in `src/web/`, so the browser only lays them out.
- **`myjobbot serve` is gone.** The `myjobbot` command doesn't serve the UI; the UI is started
  with `npm run web` (see [Command line](cli.md#other-commands)), or by the Docker `web` service (whose container start mode is also named
  `serve` and runs Next.js).
- **To learn React and Next.js** from this code, see
  [the React walkthrough](react-walkthrough.md). It maps each idea to the files that use
  it and ends with exercises.
- **`tests/agent-loop.test.ts` and `tests/e2e.test.ts`.** They drive the real loop with a
  scripted fake model, the easiest way to try "what if the model does X?".
- **`src/agent/prompt.ts`.** The only place the model's instructions live.
