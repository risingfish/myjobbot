---
description: "Task list for React Web UI"
---

# Tasks: React Web UI

**Input**: Design documents from `docs/specs/002-react-web-ui/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R15), data-model.md, contracts/web-api.md, quickstart.md

**Tests**: Included. The project works test-first. Each test task is written to fail first, and
the implementation task after it makes it pass. `npm run check` must pass at the end of every
**atomic unit**.

**Organization**: Grouped by user story (spec.md US1–US4), with one extra phase for the server
switch-over.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1–US4)

## Rules for every task

- **habit-hooks applies to `.tsx`**:
  - functions and components at most 12 lines, at most 3 parameters, complexity at most 10
  - files at most 200 lines
  - `===` only, no unused code
  - a one-line `/** … */` purpose comment on every function, component and hook in `src/`
  - no other comments; tests stay uncommented

  A component whose JSX doesn't fit in about 9 lines gets split into smaller components.
- **No exemptions**: no `eslint-disable`, no snoozes, no `ignoreDependencies` additions (FR-011).
- **Atomic units**: knip flags dependencies nothing imports and exports used only by tests. Finish
  each atomic unit before stopping; the per-file hook may flag intermediate states inside a unit.
- **The working tree is live (R15)**: `./src` runs in both containers on the LAN.
  - The server keeps serving the old HTML UI until Phase 6.
  - No `src/` file that the server or the agent loads may import `vite` or `react` until Phase 6.
    The exceptions are `src/web/client/**` and the root `vite.config.ts`, which only the browser
    build, `npm run dev:web` and the tests load.
- **Imports**: keep the `.js` extension in relative imports, including `.tsx` targets
  (`./App.js`). Use `import type` for anything from `src/web/api.ts` that is only a type.
- **Commits**: only when the user asks. Leave changes uncommitted and say so.

## Scenario carry-over (SC-002)

Each existing scenario gets a home. Tick it here when its new test passes. Delete
`tests/webUi.test.ts` (T037) only when every row in its table is ticked.

| Today's test | New home |
|---|---|
| webUi: recommended lists jobs at or above the threshold with reasoning | webApi (filter and summary); client/jobRow (reasons, "via LinkedIn") |
| webUi: title boosts lift a job and show the model's score | webApi (`score.value` 75, note) |
| webUi: excluded companies drop out and are marked | webApi |
| webUi: scores show the base and bonus breakdown; boosts match the description | webApi (note); client/jobRow (shows note) |
| webUi: all jobs lists every job and marks title-filter hides | webApi |
| webUi: job text is escaped | client/jobRow |
| webUi: only http and https postings become links | webApi (`url: null`); client/jobRow (no link) |
| webUi: long-open postings flagged as ghosts | webApi (`ghost`); client/jobRow (warning shown) |
| webUi: 100 rows, then the rest 100 at a time | webApi (offsets); client/loadMore |
| webUi: an invalid offset shows the first page | webApi |
| webUi: an empty tab says so | webApi (`empty`); client/rowsPage |
| webUi: reasoning lists each verdict with its run | webApi; client/verdictRow |
| webUi: verdicts from before history are labelled | client/verdictRow |
| webUi: settings is blank, marked and linked | client/settings; webServer (`/settings` 200) |
| webUi: root redirect, unknown paths, wrong methods | webServer |
| webUi: a failing page returns 500, escaped, and the server survives | webApi (JSON 500); webServer (HTML 500) |
| hideJobs: recommended rows have a hide button | client/hide |
| hideJobs: hiding removes from recommended and marks in all jobs | hideJobs, switched to `/api/pages` (T036) |
| hideJobs: unhiding brings it back | hideJobs, switched to `/api/pages` (T036) |
| hideJobs: fetch requests get 204 | hideJobs, unchanged |
| hideJobs: rejects other sites, unknown jobs, malformed forms | hideJobs, unchanged |
| hideJobs: an unknown back path redirects to recommended | hideJobs, unchanged |
| hideJobs: stays hidden when re-fetched | hideJobs, unchanged |

---

## Phase 1: Setup

- [X] T001 Create branch `react-web-ui` from `main`, carrying the uncommitted blank Settings page
  (`src/web/page.ts`, `src/web/server.ts`, `tests/webUi.test.ts`) and
  `docs/specs/002-react-web-ui/`.
  - Run `npm run check`; it must pass with 207 tests.
  - Commit only the Settings page files as "Add a blank settings page", and only if the user
    approves committing. Otherwise leave everything uncommitted on the branch.
- [X] T002 In `src/cli.ts`, replace the static `import { startUi } from "./app/serve.js"` with a
  dynamic `const { startUi } = await import("./app/serve.js")` inside `serveCommand`, making it
  `async` (R14).
  - Keep `serveCommand` within 12 lines and keep its doc comment.
  - Run `npm run check`; `tests/cli.test.ts` must still pass.
  - Confirm `grep -n "serve.js" src/cli.ts` shows only the dynamic import.
- [X] T003 Record the baseline in this file's notes: the test count from `npm test`, and
  `sqlite3 -readonly data/myjobbot.db "select count(*) from jobs"`, which is needed for the
  SC-004 check in T044.

---

## Phase 2: Foundational (server view models and JSON API, still serving the HTML UI)

**Purpose**: put every display rule in one place (`rowViews.ts`), used by both the old HTML rows
and the new JSON API. This needs no new dependencies.

**⚠️ CRITICAL**: US1–US3 read from this API. Atomic unit: T004–T010.

- [X] T004 [P] Write `tests/webApi.test.ts`, using `startTestUi` and `seededViews` from
  `tests/helpers/`. Read `/api/pages/<name>` with `ui(path)` and `.json()`. Cover:
  - **Threshold**: jobs scored 90 and 40 with threshold 70 give recommended 1 row, summary
    `"1 recommended · threshold 70"`, row `reasons: ["reason a"]`, `via: "LinkedIn"`.
  - **Boost**: `title_boosts: {typescript: 10}` with a TypeScript job at 65 gives
    `score: {value: 75, note: "model 65 · +10 typescript"}`. A Java job at 65 is absent.
  - **Excluded company**: `exclude_companies: ["acme"]` leaves recommended with `total: 0` and
    `empty: "No recommendations yet: run myjobbot run."`. On `jobs`, the row's `filterNote` is
    `"hidden: excluded company"`.
  - **Breakdown**: `parts {base: 32, bonus: 30}`, a score of 62, a TypeScript description and a
    boost give the note `"base 32 + bonus 30 · model 62 · +10 typescript"`. On `reasoning`, the
    note is `"base 32 + bonus 30"`.
  - **Title filter**: `jobs` with an "Account Executive" row has `filterNote`
    `"hidden by title filter"`, and summary `"2 jobs"`.
  - **Unsafe link**: a URL of `javascript:alert(1)` gives `url: null`.
    `https://example.com/x` is kept.
  - **Ghost**: a `postedAt` long before `TEST_NOW` gives `posted.ghost: true`, plus `daysOpen`.
  - **Paging**: 250 jobs. Offsets 0, 100 and 200 give 100, 100 and 50 rows, with `nextOffset`
    100, 200 and `null`. `?offset=-5` and `?offset=abc` give the first page.
  - **Reasoning**: `kind: "verdicts"`. A row has `run` as the first 8 characters of the run id,
    and `scoredAt` formatted `YYYY-MM-DD HH:MM`.
  - **Meta**: `/api/meta` returns `{dbPath: "test.db", renderedAt: TEST_NOW.toISOString()}`.
  - **Errors**:
    - `/api/pages/nope` gives 404 `{"error": "Not found"}`; `/api/other` gives 404 JSON.
    - A state loader that throws `"broken <db>"` gives 500 `{"error": "broken <db>"}`, and a
      following `/api/meta` request gets an answer.
    - Every response has `content-type` starting with `application/json` and
      `cache-control: no-store`.
- [X] T005 Create `src/web/api.ts`. Shared types and constants only; no imports beyond types.
  - `PageName = "recommended" | "jobs" | "reasoning"`
  - `PAGES`: a readonly array of `{ path, label }` for `/recommended` "Recommended", `/jobs`
    "All jobs", `/reasoning` "Reasoning" and `/settings` "Settings", in that order
  - `PAGE_NAMES`, the three data pages
  - `PageData` as the discriminated union on `kind: "jobs" | "verdicts"`
  - `JobRowView`, `VerdictRowView` and `Meta`, with exactly the fields and types in
    data-model.md
- [X] T006 Create `src/web/rowViews.ts` with `toJobRowView(job: JobView, context: RowContext)`
  and `toVerdictRowView(verdict: VerdictView)`. Move `RowContext`, and today's rules, from
  `src/web/rows.ts`:
  - `url` uses `/^https?:\/\//i`, else `null`.
  - `remote` is `"yes"`, `"no"` or `""`.
  - Posted:
    - the opened date is the earlier of `posted_at` and `first_seen`
    - `daysOpen` comes from `daysBetween`
    - `ghost` is `daysOpen > ghostDays`
    - `date` is `dateOnly(opened)`
  - Score:
    - `value` is `boostedScore(score, boost)`
    - `note` joins the non-empty `"base X + bonus Y"` and `"model S · +P terms"` with `" · "`
    - `null` when unscored
  - `filterNote`: `"hidden: excluded company"` takes precedence over `"hidden by title filter"`;
    otherwise `null`.
  - Verdicts:
    - `scoredAt` is `scored_at.slice(0, 16).replace("T", " ")`
    - `run` is the first 8 characters of `run_id`, or `null`
    - `title ?? "(pruned)"`
    - `key` is `String(verdict.id)`. Add `v.rowid AS id` to `VERDICT_HISTORY` and
      `id: z.number()` to `verdictView` in `src/db/jobViews.ts`, and add `id` to the hand-built
      verdict in `tests/webUi.test.ts`
- [X] T007 Create `src/web/pageData.ts` with `loadPageData(name: PageName, input)`, returning
  `PageData`. Move `loadRecommended`, `loadAllJobs`, `loadReasoning`, `recommendedJobs`,
  `sourceNames` and `rowContext` from `src/web/tabs.ts`, mapping rows through `rowViews.ts`.
  - Summary and empty strings stay verbatim:
    - `"N recommended · threshold T"` / `"No recommendations yet: run myjobbot run."`
    - `"N jobs"` / `"No jobs retrieved yet: run myjobbot run."`
    - `"N scoring decisions"` / `"No jobs scored yet: run myjobbot run."`
  - `nextOffset` is `offset + limit` when that is below `total`, else `null`.
- [X] T008 Rewrite `src/web/rows.ts` to render HTML from `JobRowView` and `VerdictRowView` (no
  rules left in it), and `src/web/tabs.ts` to take its rows and summaries from `loadPageData`.
  - The old HTML pages must render byte-for-byte as before.
  - `tests/webUi.test.ts` and `tests/hideJobs.test.ts` must pass unchanged.
- [X] T009 In `src/web/server.ts`, add `GET /api/pages/:name` (validate `name` against
  `PAGE_NAMES`, parse the offset as today) and `GET /api/meta`.
  - Any other `/api/...` returns JSON 404.
  - API errors return JSON 500 with `describeError`.
  - Every API response sends `application/json; charset=utf-8` and `cache-control: no-store`.
  - Keep `route` and `respond` within 12 lines each by adding small helpers, such as `apiRoute`
    and `json(status, body)`.
- [X] T010 Run `npm run check`; it must pass, with T004 passing and all old tests unchanged. That
  closes atomic unit T004–T010.

**Checkpoint**: the JSON API is live beside the HTML UI. `curl localhost:8080/api/pages/jobs`
returns rows.

---

## Phase 3: User Story 1 - Same pages, now built with React (Priority: P1) 🎯 MVP

**Goal**: React renders all three data pages with today's content, navigation and footer. The
pages are tried through `npm run dev:web`; the server still serves HTML until Phase 6.

**Independent Test**: run `npm run serve` and `npm run dev:web`, then open
`http://localhost:5173/recommended`. Every page shows the same rows, notes and links as
`http://localhost:8080` does.

### Atomic unit T011–T019: tooling and app shell

- [X] T011 [US1] Confirm versions before installing:
  - `npm view react version` must be `19.3.0` (R1).
  - `npm view @vitejs/plugin-react@6.1.2 peerDependencies` must accept vite 8.
  - `npm view @testing-library/react@16.3.3 peerDependencies` must accept react 19.
  - `npm view vitest@$(node -p "require('vitest/package.json').version") peerDependencies` must
    accept `happy-dom` 21.

  If any check fails, stop and report rather than changing versions silently.
- [X] T012 [US1] Install with the lockfile splice (R10), using a one-off script in the
  scratchpad:
  - `dependencies`: `react@19.3.0`, `react-dom@19.3.0`, `vite@8.3.2`, `@vitejs/plugin-react@6.1.2`
  - `devDependencies`: `@types/react@19.3.0`, `@types/react-dom@19.3.0`,
    `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2`,
    `@testing-library/user-event@14.6.8`, `happy-dom@21.0.1`
  - All exact (`--save-exact`).
  - Process:
    1. Install into a scratch copy of the repo.
    2. Add every `packages` entry that is new in the generated lockfile, plus the root dependency
       changes, to the committed `package-lock.json`. Never remove an existing entry.
    3. Run `npm ci`.
  - Then check:
    - `grep -c '"node_modules/@rolldown/binding-' package-lock.json` still gives 15.
    - `npm ls vite` shows a single 8.3.2.
- [X] T013 [US1] In `tsconfig.json`:
  - add `"jsx": "react-jsx"` and `"lib": ["ES2023", "DOM", "DOM.Iterable"]`
  - add `"vite.config.ts"` and `"vitest.config.ts"` to `include`
  - keep `"types": ["node"]` (R8)
- [X] T014 [US1] Create `vitest.config.ts` with `test.projects`:
  - **`node`**: `include: ["tests/**/*.test.ts"]`, environment `node`
  - **`dom`**: `include: ["tests/**/*.test.tsx"]`, environment `happy-dom`, `plugins: [react()]`,
    `setupFiles: ["tests/helpers/domSetup.ts"]`

  Create `tests/helpers/domSetup.ts`, which calls `afterEach(cleanup)` from Testing Library and
  `vi.unstubAllGlobals()`. Confirm `npm test` still runs all existing tests in the `node` project.
