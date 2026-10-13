# Learning React with myjobbot's web UI

This walkthrough teaches React through the web UI you already use. Each section explains one idea,
shows where this codebase uses it, and suggests what to look at.

- **Read the files as you go.** The code has no explanatory comments, only a one-line purpose
  comment per function, so this document is the guide.
- **It stays accurate.** `tests/walkthrough.test.ts` checks that every file and component named
  here exists.

## How the pieces fit

```text
browser                                     server (myjobbot serve)
───────                                     ───────────────────────
index.html ─► main.tsx ─► <App>             src/web/server.ts
                            ├─ <Header>/<Nav> GET /recommended …  → built index.html
                            ├─ <CurrentPage>  GET /assets/…       → built JS and CSS
                            │    └─ <RowsPage>  ──fetch──►  GET /api/pages/:name → rows as JSON
                            │         └─ <JobTable>/<VerdictTable>
                            └─ <Footer>  ─────fetch──►  GET /api/meta
                         <HideButton>  ───────fetch──►  POST /hide
```

- **The server does the thinking.** It decides scores, boosts, filter notes and ghost flags, and
  sends ready-to-show values. `src/web/rowViews.ts` builds them, and `src/web/api.ts` defines
  their TypeScript types.
- **The browser only lays them out.** The React code in `src/web/client/` imports those same
  types, so TypeScript catches any mismatch between the two sides.
- **Layout of `src/web/client/`**: `main.tsx` (the entry point) and `App.tsx` (the root
  component) sit at the top, next to the hooks (`use….ts`) and the plain helpers (`pageRows.ts`,
  `fetchJson.ts`). UI components live in `components/`, grouped by kind:
  - `sections/`: the parts every page shares (`Header`, `Footer`)
  - `menus/`: navigation (`Nav`, `NavLink`)
  - `pages/`: what fills the space between header and footer (`CurrentPage`, `RowsPage`, `SettingsPage`)
  - `tables/`: tables and their rows and cells
  - `forms/`: anything you submit (`HideButton`)
  - `common/`: small pieces used in several places (`ExternalLink`, `BulletList`)

## 1. Components and JSX

A **component** is a function that returns what should appear on screen. **JSX** is the HTML-like
syntax inside it. React turns JSX into calls that build the page, and **escapes every
`{value}`**, so text from job postings can never inject markup.
`tests/client/jobRow.test.tsx` checks that a `<script>` title shows up as plain text.

**Where:** `JobRow` in `src/web/client/components/tables/JobRow.tsx`, built from `ScoreCell`, `TitleCell`,
`WhereCells`, `SourceCell` and `WhenCells`.

Notice how small each component is: habit-hooks allows 12 lines per function, so a table row is
split into cells. That is also how React code is usually written. When a component grows, you
pull out a smaller one with a clear name.

## 2. Props

**Props** are a component's inputs, passed like HTML attributes (`<ScoreCell score={job.score} />`)
and received as one typed object. They flow one way, from parent to child.

**Where:** `ScoreCell` in `src/web/client/components/tables/ScoreCell.tsx` takes a `score` typed from
`src/web/api.ts`. `ExternalLink` in `src/web/client/components/common/ExternalLink.tsx` takes `url` and `children`.

**`children`** is a special prop: whatever you put between the opening and closing tags. `JobRow`
puts its `children` in the last cell, which is how `JobTable` slots a `HideButton` into each row
without `JobRow` knowing anything about hiding.

## 3. State

**State** is data a component remembers between renders. `useState` returns the current value
and a setter, and calling the setter re-renders the component with the new value. You never
change state in place; you give React a new value.

**Where:** `usePageRows` in `src/web/client/usePageRows.ts` keeps the loaded rows, any error,
and any "couldn't load more" message. `useHide` in `src/web/client/useHide.ts` keeps a button's
`idle`, `saving` or `failed` status.

The changes to the rows live as plain functions in `src/web/client/pageRows.ts`. `withMore`
appends a page, `withoutJob` removes a hidden job from Recommended, and `withJobHidden` dims one
on All jobs. Each returns a **new** object, which is what lets React see that something changed.
They are ordinary TypeScript you can read without knowing React.

## 4. Effects and cleanup

An **effect** (`useEffect`) runs code after React has updated the screen. It's for things outside
React: network requests, browser APIs, timers. Its dependency list says when to run it again. The
function it returns is the **cleanup**, which runs before the next run and when the component
goes away.

**Where:**
- `usePath` in `src/web/client/usePath.ts` uses a small `usePopState` hook that listens for the
  browser's back and forward buttons, and removes the listener in its cleanup.
- `useWhenVisible` in `src/web/client/useWhenVisible.ts` sets up an `IntersectionObserver` and
  disconnects it in its cleanup.
- `useDocumentTitle` in `src/web/client/useDocumentTitle.ts` keeps the tab title in step.

## 5. Events

Event handlers are props like `onClick` and `onSubmit` that take a function.

**Where:**
- `NavLink` in `src/web/client/components/menus/NavLink.tsx` handles a plain left click by calling
  `preventDefault()` and switching pages in place. A middle-click or Ctrl-click still opens a new
  tab, because those are left to the browser.
- `HideButton` in `src/web/client/components/forms/HideButton.tsx` submits a small form, and `useHide` sends it
  with `fetch`.

## 6. Loading data

React has no built-in data loading; this UI uses plain `fetch` inside effects.

**Where:**
- `fetchJson` in `src/web/client/fetchJson.ts` fetches JSON and turns a failed response into an
  error carrying the server's own message.
- `usePageRows` loads the first page in an effect. It passes an `AbortController`, so leaving a
  page mid-load cancels the request. `tests/client/rowsPage.test.tsx` checks this.
