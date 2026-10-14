# Implementation Plan: React Web UI

**Branch**: to be created (suggested `react-web-ui`; see Rollout) | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/002-react-web-ui/spec.md`

> **Superseded in part (2026-10-14)**: the `serve` command, the Vite build and the
> `src/web/client/` structure described here were replaced by the Next.js app in `web/`. See
> `docs/specs/003-nextjs-web-ui/`. The shared rules (`src/web/api.ts`, `rowViews.ts`,
> `pageData.ts`) and the paging fixes still apply.

## Summary

The web UI's four pages are rebuilt as a React 19 single-page app:
- **The server** keeps every rule (filters, boosts, ghost age, paging, Hide protection) and sends
  ready-to-show JSON from `/api/pages/:name` and `/api/meta`. It serves a Vite-built bundle from a
  temporary folder, rebuilt on change under `MYJOBBOT_WATCH=1`.
- **The browser app** is made of small typed components and four plain hooks: `usePath` for
  navigation, `usePageRows` for data and infinite scroll, `useHide`, and `useMeta` for the footer. It is tested with
  Testing Library in a separate `happy-dom` vitest project.
- **For learning**, `docs/react-walkthrough.md` maps each React idea to the files that use it and
  ends with exercises. A test keeps it accurate.
- **For local development**, `npm run dev:web` gives hot reload on localhost only.

The decisions are in [research.md](research.md).

## Technical Context

- **Language/Version**: TypeScript 6.0 on Node 24, for the server and for the browser code
  (`.tsx`, compiled with `jsx: react-jsx`)
- **Primary Dependencies**:
  - Runtime: React and React DOM 19.3.0, Vite 8.3.2 with `@vitejs/plugin-react` 6.1.2
  - Development only: Testing Library (react 16.3.3, dom 10.4.2, user-event 14.6.8), happy-dom
    21.0.1, `@types/react` and `@types/react-dom` 19.3.0
  - All pinned exactly
- **Storage**: SQLite, unchanged. No schema change.
- **Testing**: vitest 5, with two projects (`node` for `.test.ts`, `dom` for `.test.tsx`)
- **Target Platform**: the Linux server in Docker. The UI runs in current desktop and mobile
  browsers on the home network.
- **Project Type**: CLI agent plus a web UI (server and single-page app in one repo)
- **Performance Goals**: first rows within 1 s with 1,000 jobs (SC-004); Hide feedback in under
  0.5 s (SC-003)
- **Constraints**:
  - habit-hooks limits apply to `.tsx` too: functions and components at most 12 lines, at most 3
    parameters, files at most 200 lines
  - knip must see the browser entry point
  - nothing under `/app` is writable in Docker
  - no Vite development server on the LAN
- **Scale/Scope**: 4 pages, about 15 small components and 4 hooks in `src/web/client/`. The
  server-side web code is reshaped, not grown. About 23 existing scenarios are carried over.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates from `.specify/memory/constitution.md` v1.0.0, Principles I–V (research R13). The rows
map to them as follows:
- dependencies: IV
- size limits and knip: I
- doc comments: III
- tests: II
- no exemptions: I

The spec location satisfies V.

| Gate | Pre-design | Post-design |
|---|---|---|
| New dependencies exact-pinned and in the lockfile | Planned | Pass. Everything in R1 is exact-pinned and spliced into the lockfile (R10); vite reuses the locked 8.3.2 |
| Size limits (12-line functions and components, 200-line files) | Risk: JSX is verbose | Pass by design. Each component returns at most about 9 lines of JSX, and long rows are split into cell components (R9) |
| No unused code (knip) | Risk: the browser entry isn't reachable from `cli.ts` | Pass. A project `knip.json` adds `src/web/client/main.tsx!` as a real production entry (R9) |
| Doc comment on every `src/` function | Planned | Pass. Applies to components and hooks too |
| Tests in `tests/`, `npm run check` green | Planned | Pass. Two vitest projects (R7); all 23 scenarios carried over (SC-002) |
| No exemptions added to checks (FR-011) | Planned | Pass. No eslint disables and no snoozes; knip gets an entry, not an ignore |

There are no violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
docs/specs/002-react-web-ui/
├── spec.md
├── plan.md                     # this file
├── research.md                 # R1–R13
├── data-model.md               # view models and browser state
├── quickstart.md
├── contracts/web-api.md        # addresses, JSON shapes, Hide
├── checklists/requirements.md
└── tasks.md                    # /speckit-tasks (not yet created)

docs/react-walkthrough.md       # learning guide (FR-013)
```

