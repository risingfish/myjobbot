# Research: Job interactions (Applied and Hide)

Every decision below follows the code as it stands on `main` after feature 012 (`ab146ae`). No new
library is needed.

## R1. Storing the applied mark

- **Decision**: two columns on `jobs`, as the owner's request names them: `applied` (`tinyint`, not
  null, default 0, like `hidden`) and `applied_on` (`varchar(32)`, null). `applied_on` holds an ISO
  8601 UTC string (`2026-10-23T16:40:00.000Z`), the format of every other time column
  (`first_seen`, `last_seen`, `scored_at`, `injection_seen_at`). One store method sets or clears both
  in one `UPDATE`, so `applied = 1` exactly when `applied_on` is set; the row schema in
  `src/db/rows.ts` parses `applied` to a boolean as it does `hidden`.
- **Rationale**: the owner asked for both fields. Keeping the time as an ISO string, not a MariaDB
  `DATETIME`, matches the rest of the schema and sorts and compares the same way; "datetime" in the
  request is met by the value, not the column type.
- **Alternatives**: `applied_on` alone, with "applied" meaning "the time is set" (one column, no
  way to disagree, but not what the owner named; the single write path makes disagreement
  impossible anyway). A `DATETIME` column (the only one in the schema, needing conversion on every
  read and write).

## R2. Keeping the first time, and undo

- **Decision**: marking runs `UPDATE jobs SET applied = 1, applied_on = COALESCE(applied_on, :now)`
  through Kysely's builder (`eb.fn.coalesce("applied_on", eb.val(now))`), so marking twice keeps the
  first time (FR-009). Undoing sets `applied = 0, applied_on = NULL` (FR-013). The method then reads
  the row's `applied_on` back and returns it, or `null` for a missing job, so the UI shows the stored
  time, not the click's. A repeat mark still counts as a matched row: mysql2 reports found rows, as
  `setHidden`'s contract case already relies on.
- **Rationale**: one statement decides the time; two tabs marking the same job agree on it.
- **Alternatives**: the browser sends the time (trusts the client's clock; rejected); a
  `WHERE applied = 0` guard (cannot tell "already applied" from "no such job" without a second read
  anyway).

## R3. The server time, not the browser's

- **Decision**: the server action stamps `new Date()` when it receives the change. `setAppliedFor`
  in `web/lib/rows.ts` takes that time as an argument, as `loadPageData` takes `now`, so its tests
  pass a fixed one.

## R4. Showing the time in the browser's time zone without a flash (FR-011)

- **Decision**: `web/lib/appliedTime.ts` holds:
  - A private `appliedLabel(iso, timeZone, style)`, formatting with `Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short", timeZone })` for `"date"` (`2026-10-23`), adding `timeStyle: "short"` for
    `"dateTime"` (`2026-10-23 09:40`; the style arrives in PR 5). The `sv-SE` locale gives ISO-style
    dates, like the rest of the UI and `src/web/gmailPanel.ts:49`, and makes test strings exact
    whatever the machine's own locale. It is never exported: its callers are in the same file, and
    an export only tests used would be test-only code.
  - `rowLabel(job, timeZone)`: "Mark as applied", "Applied on 2026-10-23", or "Applied" while the
    zone is unknown (PR 3).
  - `appliedFact(job, timeZone)`, the panel's Job section value: "2026-10-23 09:40", "Not
    applied", or "Yes" while the zone is unknown (PR 5).
  - `useLocalTimeZone()`, reading `Intl.DateTimeFormat().resolvedOptions().timeZone` through React's
    `useSyncExternalStore` with a server snapshot of `null`.

  The server render, and the first render in the browser, show "Applied" without a date; the date
  appears right after hydration. No wrong date is ever shown first, and React raises no hydration
  mismatch.
- **Rationale**: `useSyncExternalStore` with `getServerSnapshot` is React's designed way to read a
  browser-only value (constitution Principle IV). The formatting stays plain functions, unit-tested
  with explicit zones.
- **Alternatives**: `suppressHydrationWarning` (shows the server's zone first, then changes:
  breaks FR-011); a cookie carrying the zone (an extra request cycle and state for one owner); the
  browser's default locale (dates would read `10/23/2026` here, unlike the rest of the UI, and tests
  would depend on the machine).

