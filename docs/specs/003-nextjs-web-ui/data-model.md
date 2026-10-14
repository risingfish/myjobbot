# Data Model: Next.js Web UI

There is no database change: same tables, same queries, and Hide still writes only `jobs.hidden`.

The display models from feature 002 carry over unchanged, from `src/web/api.ts`:
- `PageName`, `PAGES` and `PAGE_NAMES`
- `PageData`, `JobRowView` and `VerdictRowView`
- `Score`

The rules that build them are unchanged too: `src/web/rowViews.ts` and `src/web/pageData.ts`.
See `docs/specs/002-react-web-ui/data-model.md` for every field and rule.

What changes is **where** the data moves.

## Routes (Next.js app folders)

| Address | File | Kind | Renders |
|---|---|---|---|
| `/` | `web/app/page.tsx` | server | `redirect("/recommended")` |
| `/recommended` | `web/app/recommended/page.tsx` | server | `PageData` for `recommended` |
| `/jobs` | `web/app/jobs/page.tsx` | server | `PageData` for `jobs` |
| `/reasoning` | `web/app/reasoning/page.tsx` | server | `PageData` for `reasoning` |
| `/settings` | `web/app/settings/page.tsx` | server | empty `<main>` |
| (any other) | `web/app/not-found.tsx` | server | "Not found" |
| (all) | `web/app/layout.tsx` | server | header with `Nav`, styles, footer |
| (errors) | `web/app/error.tsx` | client | the error message, inside the layout |

- **`PAGES`** (address and label) is still the single list behind the menu. It moves to
  `web/lib/pages.ts`, so adding a page touches only `web/`. `src/web/api.ts` keeps the
  `PageName` type.
- **Titles** come from each page's `metadata.title`, inside the layout's template
  `"myjobbot · %s"`.
- **Adding a page** means one new folder with a `page.tsx`, plus one `PAGES` entry.

## Server-side state

`dbPath()`, in `web/lib/uiState.ts`, returns `<dataDir>/myjobbot.db` without reading any file.
The layout's footer uses it. The layout never calls `getUiState()`, because `app/error.tsx`
can't catch an error thrown in the root layout, and a bad `config.json` must show the app's
error message.

`getUiState()`, in the same file, returns `{ views: JobViews, config: FileConfig, dbPath }`:
- **`views`** opens `<MYJOBBOT_DATA_DIR>/myjobbot.db` once per server process, cached on
  `globalThis` so dev reloads don't reopen it.
- **`config`** is loaded again on every call with `loadFileConfig(dataDir)`, so config edits
  show on the next page load, as today. It never reads the agent's `LLM_*` settings, so
  building and serving the web app need no agent secrets.
- **`dataDir`** is `MYJOBBOT_DATA_DIR`, or `data` when unset.

## Server functions (called from client components)

| Function | Inputs | Returns | Rules |
|---|---|---|---|
| `loadMoreRows(name, offset)` | `PageName`, integer ≥ 0 | `PageData` | Same as `loadPageData`, with 100 rows per page. An invalid name or offset is refused with an error, never a crash. |
| `setJobHidden(ats, jobId, hidden)` | strings and a boolean | `{ ok: true }` or `{ ok: false, error }` | An unknown job gives `ok: false`. Next.js refuses the call when the `Origin` is cross-site (research R4). |

Both are thin `"use server"` wrappers over plain functions in `web/lib/rows.ts`, which take
`JobViews` so they can be unit-tested.

## Browser state (client components)

| State | Owner | Changes |
|---|---|---|
| Rows shown, next offset, "couldn't load more" error, version | `RowsList` (via `pageRows.ts` helpers, moved from 002) | Starts from the server-rendered first page; grows with `loadMoreRows`; a removal on Recommended bumps the version |
| Hide status (`idle`, `saving`, `failed`) | `HideButton` / `useHide` | As in 002, but calls `setJobHidden` instead of a `fetch` to `/hide` |
| Current page in the menu | `Nav` via `usePathname()` | Follows every navigation, including back and forward |

## Request filter

`web/proxy.ts` lets a request through only if its `Host` (host and port) is on the allowlist:
- **The list** comes from `MYJOBBOT_HOSTS`, comma-separated and matched without regard to case.
  The default is `localhost` and `127.0.0.1` on `MYJOBBOT_PORT` (default 8080), the same
  port every script and the Docker entrypoint pass to Next.js.
- **Docker requires it.** The `web` service refuses to start without `MYJOBBOT_HOSTS`, so the
  LAN is never locked out by the default.
- **Anything else** gets `421 Misdirected Request`.
