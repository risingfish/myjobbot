# Contract: `compose.full.yaml`

Started with `docker compose -f compose.full.yaml up -d --build`. `compose.yaml` is unchanged.

## Services

| Service | Image | Command | Networks | Notes |
|---|---|---|---|---|
| `myjobbot` | `build: .`, tagged `myjobbot-full:latest` (not `compose.yaml`'s `myjobbot:latest`, so building one stack never retags the other's image) | default (`schedule`) | default, browser | depends on `mariadb` healthy |
| `web` | `build: .` (same image) | `serve` | default, browser | `MYJOBBOT_WEB_MODE=production`; publishes `${MYJOBBOT_PORT:-8080}`; depends on `mariadb` healthy |
| `mariadb` | `mariadb:11.8.9` | `--character-set-server=utf8mb4 --collation-server=utf8mb4_general_ci` | default | named volume `mariadb-data`; healthcheck `healthcheck.sh --connect --innodb_initialized`; no published port |
| `searxng` | `searxng/searxng:2026.10.15-b00212a83` (as `compose.yaml`) | default | default | `./docker/searxng/settings.yml` read-only; `SEARXNG_SECRET` from `.env` (`:?` required) |
| `browser` | `mcr.microsoft.com/playwright:v1.64.1-noble` (as `compose.yaml`) | `run-server` as `compose.yaml` | browser only | same `browser` network and subnet as `compose.yaml` |

No profiles: everything starts. No source mounts: the image's code runs.

## Environment

Both app services: `env_file: .env`, then `environment` (overrides `.env`):

| Variable | Value |
|---|---|
| `MYJOBBOT_DATA_DIR` / `MYJOBBOT_LOG_DIR` | `/data` / `/data/log` (as `compose.yaml`) |
| `MYJOBBOT_DB_HOST` / `MYJOBBOT_DB_PORT` | `mariadb` / `3306` |
| `MYJOBBOT_SEARXNG_URL` | `http://searxng:8080` |
| `MYJOBBOT_BROWSER_URL` | `ws://browser:3000/` |

From `.env` (not set by the file): `MYJOBBOT_BASE_URL` (required; `serve` refuses to start without
it; `http://localhost:8080` for a first look), `MYJOBBOT_HOSTS`, `MYJOBBOT_TRUSTED_PROXIES` (0 unless a
proxy sits in front; see Deploying, "Proxies and the sign-in limits"), and the optional account mail
settings.

`mariadb`'s environment: `MARIADB_DATABASE: ${MYJOBBOT_DB_NAME:?…}`, `MARIADB_USER:
${MYJOBBOT_DB_USER:?…}`, `MARIADB_PASSWORD: ${MYJOBBOT_DB_PASSWORD:?…}`,
`MARIADB_RANDOM_ROOT_PASSWORD: "1"`. No secret is written in the file.

## Volumes

- `./data:/data` on both app services (config, resume, traces, logs; owned by uid 1000).
- `mariadb-data` (named) on `/var/lib/mysql`.

## Guarantees

- `docker compose -f compose.full.yaml config --quiet` exits 0 with `.env` filled from
  `.env.example` (never run without `--quiet`: it would print `.env`).
- From a fresh clone with that `.env` and `data/` prepared as the README says, `up -d --build`
  answers on `MYJOBBOT_PORT` (the sign-in page), the database records every migration step, and
  `docker compose -f compose.full.yaml exec web npm start -- account init <email>` makes the first admin.
- Missing `MYJOBBOT_DB_NAME`/`_USER`/`_PASSWORD` or `SEARXNG_SECRET` stops `up` with compose's
  `:?` message, before any container starts.