## R5. The confirmation before undo (FR-013)

- **Decision**: the browser's `confirm("Mark as not applied?")`, called by `useApplied` before it
  sends an undo. Declining sends nothing: `useApplied`'s own `submit` returns before handing over to
  `useSave`'s, so the status stays idle and no failure note shows. The pure `appliedRequest(job)`, in
  its own module `web/lib/appliedRequest.ts`, decides whether a click marks or undoes and which
  confirmation it needs, so that decision is unit-tested without loading the server action.
- **Testing**: happy-dom 21 (the `dom` project's environment) has no `window.confirm`, so
  `vi.spyOn` can't wrap it. Tests use `vi.stubGlobal("confirm", vi.fn(() => …))`, the project's
  pattern (`tests/helpers/fakeObserver.ts:27`), and `tests/helpers/domSetup.ts` unstubs after each
  test.
- **Rationale**: the browser's own dialog is accessible, keyboard-operable and needs no code to style
  or trap focus.
- **Alternatives**: a custom `<dialog>` (more code and focus handling inside the panel, which is
  itself a `<dialog>`); an undo toast (not what the owner chose).

## R6. One server action for both directions

- **Decision**: `setJobApplied(ats, jobId, applied)` in `web/lib/actions.ts`, beside `setJobHidden`,
  calling `setAppliedFor(views, change, now)`. It validates with zod exactly like `hideChange`
  (malformed throws "Invalid applied request"; missing job gives `{ ok: false, error: "No such
  job." }`), and returns `{ ok: true, appliedOn }` on success.
- **Rationale**: cross-site refusal (FR-010) comes from the same place as Hide's: Next.js server
  actions reject a request whose `Origin` doesn't match its host, and `web/proxy.ts` refuses
  unknown hosts. A second action in the same file inherits both. The suite has no harness for a
  running Next.js server, so this is checked by hand (quickstart PR 4 step 8), as Hide's never has
  been automatically.

## R7. Where the row's mark sits

- **Decision**: a new first column, headed "Applied". `AppliedMark` shows a blue "?" glyph or a
  green "✓" glyph, labelled by `rowLabel` (`aria-label` and `title`). In PR 3 it is a read-only
  `<span role="img">`. In PR 4, `AppliedButton` wraps it in a form's button, and the cell gains
  `data-keeps-panel` so clicking it doesn't close an open panel. The button is its own tab stop,
  before the title link (US1 scenario 5). Colours are two new custom properties in
  `web/app/styles.css`, in `:root` and its dark block.
- **Rationale**: a dedicated column is readable at a glance down the table (SC-004). Text glyphs need
  no icon library or image files. Showing the mark before it can be clicked lets PR 3 ship small.
- **Alternatives**: inside the actions cell beside Hide (harder to scan); an icon library such as
  lucide-react (a new dependency for two glyphs; would need the owner's approval).

## R8. Keeping the row and the panel in step (FR-006)

- **Decision**:
  - `withJobApplied(key, appliedOn)` in `web/lib/pageRows.ts`, beside `withJobHidden`, updates the
    listed row; `usePageRows` gains `markApplied`, through a small private helper so the hook stays
    within 20 lines.
  - `usePanelJob`'s `noteHidden` becomes `noteChange(job, change)`, taking `Partial<Pick<JobRowView,
    "hidden" | "applied" | "appliedOn">>`. It changes the kept row only for the job the panel
    shows, using the passed job as the base when the kept row isn't that job. A panel showing a job
    that isn't in the loaded rows (opened by address, beyond the first 100, or hidden on Recommended)
    then follows its own changes, where today's `noteHidden` would ignore them, and a change to
    another row never replaces it.
  - `useJobChanges(rows, panel, close)` in `web/lib/useJobChanges.ts` holds every handler
    (`markHidden`, `markApplied`, `hideFromPanel`), so `JobRows` (20 lines today, the limit) only
    renders.

## R9. The panel's header

- **Decision**: the header moves out of `DetailsPanel.tsx` (143 lines) into
  `web/components/panel/PanelHeader.tsx`: the heading, then a `div.details-actions` holding
  `PanelApplied`, `PanelHide` and Close. The wrapper is needed because `.details-head` lays out its
  children with `justify-content: space-between`.
  - `PanelApplied` shows the green "Applied" button for an unapplied job, and otherwise a button
    reading "Applied ✓" (green check after the word) that undoes after the confirmation.
  - `PanelHide` reuses `useHide`, adapting its `onHidden(hidden)` to `hideFromPanel(job)` (the panel
    only ever hides). When the save succeeds, `hideFromPanel` marks the row hidden and calls
    `close()`. For a job already hidden it renders
    `<button disabled title="Already hidden" aria-label="Hide (already hidden)">Hide</button>`.
  - Which of these each shows is decided by the pure `panelApplied(job)` (`"offer" | "done"`) and
    `panelHide(job)` (`"enabled" | "disabled"`) in `web/lib/panelActions.ts`.
  - The actions show once the panel has a row to act on (`job ?? view.job`).
  - `JobSection` gains an "Applied" fact from `appliedFact` (R4), one line so the component stays
    within 20.
  - The green button is styled as `.details-head .applied-action`, since `.details-head button`
    (`styles.css:228`) would otherwise win.
- **Rationale**: keeps `DetailsPanel.tsx` well under 200 lines, each control a component under 20
  lines, and the decisions unit-tested.

## R10. Applied jobs and the cleanup (FR-014)

- **Decision**: in PR 4, `pruneLastSeenBefore` gains `.where("applied", "=", 0)` (and the memory store
  the same rule). It lands with `setApplied`, so the bundled contract case can prove it on both stores
  through the store's own API. Verdicts of kept jobs stay, since the verdict prune only removes rows
  without a job.
- **Rationale**: the owner's decision while planning (spec Clarifications). Until PR 4 nothing can
  mark a job, so nothing needs keeping.

## R11. Agent runs keep the mark (FR-008)

- **Decision**: no code change needed. `upsertAll` refreshes only the `REFRESHED` columns plus
  `last_seen` and `scored_at`; `applied` and `applied_on` aren't among them. PR 1 updates its doc
  comment to say so, and PR 4's contract case pins it. `import-sqlite` leaves both at their
  defaults.

## R12. Delivery and test split

- **Delivery**: six code PRs after the docs PR (plan, Delivery). Each new export arrives with its
  first production caller, since habit-hooks runs knip a second time without the tests and reports
  test-only code (`test-only-dead-code`).
- **Test split (new tests, by count)**: 32 unit, 2 integration, 3 UI. Each contract case runs once
  per store, adding one integration test per case, so the store's applied behaviour is one bundled
  case (`tests/helpers/appliedContract.ts`, each step a helper) instead of several. Decisions are
  pure functions with their own unit tests (`saveOutcome`, `appliedRequest`, `rowLabel`,
  `appliedFact`, `withJobApplied`, `panelApplied`, `panelHide`, and `setAppliedFor`'s validation).
  Each UI task is one `test()` driving its scenarios through helpers; the panel header's two live in
  their own file, `tests/client/panelHeader.test.tsx`. From 543 / 50 / 54 (83.9 / 7.7 /
  8.35%), this gives 575 / 52 / 57 (84.1 / 7.6 / 8.33%), moving every share toward 95 / 4 / 1.

## R13. One save hook and one failure note for Hide and Applied

- **Decision**: in PR 2, before any Applied code:
  - `web/lib/useSave.ts` holds `useSave(send, onSaved)`, the status (`"idle" | "saving" |
    "failed"`) and submit logic `useHide` has today, deciding through the pure `saveOutcome(result)`
    from its own module `web/lib/saveOutcome.ts` (an export only `useSave.ts` used would be test-only
    code). `onSaved` receives the successful result; `useHide` ignores it and reports
    `!job.hidden`, as today. `useHide` moves onto it, and `useApplied` (PR 4) is built on it.
  - `web/components/forms/SaveFailedNote.tsx` holds the "Couldn't save — try again" note that
    `HideButton` has today, also used by `AppliedButton`, `PanelApplied` and `PanelHide`.
- **Rationale**: four copies of the note and two of the hook would be jscpd `duplicated-code`,
  which the constitution requires fixed. Moving Hide first, with no change in behaviour, proves the
  shared parts against Hide's existing tests before Applied depends on them.