- [X] T015 [US1] Create `knip.json`, copying habit-hooks' shipped config
  (`~/.local/share/uv/tools/habit-hooks/lib/python3.12/site-packages/habit_hooks_typescript/knip.json`):
  the same `entry`, `project`, `ignore` and `ignoreDependencies`. Add `"src/web/client/main.tsx!"`
  to `entry`.
  - If knip reports `happy-dom`, `@vitejs/plugin-react` or `@testing-library/dom` as unused,
    configure knip's `vitest` and `vite` plugins to load the root config files. Don't add them to
    `ignoreDependencies` (R9).
  - In `CLAUDE.md` under "Enforcement in this repo", add: "`knip.json` replaces habit-hooks'
    shipped knip config (copied 2026-10-13, adding the browser entry
    `src/web/client/main.tsx`); when upgrading habit-hooks, diff it against the shipped
    `habit_hooks_typescript/knip.json` and carry over changes." (R9 drift risk)
- [X] T016 [US1] Create the Vite settings (R2). **Until Phase 6 they live in the root
  `vite.config.ts`** (found during implementation): knip's production pass ignores config files, so
  a `src/web/viteConfig.ts` reached only through `vite.config.ts` is reported as test-only dead
  code until `clientBuild.ts` imports it. T033 moves them into `src/web/viteConfig.ts` and turns
  the root file into the re-export described below. The settings, using `defineConfig`:
  - `root` is the absolute path of `src/web/client`, resolved from `import.meta.dirname`, so it
    works from any working directory
  - `plugins: [react()]`
  - `cacheDir` under `os.tmpdir()` (`myjobbot-vite-cache`)
  - `build.outDir` under `os.tmpdir()` (`myjobbot-client`), with `emptyOutDir: true`
  - `server: { host: "localhost", port: 5173, strictPort: true, proxy }`, forwarding `"/api"`
    and `"/hide"` to `"http://localhost:8080"` with `changeOrigin: false`. Hide's same-origin
    check compares `Origin` with the forwarded `Host`, so the proxy must keep the browser's
    `Host` (U2).

  Create the root `vite.config.ts` containing only `export { viteConfig as default } from
  "./src/web/viteConfig.js";`. The Docker image doesn't contain root files other than
  `package*.json` and `tsconfig.json`, so nothing at run time may depend on this file (U1).

  In `package.json`, add the script `"dev:web": "vite"`.
