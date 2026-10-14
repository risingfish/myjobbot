---
description: "Task list for Next.js Web UI"
---

# Tasks: Next.js Web UI

**Input**: Design documents from `docs/specs/003-nextjs-web-ui/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R13), data-model.md, contracts/web-ui.md, quickstart.md

**Tests**: Included. Each test task is written to fail first, and the implementation task after it
makes it pass. `npm run check` must be green at the end of each atomic unit.

**Organization**: Grouped by user story (spec.md US1–US4), with a final phase for switching
Docker over.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1–US4)

## Rules for every task

- **Work happens in a git worktree.** Every task below runs in the worktree from T001, for
  example `/home/zac/code/myjobbot-nextjs` on branch `nextjs-web-ui`, never in the main checkout.
  - **Why**: the Docker containers mount the main checkout's `src/` live, and this feature removes
    the `serve` command they run, so working in place would take the LAN UI down.
  - **What it changes**: the main checkout keeps serving `main` until T045.
  - **Checking work**: the main checkout's Stop hook does not inspect the worktree, and the
    per-file PostToolUse hook checks the main checkout too, so neither gives feedback here.
    Run `habit-hooks` inside the worktree after **every** task, and `npm run check` at every
    checkpoint.
- **habit-hooks applies to `web/` as well as `src/`**:
  - functions and components at most 12 lines, at most 3 parameters, files at most 200 lines
  - `===` only, no unused code
  - a one-line `/** … */` purpose comment on every function, component, hook, server action and
    page in `src/` and `web/`
  - no other comments
  - `"use client"` and `"use server"` are directives, not comments
- **No exemptions**: no `eslint-disable`, no snoozes, no `ignoreDependencies` additions.
- **Imports**:
  - **In `web/`**: NodeNext style with `.js` extensions, matching `web/tsconfig.json`. Shared
    rules are imported from `src/web/` by relative path, for example
    `../../src/web/pageData.js`.
  - **In `src/`**: never import from `web/` (FR-007).
- **Edit files safely.** Use the Edit/Write tools, or scripts that read the whole file before
  writing it. Never open a file for writing before reading it.
- **Commits**: only when the user asks.

## Scenario carry-over (SC-002)

Tick each row when its new test passes. Delete a test file only when every row from it is ticked.

| Today's test | New home |
|---|---|
| webApi: threshold with reasoning and publisher | `tests/pageData.test.ts` |
| webApi: title boosts lift over threshold | `tests/pageData.test.ts` |
| webApi: excluded companies drop and are marked | `tests/pageData.test.ts` |
| webApi: base and bonus breakdown with boosts in the description | `tests/pageData.test.ts` |
| webApi: all jobs marks title-filter hides | `tests/pageData.test.ts` |
| webApi: only http(s) postings carry a link | `tests/pageData.test.ts` |
| webApi: long-open postings flagged as ghosts | `tests/pageData.test.ts` |
| webApi: pages of 100 with next offsets | `tests/pageData.test.ts` |
| webApi: invalid offset gives the first page | `tests/webRows.test.ts` (`loadRows` refuses a bad offset, per data-model) |
| webApi: reasoning lists verdicts with run and time | `tests/pageData.test.ts` |
| webApi: meta reports the database and time | `tests/client/footer.test.tsx` (`Footer` renders `dbPath` and time) |
| webApi: uncached JSON, JSON 404s | Retired with the JSON API (FR-005). Replaced by `tests/webBuild.test.ts`, which checks that no `/api` routes exist |
| webApi: failing load gives a 500 and the server keeps answering | `tests/webRows.test.ts` (`loadRows` reports the error message); `web/app/error.tsx` covered by `tests/client/errorPage.test.tsx` |
| webServer: page addresses serve the app | `tests/webBuild.test.ts` (route list); quickstart (live) |
| webServer: assets cached, nothing outside the assets folder | quickstart probes (Next.js serves the assets) |
| webServer: root redirect, unknown paths, wrong methods | `tests/webBuild.test.ts` (`/` redirects, `not-found` route); quickstart (live) |
| webServer: missing build gives a 500 | Retired: there is no separate build step to miss. Covered by `tests/client/errorPage.test.tsx` |
| clientBuild: Vite builds into the given folder; private temp folder | Retired with the Vite build. Replaced by `tests/webBuild.test.ts` |
| hideJobs: hiding removes from recommended and marks in all jobs | `tests/webRows.test.ts` (`setHiddenFor` plus `loadPageData`) |
| hideJobs: unhiding brings it back | `tests/webRows.test.ts` |
| hideJobs: fetch requests get 204 | Retired with `/hide` (contract change) |
| hideJobs: rejects other sites, unknown jobs, malformed forms | Other sites: Next.js origin check, quickstart probe. Unknown job: `tests/webRows.test.ts` (`ok: false`). Malformed input: `tests/webRows.test.ts` (refused) |
| hideJobs: unknown back path redirects | Retired with `/hide` |
| hideJobs: stays hidden when re-fetched | Kept in `tests/hideJobs.test.ts` (store-level test, unchanged) |
| client/nav (5) | `tests/client/nav.test.tsx` against `web/components/menus/Nav.tsx`, with `usePathname` mocked. The popstate and pushState tests become "Link rendering and marking" tests; back and forward are Next.js's job and are checked in the quickstart |
| client/rowsPage (5) | `tests/client/rowsList.test.tsx` (summary, headers, empty, kinds). The abort test is retired: the first page comes from the server, not a fetch |
| client/hide (5), loadMore (5) | Same files, rewritten against `RowsList`, with `loadMoreRows` and `setJobHidden` mocked through `vi.mock("../../web/lib/actions.js")` |
| client/jobRow (6), verdictRow (2) | Unchanged apart from import paths |
| client/settings (2) | `tests/client/settings.test.tsx` renders the settings page component; its title metadata is checked |
| walkthrough (3) | Unchanged; it scans `web/` |

---

## Phase 1: Setup

- [X] T001 Create the worktree. Use the `superpowers:using-git-worktrees` skill. The branch
  `nextjs-web-ui` already exists and holds uncommitted work:
  - the 003 spec documents
  - constitution v1.2.0 and the matching `CLAUDE.md` rules
  - the `compose.yaml` port mapping and its `README.md` row

  1. With the user's OK, commit **everything** uncommitted on `nextjs-web-ui` (check with
     `git status`), because the worktree only sees committed files. Before committing, delete
     the Sync Impact Report comment at the top of the constitution; it is for review only.
  2. Switch the main checkout back to `main` (`git switch main`), because a branch can be
     checked out in only one place, and the Docker containers should mount `main`'s `src/`.
  3. Run `git worktree add ../myjobbot-nextjs nextjs-web-ui`.

  From here on, every task runs in `../myjobbot-nextjs`.
- [X] T002 In the worktree, run `npm ci` and `npm run check`. It must pass with 242 tests.
  Record the count in this file's notes.
- [X] T003 Install `next` 16.4.0 exact-pinned (`npm install --save-exact next@16.4.0`). Then:
  1. Check the lockfile kept its optional platform packages:
     - `grep -c '"node_modules/@next/swc-' package-lock.json` must be 8
     - `@rolldown/binding-` must be 15
     - `"node_modules/@img/` must be at least 28
  2. If any count is lower, use the splice from the memory note.
  3. Keep `vite` and `@vitejs/plugin-react` in `dependencies` for now. T040 moves them.
  4. Run `npm ls next` and confirm a single 16.4.0.

