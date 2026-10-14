# Learning React and Next.js with myjobbot's web UI

This walkthrough teaches React, and the Next.js framework around it, through the web UI you
already use. Each section explains one idea, shows where this codebase uses it, and suggests what
to look at.

- **Read the files as you go.** The code has no explanatory comments, only a one-line purpose
  comment per function, so this document is the guide.
- **It stays accurate.** `tests/walkthrough.test.ts` checks that every file and component named
  here exists.

## How the pieces fit

```text
                       server (next dev / next start)                       browser
                       ──────────────────────────────                       ───────
GET /jobs ─► web/proxy.ts (Host allowlist) ─► web/app/layout.tsx
                                               ├─ <Header> ─ <Nav> ············ marks the page, <Link>s
                                               ├─ web/app/jobs/page.tsx
                                               │    └─ <DataPage> reads the database
                                               │         └─ <RowsList initial=first 100 rows> ··· scrolls, hides
                                               └─ <Footer>                          │
                                                                                    │ server functions
                                web/lib/actions.ts ◄────────────────────────────────┘
                                  loadMoreRows, setJobHidden ─► web/lib/rows.ts ─► src/web/pageData.ts
```

- **The server does the thinking.** It decides scores, boosts, filter notes and ghost flags, and
  hands over ready-to-show values. `src/web/rowViews.ts` builds them, `src/web/pageData.ts` pages
  them, and `src/web/api.ts` defines their TypeScript types. Those files are shared with the agent
  and know nothing about Next.js.
- **Pages arrive finished.** Each page is rendered on the server, so its first 100 rows are
  already in the HTML, even with JavaScript turned off.
- **The browser only does the interactive bits**: loading more rows while you scroll, and Hide.
- **Layout of `web/`**:
  - `app/`: one folder per address (`app/jobs/page.tsx` is `/jobs`), plus `layout.tsx`,
    `not-found.tsx`, `error.tsx` and the styles
  - `components/`, grouped by kind:
    - `sections/`: the parts every page shares (`Header`, `Footer`)
    - `menus/`: navigation (`Nav`)
    - `pages/`: what fills a page (`DataPage`, `RowsList`)
    - `tables/`: tables and their rows and cells
    - `forms/`: anything you submit (`HideButton`)
    - `common/`: small pieces used in several places (`ExternalLink`, `BulletList`)
  - `lib/`: hooks (`use….ts`), the server functions (`actions.ts` over `rows.ts`), the row-state
    helpers (`pageRows.ts`), the menu list (`pages.ts`) and the server's state (`uiState.ts`)

## 1. Components and JSX

A **component** is a function that returns what should appear on screen. **JSX** is the HTML-like
syntax inside it. React turns JSX into calls that build the page, and **escapes every
`{value}`**, so text from job postings can never inject markup.
`tests/client/jobRow.test.tsx` checks that a `<script>` title shows up as plain text.

**Where:** `JobRow` in `web/components/tables/JobRow.tsx`, built from `ScoreCell`, `TitleCell`,
`WhereCells`, `SourceCell` and `WhenCells`.

Notice how small each component is: habit-hooks allows 20 lines per function, so a table row is
split into cells. That is also how React code is usually written. When a component grows, you
pull out a smaller one with a clear name.

## 2. Props

**Props** are a component's inputs, passed like HTML attributes (`<ScoreCell score={job.score} />`)
and received as one typed object. They flow one way, from parent to child.

**Where:** `ScoreCell` in `web/components/tables/ScoreCell.tsx` takes a `score` typed from
`src/web/api.ts`. `ExternalLink` in `web/components/common/ExternalLink.tsx` takes `url` and
`children`. `Footer` in `web/components/sections/Footer.tsx` takes the database path and time
from the layout.

**`children`** is a special prop: whatever you put between the opening and closing tags. `JobRow`
puts its `children` in the last cell, which is how `JobTable` slots a `HideButton` into each row
without `JobRow` knowing anything about hiding. `RootLayout` receives each page as its
`children`.

## 3. Server components and client components

This is the idea Next.js adds to React. Every component is a **server component** unless its file
starts with `"use client"`.

- **Server components** run only on the server. They can read the database directly, and none of
  their code is sent to the browser. They can't keep state or react to clicks.