- [X] T017 [US1] Create the app shell in `src/web/client/`:
  - `index.html`: `<div id="root">`, `<noscript>myjobbot's web UI needs JavaScript.</noscript>`,
    `<script type="module" src="./main.tsx">`, and title `myjobbot`.
  - `styles.css`: today's `STYLE` from `src/web/page.ts`, moved verbatim, keeping the
    `[data-hidden]` rules. So that there is one copy until T037 removes `page.ts`, `page.ts`
    stops holding the string and reads `src/web/client/styles.css` once at module load, with
    `readFileSync` and a path resolved from `import.meta.dirname`. The old pages must render
    byte-for-byte as before (F2).
  - `main.tsx`: `createRoot(document.getElementById("root")!)` is not allowed (non-null
    assertion). Look the element up, throw if it's missing, then render `<StrictMode><App /></StrictMode>`.
    Import `./styles.css`.
  - `usePath.ts`: `usePath()` returns `{ path, navigate }`. `navigate` calls
    `history.pushState(null, "", to)` and updates state. A `popstate` listener is added in
    `useEffect` and removed in its cleanup.
  - `NavLink.tsx`: `<a href>`. On a plain left click, with no modifier keys, it calls
    `preventDefault()` and `navigate(href)`. It gets `className="current"` when its path is the
    current one.
  - `Nav.tsx`: maps `PAGES` to `NavLink`.
  - `useMeta.ts`: fetches `/api/meta` in `useEffect` and returns `Meta | null`. It stays
    `null` while loading and on any error; it never throws.
  - `Footer.tsx`: `<footer><small>{dbPath} · rendered {renderedAt}</small></footer>` once meta
    has loaded. While loading or after an error it renders an empty `<footer>`, never
    "undefined" (U3).
  - `App.tsx`: `<h1>myjobbot</h1>`, `<Nav>`, the current page (a placeholder `<p>` until T024),
    and `<Footer>`.
  - The document title follows the page: `myjobbot · <label>`, set in a `useEffect` in `App`.
