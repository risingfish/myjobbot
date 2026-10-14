# Implementation Plan: Next.js Web UI

**Branch**: to be created (suggested `nextjs-web-ui`) | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/003-nextjs-web-ui/spec.md`

## Summary

The web UI moves from the hand-rolled Node server, the Vite build and the project's own routing
to a **Next.js 16 App Router** app in a new top-level `web/` folder:
- **Pages are server components.** They read the database through the unchanged shared rules in
  `src/web/`, so rows arrive in the HTML.
- **Browser code is minimal.** Infinite scroll and Hide are small client components that call
  server functions (`loadMoreRows`, `setJobHidden`). The JSON API and the `/hide` endpoint are
  removed.
- **Routing comes from the page folders**, with a layout, a not-found page and a redirect.
- **The Docker `web` service runs `next dev`** on the live `web/` and `src/` mounts. A `proxy.ts`
  host allowlist and Next.js's built-in protections are the safeguards.
- **The agent is untouched.** `myjobbot` becomes run-only.

A spike settled the unknowns, including Turbopack resolving the agent's NodeNext imports,
`node:sqlite` working in server components, and the dev server's exposure. See
[research.md](research.md).

## Technical Context

- **Language/Version**: TypeScript 6.0 on Node 24. Two configs: the root one (agent, NodeNext)
  and `web/tsconfig.json` (Next.js, NodeNext resolution, strict).
- **Primary Dependencies**:
  - **New**: `next` 16.4.0, exact-pinned.
  - **Kept**: `react` and `react-dom` 19.3.0.
  - **Moved to dev**: `vite` and `@vitejs/plugin-react`, which only vitest uses now.
- **Storage**: SQLite (`node:sqlite`), unchanged.
- **Testing**: vitest 5. The `node` project covers rules, server functions, the proxy and the
  build smoke test; the `dom` project covers client components with Testing Library, with
  `next/navigation` mocked.
- **Target Platform**: the Linux server in Docker, with Next.js's development server on the LAN
  (FR-006). Production mode also works outside Docker.
- **Project Type**: CLI agent (`src/`) plus a Next.js web app (`web/`) in one package.
- **Performance Goals**: first rows within 1 s with 1,000 jobs, and Hide within 0.5 s. The spike
  measured 25 ms in production and 36–41 ms in dev, with 754 jobs.
- **Constraints**:
  - habit-hooks limits apply to `web/` too.
  - knip must understand Next.js's file conventions in `web/`.
  - `/app` is read-only in the container, so the `.next` folder is a tmpfs (or research R7's
    writable-mount fallback, if T006 finds `next dev` must write `next-env.d.ts`).
  - The dev server must not expose files outside the app.
  - Agent runs must never load web code.
- **Scale/Scope**:
  - 4 routes, a layout and a not-found page.
  - About 15 components moved, and 6 retired (`usePath`, `NavLink`, `CurrentPage`,
    `useDocumentTitle`, `Footer`'s fetch, the `fetchJson` client).
  - About 8 server-side web files deleted.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates from `.specify/memory/constitution.md` v1.2.0, Principles I–V (research R13). The rows map
to them as follows:
- dependencies: IV
- size limits, knip and no exemptions: I
- doc comments: III
- tests: II
- agent unaffected: FR-007, not a principle

The spec location satisfies V.

| Gate | Pre-design | Post-design |
|---|---|---|
| New library presented with options and approved by the owner | Planned | Pass: React Router, TanStack Router, Wouter and Next.js were compared; the owner chose Next.js ("OK, lets update to NExtJS for this spec", 2026-10-14) |
| Dependencies exact-pinned and in the lockfile, optional platform entries kept | Planned | Pass: `next` 16.4.0 exact. The spike's install kept 8 swc, 15 rolldown and 28 sharp entries; counts are re-checked at install (R11) |
| Size limits (12-line functions, 200-line files) in `web/` too | Risk: Next.js boilerplate | Pass by design: pages are about 6 lines and call shared loaders; the components keep 002's small shape |
| No unused code (knip) | Risk: Next.js's conventions and server actions | Pass: knip's `next` plugin gets explicit `web/` entries (R9); there is a verification task for server actions |
| Doc comment on every function, including `web/` | Planned | Pass |
| Tests in `tests/`, `npm run check` green | Risk: server components and the HTTP layer | Pass: every scenario has an automated home except live HTTP plumbing, which moves to quickstart checks (R10) |
| No exemptions | Planned | Pass |
| Agent unaffected (FR-007) | Planned | Pass: `serve` is removed from the CLI, and the agent never imports `web/` (R8) |

No violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
docs/specs/003-nextjs-web-ui/
├── spec.md, plan.md, research.md (R1–R13), data-model.md, quickstart.md
├── contracts/web-ui.md
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code (repository root)

```text
web/                                  # NEW: Next.js project root
├── next.config.ts                    # turbopack.root / outputFileTracingRoot = repo root
├── tsconfig.json                     # nodenext, strict, plus everything Next.js wants (no rewrite at start)
├── next-env.d.ts                     # committed if Next.js never rewrites it, else gitignored + `next typegen` (T006)
├── proxy.ts                          # Host allowlist (MYJOBBOT_HOSTS) → 421
├── app/
│   ├── layout.tsx                    # <html>, styles, <Header>, {children}, <Footer dbPath()>; title template; never loads config
│   ├── error.tsx                     # "use client": error message inside the layout (config errors land here)
│   ├── page.tsx                      # redirect("/recommended")
│   ├── not-found.tsx
│   ├── styles.css                    # moved from src/web/client/styles.css
│   ├── recommended/page.tsx  jobs/page.tsx  reasoning/page.tsx  settings/page.tsx
├── components/                       # moved from src/web/client/components, same subfolders
│   ├── sections/ Header, Footer (server: renders dbPath and time)
│   ├── menus/    Nav ("use client", usePathname + <Link>)
│   ├── pages/    RowsList ("use client": summary, rows, LoadMore, Hide wiring, noscript notice)
│   ├── tables/   DataTable, Tables, JobRow, JobCells, ScoreCell, TitleCell, VerdictRow, Why, LoadMore
│   ├── forms/    HideButton ("use client")
│   └── common/   ExternalLink, BulletList
└── lib/
    ├── uiState.ts                    # dbPath() for the layout; getUiState(): cached JobViews + fresh file config (no agent secrets)
    ├── pages.ts                      # PAGES + PAGE_NAMES, moved from src/web/api.ts (menu list; SC-004)
    ├── rows.ts                       # loadRows(), setHiddenFor(): plain, testable
    ├── actions.ts                    # "use server": loadMoreRows, setJobHidden (thin wrappers)
    ├── pageRows.ts                   # moved: withMore, withoutJob, withJobHidden, jobKey
    ├── usePageRows.ts                # reshaped: starts from server data, loads more via action
    ├── useHide.ts                    # calls setJobHidden
    └── useWhenVisible.ts             # moved