---

## Phase 2: Foundational (the Next.js project frame)

**Purpose**: `web/` builds, type-checks and is understood by knip before any page moves in. Atomic
unit T004–T012.

- [X] T004 [P] Write `tests/webBuild.test.ts` (node project, 120 s timeout). It runs
  `next build web` with:
  - `NEXT_TELEMETRY_DISABLED=1`
  - `NEXT_DIST_DIR=.next-test`, so it never collides with a running `npm run web`
  - an environment with **no** `LLM_*`, `JSEARCH_API_KEY`, `MYJOBBOT_DATA_DIR` or
    `MYJOBBOT_HOSTS` variables, because building must not need agent secrets or data

  It asserts:
  - the exit code is 0
  - the route list printed includes `/`, `/recommended`, `/jobs`, `/reasoning`, `/settings` and
    `/_not-found`
  - there are no `/api` routes
  - if T006 decided to commit `web/next-env.d.ts`, the build left it unchanged
    (`git diff --exit-code web/next-env.d.ts`)
- [X] T005 [P] Write `tests/proxy.test.ts`. It imports `proxy` and `config` from `web/proxy.ts`
  and builds `NextRequest` objects. Cases:
  - **Defaults**: with `MYJOBBOT_HOSTS` and `MYJOBBOT_PORT` unset, `localhost:8080` and
    `127.0.0.1:8080` pass through and `localhost:3000` gets 421. With `MYJOBBOT_PORT=9000`,
    `localhost:9000` passes.
  - **Foreign host**: `evil.example:8080` gets 421.
  - **Custom list**: `MYJOBBOT_HOSTS="myserver.lan:8080,192.168.1.20:8080"` (stubbed with
    `vi.stubEnv`) lets those two through, `MyServer.LAN:8080` too because matching ignores
    case, and refuses everything else.
  - **No `Host`**: refused.
- [X] T006 Create `web/tsconfig.json` (research R2):
  - `"module": "nodenext"`, `"moduleResolution": "nodenext"`
  - `strict`, `noUncheckedIndexedAccess`, `jsx: "react-jsx"`, `isolatedModules`,
    `resolveJsonModule`, `incremental`
  - `lib` ES2023 plus DOM, `types` node, plugin `next`
  - `include` `next-env.d.ts`, `.next/types/**/*.ts`, `.next/dev/types/**/*.ts`, `**/*.ts` and
    `**/*.tsx`

  The `include` list names only the default `.next` folder's types on purpose: `typecheck` uses
  the default folder, and the `.next-test` and `.next-docker` outputs are never type-checked.

  **Decide how `web/next-env.d.ts` is handled.** Next.js 16 writes this file's `routes.d.ts`
  import to match the output folder and whether it is running `dev` or `build`, so a committed
  copy may churn. Check it:
  1. Run `next dev web` until it is ready, then stop it, and save the file.
  2. Run `next build web`, then `NEXT_DIST_DIR=.next-test next build web`, saving the file after
     each.
  3. Compare the three copies.

  - **All three identical**: commit the file. The read-only Docker mount then never needs to
    write it (research R7). T004 asserts the build leaves it unchanged.
  - **Any difference**:
    - add `web/next-env.d.ts` to `.gitignore` and let Next.js generate it
    - make T011's `typecheck` run `next typegen web` before `tsc --noEmit -p web`
    - T038 uses research R7's writable-mount fallback, because `next dev` must write the file
  - **Record** which case applied in research R7 and in this file's notes.

  Either way, confirm Next.js left `web/tsconfig.json` unchanged
  (`git diff --exit-code web/tsconfig.json`).
- [X] T007 Create `web/next.config.ts`:
  - `turbopack: { root: <repo root> }` and `outputFileTracingRoot: <repo root>`, both from
    `fileURLToPath(new URL("..", import.meta.url))`
  - `poweredByHeader: false`
  - `distDir: process.env.NEXT_DIST_DIR ?? ".next"`, so the build test and the Docker fallback
    can use their own folders
  - no `allowedDevOrigins` (research R6)
