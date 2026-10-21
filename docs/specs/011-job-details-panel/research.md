# Research: Job details panel

Inputs:
- the spec and its clarifications (2026-10-21);
- the web UI as it is after feature 009 (`web/components/pages/RowsList.tsx`,
  `web/components/tables/*`, `web/lib/actions.ts`, `web/lib/rows.ts`, `web/lib/pageRows.ts`,
  `src/web/rowViews.ts`, `src/web/pageData.ts`, `src/db/kysely/jobViews.ts`);
- the Next.js 16 docs shipped in `node_modules/next/dist/docs`;
- the deep analysis of 2026-10-21.

## R1. How the panel gets a job's details

- **Decision**: a server action, `loadJobDetails(ats, jobId)` in `web/lib/actions.ts`, that only
  delegates to `loadDetailsFor(views, config, request)` in `web/lib/rows.ts`. That function does
  the zod check, the reads and the mapping, beside `loadRows` and `setHiddenFor`. The mapping is
  `toJobDetailView` in `src/web/jobDetail.ts`, which uses `rowContext` (exported from
  `src/web/pageData.ts`) so the panel and the rows read the job the same way.
- **Rationale**: it's the pattern the web UI already uses. Validation lives in `rows.ts`, so it is
  unit-tested with memory views (`tests/webRows.test.ts`), while the `"use server"` file only opens
  the database. Rows stay light (FR-006, SC-005).
- **Input limits**: `ats` is non-empty and at most 32 characters (its column size); `jobId` is
  non-empty and at most 255. Anything else throws "Invalid job request", as `loadRows` does.
- **Alternatives**: carrying details in the rows (heavier tables); a route handler (a second way of
  doing what server actions already do).

## R2. The open job in the address (FR-004)

- **Decision**: `?job=<ats>:<jobId>` on the Recommended and All jobs pages, built and read by pure
  helpers in `web/lib/jobParam.ts`:
  - `parseJobParam(value)` splits on the first `:`;
  - `jobParam(key)` is its inverse;
  - `withJob(search, key | null)` returns a full query string through `URLSearchParams` (other
    parameters kept, the value encoded). Both the title link's `href` and every `pushState` use it.
- **Sync**: `useOpenJob` (`web/lib/useOpenJob.ts`) reads `useSearchParams()`, which is
  `null`-safe: a `null` value, as outside Next's router, means "no job". `open` and `close` call
  `window.history.pushState(null, "", withJob(location.search, …))`. Next.js 16 documents native
  `pushState` as integrating with `useSearchParams` (`01-app/02-guides/single-page-applications.md`).
- **No history loops**: the panel's own close calls `close()` only when the address still names a
  job. Going back (`popstate` to no job) closes the panel without pushing a new entry, so Forward
  still works.
- **Tests**: outside Next, `useSearchParams` returns `null` and doesn't react to `pushState`, so the
  UI tests mock `next/navigation.js` (as `tests/client/nav.test.tsx` does). The mock reads
  `window.location.search` and re-renders on `pushState` and `popstate`.

## R3. The panel element (FR-002, FR-003, FR-010, FR-013; clarification 4: non-modal)

- **Decision**: the native `<dialog>` opened with `show()`, which is **non-modal**: the list stays
  clickable and scrollable, so clicking another title switches the panel. Because a non-modal
  dialog gets no built-in Escape or backdrop:
  - a document `keydown` listener closes it on Escape while it's open;
  - a document `pointerdown` listener closes it when the click lands outside the panel, unless it
    lands on an element marked `data-keeps-panel`: job titles (they switch it) and each row's
    posting icon and Hide button (they do their own job);
  - on open, focus moves to the panel's heading. On close, it returns to the title that opened it,
    or to `main` after a deep link;
  - `aria-labelledby` names it with the job's title. There is no focus trap; the list stays
    reachable.
- **Layout**: class `details-panel`, since `.panel` already exists for Settings. It's fixed to the
  right edge, `width: 60vw` (FR-013), full height, and nearly full width under 800px. It slides in
  (respecting `prefers-reduced-motion`), and its body scrolls with `overscroll-behavior: contain`,
  so scrolling the panel doesn't scroll the list. Colours use the existing tokens, including dark
  mode.
- **Keeping the job**: the panel keeps the job it opened. If its row disappears (hidden on
  Recommended), it keeps showing it, as hidden, until closed (spec edge case).
- **Test environment**: vitest's `dom` project uses happy-dom (21.x), which implements `show()`
  and `close()`. Real focus and layout are checked by hand per quickstart.
