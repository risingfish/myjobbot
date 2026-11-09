# Deploying

Running myjobbot for real: the full stack, Docker Compose against your own database, the settings sign-in needs, proxies and the sign-in limits, the browser and search services, and Kubernetes.

[← README](../README.md)

## Choosing a setup

- **[The full stack](#the-full-stack-composefullyaml)** (`compose.full.yaml`): everything but the LLM,
  database included, from one command. For trying myjobbot out or a single host.
- **[Docker Compose](#docker-compose-composeyaml)** (`compose.yaml`): the app against a MariaDB
  server you run, with SearXNG and the browser as optional extras.
- **[Kubernetes](#kubernetes)**: the Helm chart.

## The full stack (`compose.full.yaml`)

Five services from one file: the scheduled agent run (`myjobbot`), the web UI (`web`, serving the
image's own production build), MariaDB 11.8 (`mariadb`), SearXNG (`searxng`) and the Playwright
browser (`browser`). Only the LLM is yours to provide. For trying myjobbot out, or for one host.

```bash
git clone <repo> myjobbot && cd myjobbot
cp .env.example .env              # see below
mkdir -p data
cp examples/config.json examples/resume.md data/
docker compose -f compose.full.yaml up -d --build
docker compose -f compose.full.yaml exec web npm start -- account init you@example.com   # the first admin
```

Then sign in at `MYJOBBOT_BASE_URL` and add your first source on Settings → Sources.

`.env` needs `LLM_*`, `MYJOBBOT_HOSTS` (`localhost:8080`), `MYJOBBOT_BASE_URL`
(`http://localhost:8080`), `MYJOBBOT_DB_NAME`, `MYJOBBOT_DB_USER` and `MYJOBBOT_DB_PASSWORD` (the
database and user MariaDB creates on its first start; any values), and `SEARXNG_SECRET`; `up` stops
with a message when one of the last four is missing. `MYJOBBOT_SECRET_KEY` (for Gmail and
authenticator apps), account mail and `JSEARCH_API_KEY` are optional; see
[Account settings](#account-settings). The file sets the database, SearXNG and browser addresses
itself, overriding `.env`. Behind a reverse proxy, also set `MYJOBBOT_TRUSTED_PROXIES` (see
[Proxies and the sign-in limits](#proxies-and-the-sign-in-limits)).

- **The database** lives in the `mariadb-data` volume: `docker compose -f compose.full.yaml down`
  keeps it, `down -v` deletes it. It publishes no port; the root password is random and never
  shown.
- **The code** is the image's own copy, not your checkout's files: after `git pull`, run
  `up -d --build` again.
- **The browser** is on the same isolated network as `compose.yaml`'s (`172.31.250.0/24`; see
  [The browser service](#the-browser-service)), so the two files can't run on one host at once
  without changing one of them.
- **Everything else** (the schedule, the task table, uid 1000, `extra_hosts`) is as for
  `compose.yaml` below, with `-f compose.full.yaml` added to each command.

## Docker Compose (`compose.yaml`)

On the server:

```bash
git clone <repo> myjobbot && cd myjobbot
cp .env.example .env              # set LLM_*, MYJOBBOT_HOSTS, MYJOBBOT_BASE_URL and MYJOBBOT_DB_*; optionally SCHEDULE and TZ
mkdir -p data
cp examples/config.json data/     # runtime settings
cp examples/resume.md data/       # your resume (the containers won't start without one; see below)
docker compose up -d --build
docker compose exec web npm start -- account init you@example.com   # the first admin
```

Then sign in at `MYJOBBOT_BASE_URL`, open Settings and add your first source in Sources (see
[Job sources](sources.md)).

The container runs `myjobbot run` on `SCHEDULE` (default `0 1/8 * * *`, every 8 hours from
1 a.m.: 01:00, 09:00, 17:00) in `TZ` (default `America/Los_Angeles`, Pacific time). After a board's backlog is scored,
each run only scores new postings; a run never starts while the previous one is still going.
Jobs and scores go to MariaDB (see [Database structure](database.md)); `runs/` traces and `log/` files go to the host
`data/` folder. Both containers reach the database over the network, so `compose.yaml` has no
database container (`compose.full.yaml` does).

| Task | Command |
|---|---|
| Open the web UI | `http://<server>:8080` (the `web` service; `MYJOBBOT_PORT` in `.env` changes the port) |
| Run once now | `docker compose run --rm myjobbot run` |
| Re-score one job | The job panel's **Re-score** (or `npm start -- rescore <ats> <job_id>` from a checkout with `.env`) |
| Change search settings | The web UI's Settings page: Sources, Preferences, Scoring and Filters, each with its own Save |
| Watch runs | `docker compose logs -f myjobbot` |
| Update after `git pull` | Nothing for code under `src/` or `web/`; `docker compose up -d --build` when `package.json`, `package-lock.json`, `Dockerfile`, `docker/`, `web/next.config.ts` or `web/tsconfig.json` changed (or leave `npm run docker:watch` running) |
| Start (or update) the stack | `npm run docker:up` (`docker compose up -d --build`) |
| Start and rebuild automatically | `npm run docker:watch`: starts the stack, then runs `docker compose watch` in the foreground. Ctrl-C stops only the watcher; the stack keeps running |
| Stop | `docker compose down` |

The container runs as uid 1000. If your server user has a different uid, run
`sudo chown -R 1000:1000 data`. If the container can't resolve the LLM host (LAN-only DNS),
add `extra_hosts: ["llm.home.arpa:192.168.1.50"]` to the service in `compose.yaml`.

The container start checks for `data/config.json` and `data/resume.md` and stops without either,
even once a resume is uploaded on the Settings page; any Markdown file will do as `resume.md` then. The file is user 1's resume only; every other user uploads their own.
Running from a checkout instead, see [Docker development mode](developing.md#docker-development-mode).

## Account settings

Set in `.env` (see `.env.example`):

- `MYJOBBOT_BASE_URL`: the UI's public address, one of `MYJOBBOT_HOSTS`, and `https://` unless it
  is localhost. Browsers keep sign-in cookies and hardware keys only on HTTPS or localhost, so open
  a local UI at `http://localhost:8080`; a LAN name over plain HTTP can't be signed into.
- Account mail, all five or none: `MYJOBBOT_SMTP_HOST`, `_PORT` (465 for TLS from the start, else
  STARTTLS is required), `_USER`, `_PASSWORD`, and `MYJOBBOT_MAIL_FROM`, whose address must be one
  the login may send as. Without them, "Email me a link" and "Forgot password" say mail isn't set
  up, and notices aren't sent.
- `MYJOBBOT_SECRET_KEY` also seals authenticator app secrets; without it the app can't be set up.

## Proxies and the sign-in limits

The per-address sign-in limits count each client by its IP
address, which the web app reads from `X-Forwarded-For`. Each proxy in front of the pod appends
the address it received the request from, and anyone can send a header of their own, so the app
trusts only the entries its own proxies added: it takes the address `web.trustedProxies` places
from the right. Left empty, the chart uses 1 with the ingress (the ingress controller alone) and 0
without. Count every proxy that appends to `X-Forwarded-For`, the ingress included: Cloudflare or a
cloud load balancer in HTTP mode in front of the ingress makes 2, while a TCP pass-through such as
MetalLB adds nothing. Too high, and a client can name any address it likes, dodging the
per-address limit; too low, and many clients share one address and one limit. To check it, sign
in and open the Account tab's Sign-ins list: it should show your real public IP, not the
ingress's or a pod's.

### Why the count matters

- Too high is a security hole. Each sign-in failure is counted twice: once against the email and
  once against the client's address. If the count is higher than the real number of proxies, the
  app reads an entry the client wrote itself. Someone guessing passwords can then send a different
  made-up address each time, and the per-address limit never catches them. That limit is the
  defence against one client trying many accounts. The per-email limit still applies, but it only
  protects one account at a time.
- Too low locks out real users. The app reads a proxy's own address instead of the visitor's, so
  everyone behind that proxy shares one limit. One person, or one attacker, failing 20 sign-ins in
  15 minutes would block sign-in for everyone, and you'd see it as unexplained lockouts.
- The default is only a guess. The chart sets 1 whenever the ingress is on, which assumes nothing
  else sits in front of it. Your cluster is the one place that's known, which is why the docs
  should say how to count proxies and how to check the result.
- The check is cheap. The Sign-ins list on the Account tab shows the IP the app worked out. If it
  shows your real public address after a production sign-in, the setting is right.

What the check can't show: with a count too high, or 0, the Sign-ins list shows the leftmost
`X-Forwarded-For` entry, which is your real address unless the client wrote the header itself. So a
correct-looking list proves only that a count of 1 or more isn't too low; count the proxies with
care rather than trusting the list for the other direction.

### Outside Kubernetes

With either compose file, set `MYJOBBOT_TRUSTED_PROXIES` in `.env` (0 to 10, default 0) by the same
rule: 0 when browsers reach the `web` service directly, which makes every client share one
per-address limit, and one for each reverse proxy in front that appends to `X-Forwarded-For`.

## The browser service

The careers lookup renders JavaScript-built pages in a Playwright browser service. The full stack
runs one for you. With `compose.yaml`, run the bundled one with
`docker compose --profile browser up -d browser` and
set `MYJOBBOT_BROWSER_URL=ws://browser:3000/`, or point at a Playwright server elsewhere. It must
be Playwright **1.64.1**, the same version as `playwright-core` in `package.json`; upgrade both
together. The bundled service sits on its own Docker network (`172.31.250.0/24`) with no published
port. The address checks are the protection; as a second line of defence, keep that network off
your LAN on the Docker host:

```bash
sudo iptables -I DOCKER-USER -s 172.31.250.0/24 -d 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16 \
  -m conntrack --ctstate NEW -j DROP
```

and set `careers_lookup.lan_probe_url` to a LAN address that answers (your router, say): each
run's first rendering then checks the browser can't reach it, and writes a `render_check` audit
row with `warning = 1` (rendering still goes ahead) if it can.

Both services join the `browser` network as well as the default one: runs and the web UI's
Re-score both use the careers lookup, which renders pages in the `browser` service.

## SearXNG

The careers lookup and the company search find pages through SearXNG. The full stack runs one for
you. With `compose.yaml`, use your own server, or the bundled one: set `SEARXNG_SECRET` in `.env`,
start it with `docker compose --profile search up -d searxng`, and set
`MYJOBBOT_SEARXNG_URL=http://searxng:8080`. It has no published port. Either way, SearXNG must
answer JSON: `search.formats` in its `settings.yml` must include `json` (the bundled
`docker/searxng/settings.yml` does). Otherwise searches fail with HTTP 403, and the run notes it.

## Kubernetes

CI publishes the image as `ghcr.io/risingfish/myjobbot` (`:main` and `:sha-<short>` from `main`,
`:X.Y.Z`, `:X.Y` and `:latest` from `v*` tags) and the Helm chart in `deploy/helm/myjobbot/` as
`oci://ghcr.io/risingfish/charts/myjobbot` on `v*` tags. The image's web UI is built in; it serves
it with `next start` when `MYJOBBOT_WEB_MODE=production`, which the chart sets.

```bash
kubectl create secret generic myjobbot-env --from-env-file=.env   # LLM_*, MYJOBBOT_DB_*, MYJOBBOT_SECRET_KEY, ...
kubectl create configmap myjobbot-config --from-file=config.json=data/config.json
kubectl create secret generic myjobbot-resume --from-file=resume.md=data/resume.md
helm install myjobbot oci://ghcr.io/risingfish/charts/myjobbot --version X.Y.Z \
  --set secret.existingSecret=myjobbot-env \
  --set config.existingConfigMap=myjobbot-config --set resume.existingSecret=myjobbot-resume \
  --set ingress.enabled=true --set 'ingress.hosts={myjobbot.example.com}'
```

The chart runs the web UI as a Deployment and each agent run as a CronJob (`agent.schedule`, in
`timeZone`), sharing one `/data` volume (traces and logs; `config.json` and `resume.md` are copied
onto it at every start). `resume.md` is optional once a resume is uploaded on the Settings page. With the default `ReadWriteOnce` volume, run pods are placed on the web
pod's node. The UI answers only to `web.hosts` (default: the ingress hosts plus `localhost:8080`
for the probes and `kubectl port-forward`). `browser.enabled` and `searxng.enabled` add the
Playwright browser and SearXNG, wired in automatically; only this release's pods may reach the
browser. Start a run now with `kubectl create job --from=cronjob/myjobbot-agent myjobbot-now`.
`values.yaml` documents every option.

The chart sets `MYJOBBOT_BASE_URL` from `web.baseUrl`, or from the first ingress host (`https` with
ingress TLS), and `MYJOBBOT_TRUSTED_PROXIES` to 1 with the ingress (see
[Proxies and the sign-in limits](#proxies-and-the-sign-in-limits) for when that's wrong). Put the mail settings in the
Secret. Then make the first admin once:

```bash
kubectl exec -it deploy/myjobbot-web -- npm start -- account init you@example.com
```

## Upgrading to per-user data

The release that gives each account its own data (feature 027) moves every job's score, marks and
source into a per-user table, gives them, the scoring history, re-score runs and the Gmail
connection to user 1, and only then drops the old columns. Back up the database before deploying
it. The steps run once on the first start; if one fails partway, restore the backup and start
again rather than re-running on the half-moved database.

[Upgrading to accounts and per-user data](upgrade-to-accounts.md) is the runbook: the checks
before, the backup, the deploy, creating the first user with `account init`, the counts that show
every job moved, and the rollback.

The release after it (feature 028) adds step `024_jobs_without_digest_mark`, which drops the
always-empty `jobs.emailed_at` and can't be undone, and `v0.2.0` won't start on a database that has
run it. [Upgrading from 0.2.0 to the 028 release](upgrade-028.md) is its runbook: the check
before, the backup, the deploy, the counts, and a rollback that restores the backup.
