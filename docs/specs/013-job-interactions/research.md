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
  time, not the click's.
- **Rationale**: one statement decides the time; two tabs marking the same job agree on it.
- **Alternatives**: the browser sends the time (trusts the client's clock; rejected); a
  `WHERE applied = 0` guard (cannot tell "already applied" from "no such job" without a second read
  anyway).

## R3. The server time, not the browser's

- **Decision**: the server action stamps `new Date().toISOString()` when it receives the change.
  `setAppliedFor` in `web/lib/rows.ts` takes the time as an argument (as `loadRows` takes `now`), so
  its tests pass a fixed one.

## R4. Showing the time in the browser's time zone without a flash (FR-011)

- **Decision**: a pure `appliedLabel(iso, timeZone)` in `web/lib/appliedTime.ts` formats with
  `Intl.DateTimeFormat` (date for the row's label, date and time for the panel). A hook,
  `useLocalTimeZone()`, reads the browser's zone through React's `useSyncExternalStore`, with a
  server snapshot of `null`. The server render, and the first render in the browser, show "Applied"
  without a date; the date appears right after hydration. No wrong date is ever shown first, and
  React raises no hydration mismatch.
- **Rationale**: `useSyncExternalStore` with `getServerSnapshot` is React's designed way to read a
  browser-only value (constitution Principle IV). The formatting stays a plain function, unit-tested
  with explicit zones.
- **Alternatives**: `suppressHydrationWarning` (shows the server's zone first, then changes:
  breaks FR-011); a cookie carrying the zone (an extra request cycle and state for one owner).

## R5. The confirmation before undo (FR-013)

- **Decision**: `window.confirm("Mark as not applied?")`, called by the hook before it sends an undo.
  Declining sends nothing.
- **Rationale**: the browser's own dialog is accessible, keyboard-operable and needs no code to
  style or trap focus. Tests stub it with `vi.spyOn(window, "confirm")`.
- **Alternatives**: a custom `<dialog>` (more code and focus handling inside the panel, which is
  itself a `<dialog>`); an undo toast (not what the owner chose).

## R6. One server action for both directions

- **Decision**: `setJobApplied(ats, jobId, applied)` in `web/lib/actions.ts`, beside `setJobHidden`,
  calling `setAppliedFor(views, change, now)`. It validates with zod exactly like `hideChange`
  (malformed throws "Invalid applied request"; missing job gives `{ ok: false, error: "No such
  job." }`), and returns `{ ok: true, appliedOn }` on success.
- **Rationale**: cross-site refusal (FR-010) comes from the same place as Hide's: Next.js server
  actions reject a request whose `Origin` doesn't match its host, and `web/proxy.ts` refuses
  unknown hosts. A second action in the same file inherits both.

## R7. Where the row's control sits

- **Decision**: a new first column, headed "Applied", holding a small form with one button per row:
  a blue "?" glyph (`aria-label="Mark as applied"`) or a green "✓" glyph
  (`aria-label="Applied on <date>"`, or "Applied" before the zone is known). The `title` attribute
  carries the same text for hover. Colours are two new custom properties in `web/app/styles.css`.
  The button is its own tab stop, before the title link (US1 scenario 5). The cell carries
  `data-keeps-panel`, so clicking it doesn't close an open panel.
- **Rationale**: a dedicated column is readable at a glance down the table (SC-004). Text glyphs need
  no icon library or image files.
- **Alternatives**: inside the actions cell beside Hide (harder to scan); an icon library such as
  lucide-react (a new dependency for two glyphs; would need the owner's approval).

## R8. Keeping the row and the panel in step (FR-006)

- **Decision**: `withJobApplied(key, appliedOn)` in `web/lib/pageRows.ts` (beside `withJobHidden`)
  updates the listed row; `usePageRows` gains `markApplied`. `usePanelJob`'s `noteHidden` becomes
  `noteChange(job, change)` taking `Partial<Pick<JobRowView, "hidden" | "applied" | "appliedOn">>`,
  so the kept row follows both kinds of change. `RowsList`'s `JobRows` calls both from either
  control, as it does for Hide today.

## R9. The panel's header

- **Decision**: the header moves out of `DetailsPanel.tsx` (143 lines) into
  `web/components/panel/PanelHeader.tsx`: the heading, then `PanelApplied`, `PanelHide` and Close.
  - `PanelApplied` shows the green "Applied" button when not applied, and otherwise a button reading
    "Applied ✓" (green check after the word) that undoes after the confirmation.
  - `PanelHide` reuses `useHide`. When the save succeeds, it reports up and `JobRows` marks the row
    hidden and calls `close()`. For a job already hidden it renders
    `<button disabled title="Already hidden" aria-label="Hide (already hidden)">Hide</button>`.
  - The actions show once the panel has a row to act on (`job ?? view.job`).
  - `JobSection` gains an "Applied" fact (the date and time, or "Not applied").
- **Rationale**: keeps `DetailsPanel.tsx` well under 200 lines, and each control a component under
  20 lines.

## R10. Applied jobs and the cleanup (FR-014)

- **Decision**: `pruneLastSeenBefore` gains `.where("applied", "=", 0)` (and the memory store the
  same test). Verdicts of kept jobs stay, since the verdict prune only removes rows without a job.
- **Rationale**: the owner's decision while planning (spec Clarifications).

## R11. Agent runs keep the mark (FR-008)

- **Decision**: no change needed. `upsertAll` refreshes only the `REFRESHED` columns plus
  `last_seen` and `scored_at`; `applied` and `applied_on` aren't among them. A store contract case
  pins this, beside case01's check of `hidden`. `import-sqlite` leaves both at their defaults.

## R12. Delivery and test split

- **Delivery**: four code PRs after the docs PR (plan, Delivery). Nothing in the store is added
  before its first production caller, so knip stays clean at each sitting's end.
- **Test split (new tests, by count)**: about 30 unit (the memory runs of the new contract cases,
  `setAppliedFor`, `withJobApplied`, `appliedLabel`, row views, the prune rule), about 6 integration
  (migration 008, the MariaDB runs of the contract cases) and 3 UI (the row's mark and undo; the
  panel's Applied staying in step with the row; the panel's Hide closing it, and showing disabled
  for a hidden job). Today's mix is 543 / 50 / 54 (84 / 8 / 8). These new tests move it slightly
  toward 95 / 4 / 1.