- [X] T008 Create `web/proxy.ts`. Export `proxy(request)` and `config` (matcher: all paths). It
  answers 421 unless `request.headers.get("host")`, lowercased, is in `allowedHosts()`. That
  reads `MYJOBBOT_HOSTS` (comma-separated `host:port`, lowercased) or defaults to
  `localhost:${port}` and `127.0.0.1:${port}`, where `port` is
  `process.env.MYJOBBOT_PORT ?? "8080"`. That matches the `--port` every script and the entrypoint
  pass, and the host port `compose.yaml` publishes. Keep each function at most 12 lines. T005 must pass.
- [X] T009 Let the web app load config without agent secrets, test first (Principle II):
  1. **Test**: add a case to `tests/config.test.ts`: `loadFileConfig(makeDataDir())` works with
     **no** LLM environment variables. Run it and watch it fail.
  2. **In `src/config/load.ts`**: export `loadFileConfig(dataDir: string): FileConfig`, which
     reads and parses `config.json` with `fileConfigSchema`, reusing `readConfigJson`. Rewrite
     `loadConfig` to call it. The test passes, and so do the existing config tests.

  Then create `web/lib/uiState.ts` (its callers are covered by T004's build and the US1/US2
  tests):
  - **`dbPath()`** returns `join(dataDir, "myjobbot.db")`, where `dataDir` is
    `process.env.MYJOBBOT_DATA_DIR ?? "data"`. It reads no files, so the layout can call it
    without loading the config.
  - **`getUiState()`** returns `{ views, config, dbPath }`.
  - `views` comes from a `JobViews` over `openDatabase(dbPath())`, cached on
    `globalThis.__myjobbotViews`
  - `config` comes from `loadFileConfig(dataDir)` on every call

  It never calls `loadConfig` or reads `LLM_*` variables.
- [X] T010 Create the app frame:
  - **`web/app/layout.tsx`**: `<html lang="en"><body>{children}</body></html>`,
    `metadata = { title: { template: "myjobbot · %s", default: "myjobbot" } }`, and
    `export const dynamic = "force-dynamic"`. The layout reads the database for the footer
    (T025), so nothing using it, including `not-found`, may be pre-rendered at build time.
  - **`web/app/page.tsx`**: `redirect("/recommended")`.
  - **`web/app/not-found.tsx`**: `<p>Not found</p>`.
  - **Placeholder pages** at `web/app/{recommended,jobs,reasoning,settings}/page.tsx`, each
    rendering its label, exporting `metadata.title` and marked `dynamic = "force-dynamic"`. The
    data pages call `getUiState()` and render `loadPageData(name, …).summary`, so `uiState.ts`
    has a caller.
- [X] T011 Wire up the tooling:
  - **Root `tsconfig.json`**: add `"exclude": ["web"]`.
  - **`package.json` scripts**:
    - `"typecheck": "tsc --noEmit && tsc --noEmit -p web"`
    - `"web": "NEXT_TELEMETRY_DISABLED=1 next dev web --port ${MYJOBBOT_PORT:-8080}"`
    - `"web:build": "NEXT_TELEMETRY_DISABLED=1 next build web"`
    - `"web:start": "NEXT_TELEMETRY_DISABLED=1 next start web --port ${MYJOBBOT_PORT:-8080}"`
  - **`.gitignore`**: add `web/.next*/`, which covers `.next`, `.next-test` and `.next-docker`.
  - **`knip.json`**:
    - add `"next": { "entry": ["web/next.config.ts", "web/proxy.ts", "web/app/**/{page,layout,not-found,error}.tsx"] }`
    - keep `src/web/client/main.tsx!` for now; T033 removes it
    - add `"web/**/*.{ts,tsx}!"` to `project`
- [X] T012 Run `npm run check` in the worktree. T004, T005 and T009's config test pass, and so do
  all 242 existing tests. Fix every habit-hooks finding without exemptions. If knip doesn't see
  `web/` files through its `next` plugin entries, fix the plugin config (research R9). That
  closes atomic unit T004–T012.

**Checkpoint**: `npm run web` serves placeholder pages with the right titles. `/` redirects.
Unknown paths show "Not found". No LLM settings are needed.

---

## Phase 3: User Stories 1 + 2 - the same UI, with scrolling and Hide, in Next.js (Priority: P1) 🎯 MVP

**Why one phase**: the components move out of `src/web/client/` as one set, using `git mv` so
jscpd never sees two copies. The old Vite app stops working the moment they move, which is
harmless in the worktree. US1 (pages and navigation) and US2 (scrolling and Hide) share those
components, so they land in one atomic unit, T013–T034, with separate test tasks per story.

**Independent tests**:
- **US1**: `npm run web`, then all four pages show the same rows, notes, menu marking and titles
  as `main` on a copy of `data/`. Back, forward and reload work.
- **US2**: All jobs loads 100 rows at a time while scrolling. Hide and Unhide work, with failures
  shown.

### Tests for US1 (write first)

- [X] T013 [P] [US1] Create `tests/pageData.test.ts` from the rule cases in
  `tests/webApi.test.ts` (carry-over rows 1–8 and 10). Call
  `loadPageData(name, { views, config, page, now: TEST_NOW })` directly instead of over HTTP,
  with the same seeds and expectations.
- [X] T014 [P] [US1] Rewrite `tests/client/nav.test.tsx` against
  `web/components/menus/Nav.tsx`:
  - Use `vi.mock("next/navigation", () => ({ usePathname: () => currentPath }))`.
  - Mock `next/link` as a plain `<a>` that passes `href` and `className`.
  - **Marking**: the link for the mocked path has `className` `current` and the others don't.
  - **Links**: every `PAGES` entry renders an `<a href>` in order.