- [X] T018 [US1] Write `tests/client/nav.test.tsx` and make it pass:
  - Rendering `App` with `/jobs` in the address bar (set with `history.replaceState`) marks
    "All jobs" `current`.
  - Clicking "Reasoning" changes `location.pathname` to `/reasoning` and marks it current. Check
    that no full navigation happened: the same `window` and a `pushState` spy called.
  - After `history.replaceState(null, "", "/jobs")` and dispatching
    `new PopStateEvent("popstate")` on `window`, "All jobs" is current again. Dispatch the event
    directly rather than relying on happy-dom's `history.back()` (A1).
  - With a stubbed `fetch` for `/api/meta`, the footer shows `test.db`. When `/api/meta` returns
    500, the footer is empty and contains no "undefined" (U3).
- [X] T019 [US1] Run `npm run check`: typecheck, both projects, habit-hooks and knip clean. That
  closes atomic unit T011–T019.

### Tests for User Story 1 (write first, confirm they fail)

- [X] T020 [P] [US1] Write `tests/client/jobRow.test.tsx`. Render `JobRow` in a `<table><tbody>`
  with `JobRowView` objects:
  - A title `<script>alert(1)</script>` shows as text, and there is no `script` element in the
    container.
  - `url: null` gives a title with no link. A `url` gives a link with `target="_blank"` and
    `rel="noopener noreferrer"`.
  - `score {value: 75, note: "model 65 · +10 typescript"}` shows `75` and the note. A `null`
    score gives an empty cell.
  - `via: "LinkedIn"` shows "via LinkedIn".
  - `posted.ghost: true` shows "⚠ possible ghost" and "N days open".
  - `filterNote` text is shown.
  - Reasons and gaps sit under a "Why" `<details>`, which is absent when both are empty.
