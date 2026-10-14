# Research: React Web UI

Checked against the code and the npm registry on 2026-10-13. The spec fixes two choices:
- React builds the pages in the browser from data the server provides (FR-014).
- A walkthrough document comes with the code (FR-013).

Everything below is the "how".

## R1. Packages and versions

- **Decision**: add these packages, each pinned exactly to match the repo's style.
  - Runtime (`dependencies`, needed inside the Docker image, which installs with `--omit=dev`):
    - `react` and `react-dom` 19.3.0
    - `vite` 8.3.2, the version already in the lockfile through vitest
    - `@vitejs/plugin-react` 6.1.2
  - Development only (`devDependencies`):
    - `@types/react` and `@types/react-dom` 19.3.0
    - `@testing-library/react` 16.3.3
    - `@testing-library/dom` 10.4.2
    - `@testing-library/user-event` 14.6.8
    - `happy-dom` 21.0.1
- **Rationale**: these are the standard React 19 toolchain, the same set `npm create vite`'s
  `react-ts` template uses, so what the owner learns transfers to other projects. Pinning `vite`
  to 8.3.2 reuses the copy vitest already installs, so the app and the tests share one Vite.
  `happy-dom` has far fewer transitive dependencies than `jsdom`, which keeps the lockfile change
  small (see R10).
- **Alternatives considered**:
  - `jsdom` 30.1.2: the most common choice, but a much larger dependency tree.
  - `esbuild` used directly instead of Vite: simpler, but no development server with hot reload,
    and not what React projects usually use.
  - `react-router`: see R5.
  - TanStack Query: see R6.
- **To confirm at install**: the registry timed out on `react`'s version during research.
  `react-dom` 19.3.0 needs an identical `react`. Check this first.

## R2. Where React's output comes from at run time

- **Decision**: when `myjobbot serve` starts, it builds the browser code once with Vite's
  `build()` into a temporary folder under the OS temp directory, then serves those files itself.
  With `MYJOBBOT_WATCH=1` (the Docker `web` service), it uses `build({ build: { watch } })`
  instead, so saving a browser file rebuilds the bundle in about a second and a browser reload
  shows the change. A separate `npm run dev:web` runs Vite's own development server with hot
  module replacement, bound to `localhost` only, and forwards `/api` and `/hide` to `serve`. That
  is the fastest loop for learning, for local use.
- **Rationale**:
  - **One code path, no Dockerfile build step**: the live `./src` mount keeps working, and code
    changes still need no image rebuild, as with the server code today.
  - **Small surface on the home network**: the always-on server only ever sends built files from
    one folder. Vite's development server is meant for local use. It serves project files over
    `/@fs/`, which by default reaches the project root, including `data/` (the database, config and
    resume). It has also had file-access bypass bugs over the years. So it is never exposed on the
    LAN.
  - **Writable output**: in Docker, `/app` belongs to root and the server runs as `node`, so build
    output and Vite's cache (`cacheDir`) both go to the temp directory.
  - **Settings reach the container**: the Docker image copies only `package.json`,
    `package-lock.json`, `tsconfig.json`, `src/` and `docker/`, and compose mounts only `./src`.
    A root `vite.config.ts` would not exist inside the `web` container. So the Vite settings live
    in `src/web/viteConfig.ts`, and `clientBuild.ts` passes them inline (`configFile: false`).
    The root `vite.config.ts` only re-exports them, so `npm run dev:web` uses the same settings.
    A settings change then reaches the container through the `src` mount like any other code.
- **Alternatives considered**:
  - Vite's development server in middleware mode inside `serve`. It has hot reload, but it exposes
    a development server on the LAN all the time (above).
  - Building in the Dockerfile only. A browser change would then need an image rebuild, which
    breaks the current "code changes need no rebuild" workflow.
  - Running two processes in the container (`vite build --watch` alongside the server). That
    means more moving parts than one in-process `build()`.

## R3. Serving the built files safely

