# Research: Next.js Web UI

**Method.** Unknowns were settled by a spike rather than by reading documentation. On
2026-10-14, Next.js 16.4.0 was installed into a scratch copy of the repository, with React
19.3.0 already present. A minimal `web/` app (layout, one server page, one server action) then
read a copy of the real database through the existing `src/` code. The spike was built, run
with `next start` and `next dev`, and probed. Results are quoted below.

## R1. Where the Next.js app lives

- **Decision**: a new top-level `web/` folder is the Next.js project root:
  - `web/app/` holds the routes
  - `web/next.config.ts`, `web/tsconfig.json` and `web/proxy.ts`
  - `web/components/` and `web/lib/` hold the moved React code

  There is still one `package.json` and one lockfile at the repository root, and the agent stays
  in `src/`. Next.js commands take the folder as an argument: `next dev web`, `next build web`.
- **Rationale**:
  - **`src/app/` is taken.** It already holds the agent's `run.ts` and `serve.ts`, and Next.js
    treats `src/app/` as its routing folder.
  - **A sibling folder** keeps Next.js's settings (`tsconfig`, its generated `next-env.d.ts`, the
    `.next` build folder) away from the agent.
  - **One package** keeps one lockfile and one `npm ci`.
- **Alternatives considered**:
  - npm workspaces (a separate `web/package.json`): cleaner separation, but a second manifest and
    lockfile layout for one small app.
  - Putting Next.js at the repository root: it collides with `src/app/` and would rewrite the
    root `tsconfig.json`.

## R2. Sharing the agent's code with the web app

- **Decision**: the web app imports the shared rules straight from `src/` with relative paths
  (`../../src/web/pageData.js` and similar), with two settings:
  - **`web/tsconfig.json`** uses `"module": "nodenext"` and `"moduleResolution": "nodenext"`,
    with `strict` and `noUncheckedIndexedAccess`.
  - **`web/next.config.ts`** sets `turbopack.root` and `outputFileTracingRoot` to the repository
    root.
- **Spike evidence**:
  - With Next.js's generated `tsconfig` (`moduleResolution: "bundler"`, `strict: false`),
    Turbopack could not resolve the agent's NodeNext-style imports (`./schema.js`, where the
    file is `schema.ts`): "Module not found: Can't resolve '../errors.js'". Type checking also
    failed, because zod's inferred types differ when `strict` is off.
  - With `nodenext` resolution, Turbopack resolved every `.js`→`.ts` import inside `src/`:
    "✓ Compiled successfully", route `ƒ /jobs`.
  - `node:sqlite` works inside a server component. The real database copy rendered "754 jobs"
    in about 25 ms under `next start`.
- **Rationale**: nothing in `src/` changes. The agent's rules and database code stay the single
  source (FR-004).
- **Alternatives considered**:
  - Rewriting all agent imports to be extensionless or `.ts`: churn across about 100 files.
  - webpack's `extensionAlias`: it means giving up Turbopack, Next.js 16's default.

## R3. Server-first pages (FR-005)

