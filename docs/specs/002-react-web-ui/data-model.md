# Data Model: React Web UI

There are no schema changes. One query changes: `VERDICT_HISTORY` also selects `v.rowid AS id`, for row keys. Hide still writes only `jobs.hidden`.

What is new are the **view models** the server sends to the browser. They live in
`src/web/api.ts` as plain TypeScript types, imported with `import type` by both the server (which
builds them) and the browser (which displays them). Every field is ready to show, and the browser
makes no business decisions.

## PageName

`"recommended" | "jobs" | "reasoning"`. These are the three data pages. `settings` has no data
endpoint.

Each page has its own address, label, row kind and table headers:

| Page | Address | Label | Row kind | Headers |
|---|---|---|---|---|
| `recommended` | `/recommended` | Recommended | job | Score, Title, Company, Location, Remote, Source, Posted, Scored, (Hide) |
| `jobs` | `/jobs` | All jobs | job | same as above |
| `reasoning` | `/reasoning` | Reasoning | verdict | Scored at, Run, Job, Company, Score, Reasons, Gaps |
| (settings) | `/settings` | Settings | none | none |

The browser's navigation list is built from one shared constant, `PAGES`, in `src/web/api.ts`.
It holds the address and label for all four pages, including Settings. The server uses the same
constant, so neither side can drift from the other.

## PageData (the response for one page of rows)

| Field | Type | Meaning and rule |
|---|---|---|
| `kind` | `"jobs" \| "verdicts"` | Which row type `rows` holds. A discriminated union, so TypeScript narrows `rows` |
| `rows` | `JobRowView[]` or `VerdictRowView[]` | At most 100 |
| `total` | `number` | All rows on this page, not just this slice |
| `nextOffset` | `number \| null` | Offset of the next slice, or `null` at the end (today's `nextOffset`) |
| `summary` | `string` | For example `"1 recommended · threshold 70"`, `"250 jobs"`, `"12 scoring decisions"` |
| `empty` | `string` | Today's empty-state message, shown when `total === 0` |

## JobRowView (Recommended and All jobs)

Built by `src/web/rowViews.ts`, which replaces the HTML-producing parts of `rows.ts`. Each rule is
the one used today.

| Field | Type | Rule (today's source) |
|---|---|---|
| `ats` | `string` | Hide key |
| `jobId` | `string` | Hide key, and the React `key` together with `ats` |
| `title` | `string` | Raw text. React escapes it when displaying |
| `url` | `string \| null` | The posting URL only if it matches `^https?://` (case-insensitive), else `null` (`linkTo`) |
| `company`, `location` | `string` | Raw text (`location` is `""` when unknown) |
| `remote` | `"yes" \| "no" \| ""` | `remoteText` |
| `source` | `string` | `job.source` |
| `via` | `string \| null` | `job.publisher`, shown as "via X" (`sourceText`) |
| `posted` | `{ date: string; daysOpen: number; ghost: boolean }` | Opened date is the earlier of `posted_at` and `first_seen`. `ghost` is true when `daysOpen > ghost_threshold_days` (`postedText`) |
| `scoredDate` | `string` | `dateOnly(scored_at)` |
| `score` | `{ value: number; note: string } \| null` | `value` is the boosted score. `note` joins the breakdown ("base X + bonus Y") and the boost note ("model 65 · +10 typescript") with " · ", and is `""` if neither applies (`jobScore`). `null` when unscored |
| `filterNote` | `string \| null` | `"hidden: excluded company"` or `"hidden by title filter"` (`filterNote`) |
| `hidden` | `boolean` | `jobs.hidden` |
| `reasons`, `gaps` | `string[]` | Shown under "Why" when either is non-empty |

## VerdictRowView (Reasoning)

| Field | Type | Rule (today's `verdictRow`) |
|---|---|---|
| `key` | `string` | A stable React key: the verdict's SQLite `rowid`. `VerdictView` gains `id` from `v.rowid AS id`, because one job can be scored twice at the same time |
| `scoredAt` | `string` | `scored_at` as `YYYY-MM-DD HH:MM` |
| `run` | `string \| null` | The first 8 characters of `run_id`, or `null`, which displays as "before history" |
| `title` | `string` | The title, or `"(pruned)"` when the job is gone |
| `url` | `string \| null` | Same `http(s)` rule as jobs |
| `company` | `string` | Raw text |
| `score` | `{ value: number; note: string }` | `note` is the breakdown, or `""` |
| `reasons`, `gaps` | `string[]` | Bullet lists |

## Meta (footer)

| Field | Type | Meaning |
|---|---|---|
| `dbPath` | `string` | As in today's footer |
| `renderedAt` | `string` | ISO time when the server answered |

## Browser state (React, not persisted)

| State | Owner | Changes |
|---|---|---|
| current path | `usePath` hook | Clicking a nav link (`pushState`); the browser's back and forward buttons (`popstate`) |
| rows, total, nextOffset, loading, error | `usePageRows(name)` | First fetch; `loadMore`; reset when `name` changes |
| row hide status | `useHide` / `JobRow` | `idle → saving → idle`. On success the row's `hidden` flips (All jobs) or the row is removed (Recommended). On failure: `idle → failed`, the row is unchanged and a message shows |
| footer meta | `useMeta` | Fetched once per page view |

Hide's state transitions:

```text
idle --click--> saving --204--> idle (row updated or removed)
                   └--error--> failed (message shown; row unchanged) --click--> saving
```