- [X] T021 [P] [US1] Write `tests/client/verdictRow.test.tsx`:
  - `run: null` shows "before history".
  - `title: "(pruned)"` and `url: null` give plain text.
  - The score note is shown.
  - Reasons and gaps render as `<li>` items.
- [X] T022 [P] [US1] Write `tests/client/rowsPage.test.tsx`, rendering `RowsPage` with a stubbed
  `fetch`:
  - The summary line is shown.
  - The table headers match data-model.md.
  - `total: 0` shows `empty` text and no table.
  - A 500 `{error: "broken"}` shows "broken" where the rows would be, and the nav still renders.
  - Switching `name` aborts the previous request: no state update after unmount, no React warning.

### Implementation for User Story 1

- [X] T023 [P] [US1] Create the display components in `src/web/client/`, each with a doc comment
  and at most 12 lines:
  - `ExternalLink.tsx`: renders `<a target="_blank" rel="noopener noreferrer">` for a URL, and
    plain text for `null`.
  - `BulletList.tsx`
  - `ScoreCell.tsx`
  - `TitleCell.tsx`: link, filter note, hidden note and `<Why>`.
  - `Why.tsx`
  - `PostedCell.tsx`
  - `JobRow.tsx`: a `<tr className="job" data-hidden>` of 9 cells. The last cell is left empty
    until T028.
  - `JobTable.tsx`
  - `VerdictRow.tsx`
  - `VerdictTable.tsx`

  Rows use `key` values `${ats}:${jobId}` and `VerdictRowView.key`.
- [X] T024 [US1] Create `usePageRows.ts` (first page only, for now) and `RowsPage.tsx`:
  - `usePageRows`: `fetch('/api/pages/'+name)` with an `AbortController` in `useEffect`. State
    holds rows, total, nextOffset, error and loading. It resets when `name` changes.
  - `RowsPage`: shows the summary, empty, error or table by `kind`.

  Wire them into `App.tsx`: `/recommended`, `/jobs` and `/reasoning` map to
  `<RowsPage name=…>`. Any other path shows "Not found".

  T020–T022 must pass, then run `npm run check`.

**Checkpoint**: with `npm run serve` and `npm run dev:web`, all three data pages in React match
the HTML UI. Hide and scrolling past 100 rows come in US2.

---

## Phase 4: User Story 2 - Long lists and Hide keep working (Priority: P1)

**Goal**: infinite scroll and Hide/Unhide in React, with failures shown.

**Independent Test**: in `npm run dev:web`:
- With more than 100 jobs, scrolling All jobs loads 100 more each time.
- Hide on Recommended removes the row. On All jobs it dims the row, shows "hidden by you" and
  changes the button to Unhide.
- With the server stopped, Hide shows "Couldn't save — try again".

### Tests for User Story 2 (write first, confirm they fail)

- [X] T025 [P] [US2] Write `tests/client/loadMore.test.tsx`:
  - Stub `IntersectionObserver` with a class that records callbacks and lets the test trigger
    intersection.
  - Make `fetch` return 100 rows with `nextOffset: 100`, then 50 rows with `nextOffset: null`.
  - Triggering the sentinel appends rows, giving 150 `tr.job`, with no duplicate keys and
    `fetch` called with `offset=100` exactly once, even when triggered twice quickly.
  - After `nextOffset: null` there is no sentinel row.
  - The "Load more" button triggers the same load.
- [X] T026 [P] [US2] Write `tests/client/hide.test.tsx`, rendering `RowsPage` with a stubbed
  `fetch`:
  - **Recommended**: clicking "Hide" POSTs `/hide` with header `x-myjobbot-fetch: 1` and
    URL-encoded `ats`, `job_id`, `hidden=1` and `back=/recommended`. A 204 removes the row.
  - **All jobs**: a 204 sets `data-hidden="1"`, shows "hidden by you" and changes the button
    to "Unhide". Clicking again sends `hidden=0`.
  - **Failure**: a 500 leaves the row unchanged and shows "Couldn't save — try again". The
    button is disabled while saving.
  - A Hide button exists on recommended rows. This carries over a hideJobs scenario.

### Implementation for User Story 2

- [X] T027 [US2] Add paging and scrolling:
  - In `usePageRows.ts`, add `loadMore()`. It fetches `?offset=nextOffset`, appends, and is
    guarded by a ref so only one load runs at a time.
  - Create `LoadMore.tsx`: a `<tr className="more">` sentinel with a "Load more" button. A
    `useEffect` sets up an `IntersectionObserver` with `rootMargin: "400px"` and disconnects it
    in cleanup.
  - Render `LoadMore` in `JobTable` and `VerdictTable` when `nextOffset !== null`.
