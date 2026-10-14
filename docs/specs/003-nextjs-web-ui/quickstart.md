# Quickstart: checking the Next.js web UI

## Automated

```bash
npm ci
npm run check     # both tsconfigs, vitest node + dom projects, a next build smoke test, habit-hooks
```

Tests must show:

| Area | Scenario | Expected |
|---|---|---|
| Rules | Threshold, boosts, excluded companies, title filter, `javascript:` links, ghosts, paging 0/100/200 on 250 jobs, invalid offsets | Same values as feature 002's API tests, now checked directly against `loadPageData` |
| Server functions | `setJobHidden` on a known job, an unknown job; `loadMoreRows` with a bad name or offset | Flag written, `ok: false`, refusal |
| Components | Escaping, links only for `http(s)`, notes, Hide per page, failure message, infinite scroll (no duplicates, stale replies dropped), Nav marking with a mocked `usePathname` | As in feature 002 |
| Build | `next build web` | Routes `/`, `/recommended`, `/jobs`, `/reasoning`, `/settings` and not-found are listed; no type errors |
| Proxy | Host on the allowlist; host not on it | Request passes; `421` |
| Walkthrough | Every path and component named exists | Passes |

## Manual (local, production mode)

```bash
npm run web:build && npm run web:start          # :8080, or MYJOBBOT_PORT; no LLM_* variables needed
curl -s localhost:8080/jobs | grep -c 'class="job"'   # 100 rows in the HTML, with no JavaScript run
```

Then, in a browser:
1. The four pages, with titles and menu marking.
2. The back and forward buttons.
3. A reload of `/reasoning`.
4. Scrolling `/jobs` to the end.
5. Hide and Unhide, then a reload.
6. With JavaScript off, the rows still show, along with the notice "Loading more rows and Hide need
   JavaScript."
7. With a broken `config.json` (on a copy of the data), `/jobs` shows the error message inside the
   usual header and footer, not a blank or default Next.js error screen.

## Manual (Docker, development server on the LAN)

```bash
# .env must contain MYJOBBOT_HOSTS=<the host:port names you use>; the web service won't start without it
npm run docker:watch
```

1. Open `http://<server>:8080/recommended`. The first rows are visible.
2. Edit a component under `web/components/` and reload: the change shows, with no image rebuild.
3. Check that nothing outside the app is served. Each of these must return 404, or 421 for a
   foreign `Host`, and none may return file contents:
   - `curl -s -o /dev/null -w '%{http_code}' http://<server>:8080/../data/config.json`
   - `/_next/static/../../data/config.json`
   - `/.env`
4. Check the Host allowlist. A request with `-H "Host: evil.example:8080"` gets 421.
5. Check that cross-site Hide is refused. POSTing the Hide action with `Origin: https://evil.example`
   is rejected and the job is unchanged. Test this on a job you don't mind toggling, or with
   `MYJOBBOT_DATA_DIR` pointed at a copy.
6. Check that scheduled runs are unaffected: `docker compose top myjobbot` and
   `docker compose logs myjobbot` show runs completing.
