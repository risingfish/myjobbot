# Contract: job actions in the web UI

## Server action `setJobApplied` (`web/lib/actions.ts`)

```ts
setJobApplied(ats: string, jobId: string, applied: boolean): Promise<AppliedResult>
type AppliedResult = { ok: true; appliedOn: string | null } | { ok: false; error: string };
```

- Delegates to `setAppliedFor(views, { ats, jobId, applied }, new Date())` in `web/lib/rows.ts`.
- **Validation** (zod, the same bounds as `hideChange`): `ats` and `jobId` non-empty strings,
  `applied` a boolean. Anything else throws `Error("Invalid applied request")`.
- **Missing job**: `{ ok: false, error: "No such job." }`.
- **Success**: `{ ok: true, appliedOn }`. `appliedOn` is the stored time after the change: the
  original time if the job was already applied, `null` after an undo.
- **Cross-site**: refused by Next.js's server-action origin check and `web/proxy.ts`'s host check,
  as `setJobHidden` is.

`setJobHidden` is unchanged.

## Dates

Dates are `YYYY-MM-DD` and date-times `YYYY-MM-DD HH:mm` (24-hour), in the browser's own time zone,
formatted with `Intl.DateTimeFormat("sv-SE", …)` (research R4). Until the browser's zone is known
(the server render and the first render), a label shows "Applied" with no date.

## Row control (Recommended and All jobs)

| State | Shows | Accessible name and `title` | Click |
|---|---|---|---|
| Not applied | blue `?` | "Mark as applied" | marks; on success becomes the check |
| Applied | green `✓` | "Applied on 2026-10-23" ("Applied" until the zone is known) | asks "Mark as not applied?"; yes undoes, no does nothing |
| Saving | the current glyph, disabled | unchanged | — |
| Failed | the previous glyph and "Couldn't save — try again" | unchanged | retry |

The column comes first, headed "Applied". From PR 3 it shows the mark read-only; from PR 4 the mark
is a button, and its cell keeps an open panel open (`data-keeps-panel`).

## Panel header (left to right, after the heading)

| Job state | Applied area | Hide | Close |
|---|---|---|---|
| Not applied | green "Applied" button | "Hide" (as Close) | "Close" |
| Applied | "Applied ✓" button: confirms, then undoes | "Hide" | "Close" |
| Hidden | as above | disabled "Hide", labelled "Hide (already hidden)" | "Close" |

- **Applied succeeds**: the button becomes "Applied ✓", the row shows the check, and the panel's Job
  section shows "Applied: 2026-10-23 09:40" ("Not applied" before, and "Yes" until the browser's
  zone is known). This holds for a panel showing a job that isn't in the loaded rows too, and that
  panel keeps showing its own job when another row is then marked.
- **Applied fails**: the button stays, followed by "Couldn't save — try again".
- **Hide succeeds**: the row is marked hidden (dropped on Recommended, Unhide on All jobs) and the
  panel closes, giving focus back as Close does.
- **Hide fails**: the panel stays open with "Couldn't save — try again".

A change made in either place shows in the other at once (FR-006).