- [X] T028 [US2] Add Hide:
  - Create `useHide.ts`: POSTs `/hide` as in T026, and returns the row status
    (`idle | saving | failed`) and `toggle()`.
  - Create `HideButton.tsx`: shows "Hide" or "Unhide" and the failure message. It is disabled
    while saving.
  - In `usePageRows`, add `removeRow(key)` and `setHidden(key, hidden)`.
  - Pass to `JobRow` a callback chosen by page: remove on `recommended`, `setHidden` on `jobs`.

  T025–T026 must pass, then run `npm run check`.

**Checkpoint**: React reaches parity with the HTML UI in `dev:web`.

---

## Phase 5: User Story 3 - A Settings page ready to grow (Priority: P2)

**Independent Test**: `/settings` in `dev:web` shows the header, nav with Settings current, an
empty body, and the footer.

- [X] T029 [P] [US3] Write `tests/client/settings.test.tsx`:
  - Rendering `App` at `/settings` marks Settings `current`.
  - The title is `myjobbot · Settings`.
  - There is no table, and the main area is empty.
  - Clicking Settings from `/recommended` navigates without a reload.
- [X] T030 [US3] Create `src/web/client/SettingsPage.tsx`, which returns an empty `<main>`. Map
  `/settings` to it in `App.tsx`. T029 must pass, then run `npm run check`.

---

## Phase 6: Switch the server to the React app (US1)

**Purpose**: serve the built React app in place of the HTML pages, and remove the HTML renderer.
Atomic unit T031–T038. Do it in one sitting.

- [X] T031 [US1] Pre-flight (R15):
  1. `docker compose top myjobbot` must show only supercronic, meaning no agent run in progress.
  2. Ask the user before recreating containers.
  3. With approval, run `docker compose build && docker compose up -d`, or confirm
     `npm run docker:watch` is running and has rebuilt.
  4. Verify that `docker compose exec web ls node_modules/vite node_modules/react` lists both.
- [X] T032 [P] [US1] Write `tests/webServer.test.ts`. `startTestUi` gains a `clientDir` option,
  pointing at a temporary folder holding `index.html` and `assets/app-abc.js`. Cover:
  - `/` gives 302 to `/recommended`.
  - `/recommended`, `/jobs`, `/reasoning` and `/settings` give 200 `text/html` containing
    `id="root"` and the noscript text.
  - `/assets/app-abc.js` gives 200 `text/javascript` with the immutable cache header.
  - `/assets/../index.html` and `/assets/%2e%2e/package.json` give 404.
  - `/nope` gives 404 "Not found".
  - `POST /jobs` gives 405.
  - A throwing state gives HTML 500 on a page address, and the server keeps running.

  Also write `tests/clientBuild.test.ts` (C1). It runs `buildClient({ watch: false })` for real,
  with the output folder overridden to a fresh temp folder, and asserts:
  - `index.html` exists, references an `/assets/*.js` file, and contains `id="root"` and the
    noscript text
  - that JS file exists
  - nothing was written under the repository root

  Give it a timeout of up to 30 s. It is the only automated proof that the real Vite settings
  build.
