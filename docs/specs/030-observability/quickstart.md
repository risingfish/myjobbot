# Quickstart: validating worker observability (030)

Against the main checkout's `myjobbot_dev` (refresh it with `scripts/copy-prod.sh myjobbot_dev` if
wanted), with `npm run check` and `npm run check:db` green.

1. **A clean run is recorded.** `npm start -- run`. Open `/monitoring` as an admin: the run is
   listed as finished with its duration, users and counts; its detail shows each user's part by id.
2. **A failing source.** Turn on a source that will fail (e.g. a Greenhouse board with a made-up
   token) and run again: the run is "finished with errors", the module shows a failing fetch with
   its fixed reason, and the owner's Settings → Sources shows it under the source's name.
3. **A dead run.** Start `npm start -- run` and kill it (`kill -9`) after the fetch phase. Within 6
   minutes the page shows it as never finished, with how far it got.
3a. **Overhead (SC-004).** Compare the run's duration (Monitoring) with the same users' runs before
   030 (their trace files' first and last lines): within 1%. The write budget is also unit-tested:
   a run writes at most 2 rows per user part, 1 per fetch and 1 heartbeat a minute.
4. **Privacy.** Search the Monitoring page's HTML for a source name, a search term and an address
   from step 2: none appear. A second user sees nothing of the owner's sources; a non-admin gets
   404 at `/monitoring`.
5. **Mail.** Send the Settings test mail, then break `MYJOBBOT_SMTP_*` and send again: Mail shows
   one sent and one failed (`connect` or `auth`).
6. **Metrics.** `MYJOBBOT_METRICS_TOKEN=<32+ chars> npm start -- metrics`, then
   `curl -H "Authorization: Bearer <token>" localhost:9464/metrics` lists the metrics in
   [contracts/metrics.md](contracts/metrics.md) with no source names; without the header it answers
   401 with nothing; `curl localhost:9464/other` answers 404.
7. **Chart.** `helm template deploy/helm/myjobbot` creates no monitoring resources; with
   `--set monitoring.enabled=true` it adds the metrics container, its `Service`, a `ServiceMonitor`,
   a `PrometheusRule` with the default thresholds and a dashboard `ConfigMap`, and the ingress still
   routes only the web service.
8. **Alerts on the cluster.** With monitoring on, the targets page shows the scrape up; suspending
   the CronJob past 9 hours fires `MyjobbotRunMissed`.
