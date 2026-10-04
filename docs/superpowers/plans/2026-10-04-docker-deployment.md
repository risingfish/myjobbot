# myjobbot Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docker compose up -d --build` on the home server starts a container that runs `myjobbot run` on a cron schedule, with all state and logs in a bind-mounted `data/` folder.

**Architecture:** A `node:24.21.0-bookworm-slim` image with runtime deps from the lockfile and a checksum-verified supercronic binary. A POSIX `sh` entrypoint either schedules runs (the default), runs once (`run`), or execs any other command. Compose builds the image, injects `.env`, sets data and log paths, and bind-mounts `./data` to `/data`.

**Tech Stack:** Docker (BuildKit), Docker Compose v2, supercronic v0.2.49, Node 24 + tsx.

**Spec:** `docs/superpowers/specs/2026-10-04-docker-deployment-design.md`

---

## Notes for implementers

- This plan adds **no TypeScript**. habit-hooks only scans `.ts`, but `npm run check` must still pass at the end of each task.
- Shell scripts must be committed **executable** (`chmod +x` before `git add`). The Docker `COPY` keeps the mode.
- Verified facts this plan relies on:
  - the host user here is uid 1000
  - the base image's `node` user is uid 1000
  - the base image already contains tzdata
  - BuildKit sets `TARGETARCH` automatically
- Never put the real `.env` in the image. `.dockerignore` excludes it.

## File structure

```
.dockerignore            keeps secrets, data, dev files out of the build context
Dockerfile               runtime image
docker/entrypoint.sh     schedule (default) | run | exec anything else
docker/run.sh            the one command both scheduled and manual runs execute
compose.yaml             the home-server service
tests/docker.sh          container verification script (needs Docker; not part of npm test)
README.md                + "Deploy with Docker" section
.env.example             + SCHEDULE / TZ
```

---

### Task 1: Image, entrypoint and container verification script

**Files:**
- Create: `tests/docker.sh`, `.dockerignore`, `Dockerfile`, `docker/entrypoint.sh`, `docker/run.sh`

- [ ] **Step 1: Write the verification script**

`tests/docker.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=myjobbot:test
BAD_LLM=(-e LLM_BASE_URL=not-a-url -e LLM_MODEL=m -e LLM_API_KEY=k)

ok() { echo "ok - $1"; }
fail() { echo "not ok - $1" >&2; exit 1; }

expect_exit() {
  local want=$1 pattern=$2 name=$3; shift 3
  local out code=0
  out=$(docker run --rm "$@" 2>&1) || code=$?
  [ "$code" -eq "$want" ] || fail "$name: exit $code, wanted $want. Output: $out"
  grep -q -- "$pattern" <<<"$out" || fail "$name: output lacks '$pattern'. Output: $out"
  ok "$name"
}

data_dir() {
  local dir; dir=$(mktemp -d)
  chmod 777 "$dir"
  if [ "${1:-}" = "with-config" ]; then
    cp examples/config.yaml examples/resume.md "$dir/"
  fi
  echo "$dir"
}

docker build -q -t "$IMAGE" . >/dev/null || fail "image builds"
ok "image builds (supercronic checksum verified)"

[ "$(docker run --rm "$IMAGE" id -u)" = "1000" ] || fail "runs as uid 1000"
ok "runs as uid 1000"

expect_exit 2 "usage: myjobbot run" "cli prints usage without a command" "$IMAGE" node_modules/.bin/tsx src/cli.ts

empty=$(data_dir)
expect_exit 1 "missing /data/config.yaml" "run reports a missing config" -v "$empty:/data" "$IMAGE" run

configured=$(data_dir with-config)
expect_exit 1 "LLM_BASE_URL" "run reports a bad LLM URL readably" -v "$configured:/data" "${BAD_LLM[@]}" "$IMAGE" run

name="myjobbot-test-$$"
docker run -d --name "$name" -v "$configured:/data" "${BAD_LLM[@]}" -e SCHEDULE="*/5 * * * *" "$IMAGE" >/dev/null
sleep 3
logs=$(docker logs "$name" 2>&1)
running=$(docker inspect -f '{{.State.Running}}' "$name")
docker rm -f "$name" >/dev/null
[ "$running" = "true" ] || fail "schedule mode stays running. Logs: $logs"
grep -q "scheduling runs at '\*/5 \* \* \* \*'" <<<"$logs" || fail "schedule mode announces its schedule. Logs: $logs"
ok "schedule mode starts supercronic with SCHEDULE"

rm -rf "$empty" "$configured"
echo "all docker checks passed"
```

```bash
chmod +x tests/docker.sh
```

- [ ] **Step 2: Run it to verify it fails**

Run: `tests/docker.sh`
Expected: `not ok - image builds`, because there is no Dockerfile yet.

- [ ] **Step 3: Write `.dockerignore`**

```
.env
data/
log/
node_modules/
.git/
tests/
docs/
.claude/
.githooks/
.habit-hooks/
.idea/
```

- [ ] **Step 4: Write `docker/run.sh` and `docker/entrypoint.sh`**

`docker/run.sh`:

```sh
#!/bin/sh
set -eu
cd /app
exec node_modules/.bin/tsx src/cli.ts run
```

`docker/entrypoint.sh`:

