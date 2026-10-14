# Quickstart: checking the React web UI

## Automated

```bash
npm ci                 # after the lockfile splice (research R10)
npm run check          # typecheck (server and browser code), both vitest projects, habit-hooks
```

What the tests must show. The addresses are in [contracts/web-api.md](contracts/web-api.md) and the
fields in [data-model.md](data-model.md).

| Area | Scenario | Expected |
|---|---|---|
| API | Jobs scored 90 and 40, threshold 70 | `/api/pages/recommended` has 1 row and summary `1 recommended · threshold 70` |
| API | `title_boosts: {typescript: 10}`, a TypeScript job at 65 | Row present, `score.value` 75, note `model 65 · +10 typescript` |
| API | `exclude_companies: ["acme"]` | Missing from recommended. On `jobs`, `filterNote` is `hidden: excluded company` |
| API | 250 jobs | Offsets 0, 100 and 200 give 100, 100 and 50 rows. The last `nextOffset` is `null`. An invalid offset gives the first page |
| API | A posting URL of `javascript:alert(1)` | `url` is `null` |
| API | The state loader throws | `500` with an `error` message, and the next request still works |
| Server | `/`, `/nope`, `POST /jobs`, `/settings`, `/assets/../package.json` | 302, 404, 405, 200 HTML, 404 |
| Hide | `tests/hideJobs.test.ts` | Endpoint tests pass unchanged; the three page-reading tests pass against `/api/pages/*` |
| Components | A title `<script>alert(1)</script>` | Shown as text, no `script` element created |
| Components | A row with `url: null` | Title is plain text, not a link |
| Components | Clicking Hide on Recommended, server answers 204 | Row removed |
| Components | Clicking Hide on All jobs, 204 | Row dimmed, "hidden by you" shown, button reads "Unhide" |
| Components | Clicking Hide, server answers 500 | Row unchanged, "Couldn't save — try again" shown |
| Components | The sentinel row becomes visible | Next page fetched and appended once, with no duplicate keys |
| Components | Clicking the Settings nav link | Address `/settings`, Settings marked current, empty body, no full reload |
| Components | The page fetch fails | Error shown where the rows go, and the nav still works |
| Docs | `tests/walkthrough.test.ts` | Every `src/...` path and component named in `docs/react-walkthrough.md` exists |

## Manual (local)

```bash
npm run serve                      # builds the client, then serves on :8080
open http://localhost:8080/recommended
```

Check that:
1. All four tabs show the same rows, notes and links as `main` before the change.
2. Scrolling on All jobs loads 100 rows at a time.
3. Hide and Unhide take effect at once and survive a reload.
4. A bookmark of `/reasoning` loads directly.
5. With JavaScript turned off, the notice "myjobbot's web UI needs JavaScript." is shown.

For learning with hot reload, run these in two terminals:

```bash
npm run serve        # API on :8080
npm run dev:web      # http://localhost:5173, where edits to src/web/client appear without a reload
```

## Manual (Docker)

```bash
npm run docker:watch   # rebuilds the image, since package.json changed, and starts the stack
```

1. Open `http://<server>:8080`. The UI loads after the first client build, which takes a few
   seconds on start.
2. Edit a component under `src/web/client/`, wait about a second, and reload the browser. The
   change shows without restarting the container.
3. `curl http://<server>:8080/@fs/data/config.json` returns `404`, because no development server
   is exposed.
