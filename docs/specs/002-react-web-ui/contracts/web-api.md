# Contract: web server addresses

This is the interface between `myjobbot serve` and the React app in the browser, and between the
server and anything that bookmarks it. The types are in [data-model.md](../data-model.md).

## Pages (HTML)

| Method and path | Response |
|---|---|
| `GET /` | `302`, with `Location: /recommended` (unchanged) |
| `GET /recommended`, `/jobs`, `/reasoning`, `/settings` | `200 text/html`: the built `index.html`. React draws the page. It includes a `<noscript>` notice: "myjobbot's web UI needs JavaScript." |
| `GET /assets/<name>` | `200` with the built file and its content type, and `cache-control: public, max-age=31536000, immutable`. `404` if the file is missing or the path leaves the build folder |
| `GET` any other path | `404 text/html` "Not found" page (unchanged) |
| Any method except `GET`, other than `POST /hide` | `405 text/html` "Method not allowed" (unchanged) |

## Data (JSON)

All JSON responses are `content-type: application/json; charset=utf-8`, with
`cache-control: no-store`.

### `GET /api/pages/:name?offset=N`

`:name` is `recommended`, `jobs` or `reasoning`. `offset` is a non-negative integer. A missing or
invalid offset counts as 0, as today.

`200` returns a `PageData` object:

```json
{
  "kind": "jobs",
  "rows": [{ "ats": "greenhouse", "jobId": "123", "title": "Senior Engineer", "url": "https://…",
             "company": "Acme", "location": "Remote", "remote": "yes", "source": "Acme",
             "via": null, "posted": { "date": "2026-10-01", "daysOpen": 12, "ghost": false },
             "scoredDate": "2026-10-12", "score": { "value": 75, "note": "model 65 · +10 typescript" },
             "filterNote": null, "hidden": false, "reasons": ["…"], "gaps": [] }],
  "total": 1, "nextOffset": null,
  "summary": "1 recommended · threshold 70", "empty": "No recommendations yet: run myjobbot run."
}
```

- An unknown `:name` returns `404 {"error": "Not found"}`.
- A server failure, such as a config error, returns `500 {"error": "<message>"}`, and the browser
  shows that message where the rows would be.

### `GET /api/meta`

`200` returns `{ "dbPath": "data/myjobbot.db", "renderedAt": "2026-10-13T20:00:00.000Z" }`.

### Any other `/api/...` address

`404 {"error": "Not found"}`.

## Hide (unchanged)

`POST /hide` keeps exactly today's contract and protections:
- Body: `application/x-www-form-urlencoded` with `ats`, `job_id`, `hidden` (`0` or `1`) and
  `back` (one of the page addresses).
- **Same-origin check**: rejected with `403` when `sec-fetch-site` is a cross-site value, or when
  `origin` is a different host.
- **Fetch submissions**: with the `x-myjobbot-fetch: 1` header, which the React app always sends,
  a success returns `204`. Without the header, it returns `303` to `back`.
- **Errors**: `400` for a bad body, `404` for an unknown job.

## Development only (not served on the LAN)

`npm run dev:web` runs Vite's development server, with hot module replacement, on
`http://localhost:5173`, bound to localhost. It forwards `/api` and `/hide` to `serve` on
`http://localhost:8080`. Run both for the fastest edit-and-see loop.
