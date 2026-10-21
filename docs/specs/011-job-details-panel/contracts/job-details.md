# Contract: job details panel

## Server action

`loadJobDetails(ats: string, jobId: string): Promise<JobDetailView | null>` (`web/lib/actions.ts`,
`"use server"`) delegates to `loadDetailsFor(views, config, { ats, jobId })` in `web/lib/rows.ts`.
- It validates with zod: `ats` non-empty and at most 32 characters, `jobId` non-empty and at most
  255. Anything else throws "Invalid job request".
- It returns `null` for a job that doesn't exist, which the panel shows as "job not found".
- It returns one job at most.

## Address

- Open and switch: `pushState(null, "", withJob(location.search, key))`. Close:
  `pushState(null, "", withJob(location.search, null))`. Both keep other parameters.
- Back and forward restore the panel from `useSearchParams` without pushing new entries.
- A `null` search parameters object (outside Next's router), a missing `job`, or a malformed `job`
  all mean no panel.

## Panel

- `<dialog class="details-panel" aria-labelledby=…>` opened with `show()` (non-modal); the list
  stays usable.
- It closes on the close button, on Escape (a document listener), and on a pointerdown outside the
  panel unless the target is inside an element with `data-keeps-panel`.
- On open, focus moves to the panel heading. On close, it returns to the opening title, or to
  `main` after a deep link.
- The panel keeps the job it opened, even if its row disappears.
- The details are fetched when a job opens (from PR 3):
  - "Loading…" shows until they arrive;
  - an error shows "Couldn't load details: …";
  - an answer for a job that's no longer open is ignored;
  - `null` shows "job not found".
- Sections, in order: Job, Score, Description, Warnings (only when there are any), History. Each
  is a `PanelSection`; the trace feature appends "Path".
- Only on job pages: the panel isn't rendered when the page's rows are verdicts (Reasoning).

## Row

- **Title**: `<a href={withJob(search, key)} data-keeps-panel>`. A plain click opens the panel;
  modified clicks follow the link.
- **Action cell** (inline, with a gap): `PostingLink` (an external-link icon,
  `aria-label="Open the posting"`, a new tab, `data-keeps-panel`, absent when `url` is null), then
  Hide (`data-keeps-panel`).