- **Client components** are rendered on the server too (that's why the rows are in the HTML), and
  then come alive in the browser, where they can keep state and handle events.

**Where:**
- `DataPage` in `web/components/pages/DataPage.tsx` is a server component: it calls `getUiState`
  and `loadRows` and passes the first page of rows down as a prop.
- `RowsList` in `web/components/pages/RowsList.tsx` starts with `"use client"`, because scrolling
  and Hide happen in the browser.
- `Header` in `web/components/sections/Header.tsx` is a server component that renders `Nav`, a
  client component in `web/components/menus/Nav.tsx`.

`"use client"` marks a **boundary**: everything a client component imports runs in the browser as
well. So the boundary sits as low as possible, around the interactive parts only. A server
component may render a client component and pass it props, but only plain data (no functions,
no database handles) can cross.

## 4. Routing from folders

Next.js's **App Router** turns folders into addresses. There is no routing code to write.

**Where:**
- `web/app/recommended/page.tsx`, `web/app/jobs/page.tsx`, `web/app/reasoning/page.tsx` and
  `web/app/settings/page.tsx` are the four pages. Each exports `metadata` with its title.
- `RootLayout` in `web/app/layout.tsx` wraps every page in the header and footer, and sets the
  title template `myjobbot · %s`.
- `Home` in `web/app/page.tsx` calls `redirect` to send `/` to Recommended.
- `NotFound` in `web/app/not-found.tsx` is shown for any unknown address, inside the layout.
- `ErrorPage` in `web/app/error.tsx` is shown when a page throws, for example on a broken
  `config.json`. The layout never loads the config, so the error page always has a layout to sit
  in.
- `Nav` uses `usePathname` to mark the current page and `Link` to switch pages without a full
  reload. `Link` also handles middle-clicks and prefetching. The menu's entries come from
  `web/lib/pages.ts`.

## 5. State

**State** is data a component remembers between renders. `useState` returns the current value
and a setter, and calling the setter re-renders the component with the new value. You never
change state in place; you give React a new value.

**Where:** `usePageRows` in `web/lib/usePageRows.ts` starts from the rows the server sent and
keeps any more that load, plus any "couldn't load more" message. `useHide` in `web/lib/useHide.ts`
keeps a button's `idle`, `saving` or `failed` status.

The changes to the rows live as plain functions in `web/lib/pageRows.ts`. `withMore` appends a
page, `withoutJob` removes a hidden job from Recommended, and `withJobHidden` dims one on All jobs.
Each returns a **new** object, which is what lets React see that something changed. They are
ordinary TypeScript you can read without knowing React.

## 6. Effects and cleanup

An **effect** (`useEffect`) runs code after React has updated the screen. It's for things outside
React, such as browser APIs and timers. Its dependency list says when to run it again. The
function it returns is the **cleanup**, which runs before the next run and when the component
goes away.

**Where:** `useWhenVisible` in `web/lib/useWhenVisible.ts` sets up an `IntersectionObserver` that
fires as the last row nears the screen, and disconnects it in its cleanup.

Notice what is missing: there is no effect that loads the first page. The server already put the
rows in the HTML, so the browser has nothing to fetch on arrival.

## 7. Events and server functions

Event handlers are props like `onClick` and `onSubmit` that take a function.

A **server function** (also called a server action) is an `async` function in a file that starts
with `"use server"`. A client component imports and calls it like any function; Next.js turns the
call into a request to the server and the result into the return value. There is no API to
design and no `fetch` to write.

**Where:**
- `HideButton` in `web/components/forms/HideButton.tsx` submits a small form, and `useHide`
  calls `setJobHidden` from `web/lib/actions.ts`.
- `usePageRows` calls `loadMoreRows` from the same file when you scroll.
- The real work is in `web/lib/rows.ts`, which checks its input with zod before touching the
  database. `tests/webRows.test.ts` tests it without any Next.js involved.

**Safety:** a server function is a public endpoint, so it validates everything it receives.
Next.js also refuses a call whose `Origin` is another site, so a page elsewhere can't hide your
jobs.

## 8. Lists and keys

Rendering a list means mapping data to elements. Each element needs a **`key`**: a stable,
unique ID that lets React match old rows to new ones as rows are added, removed or reordered.

**Where:** `JobTable` and `VerdictTable` in `web/components/tables/Tables.tsx`. Jobs use `jobKey`,
which combines `ats` and `jobId`. Verdicts use their database row id, because one job can be
scored twice at the same moment.

## 9. Custom hooks

A **custom hook** is a function whose name starts with `use` and that calls other hooks. It
packages behaviour, not markup, so components stay simple.

**Where:**
- `usePageRows` combines state, a load-more callback guarded by a `useRef` so it never runs twice
  at once, and `markHidden`.
- `useHide` and `useWhenVisible` each do one job.
- `LoadMore` in `web/components/tables/LoadMore.tsx` is a good small example: a ref to its row,
  plus `useWhenVisible(row, onLoad)`.

Two hook rules: call hooks only at the top level of a component or hook, never inside `if`, and
only from components or hooks. Hooks only work in client components.

## 10. Testing components

The tests use **Testing Library**. It renders a component into a simulated browser (`happy-dom`)
and finds things the way a user would: by role and visible text.

**Where:**
- `tests/client/hide.test.tsx` renders `RowsList` with the server functions replaced by
  `vi.mock`, clicks Hide with `userEvent`, and checks what was called and what changed.
- `tests/client/loadMore.test.tsx` uses a fake `IntersectionObserver`
  (`tests/helpers/fakeObserver.ts`) to simulate scrolling.
- `tests/client/nav.test.tsx` replaces `usePathname` to test the menu marking.
- `tests/webBuild.test.ts` runs a real `next build` and checks the list of routes.
- Component tests are `.test.tsx` files in `tests/client/`. `vitest.config.ts` runs them in a
  separate `dom` project.

## 11. How it's built and served

- **Development**: `npm run web` runs `next dev`. Saved changes appear in the browser at once,
  often keeping the page's state.
- **Production**: `npm run web:build` compiles everything, then `npm run web:start` serves it.
- **In Docker**: the `web` service runs `next dev` on the live `web/` and `src/` folders, so a
  saved change shows on the next reload with no rebuild.
- **Which hosts may connect**: `web/proxy.ts` runs before every request and answers 421 unless the
  `Host` is one you use. Set them in `MYJOBBOT_HOSTS`, for example
  `myserver.lan:8080,192.168.1.20:8080`. Without it, only `localhost` on `MYJOBBOT_PORT` gets in.
- **Settings**: `web/next.config.ts` points Next.js at the repository root so it can compile the
  shared code in `src/`.

## 12. Where to go next

- **`loading.tsx` and Suspense**: show a placeholder while a slow page renders on the server.
- **`useActionState`**: React's hook for forms that call server functions, with pending and error
  state built in. It could replace most of `useHide`.
- **Dynamic routes**: a folder named `[id]` gives you addresses like `/jobs/123`, for a job detail
  page.
- **The docs**: react.dev ("Thinking in React", "You Might Not Need an Effect") and nextjs.org's
  App Router guide are worth reading next to this code.

## Exercises

Each exercise is small and touches only the files it lists. Run `npm run check` when you're done.

### Exercise 1: Count hidden jobs on All jobs

**Goal:** below the summary on All jobs, show "N hidden on this page".

- **Files:** `web/components/pages/RowsList.tsx`. Count `data.rows.filter((job) => job.hidden)`
  when `data.kind === "jobs"` and `name === "jobs"`, and render a `<p>`.
- **Test:** in `tests/client/hide.test.tsx`, after hiding the row on All jobs, expect the text
  "1 hidden on this page".
- **Check:** the count changes as you click Hide and Unhide, with no reload. That works because
  it's computed from state every render.

### Exercise 2: Filter the reasoning history

**Goal:** a text box above the Reasoning table that shows only verdicts whose job title contains
the typed text.

- **Files:** a new `web/components/forms/ReasoningFilter.tsx` for the input, which starts with
  `"use client"` and takes `value` and `onChange` as props, plus
  `web/components/pages/RowsList.tsx`, which keeps the text in `useState` and filters `data.rows`
  before passing them to `VerdictTable`.
- **Test:** a new `tests/client/reasoningFilter.test.tsx`. Render `RowsList` for `reasoning` with
  two verdicts, type into the box with `userEvent.type`, and expect one row.
- **Check:** this is a **controlled input**: React state is the single source of truth for what
  the box shows.

### Exercise 3: Show the match threshold on Settings

**Goal:** the Settings page shows "Match threshold: 70" (your configured value).

- **Files:** only `web/app/settings/page.tsx`. Call `getUiState()` from `web/lib/uiState.ts` and
  render `config.match_threshold` inside the `<main>`.
- **Test:** in `tests/client/settings.test.tsx`, mock `web/lib/uiState.js` with `vi.mock` so it
  returns a config with a threshold of 70, and expect the text.
- **Check:** compare this with feature 002, where the same change needed a new API field, a
  server change and a fetch. A server component reads the value directly.

### Exercise 4: Add a page

**Goal:** an About page at `/about`, in the menu.

- **Files:** a new `web/app/about/page.tsx` that exports `metadata` with the title "About" and a
  component returning `<main aria-label="About"><p>…</p></main>`, plus one
  `{ path: "/about", label: "About" }` entry in `PAGES` in `web/lib/pages.ts`.
- **Check:** run `npm run web` and open `/about` directly, from the menu, after a reload and with
  the back button. Then run `git diff --stat`: exactly those two files changed, and nothing on
  the server needed wiring up.