- [X] T015 [P] [US1] Create `tests/client/footer.test.tsx`. Render
  `web/components/sections/Footer.tsx` with `dbPath="test.db"` and a fixed `renderedAt`, and
  expect the text `test.db · rendered <iso>`. Create `tests/client/errorPage.test.tsx`: render
  `web/app/error.tsx` with `error: new Error("broken <db>")`, expect the message shown as text,
  and expect no `script` elements.
- [X] T016 [P] [US1] Update `tests/client/jobRow.test.tsx` and `tests/client/verdictRow.test.tsx`
  to import from `web/components/tables/*`. The assertions don't change.
- [X] T017 [P] [US1] Rewrite `tests/client/settings.test.tsx` to render the default export of
  `web/app/settings/page.tsx`. Expect `<main>` with no children, and `metadata.title` equal to
  `"Settings"`.

### Tests for US2 (write first)

- [X] T018 [P] [US2] Create `tests/webRows.test.ts`, covering `web/lib/rows.ts`:
  - **`loadRows(views, config, { name, offset })`** returns `loadPageData`'s slice.
  - **Bad input is refused**: an unknown name, or an offset that is negative, not an integer or
    too large, throws `"Invalid page request"`. A `views` that throws gives an `Error` whose
    message is the cause.
  - **`setHiddenFor(views, { ats, jobId, hidden })`**:
    - a known job gives `{ ok: true }`, and `loadPageData` then reflects the change: removed from
      recommended, `hidden: true` on jobs, and back again after unhiding (carry-over hideJobs
      rows 1 and 2)
    - an unknown job gives `{ ok: false, error: "No such job." }`
    - a non-boolean `hidden` or an empty `ats` is refused
- [X] T019 [P] [US2] Rename `tests/client/rowsPage.test.tsx` to `tests/client/rowsList.test.tsx`
  and rewrite it against `web/components/pages/RowsList.tsx`, given `initial: PageData` and
  `name`:
  - the summary is shown
  - the headers match each row kind
  - `total: 0` shows the empty text and no table
  - the server-rendered output, from `renderToString(<RowsList …/>)`, contains a `<noscript>`
    notice: "Loading more rows and Hide need JavaScript."
- [X] T020 [P] [US2] Rewrite `tests/client/hide.test.tsx` and `tests/client/loadMore.test.tsx`
  against `RowsList`, with
  `vi.mock("../../web/lib/actions.js", () => ({ setJobHidden: vi.fn(), loadMoreRows: vi.fn() }))`
  replacing `stubFetch`. Every scenario stays:
  - Hide per page, and the failure message
  - the button disabled while saving
  - scrolling loads more once
  - the Load more button
  - a failed load keeps the rows
  - shifted rows are not duplicated
  - a hide during a load skips no job

  Each scenario asserts against the mocked actions instead of fetched URLs.

### Implementation (atomic unit T021–T034)

- [X] T021 [US1] `git mv` the components and helpers:
  - `src/web/client/components/` to `web/components/` (keeping the subfolders)
  - `src/web/client/styles.css` to `web/app/styles.css`
  - `src/web/client/{pageRows,useWhenVisible,useHide,usePageRows}.ts` to `web/lib/`

  Recompute every relative import from the files' new locations with a script. Imports of
  `../../api.js` and similar become `../../../src/web/api.js` and so on.

  Also move `PAGES` and `PAGE_NAMES` out of `src/web/api.ts` into a new `web/lib/pages.ts`.
  `src/` keeps only the `PageName` type, which `pageData.ts` needs, so adding a page never
  touches `src/` (SC-004). Update every importer.
- [X] T022 [US1] Retire the client-only routing and fetching:
  - `git rm` `src/web/client/usePath.ts`, `useDocumentTitle.ts`, `useMeta.ts`, `fetchJson.ts`,
    `App.tsx`, `main.tsx` and `index.html`
  - `git rm` `web/components/menus/NavLink.tsx` and `web/components/pages/CurrentPage.tsx`
  - `git rm` `web/components/pages/RowsPage.tsx`, which T026 replaces
- [X] T023 [US1] Rewrite `web/components/menus/Nav.tsx` as `"use client"`. It uses
  `usePathname()` and renders `PAGES` from `web/lib/pages.ts` as `next/link`
  `<Link href className>` (`"current"` when it matches). T014 must pass.
- [X] T024 [US1] Rewrite `web/components/sections/Header.tsx` (moved by T021) as a server component rendering
  `<header><h1>myjobbot</h1><Nav /></header>`. Rewrite `web/components/sections/Footer.tsx` as a
  server component taking `{ dbPath, renderedAt }`. T015's footer test must pass.
- [X] T025 [US1] Finish `web/app/layout.tsx`:
  - import `./styles.css`
  - render `<Header />`, `{children}` and `<Footer>` with `dbPath()` (not `getUiState()`) and
    `new Date().toISOString()`
  - keep the title template and `dynamic = "force-dynamic"`

  Create `web/app/error.tsx` (`"use client"`, shows `error.message` as text). T015's error-page
  test must pass.

  **Why the layout must not call `getUiState()`**: a bad `config.json` (for example a bad
  `exclude_publishers` entry) makes `getUiState()` throw. `app/error.tsx` catches errors from
  pages but not from the root layout, so a layout error would show Next.js's default error
  screen instead of the message (spec edge case). Config loading therefore happens only in the
  pages and server functions. Check this by hand: break the config on the scratch copy and load
  `/jobs`. The message must show inside the usual header and footer.
- [X] T026 [US2] Create `web/components/pages/RowsList.tsx` (`"use client"`).
  - **Props**: `{ name: PageName; initial: PageData }`.
  - **State**: `usePageRows(name, initial)`, as reshaped in T028.
  - **Renders**: the summary, the empty text or the right table, `LoadMore` when `nextOffset`
    is not null, and `HideButton` per job row.
  - **No-JavaScript notice**: above the table, render
    `<noscript><p className="note">Loading more rows and Hide need JavaScript.</p></noscript>`,
    so with JavaScript off the page says why those controls do nothing (spec edge case).

  Port the logic of the old `RowsPage` and `Rows`, keeping each function at most 12 lines.