- **Decision**: map each address the server is asked for:
  - `GET /` redirects to `/recommended`, as today.
  - `GET /recommended`, `/jobs`, `/reasoning` and `/settings` all return the built `index.html`.
    This is the single-page app fallback, so bookmarks and reloads work (FR-003).
  - `GET /assets/<file>` returns that file from the build folder. The resolved path must stay
    inside the folder (no `..`), and the content type comes from the extension. These files get
    long cache headers, since Vite puts a hash in their names.
  - Unknown `/api/...` addresses get a JSON 404. Any other unknown address gets today's "Not
    found" page.
  - Any method other than `GET`, except `POST /hide`, gets 405.
- **Rationale**: these keep today's addresses, error pages and redirect (FR-003, FR-009). The
  server reads files only from the one build folder.
- **Alternative considered**: a static-file library such as `sirv`. It is one more dependency
  for about 15 lines of code.

## R4. Data the browser receives (JSON API)

- **Decision**:
  - `GET /api/pages/:name?offset=N` returns one page of rows plus its summary, empty-state
    message, total and next offset.
  - `GET /api/meta` returns the footer's database path and time.
  - The server works out every display decision, as it does today, and sends ready-to-show
    values: boosted score, breakdown text, boost note, filter note, ghost flag, days open,
    "via LinkedIn", and the link URL, which is `null` unless `http` or `https`.

  The browser only lays these values out. The exact shapes are in `contracts/web-api.md` and
  `data-model.md`.
- **Rationale**: the filters, boosts and age rules live in `src/jobs/` and depend on the config.
  Keeping them on the server keeps them in one place and out of the bundle. It also keeps the
  React components small and focused on display, which suits both learning and habit-hooks'
  12-line function limit. Shared TypeScript types, imported with `import type` by both sides,
  keep the two sides agreeing about the shape.
- **Alternative considered**: sending raw database rows and computing in the browser. That would
  copy the business rules into the client and ship config such as the title filter to the
  browser.

## R5. Navigating between pages

- **Decision**: a small hook of our own, `usePath()`. It reads `location.pathname`, listens for
  `popstate`, and offers a `navigate(path)` that calls `history.pushState`. A `<NavLink>`
  component stops ordinary clicks and calls `navigate`. `App` chooses the page component with a
  plain `switch` on the path.
- **Rationale**: there are four fixed pages and no URL parameters. About 20 lines of our own
  code teach `useState`, `useEffect` and cleanup, which are the core ideas. A routing library
  would hide them at this size. The walkthrough names `react-router` as the next step when there
  are more pages.
- **Alternative considered**: `react-router` 7. It is the industry standard, but it brings many
  new ideas at once for four pages.

## R6. Loading data, infinite scroll and Hide

- **Decisions**:
  - **`usePageRows(name)`**: fetches the first page with `fetch` inside `useEffect`, using an
    `AbortController` so switching tabs mid-request is safe. It keeps `rows`, `total`,
    `nextOffset`, `error` and `loading` in state. `loadMore()` appends the next page, guarding
    against two loads at once.
  - **`<LoadMore>`**: renders a sentinel table row. An `IntersectionObserver`, set up in a
    `useEffect` with a 400px margin as today, calls `loadMore` when the row comes into view. The
    row also contains a "Load more" button for keyboards, and as a fallback.
  - **`useHide()`**: posts to `/hide` with the `x-myjobbot-fetch` header and the
    `application/x-www-form-urlencoded` body the server already accepts. The row updates only
    after the server confirms (204):
    - On Recommended the row is removed from state.
    - On All jobs the row's `hidden` flag flips.
    - On failure, the row is unchanged and an inline "Couldn't save — try again" message appears
      on the row (FR-006).
- **Rationale**:
  - Plain `fetch`, `useEffect` and `useState` are the fundamentals the owner asked to learn.
  - Updating only after the server confirms is the simplest correct behaviour, and on the home
    network a round trip is far under the 0.5 s target (SC-003).
  - The `/hide` endpoint, its same-origin check and its `back` handling stay exactly as they are,
    so the existing Hide tests keep their meaning.
- **Alternatives considered**:
  - TanStack Query, which does caching and retries. The walkthrough names it as a next step.
  - Updating the row before the server confirms and rolling back on failure. It is more complex
    to teach first.
  - A new JSON `/api/hide`. It would need a second copy of the cross-site protection.

## R7. Tests

