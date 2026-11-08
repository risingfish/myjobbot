# Research: Split the README (026)

Facts checked against the code on 2026-11-07, branch `026-split-readme` (fast-forwarded to
`693a827`, after features 024 and 025 merged). "Today's README" is `git show 693a827:README.md`.

## R1. What the LLM part really needs

- **Decision**: Describe the LLM as "an OpenAI-compatible chat-completions server with tool calling
  that accepts llama.cpp's sampling fields", tested with llama.cpp `llama-server` started with
  `--jinja` and a tool-calling model (`.env.example` names `qwen3-coder-30b`).
- **Rationale**: `src/agent/llm.ts` talks through the `openai` SDK (`LLM_BASE_URL`, `LLM_MODEL`,
  `LLM_API_KEY`), so the protocol is OpenAI's. But every request also sends `top_k` and
  `repeat_penalty` beside `temperature` and `top_p`. llama.cpp accepts them; OpenAI's own hosted API
  rejects unknown request fields, and other servers may ignore or refuse them. The raw-response log
  also records llama.cpp's `timings` when present. So "OpenAI-based APIs" is true of the protocol,
  not of every provider, and the README must say so rather than promise OpenAI itself works.
- **Alternatives considered**: Saying "any OpenAI-compatible API" (untrue for api.openai.com);
  changing the sampling fields (a code change, out of scope by FR-013; noted for a later feature).

## R2. The full-stack compose file

- **Decision**: A standalone `compose.full.yaml` (not an override of `compose.yaml`) with five
  services: `myjobbot` (scheduled runs), `web` (`serve`, `MYJOBBOT_WEB_MODE=production`, the image's
  own build), `mariadb`, `searxng`, `browser`. Started with
  `docker compose -f compose.full.yaml up -d --build`.
- **Rationale**:
  - `compose.yaml` is the owner's dev/deploy file: it mounts `src/` and `web/` over the image and
    runs `next dev`, and SearXNG and the browser sit behind profiles. A newcomer wants the image's
    own code and everything on. An override would need `!reset` on profiles and on volume lists,
    which is harder to read than a file that stands alone.
  - No source mounts: the image's code is used, so the stack works from a fresh clone with no
    `node_modules` on the host.
  - `MYJOBBOT_DB_HOST`, `MYJOBBOT_DB_PORT`, `MYJOBBOT_SEARXNG_URL` and `MYJOBBOT_BROWSER_URL` are
    set in the file's `environment` (they name the stack's own services), overriding `.env`.
- **Alternatives considered**: `include:` of `compose.yaml` (keeps its mounts and dev server);
  `-f compose.yaml -f compose.full.yaml` (two files to type, `!reset` needed).

## R3. MariaDB in the stack