- [X] T027 [US2] Create `web/lib/rows.ts`:
  - **`loadRows(views, config, request)`**:
    - validates `request.name` against `PAGE_NAMES` and `request.offset` as an integer in
      `[0, 1_000_000]`, throwing `"Invalid page request"` otherwise
    - returns `loadPageData` with a page size of 100
  - **`setHiddenFor(views, change)`**:
    - validates with zod (`ats`, `jobId` non-empty strings, `hidden` boolean)
    - calls `views.setHidden`
    - returns `{ ok: true }` or `{ ok: false, error: "No such job." }`

  Create `web/lib/actions.ts` (`"use server"`) with `loadMoreRows(name, offset)` and
  `setJobHidden(ats, jobId, hidden)`, each a two-line wrapper calling `getUiState()` and the
  matching `rows.ts` function. T018 must pass.
- [X] T028 [US2] Reshape `web/lib/usePageRows.ts` to `usePageRows(name, initial)`:
  - state starts at `{ data: initial, error: null, moreError: null, version: 0 }`
  - the first-page fetch effect is removed
  - `loadMore` calls `loadMoreRows(name, nextOffset)` from `./actions.js` instead of
    `fetchJson`, keeping the loading ref, `withMore` with the version check, and duplicate
    skipping

  Change `web/lib/useHide.ts` to call `setJobHidden(job.ats, job.jobId, !job.hidden)` and treat
  `ok: false`, or a rejected promise, as failed.
- [X] T029 [US1] Make the four pages real:
  - **Data pages**: `web/app/{recommended,jobs,reasoning}/page.tsx` load
    `loadRows(views, config, { name, offset: 0 })` from `getUiState()` and render
    `<main aria-label={label}><RowsList name initial /></main>`. Each keeps its
    `metadata.title` and `dynamic = "force-dynamic"`.
  - **Settings**: `web/app/settings/page.tsx` renders `<main aria-label="Settings" />`.
  - **Old Settings component**: delete `web/components/pages/SettingsPage.tsx`; the page itself
    is the component now.
- [X] T030 [US1] Delete the old server stack:
  - `git rm` `src/app/serve.ts`, and from `src/web/`: `server.ts`, `staticFiles.ts`,
    `clientBuild.ts`, `viteConfig.ts`, `hide.ts`, `html.ts` and `reply.ts`
  - `git rm` the root `vite.config.ts`
  - in `src/cli.ts`, remove the `serve` command and its dynamic import; the usage becomes
    `usage: myjobbot run`
  - update `tests/cli.test.ts`'s usage assertion
  - remove `MYJOBBOT_HOST` and `MYJOBBOT_PORT` from `envSchema` in `src/config/schema.ts`, since
    `serve.ts` was their only reader. The port is read by the scripts, the entrypoint and
    `web/proxy.ts` straight from the environment. `--hostname 0.0.0.0` is fixed in the
    entrypoint.
  - in `.env.example`, replace the `MYJOBBOT_HOST` and `MYJOBBOT_PORT` lines with a commented
    `MYJOBBOT_PORT=8080` under a "Web UI (npm run web, Docker web service)" heading
- [X] T031 [US1] Update the tests and their helpers:
  - `git rm` `tests/webApi.test.ts` and `tests/webServer.test.ts`, once their carry-over rows
    are ticked
  - `git rm` `tests/clientBuild.test.ts`, `tests/helpers/clientDir.ts` and `tests/helpers/ui.ts`
  - `git rm` `tests/helpers/fetchStub.ts` if no test still uses it
  - in `tests/hideJobs.test.ts`, keep only the store-level re-fetch test and drop the HTTP
    helpers
- [X] T032 [US1] Update `vitest.config.ts`. The `dom` project keeps
  `include: ["tests/**/*.test.tsx"]`. In `tests/helpers/domSetup.ts`, add nothing global: mock
  Next.js modules per test file. If server-only imports such as `node:sqlite` get pulled into a
  component test, mock `web/lib/uiState.js` in that file.
- [X] T033 [US1] Update `knip.json`: remove the `src/web/client/main.tsx!` entry. Confirm with
  `npx knip` that `web/lib/actions.ts` (`"use server"`), reached only from client components, is
  treated as used (research R9). If it isn't, add it to the `next` plugin's `entry` with a
  one-line note in research R9.
- [X] T034 [US1] Run `npm run check` in the worktree, which closes atomic unit T013–T034:
  - both tsconfigs pass
  - every test passes, including `webBuild`
  - habit-hooks is clean
  - every carry-over row from webApi, webServer, clientBuild, hideJobs and the client tests is
    ticked

**Checkpoint (MVP)**: run `MYJOBBOT_DATA_DIR=<copy of data/> npm run web` in the worktree, then:
- open all four pages and compare them with the live UI from the main checkout
- scroll All jobs
- Hide and Unhide on the copy
- check back, forward and reload

---

## Phase 4: User Story 3 - adding a page is one folder (Priority: P2)

**Independent Test**: add a throwaway `web/app/about/page.tsx` and a `PAGES` entry. It works by
address, menu and reload, with no other file touched. Then revert it.

- [X] T035 [US3] Prove SC-004. In the worktree:
  1. Add `web/app/about/page.tsx` (with `metadata.title` "About") and
     `{ path: "/about", label: "About" }` to `PAGES` in `web/lib/pages.ts`.
  2. Run `npm run web:build` and confirm `/about` is in the route list.
  3. `git diff --stat` must list exactly those two files, both inside `web/`.
  4. Revert both, and record the result in this file's notes.