- **Decision**: vitest gets a `vitest.config.ts` with two projects:
  - **`node`** for `tests/**/*.test.ts`: the server, API and Hide tests, which run as today.
  - **`dom`** for `tests/**/*.test.tsx`: component and page tests with `happy-dom`,
    `@vitejs/plugin-react`, Testing Library and user-event. `fetch` is stubbed with `vi.fn` or
    `vi.stubGlobal`.

  Today's 23 page and Hide scenarios (SC-002) split as follows:
  - **Server-side rules** move to API tests (`tests/webApi.test.ts`): threshold, boosts, excluded
    companies, title-filter notes, ghost flag, paging totals, invalid offsets, routing, the 404,
    405 and 500 responses, and the 302 redirect. They assert on the JSON.
  - **Display rules** become component tests: escaping, links only for `http(s)`, rows rendering
    the notes, Hide behaviour per tab, infinite scroll, error and empty states.
  - **Hide endpoint**: the four endpoint tests in `tests/hideJobs.test.ts` stay unchanged (204
    for fetch, cross-site, unknown job, malformed body, bad `back`, re-fetch keeps hidden). The
    three that read the old HTML pages switch to reading `/api/pages/*` JSON. The check that a
    Hide button exists moves to a component test.
- **Rationale**: the projects split avoids a per-file `@vitest-environment` comment, which the
  project's no-comments convention discourages. vitest 5 removed `environmentMatchGlobs`, so
  projects are the supported way. Testing Library's "query by what the user sees" style is the
  standard way to test React, and is worth learning.
- **Alternative considered**: a real browser runner (Playwright or vitest browser mode). It is
  heavier, and nothing here needs a real browser engine.

## R8. TypeScript configuration

- **Decision**: in the root `tsconfig.json`:
  - add `"jsx": "react-jsx"`
  - add `"lib": ["ES2023", "DOM", "DOM.Iterable"]`
  - extend `include` to cover `vitest.config.ts` and `vite.config.ts`

  Imports between browser files keep the `.js` extension, as NodeNext requires, and Vite resolves
  `./App.js` to `App.tsx`. `npm run typecheck` checks browser and server code in one pass (FR-011).
- **Rationale**: one config and one check. The cost is that DOM types are visible to server code
  too, which tests and review would catch.
- **Alternative considered**: separate client and server `tsconfig` files with project
  references. That is stricter, but means two configs for the owner to understand on day one.

## R9. habit-hooks and knip

Findings from the installed habit-hooks TypeScript plugin:
- **eslint**: the shipped `eslint.config.mjs` already applies to `**/*.tsx`, and
  `@typescript-eslint/parser` reads JSX from `.tsx` files. The 12-line function limit includes
  JSX, so every component returns at most about 9 lines of JSX. This leads to small components
  (a `ScoreCell`, a `HideButton`, and so on), which is the decomposition the walkthrough teaches.
- **knip**: the shipped `knip.json` treats only `src/cli.ts!`, `src/index.ts!` and `tests/**` as
  entry points. The browser entry `src/web/client/main.tsx` is reached only through Vite's build,
  not through an import, so knip would report every browser file as unused. A project-level
  `knip.json` replaces the shipped one entirely; habit-hooks' `knip.cjs` uses a project config
  when one exists. **Decision**: add a project `knip.json` that copies the shipped entries,
  `project`, `ignore` and `ignoreDependencies`, and adds `src/web/client/main.tsx!` as a
  production entry. That is a real production entry point, not a test-only escape hatch, so it
  matches the intent behind habit-hooks' "never add test-only code to `entry`" warning.
  - If knip's Vite or vitest plugins don't pick up `happy-dom`, `@vitejs/plugin-react` or
    `@testing-library/dom`, list them through those plugins' config rather than under
    `ignoreDependencies`.
  - **Drift risk**: because the project file replaces the shipped one, later habit-hooks releases
    that change the shipped entries or `ignoreDependencies` will not apply here automatically.
    The copy records its source, and `CLAUDE.md` says to compare the two when habit-hooks is
    upgraded (T015).

## R10. Lockfile