- **Decisions**:
  - **Each page** (`web/app/<name>/page.tsx`) is a server component. It loads its first 100 rows
    with the existing `loadPageData` and renders the summary and table. The page is marked
    `dynamic = "force-dynamic"`, because every request reads the live database and config,
    as today.
  - **Infinite scroll** is a client component (`RowsList`). It takes the first page as props and
    calls a server function, `loadMoreRows(name, offset)`, to append more. The duplicate-skipping
    and version logic in `pageRows.ts` is kept.
  - **Hide** is a server action, `setJobHidden(ats, jobId, hidden)`, called from the client `HideButton`.
  - **The JSON API (`/api/pages/*` and `/api/meta`) is removed.** Its users are replaced by
    server-component data loading and server functions (FR-005). The footer's database path and
    time are rendered on the server.
  - **State loading**: one module, `web/lib/uiState.ts`, opens the database once per server
    process (cached on `globalThis` so dev reloads don't reopen it) and loads the config per
    request, as `serve.ts` does today. It uses a new `loadFileConfig(dataDir)` rather than
    `loadConfig(env)`, because `loadConfig` also validates the agent's `LLM_*` settings, and
    the build and the web app must not need agent secrets (found by /speckit-analyze, U1). The
    layout is `force-dynamic`, so nothing that reads the database is pre-rendered at build
    time.
- **Rationale**:
  - This is the idiomatic App Router design, and it is what the owner asked to learn: server
    components, server functions, and the `"use client"` boundary.
  - Rows arrive in the first HTML, so the "JavaScript off" edge case is met.
  - Only small, explicit pieces run in the browser.
- **Alternative considered**: route handlers (`app/api/.../route.ts`) for load-more. They work,
  but they keep a hand-made API, which server functions make unnecessary.

## R4. Hide's cross-site protection (FR-003)

- **Decision**: rely on Next.js's built-in origin check for server actions, plus the `Host`
  allowlist from R6. The hand-written `src/web/hide.ts` form endpoint is retired.
- **Spike evidence**, from POSTs to the server action:
  - same origin (`Origin: http://localhost:18090`): **200**, and the action ran
  - `Origin: https://evil.example`: **500**, and the action did **not** run
  - no `Origin` header: **200**. Browsers always send `Origin` on a POST, and today's endpoint
    makes the same allowance.
- **Rationale**: this is equivalent to today's `isSameOrigin` check, and it is maintained by the
  framework.

## R5. Routing, titles, redirect, not-found

- **Decision**: routes are the page folders:
  - `web/app/recommended/page.tsx`, `jobs/page.tsx`, `reasoning/page.tsx` and
    `settings/page.tsx`
  - `web/app/page.tsx` calls `redirect("/recommended")`
  - `web/app/not-found.tsx` is the not-found page
  - `web/app/layout.tsx` holds the header, nav, footer and styles

  Titles use the layout's `metadata.title.template` (`"myjobbot · %s"`) with each page's own
  `metadata.title`. `Nav` is a client component that marks the current page with
  `usePathname()` and renders Next.js `<Link>`, which handles modifier-clicks and prefetching.
  `PAGES` (address and label) stays the single list behind the menu.
- **Rationale**: adding a page means a new folder with a `page.tsx` plus one `PAGES` entry, which
  is two files (SC-004). The server needs no change.
- **Retired**: `usePath`, `NavLink`, `CurrentPage`, `useDocumentTitle`, and the server's own
  page routing.

## R6. Running the development server on the LAN (FR-006 safeguards)

- **Decisions**:
  - **The command**: `next dev web --hostname 0.0.0.0 --port ${MYJOBBOT_PORT}`, with
    `NEXT_TELEMETRY_DISABLED=1`.
  - **Host allowlist**: `web/proxy.ts` (Next.js 16's name for middleware) refuses any request
    whose `Host` is not on the list, answering 421. The list comes from `MYJOBBOT_HOSTS`, with a
    default of `localhost` and `127.0.0.1` on `MYJOBBOT_PORT`, which defaults to 8080, the port
    every script and the entrypoint pass. In Docker, `MYJOBBOT_HOSTS` is required, and the
    entrypoint refuses to start without it, so the default can't lock the LAN out. This closes DNS-rebinding
    attacks, where a malicious site's domain resolves to the LAN IP. Today's server has the
    same gap.
  - **No `allowedDevOrigins` setting is needed** for same-origin LAN use.
- **Spike evidence** (`next dev` on 0.0.0.0):
  - **Path escapes don't leak**: `/../data/config.json`, `/_next/static/../../data/config.json`,
    `/.env`, `/_next/static/chunks/../../../../.env` and others all returned 404, with no
    content leaked.
  - **Dev helper endpoints don't leak either**: `__nextjs_source-map` (204),
    `__nextjs_launch-editor` (204) and `__nextjs_original-stack-frames`, given a POST naming
    `data/config.json` and `.env`, returned no file content.
  - **LAN access is allowed**: dev scripts requested same-origin as `192.168.1.20` or
    `myserver.lan` returned 200.
  - **Cross-site use is blocked by default**: a cross-site dev script request returned **403**,
    with "Blocked cross-origin request to Next.js dev resource".
  - **Speed**: `/jobs` on 754 real jobs took 36–41 ms in dev mode, so SC-003 is met.
- **Residual risk, accepted with FR-006**:
  - The dev overlay endpoint `__nextjs_launch-editor` exists on the LAN. The container has no
    editor, so it does nothing.
  - Source maps of the web app's own code are served. That is code, not data, and it is
    already in the repository.

## R7. Docker

- **Decisions**:
  - **Image**: the Dockerfile also copies `web/`. The `web` service runs the entrypoint's
    `serve` mode, which now executes the R6 command.
  - **Mounts**: `./src:/app/src:ro` stays, and `./web:/app/web:ro` is added for live code.
  - **Writable build output**: Next.js's dev output goes to a **tmpfs** mounted at
    `/app/web/.next`, owned by uid 1000. The read-only mount stays read-only and nothing is
    written into the host checkout. Locally, `web/.next` is gitignored.
  - **No surprise writes on start**: `web/tsconfig.json` already contains every option Next.js
    insists on (the spike saw it add `resolveJsonModule`). `web/next-env.d.ts` is committed
    only if T006 shows Next.js writes the same content for `dev`, `build` and a custom
    `distDir`. Next.js 16 points that file at the output folder's route types, so it may
    differ. If it does, the file is gitignored, `typecheck` runs `next typegen web` first, and
    Docker uses the writable-mount fallback below, because `next dev` must write it.
    (Result: to be recorded here at T006.)
  - **Watch rules**: `compose.yaml` adds `web/next.config.ts` and `web/tsconfig.json` as
    rebuild triggers. Other `web/` changes are hot.
  - **Image size**: Next.js adds about 300 MB to `node_modules`: `next` is 207 MB, and the
    platform compiler `@next/swc-linux-x64-gnu` is 97 MB. Optional packages (`sharp`, the swc
    builds) can't be omitted in the image, because the compiler is one of them.
- **To verify at implementation**: that `next dev` starts with read-only `web/` and `src/`
  mounts and the tmpfs `.next`. If Next.js still insists on writing elsewhere, fall back to a
  writable `web/` mount with `distDir` set by environment variable to `.next-docker`.

## R8. Agent isolation (FR-007)

- **Decision**: the `serve` subcommand leaves `src/cli.ts`, and `myjobbot` becomes `run` only.
  The web app is started by `npm run web` (`next dev web`), by `npm run web:build` and
  `npm run web:start` (production, outside Docker, for FR-006 safeguard 4), or by the Docker
  entrypoint. Each passes `--port ${MYJOBBOT_PORT:-8080}`, so `MYJOBBOT_PORT` means the same
  thing everywhere.
  - The agent code never imports `web/`, and only `web/` imports `src/`.
  - `src/app/serve.ts`, `src/web/server.ts`, `staticFiles.ts`, `clientBuild.ts`,
    `viteConfig.ts`, `hide.ts`, `html.ts` and `reply.ts`, and the root `vite.config.ts`, are
    deleted.
  - `src/web/` keeps only the shared rules: `api.ts` (types and `PAGES`), `rowViews.ts` and
    `pageData.ts`.
- **Alternative considered**: keeping a `myjobbot serve` that runs `next`. It's an indirection
  with no benefit.

## R9. TypeScript and checks

- **Decisions**:
  - **Two TypeScript configs.** The root `tsconfig.json` excludes `web/`; `web/tsconfig.json` is
    as in R2. `npm run typecheck` runs `tsc --noEmit && tsc --noEmit -p web`, so both pass
    (FR-008).
  - **eslint** (habit-hooks) already covers `**/*.tsx`. Default exports, which Next.js requires
    for pages and layouts, are not a rule.
  - **knip**: the project `knip.json` drops the old browser entry `src/web/client/main.tsx!` and
    configures knip's `next` plugin with explicit entries: `web/next.config.ts`,
    `web/proxy.ts`, and `web/app/**/{page,layout,not-found,error}.tsx`. The plugin's defaults
    assume the app is at the repository root.
- **To verify at implementation**: that knip treats server-action modules (`"use server"`)
  imported by client components as used.

## R10. Tests

- **Decisions**:
  - **Shared rules** (`loadPageData`, `rowViews`): the assertions in `tests/webApi.test.ts`
    become direct tests of `loadPageData` in `tests/pageData.test.ts`. The data is the same; it
    just isn't fetched over HTTP any more.
  - **Server actions and functions** live in `web/lib/actions.ts` as thin wrappers over testable
    plain functions taking `JobViews`, in `web/lib/rows.ts`. Those functions are unit-tested in
    the `node` project.
  - **Components**: the `dom` project still renders client components with Testing Library.
    `next/navigation` (`usePathname`) and `next/link` are mocked with `vi.mock` where used.
    Server components are synchronous (the database API is synchronous), so they can be called
    as functions or rendered in tests with mocked state.
  - **End to end**: `tests/webServer.test.ts` is replaced by `tests/webBuild.test.ts`, which runs
    `next build web` once and checks the route list. The live checks (`next start` and
    `next dev`: pages, the Host allowlist, cross-site action refusal, probes for files outside
    the app) move to `quickstart.md` as manual and Docker checks. A browser test runner would
    be heavier than this project needs.
- **Rationale**: every one of today's scenarios keeps an automated home except the HTTP plumbing,
  which Next.js now owns. The carry-over table in tasks will list each.

## R11. Dependencies

- **Decision**: add `next` `16.4.0`, exact-pinned, to `dependencies`.
  - `react` and `react-dom` stay.
  - `vite` and `@vitejs/plugin-react` move to `devDependencies`, still needed by vitest's `dom`
    project but no longer at run time.
- **Spike evidence**: a plain `npm install --save-exact next@16.4.0` this time kept every
  optional platform entry: 8 `@next/swc-*`, 15 `@rolldown/binding-*` and 28 `@img/*` (sharp).
  Still check the counts after installing, per the memory note. Use the splice only if any
  count drops.
- **Rationale**: one framework dependency, and the Vite runtime dependency goes away.

## R12. Walkthrough

- **Decision**: `docs/react-walkthrough.md` is restructured for Next.js:
  - Sections 1–3 (components, props, state) and 7 (lists and keys) keep their ideas with new
    paths.
  - Section 4 (effects) loses `usePath` and gains `useWhenVisible` as its main example.
  - Section 6 (loading data) becomes server components plus server functions.
  - New sections cover routing folders, layouts, not-found and the redirect, and
    `"use client"` versus server code.
  - Section 10 (build and serve) covers `next dev` and `next build`.
  - Exercises: Exercise 3 (match threshold on Settings) becomes a pure server-component change,
    and a new exercise adds a page folder.

  `tests/walkthrough.test.ts` scans `web/` instead of `src/web/client/`.

## R13. Constitution

The gates come from `.specify/memory/constitution.md` v1.2.0, re-ratified 2026-10-14. It
restores the five principles of v1.0.0, which feature 002 cited and which were lost when the
file was reset to the template, and extends I and III to `web/`:
- **I. Habit-hooks clean at all times**: size limits and knip, now in `web/` too
- **II. Test-first, checked before done**: tests in `tests/`, `npm run check` green
- **III. Purpose comments only**: one-line doc comments on every function in `src/` and `web/`,
  including components, hooks and server actions
- **IV. Bounded, locked dependencies**: libraries are allowed once the owner approves one from a
  list of options (Next.js was chosen over React Router, TanStack Router and Wouter); `next`
  exact-pinned, optional platform entries kept
- **V. Specs live in docs/specs**: this feature is in `docs/specs/003-nextjs-web-ui/`