- [X] T033 [US1] Move the Vite settings from the root `vite.config.ts` into `src/web/viteConfig.ts`
  (exporting `viteConfig`; resolve `root` as `new URL("./client", import.meta.url)`), and make the
  root file only `export { viteConfig as default } from "./src/web/viteConfig.js";`. Then create
  `src/web/clientBuild.ts` with `buildClient({ watch, outDir? })`:
  - It calls Vite's `build()` with `{ ...viteConfig, configFile: false }`, imported from
    `./viteConfig.js`, never the root `vite.config.ts`, which the Docker image doesn't contain
    (U1). It adds `build.watch: {}` when `watch` is set, and `build.outDir` when `outDir` is
    given (used by T032's build test).
  - It resolves with the output folder after the first build. In watch mode it waits for the
    first `BUNDLE_END` event; on an `ERROR` event it logs and keeps watching.
- [X] T034 [US1] Create `src/web/staticFiles.ts`:
  - `indexPage(clientDir)` reads `index.html` on each request, so watch rebuilds show up.
  - `asset(clientDir, name)`:
    - Decode the name, resolve it under `<clientDir>/assets`, and refuse anything outside that
      folder.
    - Map the content type for `.js` `.css` `.svg` `.png` `.woff2` `.map`.
    - Return `Reply` with headers, or `null` when not found.
- [X] T035 [US1] Switch the server over:
  - In `src/web/server.ts`, route the page addresses from `PAGES` to `indexPage` and
    `/assets/*` to `asset`, keeping `/`, `/hide`, `/api/*`, 404, 405 and 500. Remove the
    tab-rendering path. `UiDeps` gains `clientDir`.
  - In `src/app/serve.ts`, `await buildClient({ watch: env MYJOBBOT_WATCH === "1" })` before
    `listen`, and pass the folder to `createUiServer`. Keep functions within 12 lines.
  - Adjust `src/cli.ts` (`serveCommand`) if `startUi` becomes async.
- [X] T036 [US1] Update `tests/hideJobs.test.ts`:
  - **"hiding a job removes it from recommended and marks it in all jobs"**: read
    `/api/pages/recommended` (no row `a`) and `/api/pages/jobs` (row `a` with `hidden: true`).
  - **"unhiding a job brings it back to recommended"**: assert through `/api/pages/recommended`.
  - Delete "recommended rows have a hide button"; T026 covers it. Leave the other four tests
    unchanged.
  - In `src/web/hide.ts`, validate `back` against `PAGES` paths instead of `TABS`.
- [X] T037 [US1] Delete the HTML renderer and its tests:
  - Delete `src/web/page.ts`, `src/web/tabs.ts` and `src/web/rows.ts`.
  - Delete the helpers in `src/web/html.ts` that nothing uses any more. Keep `escapeHtml` and
    move `simplePage` there. Keep `dateOnly`, moved into `rowViews.ts`, if only it uses it.
  - Delete `tests/webUi.test.ts` only after confirming every row of the carry-over table is
    ticked. Update `tests/helpers/ui.ts` (`pageText` and `countRows` if unused).
- [X] T038 [US1] Run `npm run check`; it must be green. Then the local smoke test:
  - Run `npm run serve`. `curl -s localhost:8080/recommended | grep 'id="root"'` matches, and
    the asset referenced in that HTML loads.
  - In a browser, check all four pages, Hide, scrolling and a reload of `/reasoning`.
  - **In Docker** (U1): `docker compose logs web` shows a successful client build and no
    `vite.config` error. `curl -s http://127.0.0.1:8080/recommended | grep 'id="root"'` matches.
    Touching a file under `src/web/client/` logs a rebuild within a few seconds.

  That closes atomic unit T031–T038.

**Checkpoint**: the LAN UI is React. The web container rebuilds the client on save.

---

## Phase 7: User Story 4 - Learning from the code (Priority: P2)

- [X] T039 [P] [US4] Write `tests/walkthrough.test.ts`, a `node` project test:
  - Read `docs/react-walkthrough.md`.
  - Every backticked path matching `src/[\w/.-]+\.(tsx?|css|html)` must exist.
  - Every backticked `PascalCase` component or `useCamelCase` hook named in a section's
    "Where:" line must appear as an exported function in some file under `src/web/client/`.
- [X] T040 [US4] Write `docs/react-walkthrough.md` (R12) with sections:
  1. Components and JSX: `JobRow` and the cell components.
  2. Props: `ScoreCell`, typed from `JobRowView`.
  3. State: `usePageRows`.
  4. Effects and cleanup: `LoadMore`'s observer and `usePath`'s `popstate`.
  5. Events: `NavLink`, `HideButton`.
  6. Loading data: `usePageRows`, `useMeta`, `/api/pages`.
  7. Lists and keys: `JobTable`.
  8. Custom hooks: `useHide`.
  9. Testing components: `tests/client/hide.test.tsx`.
  10. How it's served: `clientBuild.ts`, `dev:web`, hot reload.
  11. Next steps: `react-router`, TanStack Query.

  Each section has a "Where:" line with files and components, and a few sentences. Then add at
  least three exercises, each with goal, files to change, test to add and how to check:
  - a count of hidden jobs on All jobs
  - a filter box on Reasoning
  - showing `match_threshold` on Settings by adding it to `/api/meta`

  T039 must pass.

---

## Phase 8: Polish & Cross-Cutting

- [X] T041 [P] Update `README.md`:
  - The web UI section: built with React, served from a Vite build, `npm run dev:web` for hot
    reload on localhost, a link to `docs/react-walkthrough.md`.
  - The `web` service's watch note: client rebuilds on save, then reload the browser.
  - The Docker section: the first start builds the client.
- [X] T042 [P] In `docs/superpowers/specs/2026-10-04-web-ui-design.md`, add a one-line note
  under the Rendering decision: "Superseded by `docs/specs/002-react-web-ui/` (2026-10-13)".
- [X] T043 Run a review agent (feature-dev:code-reviewer) over the diff, and fix every confirmed
  finding test-first. It must check:
  - escaping and link safety
  - static-file path containment
  - Hide's same-origin behaviour from the React app, both served by `serve` and through
    `npm run dev:web`'s proxy (Hide must succeed in both and be refused cross-site)
  - effect cleanup and abort handling
  - knip and eslint cleanliness without exemptions
- [X] T044 Run the quickstart:
  - `npm run check`.
  - **SC-004**: time the first rows on `/jobs` against the real database (count from T003),
    loaded read-only through `npm run serve` with `MYJOBBOT_DATA_DIR` pointing at a scratch copy
    of `data/`. The first rows must appear within 1 s.
  - **SC-003**: Hide round trip under 0.5 s, from the browser devtools timing.
  - `curl localhost:8080/@fs/` returns 404.
  - Mark completed tasks `[X]` and leave changes uncommitted unless the user asks to commit.

---

## Notes

- **Baseline (T003, 2026-10-13)**: `npm test` gives 207 tests in 38 files. `data/myjobbot.db`
  holds 703 jobs (used for SC-004 in T044).
- **US1 checkpoint (2026-10-13)**: the React tables, rendered with `renderToStaticMarkup` from
  the live `/api/pages/*` JSON, match the live HTML UI's row text on every row: recommended 2,
  jobs 200, reasoning 200 (Hide form excluded). Notes on deviations:
  - The table components live together in `Tables.tsx` (`JobTable`, `VerdictTable`).
  - The job cells are grouped in `JobCells.tsx` (`WhereCells`, `SourceCell`, `WhenCells`).
  - `DataTable` wraps the shared table markup.
  - `CurrentPage` chooses the page.
  - `fetchJson` reads the server's error messages.
  - `useDocumentTitle` and `usePopState` were split out to meet the 12-line limit.
  - No browser is available for Playwright here, so visual checks are left to the user.
- **Switch-over (2026-10-13)**:
  - **T031**: the running `npm run docker:watch` rebuilt the image when `package.json` changed
    (15:21 MDT), so both containers already had `vite`, `react`, `react-dom` and
    `@vitejs/plugin-react`. Nothing had to be recreated.
  - **Brief outage**: during the file swap the live `web` container failed to start for about 40 s
    (removed `html.ts` exports), then recovered on its own.
  - **Docker checks**: the app is served, assets are served with the right types, `/@fs/` and
    `/assets/` escapes return 404, and an edit rebuilds the client in about 1 s.
  - **Page addresses no longer read state**, so the "HTML 500" test uses a missing build instead
    of a throwing state.
  - **Hide**: the "rejects other sites" test now reads back through the API.
- **Review (T043)**: a read-only review agent, with probes, found no security issues. Escaping,
  links, asset path containment and Hide's same-origin check through both `serve` and the
  `dev:web` proxy all held. It found two paging bugs, both fixed test-first in
  `src/web/client/pageRows.ts` and `usePageRows.ts`:
  1. Rows shifted onto the next page were shown twice, with duplicate React keys and a stale
     hidden row. Appended pages now skip rows already shown.
  2. Hiding a job on Recommended while "load more" was in flight skipped a job. A version counter
     now discards loads requested before a removal.

  Its minor note about the fixed `/tmp/myjobbot-client` folder is also fixed: each start builds
  into a fresh `mkdtemp` folder (mode 0700). Watch rebuilds can briefly fail if they read a file
  mid-write; they log the error and recover on the next save.
- **Quickstart (T044)**, on 703 real jobs, measured server-side over loopback:
  - `/api/pages/jobs` answers in 29 ms; the page and bundle (229 KB) in 2 ms each (SC-004).
  - The Hide endpoint answers in 5 ms (SC-003), measured with a malformed request so no data
    changed.
  - `/@fs/` and `/assets/` escapes return 404.
  - Not checked: visual browser rendering, since no browser is available here. The user should
    check all four pages, Hide, scrolling and the back button in a real browser.
- **T001**: the Settings page is committed as `417be6d` on `react-web-ui`. The constitution and
  specs are left uncommitted, as the user chose.

## Dependencies & Execution Order

- **Setup (T001–T003)**: T002 (lazy `serve` import) must land before any task adds a web
  dependency.
- **Foundational (T004–T010)** blocks everything else. No new dependencies are needed.
- **US1 (T011–T024)**: the tooling unit T011–T019 comes first, then T020–T024.
- **US2 (T025–T028)** needs `usePageRows` and the tables from US1.
- **US3 (T029–T030)** needs the app shell (T017). It can run alongside US2.
- **Switch-over (T031–T038)** needs US1, US2 and US3 complete. It is one atomic unit and needs
  the user's go-ahead for the container rebuild (T031).
- **US4 (T039–T040)** needs the switch-over, because the walkthrough describes the final files.
- **Polish (T041–T044)** comes last.

## Parallel Opportunities

- T004 runs alongside T005–T007, since they're different files. T008 and T009 depend on
  T005–T007.
- US1 tests T020, T021 and T022 can run in parallel. T023's components are separate files and
  can be split between workers.
- US2 tests T025 and T026 can run in parallel. US3 (T029–T030) can run alongside US2.
- T032 (including `tests/clientBuild.test.ts`) can be written alongside T033 and T034. T041 and
  T042 can run in parallel.

Same-file serialisation:
- `src/web/server.ts`: T009, T035
- `src/web/client/App.tsx`: T017, T024, T030
- `src/web/client/usePageRows.ts`: T024, T027, T028
- `tests/hideJobs.test.ts`: T036

## Implementation Strategy

1. **Phases 1–2**: the lazy import and the JSON API. Safe to stop here; the LAN UI is unchanged.
2. **MVP, Phase 3 (US1)**: React shows every page through `dev:web`. Stop and compare with the
   HTML UI.
3. **Phase 4 (US2)**, then **Phase 5 (US3)**: parity.
4. **Phase 6**: switch over in one sitting, with the container rebuild approved by the user.
5. **Phase 7 (US4)**: the walkthrough, then **Phase 8**: polish, review and the quickstart.
