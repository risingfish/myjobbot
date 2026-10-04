# myjobbot Docker Deployment — Design Spec

**Date:** 2026-10-04
**Status:** Approved design, pending implementation plan
**Parent spec:** `2026-10-03-myjobbot-design.md` (this replaces its "Deployment" section)

## Goal

Run myjobbot unattended on a home server with Docker Compose: one `docker compose up -d --build`
starts a container that runs the agent on a schedule. All state and logs live in one host folder.

## Decisions

| Area | Decision |
|---|---|
| Orchestration | Docker Compose, one service |
| Image source | Built on the server from the repo (`build: .`), tagged `myjobbot:latest` so a registry can be added later without changing the compose file's shape |
| Scheduling | supercronic inside the container (long-running), schedule from env |
| Base image | `node:24.21.0-bookworm-slim` (pinned tag; Node 24 provides `node:sqlite`) |
| Browser | None yet. The Glassdoor plan will switch to a Playwright base image when it needs Chromium |
| Secrets | `.env` via `env_file`, never baked into the image |

Rejected: host cron + `docker compose run --rm` (schedule lives outside the repo, easy to lose);
a Node-side scheduler such as node-cron (new dependency and code to duplicate cron, and an app
bug can kill the schedule).

## Image (`Dockerfile`)

- `FROM node:24.21.0-bookworm-slim`.
- Install supercronic **v0.2.49** for the build architecture (`TARGETARCH` = `amd64` or `arm64`)
  from its GitHub release, verified against the pinned sha256:
  - amd64 `a53ae236602c7338aba3fbaff40bda6300eae3b9fedb8261eb06cfe3724430c1`
  - arm64 `02aa0cb229ba09050cba6638059dadb9eedc2276632ea43d6a57a2f8c1629dd5`
  The build fails if the checksum does not match. `curl` and `ca-certificates` are installed only
  for this step.
- `WORKDIR /app`; copy `package.json` and `package-lock.json`; `npm ci --omit=dev` (runtime deps
  only: `openai`, `tsx`, `yaml`, `zod`, all exact-pinned in the lockfile).
- Copy `src/` and `docker/`. No build step: `tsx` runs TypeScript directly, as in development.
- Environment defaults: `MYJOBBOT_DATA_DIR=/data`, `MYJOBBOT_LOG_DIR=/data/log`,
  `SCHEDULE="0 6 * * *"`, `TZ=UTC`, `NODE_OPTIONS=--disable-warning=ExperimentalWarning`.
- Runs as the image's non-root `node` user (uid 1000).
- `ENTRYPOINT ["/app/docker/entrypoint.sh"]`.

`.dockerignore` excludes `.env`, `data/`, `log/`, `node_modules/`, `.git/`, `tests/`, `docs/`,
`.claude/`, `.habit-hooks/`, `.idea/`.

## Entrypoint (`docker/entrypoint.sh`)

POSIX `sh`, `set -eu`. Behaviour by first argument:

| Command | Behaviour |
|---|---|
| *(none)* or `schedule` | Check prerequisites, write a one-line crontab `"$SCHEDULE" /app/docker/run.sh` to `/tmp/crontab`, then `exec supercronic /tmp/crontab` |
| `run` | Check prerequisites, then `exec /app/docker/run.sh` (one run now) |
| anything else | `exec "$@"` (e.g. `sh` for debugging) |

Prerequisite check: `"$MYJOBBOT_DATA_DIR/config.yaml"` and `"$MYJOBBOT_DATA_DIR/resume.md"` must
exist and the data dir must be writable; otherwise print which file is missing (or that the dir is
not writable by uid 1000) and exit 1.

`docker/run.sh` runs `cd /app && exec node_modules/.bin/tsx src/cli.ts run`, so manual and
scheduled runs execute exactly the same command.

supercronic does not start a job while the previous instance is still running (its default
overlap protection), so a slow run never overlaps the next one. Run output, including the CLI's
`run <run_id> finished …` line, goes to the container's stdout (`docker compose logs`).

## Compose (`compose.yaml`)

```yaml
services:
  myjobbot:
    build: .
    image: myjobbot:latest
    restart: unless-stopped
    env_file: .env
    environment:
      MYJOBBOT_DATA_DIR: /data
      MYJOBBOT_LOG_DIR: /data/log
    volumes:
      - ./data:/data
```

- `SCHEDULE` and `TZ` come from `.env` when set, otherwise the image defaults.
- `.env` must hold `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`. A `MYJOBBOT_DATA_DIR` or
  `MYJOBBOT_LOG_DIR` in `.env` (used for local development) is overridden by the compose
  `environment` block, so local `.env` files work unchanged.
- The host `./data` folder must be owned by uid 1000 (the default first user on most Linux
  servers). The README documents `sudo chown -R 1000:1000 data` for other setups.
- If `llm.home.arpa` only resolves on the LAN DNS and the container cannot resolve it,
  add `extra_hosts: ["llm.home.arpa:192.168.1.50"]` (documented, not enabled by default).

## Operating it

| Task | Command |
|---|---|
| Start / update | `docker compose up -d --build` |
| Run once now | `docker compose run --rm myjobbot run` |
| Watch runs | `docker compose logs -f myjobbot` |
| Stop | `docker compose down` |
| Inspect results | the host `data/` folder: `myjobbot.db`, `runs/`, `log/` |

## Verification

- `tests/docker.sh` (a shell script, run manually and in the plan's verification steps, not part
  of `npm test` because it needs Docker):
  1. `docker build -t myjobbot:test .` succeeds (this also proves the supercronic checksum).
  2. `docker run --rm myjobbot:test node_modules/.bin/tsx src/cli.ts` prints the usage line
     and exits 2.
  3. `docker run --rm myjobbot:test run` with an empty temp dir mounted at `/data` exits 1 and
     names the missing `config.yaml`.
  4. With a temp data dir holding the example config and resume and `LLM_BASE_URL=not-a-url`,
     `run` exits 1 with the readable `LLM_BASE_URL` config error.
  5. The image runs as uid 1000 (`docker run --rm myjobbot:test id -u` prints `1000`).
- One live `docker compose run --rm myjobbot run` against the LLM server from this machine.
- `npm run check` stays green (no TypeScript changes are expected).

## Out of scope

Registry push and CI builds, Playwright/Chromium (Glassdoor plan), the email digest (digest plan),
health checks and alerting beyond the CLI exit code.