### Source Code (repository root)

```text
src/web/
├── api.ts            # NEW. Shared types: PageName, PAGES, PageData, JobRowView, VerdictRowView, Meta
├── server.ts         # routes: /, page addresses → index.html, /assets/*, /api/*, POST /hide, 404/405/500
├── pageData.ts       # NEW (replaces tabs.ts). Loads PageData per PageName from JobViews and config
├── rowViews.ts       # NEW (replaces the HTML half of rows.ts). JobView/VerdictView to *RowView
├── viteConfig.ts     # NEW. The Vite settings (root, React plugin, tmpdir outDir and cacheDir, dev server and proxy)
├── clientBuild.ts    # NEW. Runs Vite build() with viteConfig (configFile: false), once or watching; returns the folder
├── staticFiles.ts    # NEW. Serves index.html and /assets/* from that folder, guarding against path escape
├── hide.ts           # unchanged apart from reading page addresses from PAGES
├── html.ts           # keeps escapeHtml and simplePage for the 404/405/500 pages; the row HTML helpers go
├── page.ts, tabs.ts, rows.ts   # REMOVED (replaced above)
└── client/
    ├── index.html    # root <div>, <noscript> notice, module script to main.tsx
    ├── main.tsx      # createRoot(...).render(<App />)
    ├── styles.css    # today's STYLE, moved verbatim
    ├── App.tsx       # Layout: header, Nav, current page, Footer
    ├── usePath.ts    # navigation hook (pushState and popstate)
    ├── usePageRows.ts# fetch, paging, loadMore, abort on page change
    ├── useHide.ts    # POST /hide, per-row status
    ├── useMeta.ts    # footer data
    ├── Nav.tsx, NavLink.tsx, Footer.tsx
    ├── RowsPage.tsx  # summary, empty, error and table for a data page
    ├── JobTable.tsx, JobRow.tsx, ScoreCell.tsx, TitleCell.tsx, PostedCell.tsx, HideButton.tsx, Why.tsx
    ├── VerdictTable.tsx, VerdictRow.tsx, BulletList.tsx, ExternalLink.tsx
    ├── LoadMore.tsx  # IntersectionObserver sentinel row, plus a button
    └── SettingsPage.tsx

src/app/serve.ts      # builds the client (watching under MYJOBBOT_WATCH) before listening
src/cli.ts            # dynamic import of app/serve.js, so `run` never loads web code (R14)
vite.config.ts        # NEW. Re-exports src/web/viteConfig.ts for `npm run dev:web` (the image doesn't contain this file)
vitest.config.ts      # NEW. node and dom projects
knip.json             # NEW. Copies the shipped config and adds src/web/client/main.tsx!
tsconfig.json         # jsx: react-jsx, DOM lib, config files included
package.json          # dependencies (R1); scripts: dev:web

tests/
├── webApi.test.ts        # NEW (server-side half of today's webUi tests)
├── webServer.test.ts     # NEW (routing, static files, the 404/405/500 responses, redirect)
├── hideJobs.test.ts      # endpoint tests unchanged; the 3 that read HTML pages switch to /api/pages JSON
├── client/*.test.tsx     # NEW (display half: rows, escaping, links, Hide, LoadMore, Nav, Settings, errors)
├── walkthrough.test.ts   # NEW (SC-007)
└── webUi.test.ts         # REMOVED once its scenarios have moved (tracked scenario by scenario in tasks)
```

**Structure Decision**: single project. The browser app lives under `src/web/client/`, next to
the server that feeds it, so the two share `src/web/api.ts` types with no separate package.
Business rules stay in `src/jobs/`, used only by the server.

## Rollout

1. **Settings page first.** The blank Settings page is uncommitted on `main`. Start a branch
   (`react-web-ui`), commit the Settings page as its first commit, then build on it.
2. **Dependencies.** The lockfile splice (R10). After merging, `npm run docker:watch` rebuilds the
   image automatically, because `package.json` changes. If the watcher isn't running, rebuild by
   hand: `docker compose build && docker compose up -d`. Check that no scheduled run is in
   progress first.
3. **Design spec.** The "Rendering" row of `docs/superpowers/specs/2026-10-04-web-ui-design.md`
   gets a one-line note pointing to this spec.

## Complexity Tracking

None.
