# Packaging and Helm chart: design

Date: 2026-11-03. Status: approved by the owner.

## Goal

Build myjobbot as a container image in GitHub Actions, publish it to GitHub Container Registry,
and deploy it to any Kubernetes cluster with a generic Helm chart. Delivered as two small PRs,
each in its own git worktree off `main`, so the feature work in the main checkout is untouched.
A `.tar.gz` release asset may be added later; it is out of scope here.

## PR 1: production image and CI

Worktree `../myjobbot-ci`, branch `ci-image`.

- `Dockerfile` builds the web UI at image build time (`next build web`) into
  `NEXT_DIST_DIR=.next-prod`, so it never collides with compose's `.next-docker` dev output or
  the bind-mounted `web/`. If `npm ci --omit=dev` leaves out something the build needs, the
  Dockerfile becomes two stages (build, then a slim runtime that copies `node_modules`, `src`,
  `web` with `.next-prod`, and `docker`).
- `docker/entrypoint.sh` `serve`: when `MYJOBBOT_WEB_MODE=production`, it runs
  `next start web` with `NEXT_DIST_DIR=.next-prod`; otherwise `next dev` as today. Compose is
  unchanged and keeps dev mode. `MYJOBBOT_HOSTS` stays required in both modes.
- `.github/workflows/image.yml`:
  - pull requests: build only, no push (proves the image builds);
  - pushes to `main`: push `ghcr.io/risingfish/myjobbot:main` and `:sha-<short>`;
  - `v*` tags: push `:X.Y.Z`, `:X.Y` and `:latest`;
  - platforms `linux/amd64,linux/arm64` (QEMU), GitHub Actions layer cache;
  - `docker/metadata-action` for tags and labels, `docker/build-push-action` to build;
  - every action pinned to a full commit SHA (with its version in a comment); permissions
    `contents: read`, `packages: write` only where pushing.
- CI does not run `npm run check` (habit-hooks setup) or `check:db` (the LAN MariaDB is
  unreachable from GitHub's runners).
- Verification: local `docker build`, then `docker run … serve` with
  `MYJOBBOT_WEB_MODE=production` against the configured MariaDB, loading a page; compose
  `docker compose config --quiet` still passes and the dev stack still starts.

## PR 2: Helm chart

Worktree `../myjobbot-helm`, branch `helm-chart`, started after PR 1 merges.
Chart at `deploy/helm/myjobbot/`, `appVersion` set from the release tag.

- Web: `Deployment` (1 replica, `serve`, `MYJOBBOT_WEB_MODE=production`), `Service`, optional
  `Ingress` (class, hosts, TLS from values). `MYJOBBOT_HOSTS` defaults to the ingress hosts plus
  the service's in-cluster name and port; overridable. Liveness and readiness probes on `/`.
- Agent: `CronJob` running `run`; `schedule` and `TZ` from values, `concurrencyPolicy: Forbid`,
  success and failure history limits.
- `/data`: one PVC (`storageClass`, `size`, `accessMode`; or `persistence.existingClaim`) shared
  by web and agent. With `ReadWriteOnce`, the job pods get pod affinity to the web pod's node.
- `config.json` and `resume.md`: an init container copies them onto the volume from
  `config.existingConfigMap` and `resume.existingSecret` when given; otherwise whatever is on
  the volume is used. The entrypoint's prerequisite check still reports missing files.
- Environment secrets (LLM, `MYJOBBOT_DB_*`, `MYJOBBOT_SECRET_KEY`, `JSEARCH_API_KEY`,
  `SEARXNG_SECRET`): `existingSecret`, or a Secret the chart creates from values (for testing).
  The chart never prints them.
- Optional `browser` (`mcr.microsoft.com/playwright:v1.64.1-noble`, the compose command, bumped
  with `playwright-core`) and optional `searxng` (the compose image tag), each `enabled` in
  values with its own Deployment and Service. When enabled, `MYJOBBOT_BROWSER_URL` /
  `MYJOBBOT_SEARXNG_URL` are set to them; otherwise external URLs come from values. A
  NetworkPolicy lets only myjobbot pods reach the browser (compose's isolated network).
- Pods run as uid/gid 1000 (`node`) with `fsGroup: 1000`.
- CI: `helm lint` and `helm template` piped to `kubeconform` on pull requests; on `v*` tags,
  `helm package` and `helm push oci://ghcr.io/risingfish/charts`.
- Verification: lint and template in CI; optionally install on a local kind cluster.

## Out of scope

Autoscaling, more than one web replica (single-user app, RWO volume), the `.tar.gz` release
asset, running unit or integration tests in CI.