```sh
#!/bin/sh
set -eu

check_prerequisites() {
  for file in config.yaml resume.md; do
    if [ ! -f "$MYJOBBOT_DATA_DIR/$file" ]; then
      echo "myjobbot: missing $MYJOBBOT_DATA_DIR/$file (put it in the host data/ folder)" >&2
      exit 1
    fi
  done
  if [ ! -w "$MYJOBBOT_DATA_DIR" ]; then
    echo "myjobbot: $MYJOBBOT_DATA_DIR is not writable by uid $(id -u); on the host run: sudo chown -R $(id -u):$(id -g) data" >&2
    exit 1
  fi
}

case "${1:-schedule}" in
  schedule)
    check_prerequisites
    printf '%s /app/docker/run.sh\n' "$SCHEDULE" > /tmp/crontab
    echo "myjobbot: scheduling runs at '$SCHEDULE' ($TZ)"
    exec supercronic /tmp/crontab
    ;;
  run)
    check_prerequisites
    exec /app/docker/run.sh
    ;;
  *)
    exec "$@"
    ;;
esac
```

```bash
chmod +x docker/run.sh docker/entrypoint.sh
```

- [ ] **Step 5: Write the `Dockerfile`**

```dockerfile
FROM node:24.21.0-bookworm-slim

ARG TARGETARCH
ARG SUPERCRONIC_VERSION=v0.2.49
ARG SUPERCRONIC_SHA256_AMD64=a53ae236602c7338aba3fbaff40bda6300eae3b9fedb8261eb06cfe3724430c1
ARG SUPERCRONIC_SHA256_ARM64=02aa0cb229ba09050cba6638059dadb9eedc2276632ea43d6a57a2f8c1629dd5

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && case "$TARGETARCH" in \
      amd64) sha="$SUPERCRONIC_SHA256_AMD64" ;; \
      arm64) sha="$SUPERCRONIC_SHA256_ARM64" ;; \
      *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
 && curl -fsSLo /usr/local/bin/supercronic \
      "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${TARGETARCH}" \
 && echo "${sha}  /usr/local/bin/supercronic" | sha256sum -c - \
 && chmod +x /usr/local/bin/supercronic \
 && apt-get purge -y curl \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY docker ./docker

ENV MYJOBBOT_DATA_DIR=/data \
    MYJOBBOT_LOG_DIR=/data/log \
    SCHEDULE="0 6 * * *" \
    TZ=UTC \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning

USER node
ENTRYPOINT ["/app/docker/entrypoint.sh"]
```

- [ ] **Step 6: Run the verification script**

Run: `tests/docker.sh`
Expected, ending with `all docker checks passed`:

```
ok - image builds (supercronic checksum verified)
ok - runs as uid 1000
ok - cli prints usage without a command
ok - run reports a missing config
ok - run reports a bad LLM URL readably
ok - schedule mode starts supercronic with SCHEDULE
all docker checks passed
```

If the checksum step fails, the release asset changed. **Stop and report it; do not update the hash without checking the release.**

- [ ] **Step 7: Verify the repo checks still pass, then commit**

Run: `npm run check`
Expected: typecheck clean, all tests pass, habit-hooks clean.

```bash
git add .dockerignore Dockerfile docker/ tests/docker.sh
git commit -m "Add Docker image with supercronic scheduling and container checks"
```

---

### Task 2: Compose service, docs, and a live run

**Files:**
- Create: `compose.yaml`
- Modify: `.env.example`, `README.md`

- [ ] **Step 1: Write `compose.yaml`**

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

- [ ] **Step 2: Validate it**

Run: `docker compose config --quiet && echo valid`
Expected: `valid`

- [ ] **Step 3: Document the schedule settings in `.env.example`**

Append:

```
# Docker only: when scheduled runs happen (cron syntax) and in which timezone
# SCHEDULE=0 6 * * *
# TZ=America/Denver
```

- [ ] **Step 4: Add a "Deploy with Docker" section to `README.md`**

Insert after the `## Develop` section and before the `---` that precedes `## How it works`:

````markdown
## Deploy with Docker

On the server:

```bash
git clone <repo> myjobbot && cd myjobbot
cp .env.example .env              # set LLM_API_KEY; optionally SCHEDULE and TZ
mkdir -p data
cp examples/config.yaml data/     # your companies
cp examples/resume.md data/       # your resume
docker compose up -d --build
```

The container runs `myjobbot run` on `SCHEDULE` (default `0 6 * * *`, in `TZ`, default UTC).
Everything it writes goes to the host `data/` folder: `myjobbot.db`, `runs/` traces and
`log/` files.

| Task | Command |
|---|---|
| Run once now | `docker compose run --rm myjobbot run` |
| Watch runs | `docker compose logs -f myjobbot` |
| Update after `git pull` | `docker compose up -d --build` |
| Stop | `docker compose down` |

The container runs as uid 1000. If your server user has a different uid, run
`sudo chown -R 1000:1000 data`. If the container can't resolve the LLM host (LAN-only DNS),
add `extra_hosts: ["llm.home.arpa:192.168.1.50"]` to the service in `compose.yaml`.

`tests/docker.sh` builds the image and checks the container's behaviour (needs Docker).
````

- [ ] **Step 5: Live run against the real LLM with Compose**

Uses the repo's existing `.env` and `data/` (both gitignored). `data/` is owned by uid 1000 on this machine.

```bash
docker compose build
docker compose run --rm myjobbot run
```

Expected: a `run <uuid> finished after N steps: finish called` line, and new files under `data/runs/` and `data/log/` named with that UUID. If the container can't resolve `llm.home.arpa`, report it instead of editing `compose.yaml`.

- [ ] **Step 6: Verify and commit**

Run: `npm run check && tests/docker.sh`
Expected: both pass.

```bash
git add compose.yaml .env.example README.md
git commit -m "Add Compose service and Docker deployment docs"
```
