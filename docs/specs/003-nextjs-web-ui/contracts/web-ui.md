# Contract: web UI addresses and server functions

This contract replaces `docs/specs/002-react-web-ui/contracts/web-api.md`. The JSON API and the
`/hide` form endpoint are gone. Field shapes are in [data-model.md](../data-model.md).

## Addresses (HTML)

| Request | Response |
|---|---|
| `GET /` | Redirect to `/recommended` |
| `GET /recommended`, `/jobs`, `/reasoning` | `200` HTML with the summary, and the first 100 rows already in the page (they show without JavaScript) |
| `GET /settings` | `200` HTML: header, nav (Settings current), empty main, footer |
| `GET` any other path | `404` with the "Not found" page inside the usual layout |
| Any request whose `Host` is not on the allowlist | `421`, before any page or action runs |

Each page's `<title>` is `myjobbot · <label>`, and the current page's menu link has
`class="current"`.

## Server functions

| Function | Called from | Guarantees |
|---|---|---|
| `loadMoreRows(name, offset)` | `RowsList`, when the last row scrolls into view or "Load more" is clicked | Returns the next `PageData` slice. The client skips rows already shown and drops replies that started before a removal (both kept from 002). |
| `setJobHidden(ats, jobId, hidden)` | `HideButton` | Writes `jobs.hidden`, then returns `ok` or an error. The client updates the row only on `ok` and shows "Couldn't save — try again" otherwise. A cross-site `Origin` is refused by Next.js before the function runs. |

## Commands

| Command | What it runs |
|---|---|
| `npm run web` | `next dev web --port ${MYJOBBOT_PORT:-8080}` on localhost, for development |
| `npm run web:build`, then `npm run web:start` | Production build and server, outside Docker (FR-006 safeguard 4) |
| `myjobbot run` | The agent only. The `serve` subcommand is removed. |
| Docker `web` service | Refuses to start without `MYJOBBOT_HOSTS`, then `next dev web --hostname 0.0.0.0 --port ${MYJOBBOT_PORT:-8080}`, with live `src/` and `web/` mounts and a tmpfs `.next`. The host publishes the same port, `${MYJOBBOT_PORT:-8080}` |