---

## Phase 5: User Story 4 - learning Next.js from the code (Priority: P2)

- [X] T036 [P] [US4] Update `tests/walkthrough.test.ts`. `CLIENT` becomes `"web"`. Scan
  `web/**/*.{ts,tsx}` recursively, excluding `web/.next*`. The platform-name allowlist gains
  `Link`, `usePathname`, `redirect` and `notFound`.
- [X] T037 [US4] Restructure `docs/react-walkthrough.md` (research R12):
  - **New layout section**: `web/app/` routes, `web/components/` grouped by kind, `web/lib/`
    for hooks, server functions, state and `pages.ts`, and the shared rules in `src/web/`.
  - **Server and client components**: pages and `Header` versus `RowsList` and `HideButton`,
    and why `"use client"` sits where it does.
  - **Routing**: page folders, `layout.tsx`, `not-found.tsx`, `error.tsx`, the redirect in
    `page.tsx`, and `Nav` with `usePathname` and `Link`.
  - **Server functions**: `web/lib/actions.ts` over `web/lib/rows.ts`, and how the origin check
    protects them.
  - **Sections 3, 4, 6, 7, 8 and 9** keep their ideas with the new paths. The effects section
    uses `useWhenVisible`.
  - **"How it's built and served"** covers `npm run web`, `web:build` and `web:start`, Docker's
    `next dev`, and the Host allowlist (`MYJOBBOT_HOSTS`).
  - **Exercises**:
    1. A hidden-job count, unchanged.
    2. A Reasoning filter, now a client component in `web/components/forms/`.
    3. The match threshold on Settings, now a pure server change in
       `web/app/settings/page.tsx` that reads `getUiState().config.match_threshold`.
    4. New: add a page folder (the T035 steps).

  T036 must pass.

---

## Phase 6: Switch Docker over (FR-006, FR-007)

**Purpose**: the Docker `web` service runs `next dev` with the safeguards. The stack is checked
from the worktree first, then switched in the main checkout (T045).

- [X] T038 Update the Docker files in the worktree:
  - **`Dockerfile`**: `COPY web ./web` after `COPY src ./src`.
  - **`docker/entrypoint.sh`**: the `serve` case:
    - **Refuses to start** with `myjobbot: set MYJOBBOT_HOSTS to the host:port names you open
      the UI with (for example myserver.lan:8080,192.168.1.20:8080)` when `MYJOBBOT_HOSTS` is
      unset. Otherwise the Host allowlist would refuse every LAN request.
    - **Then runs** `exec node_modules/.bin/next dev web --hostname 0.0.0.0 --port "${MYJOBBOT_PORT:-8080}"`
      with `NEXT_TELEMETRY_DISABLED=1` exported.
    - **Drops the `MYJOBBOT_WATCH` branch**, because dev is always live.
  - **`compose.yaml`**:
    - the `web` service gains the volume `./web:/app/web:ro` and
      `tmpfs: ["/app/web/.next:uid=1000,gid=1000,mode=0700"]`
    - `MYJOBBOT_HOSTS` comes from `.env`, through the existing `env_file`. Add it to
      `.env.example` with a commented example.
    - keep the `ports` entry `"${MYJOBBOT_PORT:-8080}:${MYJOBBOT_PORT:-8080}"` (already on
      `nextjs-web-ui`, 2026-10-14), so the published port, the container port and the proxy's
      default all follow `MYJOBBOT_PORT`
    - remove `MYJOBBOT_WATCH: "1"` and `MYJOBBOT_HOST: 0.0.0.0` from the `web` service
    - the `develop.watch` rules gain `web/next.config.ts` and `web/tsconfig.json` as rebuild
      triggers
  - **`tests/docker.sh`**: update its `serve` checks:
    - expect HTML from `/recommended` with rows, with `MYJOBBOT_HOSTS` set
    - expect the entrypoint to refuse to start without `MYJOBBOT_HOSTS`
    - drop the watch-mode case, and the `-e MYJOBBOT_HOST=0.0.0.0` flag on its `docker run`
- [X] T039 Try the new stack from the worktree as a separate Compose project, so the live stack
  is untouched:
  1. **Prepare scratch data** in the worktree's gitignored `data/`:
     ```bash
     mkdir -p data
     cp ../myjobbot/data/config.json ../myjobbot/data/resume.md data/
     sqlite3 -readonly ../myjobbot/data/myjobbot.db ".backup 'data/myjobbot.db'"
     ```
     Then copy `../myjobbot/.env` to `.env` in the worktree. It is gitignored; never print it.
  2. **Run the stack**:
     `docker compose -p mjnext build && docker compose -p mjnext run --rm -p 18080:8080 -e MYJOBBOT_HOSTS=localhost:18080 web serve`.
     `-e` overrides `.env`, and inside the container `MYJOBBOT_PORT` defaults to 8080.
  3. Run quickstart Docker checks 1–5 against `localhost:18080`:
     - pages render
     - a live edit shows after a reload
     - no file outside the app is served (404 or 421)
     - a foreign `Host` gets 421
     - a cross-site Hide action is refused, against the scratch copy
  4. If `next dev` refuses to start because the `web/` mount is read-only, apply research R7's
     fallback: a writable mount, with `distDir` from `NEXT_DIST_DIR=.next-docker`. Record which
     setup was used.
  5. **Stop the stack** with `docker compose -p mjnext down`. Keep the image, the worktree's
     `data/` copy and `.env`: T044 needs them. T044 cleans up.
- [X] T040 Final dependency tidy-up:
  - move `vite` and `@vitejs/plugin-react` to `devDependencies`, editing `package.json` and the
    lockfile flags with `npm install --save-dev --save-exact` and the count check from T003
  - `npm ls vite` shows one 8.3.2
  - `npm run check` is green

