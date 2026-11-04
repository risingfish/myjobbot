# Helm chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A generic Helm chart that deploys myjobbot from `ghcr.io/risingfish/myjobbot` (PR 2 of
`docs/superpowers/specs/2026-11-03-packaging-helm-design.md`).

**Architecture:** One chart at `deploy/helm/myjobbot/`: a web Deployment (`serve`,
`MYJOBBOT_WEB_MODE=production`) with Service and optional Ingress; the agent as a CronJob (`run`);
one PVC at `/data` shared by both; one Secret (existing or chart-made) for the environment; optional
browser and SearXNG Deployments. A workflow lints and renders it on PRs and pushes it to
`oci://ghcr.io/risingfish/charts` on `v*` tags.

**Tech Stack:** Helm 4 (chart `apiVersion: v2`), kubeconform 0.7.0, GitHub Actions.

Tests: no TypeScript changes, so no new unit, integration or UI tests (0/0/0). Verification is
`helm lint`, `helm template` piped to `kubeconform -strict` for the default values and for a values
file that turns every option on (`deploy/helm/myjobbot/ci/all-on-values.yaml`), plus a check that
the chart's SearXNG settings match `docker/searxng/settings.yml`.

Facts found in PR 1 that the chart must honour:
- `MYJOBBOT_DATA_DIR=/data` and `MYJOBBOT_LOG_DIR=/data/log` are set on every pod (a relative value
  in a copied `.env` would otherwise win).
- `web/proxy.ts` answers 421 to any Host not in `MYJOBBOT_HOSTS`, so probes send
  `Host: localhost:<port>` and that name is always in the list.
- The entrypoint refuses to start without `/data/config.json`, `/data/resume.md` and a writable
  `/data` (uid 1000).

---

### Task 1: Chart skeleton, values and helpers

**Files:** Create `deploy/helm/myjobbot/Chart.yaml`, `values.yaml`, `templates/_helpers.tpl`,
`templates/NOTES.txt`, `.helmignore`.

- [ ] Chart `version: 0.1.0`, `appVersion: "main"` (CI overrides both from the tag).
- [ ] Helpers: `myjobbot.fullname`, `myjobbot.labels`, `myjobbot.selectorLabels` (with a
  component), `myjobbot.image`, `myjobbot.secretName`, `myjobbot.hosts`, `myjobbot.env`,
  `myjobbot.podSecurityContext`, `myjobbot.containerSecurityContext`, `myjobbot.dataVolume`,
  `myjobbot.seedContainer`.
- [ ] `helm lint deploy/helm/myjobbot` passes.

### Task 2: Secret, PVC, web Deployment, Service, Ingress

**Files:** Create `templates/secret.yaml`, `pvc.yaml`, `web.yaml`, `ingress.yaml`.

- [ ] Secret rendered only when `secret.create` and no `secret.existingSecret`; `helm template`
  fails with a clear message when neither is given.
- [ ] Web probes: `httpGet /` with header `Host: localhost:<port>`; readiness and liveness.

### Task 3: Agent CronJob

**Files:** Create `templates/cronjob.yaml`.

- [ ] `concurrencyPolicy: Forbid`, `backoffLimit` from values (default 0: a failed run waits for the
  next schedule rather than spending model calls again), history limits, `timeZone`.
- [ ] Required pod affinity to the web pod's node when the PVC is `ReadWriteOnce`.

### Task 4: Optional browser and SearXNG

**Files:** Create `templates/browser.yaml`, `templates/searxng.yaml`,
`files/searxng-settings.yml` (copy of `docker/searxng/settings.yml`).

- [ ] Browser: compose's command and image, `/dev/shm` as a 1Gi memory emptyDir, NetworkPolicy
  admitting only this release's web and agent pods on port 3000.
- [ ] `MYJOBBOT_BROWSER_URL` / `MYJOBBOT_SEARXNG_URL` point at them when enabled, else at
  `externalBrowserUrl` / `externalSearxngUrl` when set.

### Task 5: Chart workflow and README

**Files:** Create `.github/workflows/chart.yml`, `deploy/helm/myjobbot/ci/all-on-values.yaml`;
modify `README.md` (a short Kubernetes section).

- [ ] PRs: helm lint, template both values files through kubeconform, diff the SearXNG settings.
- [ ] `v*` tags: `helm package --version X.Y.Z --app-version X.Y.Z`, `helm push` to
  `oci://ghcr.io/${{ github.repository_owner }}/charts`.
- [ ] actionlint clean; `npm run check` and `npm run check:db` green; open the PR.