- **Decision**: The official `mariadb` image, pinned to an exact tag of the 11.8 LTS line (the tag
  is confirmed by `docker pull` in the sitting and written in full, e.g. `mariadb:11.8.x`), with:
  - `MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD` taken from `.env`'s existing
    `MYJOBBOT_DB_NAME`, `MYJOBBOT_DB_USER`, `MYJOBBOT_DB_PASSWORD` (compose interpolation with `:?`,
    so a missing value stops `up` with a message); the image creates the database and a user with
    all rights on it at first start.
  - `MARIADB_RANDOM_ROOT_PASSWORD=1`, so no root password is written anywhere.
  - `--character-set-server=utf8mb4 --collation-server=utf8mb4_general_ci` (constitution,
    Databases); tables set `utf8mb4_bin` themselves.
  - a named volume `mariadb-data`; no published port.
  - the image's own `healthcheck.sh --connect --innodb_initialized`, and `depends_on:
    condition: service_healthy` from `myjobbot` and `web`.
- **Rationale**: The app already retries its first connection (`src/db/connect.ts`, `withRetry`) and
  applies migrations on start, so the health condition is belt and braces, not a requirement.
  Reusing the `MYJOBBOT_DB_*` names means no new `.env` entries for the database. 10.11 or later is
  the README's stated minimum; 11.8 is the current LTS.
- **Alternatives considered**: Creating the database by an init script (the image's variables
  already do it); a published port (not needed; a reader who wants one adds it).

## R4. `.env.example` changes

- **Decision**: One new commented block, "Full stack (`compose.full.yaml`) only", saying which
  settings it needs (`LLM_*`, `MYJOBBOT_HOSTS`, `MYJOBBOT_BASE_URL`,
  `MYJOBBOT_DB_NAME`/`_USER`/`_PASSWORD`, `SEARXNG_SECRET`, optionally `MYJOBBOT_SECRET_KEY`,
  `MYJOBBOT_TRUSTED_PROXIES`, the account mail settings, `JSEARCH_API_KEY`) and which ones the file sets
  itself (`MYJOBBOT_DB_HOST`, `_PORT`, `MYJOBBOT_SEARXNG_URL`, `MYJOBBOT_BROWSER_URL`). Also drop the
  stale "(README, Develop)" pointer for "(docs/developing.md)". No new variable names.
- **Rationale**: FR-013 allows only the entries the file needs; all the names already exist.

## R5. Files the containers require

- **Decision**: Both quickstart paths copy `examples/config.json` and `examples/resume.md` into
  `data/`, and the Parts section says the container start checks for both.
- **Rationale**: `docker/entrypoint.sh` (`check_prerequisites`) exits when `data/config.json` or
  `data/resume.md` is missing, for `schedule`, `run` and `serve`, even though the app treats
  `resume.md` as optional once a resume is uploaded (feature 023). Today's README Setup calls it
  optional, which is true for `npm` but not for Docker. The docs state what the code does; making the
  check optional is a code change, out of scope (noted as a follow-up).
- **Alternatives considered**: Relaxing the entrypoint check here (code change, FR-013).

## R6. Out-of-date README content found

| Today's README says | The code says | Action |
|---|---|---|
| The LLM must be llama.cpp with `--jinja` | OpenAI protocol plus llama.cpp sampling fields (R1) | Reword as R1 |
| Setup: `resume.md` optional | Container start requires it (R5) | Say required for Docker, optional for `npm` once uploaded |
| Storage: "Create two databases, `myjobbot` and `myjobbot_test`" | Per-checkout pairs for development; any name for a user | User-facing: one database, any name; test database only in Developing |
| Roadmap's "Built so far" stops at 018 | Features through 023 are built | Trim to "Still to come" plus a link to `docs/specs/` |
| "Both containers reach the database over the network, so there is no database container" | True of `compose.yaml` only | Keep in Deploying, beside `compose.full.yaml` |
| Four tabs + Settings, five tools | Confirmed (`web/app/`, `src/tools/`) | Keep |
| Deploy with Docker: setup with no base URL or first admin | `serve` needs `MYJOBBOT_BASE_URL`; pages need a sign-in (R6a) | Add both steps |
| `values.yaml`: two-line `trustedProxies` comment | Owner's fuller comment (R6b) | Replace |

## R6a. Accounts in the quickstart and the full stack (feature 024)

- **Decision**: Both quickstart paths set `MYJOBBOT_BASE_URL` and `MYJOBBOT_HOSTS`, start the stack
  or app, then make the first admin with `account init` and sign in, before adding a source. For the
  full stack: `MYJOBBOT_BASE_URL=http://localhost:8080`, `MYJOBBOT_HOSTS=localhost:8080`, and
  `docker compose -f compose.full.yaml exec web npm start -- account init you@example.com`.
- **Rationale**: `docker/entrypoint.sh` refuses `serve` without `MYJOBBOT_BASE_URL`; every page needs
  a sign-in; browsers keep sign-in cookies only on HTTPS or localhost, so a first look over a plain
  LAN name can't sign in. `tsx` is a production dependency, so `npm start` works inside the image
  (the chart's README already uses it through `kubectl exec`).
- **Account mail** stays optional in both paths; the Parts table says what is lost without it
  ("Email me a link", "Forgot password" and notices).

## R6b. Trusted proxies, as the code reads them

- `src/web/security/clientAddress.ts`: `clientAddress(forwardedFor, hops)` returns `"direct"` for
  0 hops (every client one key), else the entry `hops` places from the right, falling back to the
  leftmost entry when `hops` exceeds the list (`Math.max(len - hops, 0)`). `displayIp`, which the
  Sign-ins list shows, takes the leftmost entry for 0 hops, else the same entry as `clientAddress`.
  `MYJOBBOT_TRUSTED_PROXIES` is an integer 0–10, default 0 (`src/web/security/baseUrl.ts`).
- **Consequence for the docs** (FR-015): the Sign-ins check catches a count too low (≥ 1): the
  list shows a proxy's address. It cannot catch a count too high, nor 0: the list then shows the
  leftmost entry, which is the visitor's real address unless they wrote the header themselves. The
  page says so in one sentence rather than overstating the check.
- **The owner's text** is used as given, with the `values.yaml` comment replaced verbatim.

## R7. Checking links and anchors

- **Decision**: A one-off script in the session scratchpad (not committed) that lists every
  Markdown link in `README.md` and `docs/*.md` (excluding `docs/specs/` and `docs/superpowers/`),
  checks each relative file exists and each `#anchor` matches a heading slug in the target by
  GitHub's rules (lower-case, spaces to `-`, punctuation other than `-` and `_` dropped, `-N` for
  repeats), plus explicit `<a id>` anchors.
- **Rationale**: SC-004 needs 0 broken links; a committed checker would be new code with tests,
  beyond a docs feature.
- **Alternatives considered**: `markdown-link-check` (a new dependency needing approval; not worth it
  for one change).

## R8. Checking that every fact moved

- **Decision**: `data-model.md`'s content map assigns each of today's headings (and the blocks
  inside the large ones) to one new page and heading. In the last sitting, every row is ticked by
  searching for a distinctive phrase or value from it in the new pages, and 20 sampled facts (SC-005)
  are listed with where they were found.
- **Rationale**: Mechanical and cheap; catches dropped paragraphs.