---

## Phase 7: Polish & Cross-Cutting

- [X] T041 [P] Update `README.md`:
  - **Web UI section**: Next.js, `npm run web`, `web:build` and `web:start`, the Host allowlist
    (`MYJOBBOT_HOSTS`), and that `myjobbot serve` is gone.
  - **Docker section**: the `web` service runs `next dev`; changes under `web/` and `src/` are
    live; `next.config.ts` and `tsconfig.json` changes rebuild the image; `MYJOBBOT_HOSTS` is
    required.
  - **Update after `git pull`** row, to match.
  - Remove the `MYJOBBOT_WATCH` / `tsx watch` paragraph.
- [X] T042 [P] Add a note to `docs/specs/002-react-web-ui/plan.md` saying its serve, Vite and
  `src/web/client` structure is superseded by `docs/specs/003-nextjs-web-ui/` (2026-10-14).
  Update the `CLAUDE.md` knip note to describe the `next` plugin entries instead of
  `src/web/client/main.tsx`. (Its doc-comment and dependency rules already match constitution
  v1.2.0.)
- [X] T043 Run a read-only review agent with shell probes over `git diff main` in the worktree.
  It checks:
  - escaping and `http(s)`-only links
  - server-action input validation and the origin check
  - the proxy's Host parsing (ports, IPv6, case)
  - that no client component imports server-only code (`node:sqlite`, `uiState`)
  - state cleanup in `RowsList`
  - that agent runs load no `web/` or `next` code (`node --trace-imports`, or a grep of the
    `src/` import graph)

  Fix every confirmed finding test-first.
- [X] T044 Run the quickstart in the worktree, using the scratch `data/` copy from T039:
  - `npm run check`
  - **Production mode**: `npm run web:build`, then `npm run web:start`, then
    `curl localhost:8080/jobs | grep -c 'class="job"'` returns 100. No LLM variables are set,
    and `MYJOBBOT_DATA_DIR` is left unset, so it reads the worktree's `data/` copy.
  - **Speed**, in production mode and again in development mode: start the scratch stack again
    with T039 step 2's command. Time each against a copy of the real database:
    - first rows within 1 s
    - Hide within 0.5 s
  - **Clean up**:
    - run `docker compose -p mjnext down` and remove its images
    - delete the worktree's `data/` copy and `.env`

  Record the results in this file's notes, mark completed tasks `[X]`, and leave the worktree's
  changes uncommitted unless the user asks to commit.
- [X] T045 Switch-over handoff, which needs the user's approval:
  1. **Ask the user which `host:port` names and IPs they open the UI with**, and add
     `MYJOBBOT_HOSTS=…` to the main checkout's `.env` with their answer.
  2. **Rebuild.** Once the branch is committed and merged (or checked out in the main checkout),
     the main checkout's `npm run docker:watch` rebuilds, because `package.json` and the
     Dockerfile change. Without the watcher, run `docker compose build && docker compose up -d`
     when `docker compose top myjobbot` shows no agent run in progress.
  3. **Check**:
     - `http://<server>:8080/recommended`
     - scheduled runs still complete (`docker compose logs myjobbot`)
  4. **Clean up**: remove the worktree with `git worktree remove ../myjobbot-nextjs`.

---

## Notes

- **T002**: baseline `npm run check` passed with 242 tests in 48 files.
- **T003**: `next` 16.4.0 installed; lockfile kept 8 `@next/swc-*`, 15 `@rolldown/binding-*` and
  28 `@img/*` entries. `npm ls next` shows one 16.4.0.
- **T006**: `next-env.d.ts` churns (dev, build and `.next-test` each point it elsewhere), so it is
  gitignored, `typecheck` runs `next typegen web`, and Docker will use the R7 writable-mount
  fallback. `web/tsconfig.json` is committed in Next.js's formatting with `.next-test` and
  `.next-docker` includes, and stays unchanged. Next.js subpaths need `.js` under `nodenext`.
- **T012**: `npm run check` green with 249 tests; habit-hooks clean. Placeholder pages verified
  under `next dev` on a copy of the data (31 recommended, 754 jobs, 720 decisions), with `/`
  redirecting (307), unknown paths 404, a foreign `Host` 421 and no LLM variables set.
- **T013–T034 (MVP)**: `npm run check` green with 239 tests (the API, server and Vite tests were
  retired or re-homed per the carry-over table; every row has its new home). Decisions made
  while implementing:
  - **`DataPage`** (`web/components/pages/DataPage.tsx`), a server component that loads the first
    rows and renders `RowsList`, so the three data pages are two-line files and jscpd sees no
    duplicates.
  - **`Environment`** type in `src/config/load.ts` replaces `NodeJS.ProcessEnv` in `src/`. Next.js's
    global types make `NODE_ENV` required on `ProcessEnv`, which reached the root typecheck once
    tests imported `web/` code.
  - **`next/link.js`** under `nodenext`: the default import is the CommonJS module, so `Nav` uses
    `NextLink.default`. Next.js's dist modules set `module.exports.default` to the component, so it
    is correct under Node, Turbopack and vitest alike.
  - **`useLoadMore`** takes `{ name, offset, version }` as one object (habit-hooks: at most 3
    parameters).
  - knip needed no extra entry for `web/lib/actions.ts` (T033).
  - **MVP checkpoint** on a copy of the data, in headless Chromium: navigation via `Link` with no
    full reload, back and forward, reload of `/reasoning`, scrolling All jobs to all 754 rows (754
    distinct jobs; 23 look alike because the same posting has several job IDs), Hide in 62 ms,
    hidden after reload, Unhide, and Recommended 31 → 30 → 31. The only console error is a
    `/favicon.ico` 404, which the old server returned too.