- `useMeta` in `src/web/client/useMeta.ts` loads the footer. `Footer` in
  `src/web/client/components/sections/Footer.tsx` shows nothing until it has an answer, and nothing if the request
  fails.

The server side is `src/web/pageData.ts`, which builds each page's rows, and the `/api` routes in
`src/web/server.ts`.

## 7. Lists and keys

Rendering a list means mapping data to elements. Each element needs a **`key`**: a stable,
unique ID that lets React match old rows to new ones as rows are added, removed or reordered.

**Where:** `JobTable` and `VerdictTable` in `src/web/client/components/tables/Tables.tsx`. Jobs use `jobKey`, which
combines `ats` and `jobId`. Verdicts use their database row id, because one job can be scored
twice at the same moment.

Keys also explain a trick in `CurrentPage` (`src/web/client/components/pages/CurrentPage.tsx`):
`<RowsPage key={name} …/>`. Giving each page a different key makes React treat switching from
Recommended to All jobs as a different component, so its state starts fresh, with no reset code
needed.

## 8. Custom hooks

A **custom hook** is a function whose name starts with `use` and that calls other hooks. It
packages behaviour, not markup, so components stay simple.

**Where:**
- `usePageRows` combines a first-page effect, a load-more callback guarded by a `useRef` so it
  never runs twice at once, and `markHidden`.
- `useHide`, `usePath`, `useMeta` and `useWhenVisible` each do one job.
- `LoadMore` in `src/web/client/components/tables/LoadMore.tsx` is a good small example: a ref to its row, plus
  `useWhenVisible(row, onLoad)`.

Two hook rules: call hooks only at the top level of a component or hook, never inside `if`, and
only from components or hooks.

## 9. Testing components

The tests use **Testing Library**. It renders a component into a simulated browser (`happy-dom`)
and finds things the way a user would: by role and visible text.

**Where:**
- `tests/client/hide.test.tsx` renders `RowsPage` with `fetch` stubbed by
  `tests/helpers/fetchStub.ts`, clicks Hide with `userEvent`, and checks what was sent and what
  changed.
- `tests/client/loadMore.test.tsx` uses a fake `IntersectionObserver`
  (`tests/helpers/fakeObserver.ts`) to simulate scrolling.
- Component tests are `.test.tsx` files in `tests/client/`. `vitest.config.ts` runs them in a
  separate `dom` project.

## 10. How it's built and served

- **The build**: browsers can't run `.tsx` directly, so **Vite** compiles the app into plain
  JavaScript and CSS. The settings are in `src/web/viteConfig.ts`.
- **When serving**: `myjobbot serve` builds once at start-up (`src/web/clientBuild.ts`), into a
  temporary folder, and serves the result through `src/web/staticFiles.ts`.
- **In Docker**: the `web` service sets `MYJOBBOT_WATCH=1`. The build then reruns about a second
  after you save a file in `src/web/client/`; reload the browser to see the change.
- **For fast learning**, run `npm run serve` in one terminal and `npm run dev:web` in another, then
  open `http://localhost:5173`. That's Vite's own development server with **hot module
  replacement**: edits appear without a reload, often keeping the page's state. It only listens on
  `localhost`, and it forwards `/api` and `/hide` to `serve`.

## 11. Where to go next

- **`react-router`**: when there are more pages, or pages with parameters (`/jobs/:id`), it
  replaces `usePath` and `CurrentPage`.
- **TanStack Query**: caching, retries and background refresh for data loading. It replaces most
  of `usePageRows`.
- **React's own docs** (react.dev): "Thinking in React" and "You Might Not Need an Effect" are
  worth reading next to this code.

## Exercises

Each exercise is small and touches only the files it lists. Run `npm run check` when you're done.

### Exercise 1: Count hidden jobs on All jobs

**Goal:** below the summary on All jobs, show "N hidden on this page".

- **Files:** `src/web/client/components/pages/RowsPage.tsx`. Count `data.rows.filter((job) => job.hidden)` when
  `data.kind === "jobs"` and `name === "jobs"`, and render a `<p>`.
- **Test:** in `tests/client/hide.test.tsx`, after hiding the row on All jobs, expect the text
  "1 hidden on this page".
- **Check:** the count changes as you click Hide and Unhide, with no reload. That works because
  it's computed from state every render.

### Exercise 2: Filter the reasoning history

**Goal:** a text box above the Reasoning table that shows only verdicts whose job title contains
the typed text.

- **Files:** a new `src/web/client/components/forms/ReasoningFilter.tsx` for the input, which takes `value` and
  `onChange` as props, plus `src/web/client/components/pages/RowsPage.tsx`, which keeps the text in `useState` and
  filters `data.rows` before passing them to `VerdictTable`.
- **Test:** a new `tests/client/reasoningFilter.test.tsx`. Render `RowsPage` for `reasoning` with
  two verdicts, type into the box with `userEvent.type`, and expect one row.
- **Check:** this is a **controlled input**: React state is the single source of truth for what
  the box shows.

### Exercise 3: Show the match threshold on Settings

**Goal:** the Settings page shows "Match threshold: 70" (your configured value).

- **Server:**
  - Add `matchThreshold: number` to `Meta` in `src/web/api.ts`.
  - Set it from `state.config.match_threshold` in `meta()` in `src/web/server.ts`.
  - Extend the meta test in `tests/webApi.test.ts`.
- **Browser:** in `src/web/client/components/pages/SettingsPage.tsx`, call `useMeta()` and render the value once
  it isn't `null`.
- **Test:** in `tests/client/settings.test.tsx`, stub `/api/meta` with a `matchThreshold` and
  expect the text.
- **Check:** this exercise touches both sides, so you see how a shared type keeps the server and
  the browser in step. TypeScript tells you everywhere `Meta` must change.