- **Alternatives**: a modal `showModal()`, rejected in clarification 4 because it makes the list
  inert, so a click on another title would only close the panel; a dialog library (needs owner
  approval, and adds nothing here).

## R4. The title opens the panel (FR-001, FR-009, clarification 1)

- **Decision**: in `TitleCell`, the title becomes `<a href={withJob(search, key)}
  data-keeps-panel>`.
  - A plain left click calls `open(key)` with `preventDefault`.
  - A modified click (Ctrl/Cmd/middle, new tab) follows the link, and the new tab opens the page
    with that job's panel.
  - `TitleCell` calls `useOpenJob` directly, so no prop goes through `JobTable` and `JobRow`.
- **Without JavaScript** the link just reloads the page with `?job=` and no panel. That's harmless,
  and the existing `noscript` note already says loading more rows and Hide need JavaScript. The
  panel isn't added to that note, so its asserted text is unchanged.

## R5. The posting icon (US3, FR-008)

- **Decision**: `web/components/common/PostingLink.tsx` is an inline SVG icon in an `<a
  target="_blank" rel="noopener noreferrer" aria-label="Open the posting" data-keeps-panel>`. It
  renders nothing when `url` is null; `webUrl` in `src/web/rowViews.ts` already turns non-http(s)
  addresses into null. The action cell becomes an inline row (flex with a gap), since `form.hide`
  is a block today, so the icon sits to Hide's left.

## R6. Sections that leave room for the trace (FR-007)

- **Decision**: the panel renders its sections in order: Job, Score, Description, Warnings (only
  when there are any), History. Each is a `PanelSection` (heading and content). The trace feature
  appends "Path" without touching the others.

## R7. Data needed (read only)

- **`JobViews.jobDetail({ ats, jobId })`**: one `jobs` row, as everything the row view uses plus
  `compensation`, `workplace_type`, `description_source`, `description_url`, `requirements`,
  `skills`, `preferred_skills` and `injection_seen_at`, or `null`.
- **`JobViews.jobVerdicts({ ats, jobId })`**: that job's verdicts, newest first. It uses the same
  joined builder as `verdictHistory` (`verdicts` left-joined to `jobs`), pulled into a private
  helper both reads use.
- **No index added**: `verdicts` has no `(ats, job_id)` index. That's a small table read once per
  panel open; quickstart PR 6 times it against SC-002, and an index comes only if that's slow.
- **Score shown**: `total` is the row's boosted score (`jobScore` in `rowViews.ts`). The panel also
  shows `model`, the stored score, and the boost note, so it agrees with the table.

## R8. Delivery: a docs PR, then six code PRs (spec "Delivery")

Each PR is one sitting, branched from an up-to-date `main` after the stack is stopped, about 10
files, tests included.

| PR | Sitting | Contents | Owner can test |
|---|---|---|---|
| 1 | S1 | `PostingLink` icon in the action cell | The icon opens the posting; the title is unchanged |
| 2 | S2 | Non-modal panel, `?job=`, the title opens it, the job section from row data | Open, switch, close, Escape, outside click, reload, back/forward |
| 3 | S3 | `jobDetail` read, `loadDetailsFor`/`loadJobDetails`, the panel fetches; job section gains pay and remote | A link to any job works; pay and remote terms |
| 4 | S4 | Score section (total, model score, boost, parts, reasons, gaps) | The score explained |
| 5 | S5 | Description section and origin | Description, requirements, skills, careers page |
| 6 | S6 | `jobVerdicts` read, warnings and history sections | Injection warning, every score |

In PR 2, a job named in the address but not among the loaded rows shows "job not found". PR 3's
fetch replaces that.

PR 3 is the largest, at about 15 files. Most of that is the store layer: a moved memory views
file, three small additions, and contract wiring. The panel side is small. Splitting it further
would leave a PR with nothing to see in the UI.

## R9. Test split (Principle II)

- **Unit** (about 18):
  - `jobParam` and `withJob`;
  - the `jobDetail` mapper (job extras, score, description, origin, warnings, history, empty
    states);
  - `loadDetailsFor` validation, not-found and the verdict read;
  - the `jobDetail`/`jobVerdicts` contract cases on memory.
- **Integration**: the same contract cases on MariaDB, about 5.
- **UI** (the suite is already above its 1% share, so this is the minimum that proves each PR's
  interaction): the icon, panel open/switch/close and the address, and each section's render. About
  6.