- **T035**: adding `web/app/about/page.tsx` and one `PAGES` entry put `/about` in the build's
  route list and touched exactly those two files, both in `web/`. Reverted. (The worktree is
  uncommitted, so this was checked by comparing `git status` and file contents before and after,
  not `git diff --stat`.)
- **T036–T037**: done inside the MVP unit, because moving the files breaks the walkthrough test
  until the walkthrough is updated.
- **T038**: Docker uses the R7 writable-mount fallback (`./web:/app/web`,
  `NEXT_DIST_DIR=.next-docker`), as T006 decided; the image copies `web/` owned by uid 1000 so
  plain `docker run` works too. `next dev` insists on `typescript`, `@types/react` and
  `@types/node` and otherwise runs an unpinned `yarn add` from the network, so those three moved
  from devDependencies to dependencies (same exact versions; lockfile `dev` flags only).
  `tests/docker.sh` now fails if the container ever tries to install packages, and gives `curl`
  timeouts.
- **T039**: run as Compose project `mjnext` with a scratch override naming the image
  `mjnext:latest`, so the live `myjobbot:latest` was never retagged. The scratch `.env` held only
  `MYJOBBOT_HOSTS`, because the web service needs no secrets, so the real `.env` was not copied.
  Quickstart Docker checks: pages render (31/100/100 rows); a live edit to `Footer.tsx` showed on
  the next request with no rebuild; nine path probes (`..`, encoded `..`, `/.env`,
  `/data/myjobbot.db`, `/src/cli.ts`, `/web/next.config.ts`) all 404 with no file contents; a
  foreign `Host` gets 421; the Hide action with `Origin: https://evil.example` gets 500 and the
  job is unchanged, while the same call from the app's origin works and was undone.
  `tests/docker.sh`: all 10 checks pass.
- **T040**: `vite` and `@vitejs/plugin-react` moved to devDependencies with no lockfile entry
  added, removed or re-versioned; `npm ls vite` shows one 8.3.2; swc 8, rolldown 15, img 28.
- **T041–T042**: README, `CLAUDE.md` (knip note, `npm run web`) and the 002 plan's superseded
  note updated.
- **T043**: a read-only review agent found no confirmed problems in escaping, server-action
  validation, the proxy, the client/server import boundary, row state, agent isolation or the
  Docker setup. It noted that IPv6 `[::1]` and trailing-dot hosts are refused unless listed,
  which fails safe.
- **T044**: `npm run check` green (239 tests). Production mode with no LLM variables: `/jobs`
  HTML holds 100 rows. Timings on a scratch database grown to 1,004 jobs, warm:
  - development (Docker `next dev`): pages 27–102 ms, Hide 19–26 ms
  - production (`web:start`): pages 9–36 ms, Hide 10–22 ms

  Targets are 1 s and 0.5 s. Scratch image, data copy and `.env` removed.
- **T045 step 1** (2026-10-14): the user opens the UI at `192.168.1.20:8080`;
  `MYJOBBOT_HOSTS=192.168.1.20:8080` was appended to the main checkout's `.env` (no other lines
  read or printed). The running stack ignores it until the switch-over.
- **Before staging**: `next dev` writes `web/AGENTS.md` (Next.js's notes for AI coding agents)
  whenever it detects one, and restores it if deleted. `agentRules: false` in
  `web/next.config.ts` turns that off, so neither local runs nor the Docker service write it into
  the checkout; `CLAUDE.md` stays the agent guide. `web/tsconfig.tsbuildinfo` (TypeScript's
  incremental cache) is gitignored.
- **T045** (2026-10-14): implementation committed as `64036cc`; the worktree was removed and the
  main checkout switched to `nextjs-web-ui`. The `docker compose watch` process was stopped, then
  `docker compose up -d --build` ran with no agent run in progress. `web` serves Next.js; a
  request naming `192.168.1.20:8080` gets 200 with rows. This machine's own LAN address
  (`192.168.2.50`) gets 421; the user confirmed `192.168.1.20:8080` is the address they use.

## Dependencies & Execution Order

- **Setup (T001–T003)** comes first. T001 must come before anything that edits files.
- **Foundational (T004–T012)** blocks everything else.
- **US1 + US2 (T013–T034)** is one atomic unit. Its tests T013–T020 can be written in parallel,
  then T021–T033 are implemented in order.
- **US3 (T035)** needs the pages and `web/lib/pages.ts`.
- **US4 (T036–T037)** needs the final file layout, so it comes after T034 and preferably after
  T035.
- **The Docker phase (T038–T040)** needs US1 + US2. T039 needs T038.
- **Polish (T041–T045)** comes last. T045 needs the user.

## Parallel Opportunities

- T004 and T005 are separate test files.
- The US1 and US2 test tasks T013–T020 touch different files and can be written in parallel.
- T041 and T042 are documentation and can run in parallel.

Same-file serialisation:
- `web/lib/usePageRows.ts`: T021, then T028
- `web/app/layout.tsx`: T010, then T025
- `knip.json`: T011, then T033
- `package.json`: T003, T011, then T040
- `src/config/load.ts`: T009 only

## Implementation Strategy

1. **Phases 1–2**: the worktree, `next` installed, and a Next.js frame that builds with no agent
   secrets, with placeholder pages and the Host proxy. Nothing live changes.
2. **MVP, Phase 3**: the whole UI in Next.js in the worktree, server-rendered with scrolling and
   Hide. Compare it with the live UI on a copy of the data.
3. **Phase 4**: prove a new page costs one folder plus one list entry, both in `web/`.
4. **Phase 5**: the walkthrough teaches the new structure.
5. **Phase 6**: try the Docker stack side by side, then tidy the dependencies.
6. **Phase 7**: the review, the quickstart, and the user-approved switch-over in the main
   checkout.
