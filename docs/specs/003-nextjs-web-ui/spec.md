# Feature Specification: Next.js Web UI

**Feature Directory**: `docs/specs/003-nextjs-web-ui`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Lets bring in react-router unless there are better more modern
alternatives", then, after reviewing the options: "OK, lets update to NextJS for this spec"

**Builds on**: `docs/specs/002-react-web-ui/` (the React web UI, its JSON API and its own small
routing)

## Background

The web UI is a React app:
- The browser builds every page from JSON the server sends.
- About 30 lines of the project's own code handle navigation.
- A small Node server builds and serves the app with Vite, answers `/api/pages/*` and
  `/api/meta`, and keeps the Hide endpoint.

The owner first asked for a routing library. After weighing Next.js, they chose to move the UI
to **Next.js**, the most widely used React framework. Two reasons:
- **Routing comes built in**, from the page folders, so no separate router is needed.
- **It is where to learn the newest parts of React**: components that run on the server,
  server-side actions such as Hide, and streaming.

Next.js is named on purpose: learning it is the point of the feature. The owner chose to
lean on its server features (FR-005) and to run its development server in Docker (FR-006).

The agent itself (job fetching, scoring, scheduled runs) is not part of this change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The same UI, now a Next.js app (Priority: P1)

The owner opens the web UI and sees the same four pages: Recommended, All jobs, Reasoning and
Settings, with the same rows, scores, notes, links, menu, tab titles and footer. Everything else
also works as before:
- back and forward
- bookmarks and reloads
- `/` going to Recommended
- "Not found" for unknown addresses

**Why this priority**: This is the conversion itself, and nothing the owner relies on may get worse.

**Independent Test**: For the same database, compare every page before and after the change. All
rows, scores, notes and links match, and the existing page scenarios pass, adapted only in setup.

**Acceptance Scenarios**:

1. **Given** jobs scored at 90 and 40 with a threshold of 70, **When** the owner opens Recommended, **Then** only the 90 job appears, with its reasons and gaps, and "1 recommended · threshold 70".
2. **Given** the owner is on Recommended, **When** they click Reasoning, **Then** the address becomes `/reasoning`, Reasoning is marked current, the title reads "myjobbot · Reasoning", and the page did not fully reload.
3. **Given** a bookmark of `/jobs`, **When** it is opened, **Then** All jobs loads directly.
4. **Given** a title containing `<script>` markup or a `javascript:` posting link, **When** it is shown, **Then** it appears as text, and only `http(s)` postings become links.
5. **Given** an unknown address, **When** it is opened, **Then** a "Not found" page appears with the usual header and footer.

---

### User Story 2 - Long lists and Hide keep working (Priority: P1)

Lists show 100 rows and load more as the owner scrolls. Hide and Unhide take effect at once,
removing the job from Recommended or dimming it on All jobs. A failed change is reported, and
requests from other sites are refused.

**Why this priority**: These are the UI's only interactive behaviours. They are also where a
framework's server features (actions, revalidation) differ most from the current approach.

**Independent Test**: With 250 jobs, scroll All jobs to the end (100, 200, then 250 rows, with
no duplicates). Hide a job: it changes at once and stays hidden after a reload. A forged
cross-site request to hide a job is refused.

**Acceptance Scenarios**:

1. **Given** 250 jobs, **When** the owner scrolls All jobs, **Then** rows arrive 100 at a time with no duplicates or gaps, including when a scheduled run adds jobs meanwhile.
2. **Given** a recommended job, **When** the owner clicks Hide, **Then** it disappears at once and stays hidden after a reload.
3. **Given** the save fails, **When** the owner clicks Hide, **Then** the row is unchanged and the owner is told.
4. **Given** a page on another site, **When** it tries to hide a job on the owner's behalf, **Then** the change is refused.

---

### User Story 3 - Adding a page is one new folder (Priority: P2)

To add a page (for example, job details later), the owner creates one page file in the right
folder and lists it in the menu. Nothing on the server side needs a separate change.

**Why this priority**: This was the original motivation, wanting a proper way to grow the UI.

**Independent Test**: Follow the walkthrough's "add a page" exercise. The new page works by
address, reload, menu and back button, and only the documented files changed.

**Acceptance Scenarios**:

1. **Given** the walkthrough's steps, **When** the owner adds a page, **Then** it is reachable and marked in the menu, with at most two files touched.

---

### User Story 4 - Learning Next.js from the code (Priority: P2)

The owner learns Next.js's core ideas from the code and the walkthrough:
- folder-based routing, layouts, not-found pages
- which code runs on the server and which in the browser
- server actions, which Hide uses
- how the app is built and served

**Why this priority**: Learning is why the feature exists.

**Independent Test**: The walkthrough's Next.js section names a file that exists for each idea,
and the walkthrough test passes.

**Acceptance Scenarios**:

1. **Given** the updated walkthrough, **When** the owner follows a reference such as "this page reads the database on the server", **Then** it leads to the exact file that does so.

### Edge Cases