src/web/                              # shared rules only
├── api.ts (types; PageName stays), rowViews.ts, pageData.ts  # PAGES/PAGE_NAMES move to web/lib/pages.ts
└── (deleted) server.ts staticFiles.ts clientBuild.ts viteConfig.ts hide.ts html.ts reply.ts client/
src/app/serve.ts                      # deleted
src/config/load.ts                    # + loadFileConfig(dataDir): file config without the agent env (LLM_*)
src/config/schema.ts                  # MYJOBBOT_HOST and MYJOBBOT_PORT leave envSchema (serve.ts was their only reader)
.env.example                          # MYJOBBOT_PORT note for the web UI; MYJOBBOT_HOSTS example
src/cli.ts                            # `serve` subcommand removed
vite.config.ts                        # deleted
tsconfig.json                         # exclude web/
knip.json                             # drop the client/main.tsx entry; next plugin entries for web/
vitest.config.ts                      # dom project includes web/ components; next/* mocks in setup
package.json                          # next; vite and plugin-react → devDependencies; scripts web, web:build, web:start; typecheck runs both configs
Dockerfile, compose.yaml, docker/entrypoint.sh   # copy web/; mount ./web:ro; tmpfs .next; serve → next dev
.gitignore                            # web/.next
docs/react-walkthrough.md             # restructured for Next.js (R12)

tests/
├── pageData.test.ts          # from webApi.test.ts (rules, paging, errors)
├── webRows.test.ts           # loadRows / setHiddenFor (server-function logic)
├── proxy.test.ts             # host allowlist
├── webBuild.test.ts          # next build web smoke test
├── hideJobs.test.ts          # rewritten against setHiddenFor (endpoint tests retired with /hide)
├── client/*.test.tsx         # paths updated; Nav uses a mocked usePathname; RowsList replaces RowsPage fetch tests
├── walkthrough.test.ts       # scans web/
└── (deleted) webApi.test.ts webServer.test.ts clientBuild.test.ts helpers/clientDir.ts helpers/ui.ts
```

**Structure Decision**:
- **Two source roots in one package.** `src/` is the agent, plus shared rules in `src/web/`.
  `web/` is the Next.js app.
- **Dependencies point one way only:** `web/` → `src/`, never the reverse.

## Rollout

1. **Branch first.** Create a branch (`nextjs-web-ui`) and commit the 003 spec documents.
2. **Live tree, again.** `./src` is mounted live, and the switch-over removes `src/web/server.ts`
   and the `serve` command, which the running `web` container uses today. So:
   - The web app is built and tried locally first (`npm run web`).
   - Then, in one sitting: the Docker changes, the image rebuild (with your OK, and no
     scheduled run in progress), and the removal of the old server.
3. **Hide's contract changes.** Anything outside the UI that POSTs to `/hide` stops working.
   Nothing does today.
4. **Supersedes** the Vite/serve decisions in `docs/specs/002-react-web-ui/`. Add a one-line note
   there.

## Complexity Tracking

None.