- **Decision**: generalise the tldts splice (memory note "myjobbot dev workflow"):
  1. Install into a scratch copy.
  2. Take every `packages` entry that is new in the generated lockfile, plus the root
     `dependencies` and `devDependencies` changes, and add them to the committed lockfile.
     Existing entries, including the optional platform binaries, are never removed.
  3. Run `npm ci` and check that 15 `@rolldown/binding-*` entries remain.

  The splice is a short script run once (kept in the scratchpad, not committed).
- **Rationale**: a plain `npm install` drops the optional platform binaries (npm/cli#4828), and
  regenerating the whole lockfile would bump every transitive version.

## R11. Docker

- **Decision**:
  - No Dockerfile change beyond the new dependencies. `serve` builds the client at startup
    (R2), so the image needs no build step.
  - The `web` service keeps `MYJOBBOT_WATCH=1` and the `./src` mount, and gains Vite's
    watch-mode rebuilds.
  - The dependency changes are picked up by the existing `docker compose watch` rules
    (`package.json` and `package-lock.json` trigger a rebuild), which satisfies FR-012.
  - The first `serve` start after the change takes a few seconds longer while the client builds.
- **Check at implementation**: `vite build` inside the container must write only under the temp
  directory (`build.outDir` and `cacheDir`), because `/app` is read-only to the `node` user. It
  must also read its settings from `src/web/viteConfig.ts` (R2), never from a root config file
  that the image doesn't contain.

## R12. Walkthrough document

- **Decision**: `docs/react-walkthrough.md`, organised by idea:
  1. components and JSX
  2. props
  3. state
  4. effects and cleanup
  5. events
  6. loading data
  7. lists and keys
  8. custom hooks
  9. testing components
  10. next steps: `react-router`, TanStack Query, hot reload with `npm run dev:web`

  Each section names the file and component that shows the idea. The walkthrough ends with at
  least three exercises:
  - show a count of hidden jobs on All jobs
  - add a filter box on Reasoning
  - add a first read-only value on Settings, such as the match threshold from `/api/meta`

  For each exercise it lists the files to change and the test to add.

  A test, `tests/walkthrough.test.ts`, extracts every `src/...` path and component name in the
  walkthrough and checks that it exists (SC-007).
- **Rationale**: the comment rule stays intact, and the test keeps the document from drifting
  out of date as the code changes.

## R14. Keeping agent runs away from the web code

- **Finding**: `src/cli.ts` statically imports `startUi` from `src/app/serve.ts`, and that
  imports `src/web/server.ts`. Once the server imports Vite (through `clientBuild.ts`), every
  scheduled `myjobbot run` would load Vite and React's build tooling too, for no reason. And
  because `./src` is mounted live into both containers, it would crash with
  `ERR_MODULE_NOT_FOUND` until the image is rebuilt. That is the same failure as the tldts
  incident on 2026-10-13.
- **Decision**: `cli.ts` loads the `serve` code with a dynamic `await import("./app/serve.js")`
  only when the `serve` command runs. knip follows dynamic imports, so nothing becomes unused.
- **Rationale**: agent runs no longer depend on any web package, and a web dependency problem can
  never stop the scheduled job search.

## R15. The working tree is live

`compose.yaml` mounts `./src` into both containers, so whatever is in the checkout runs on the
LAN, including half-finished work on a branch. Three rules follow, and the tasks enforce them:
- **The server keeps serving the old HTML pages** until the React app has reached parity
  (US1–US3). The switch to React happens in one unit of work at the end.
- **The Docker image is rebuilt with the new dependencies before the server first imports them.**
  This happens at the switch-over, and only when no scheduled run is in progress.
- **R14 lands before any web dependency is imported**, so the agent's runs are never at risk.

## R13. Constitution

The gates come from `.specify/memory/constitution.md` v1.0.0, ratified 2026-10-13 by transcribing
the existing `CLAUDE.md` and habit-hooks rules:
- **I. Habit-hooks clean at all times**: size limits, and knip clean including the browser entry
- **II. Test-first, checked before done**: tests in `tests/`, `npm run check` green
- **III. Purpose comments only**: one-line doc comments on every function in `src/`, including
  components and hooks
- **IV. Bounded, locked dependencies**: exact pins, lockfile installs, optional entries kept
- **V. Specs live in docs/specs**: this feature is in `docs/specs/002-react-web-ui/`