- **The database is busy** while a scheduled run writes: pages still load, as today.
- **A config error** (for example a bad `exclude_publishers` entry): the owner sees an error message, not a blank screen.
- **JavaScript off**: pages still show their first 100 rows, because they are rendered on the server. Loading more rows and Hide need JavaScript, and say so.
- **The web container restarts**, for example after a code or dependency change: no scheduled agent run is interrupted, because the agent runs in its own service.
- **A scheduled run adds jobs while a list is open**: loading more rows never duplicates or skips rows (the fix from feature 002 is kept).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The web UI MUST be served by a Next.js application that replaces the current Node server, the Vite build and the project's own routing code.
- **FR-002**: All four pages MUST show the same information as today, with the same addresses and navigation behaviour: menu marking, titles, back and forward, bookmarks, the root redirect, and "Not found".
- **FR-003**: Lists MUST page by 100 with no duplicates or gaps. Hide and Unhide MUST behave per page as today, report failures, and refuse cross-site requests.
- **FR-004**: The rules for what is shown (thresholds, boosts, title and company filters, ghost age, `http(s)`-only links) MUST stay in one place, shared by every page, and MUST NOT be copied into browser code.
- **FR-005**: The app MUST be server-first (clarified 2026-10-14, option A).
  - Each page is rendered on the server, reading the database through the existing shared rules, and arrives with its first rows already in the HTML.
  - Only the interactive parts (loading more rows while scrolling, the Hide button) run in the browser.
  - Hide is a server action.
  - Any part of the current JSON API that no longer has a user MUST be removed.
- **FR-006**: The Docker `web` service MUST run Next.js's development server with the live source mount (clarified 2026-10-14, option B), so a saved change shows on the next reload with no image rebuild, as today. This knowingly runs a development server on the home network, so:
  1. **No other files served.** It MUST NOT serve any file outside the web app. In particular, nothing under `data/` (database, config, resume) or `.env` may be fetchable by address.
  2. **Requests limited to the home network.** It MUST accept requests only from the home network, using whatever origin and host restrictions the development server offers.
  3. **Speed targets still met.** It MUST still meet SC-003 for page speed in development mode.
  4. **Production mode still works.** A production build and start MUST also work outside Docker, for example `npm run web:build` and `npm run web:start`, so the app isn't tied to development mode.
- **FR-007**: The agent's scheduled runs and the `myjobbot run` command MUST NOT load or depend on any web or Next.js code, and MUST keep running unaffected.
- **FR-008**: The project's quality gates MUST pass with no exemptions: type checks for both the agent and the web app, tests, and habit-hooks, including the 12-line function limit and knip's unused-code checks with Next.js's file conventions recognised.
- **FR-009**: New dependencies MUST be pinned exactly and added through the lockfile, keeping every optional platform package (Next.js ships its compiler per platform). The Docker image MUST be rebuilt before anything first relies on them.
- **FR-010**: The walkthrough (`docs/react-walkthrough.md`) MUST be updated:
  - Sections that describe replaced code (the routing hook, the Vite build, the JSON API if removed) are rewritten.
  - A Next.js section is added.
  - It has at least one exercise, such as adding a page.
  - Every file and component it names exists; the walkthrough test enforces this.
- **FR-011**: The UI MUST stay reachable only on the home network, with no login, as today. The development server chosen in FR-006 is the only development server exposed, and only with its safeguards.

### Key Entities

- **Page (route)**: an address, a label for the menu and title, and the file that renders it.
- **Job row and verdict row**: the display-ready data each page shows, unchanged from feature 002.
- **Hide action**: one change to a job's hidden flag, made from a row.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For the same database, 100% of the rows, scores, notes and links shown before the change are shown after it, on all four pages.
- **SC-002**: Every existing page, Hide and navigation scenario still passes, adapted only in setup or test level. None is dropped.
- **SC-003**: Each page shows its first rows within 1 second with 1,000 stored jobs, and Hide responds within half a second, on the home network.
- **SC-004**: Adding a page touches at most two files, and none outside the web app.
- **SC-005**: The full project check passes with zero findings and no exemptions, and scheduled agent runs keep succeeding throughout the rollout.

## Assumptions

- **Single user on the home network**, no login, as today.
- **No visual redesign.** Same look, light and dark.
- **Development mode on the LAN is accepted.** The owner prefers instant live changes to a hardened production server (2026-10-14). Production mode is kept working, so switching later is a configuration change, not a rewrite.
- **Next.js version.** The current stable release, Next.js 16, with the App Router. Next.js 16.4.0 was current on 2026-10-14. The older Pages Router is not used.
- **The agent is untouched.** The agent stays in this repository, and the web app may live in its own folder with its own TypeScript settings if Next.js needs settings the agent can't use. The plan decides this.
- **Spec 002's decisions stay where they still apply**: the shared types and rules, and the paging fixes. The ones Next.js replaces (the Vite build, the own routing, possibly the JSON API) are superseded by this spec.
- **Constitution.** The gates come from `.specify/memory/constitution.md` v1.2.0 (re-ratified 2026-10-14), which transcribes `CLAUDE.md` and habit-hooks and covers `web/` as well as `src/`.
