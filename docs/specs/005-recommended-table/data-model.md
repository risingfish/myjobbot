# Data Model: Tighter job tables

No storage changes. `jobs.scored_at` and the verdict history stay as they are.

## JobRowView (`src/web/api.ts`): the display row for Recommended and All Jobs

| Field | Change | Rule |
|---|---|---|
| `title` | unchanged | full title; used for the link's `title` attribute and accessible name |
| `shortTitle` | **new** | `shortTitle(title, 64)`: `title` itself when it has ≤ 64 graphemes, else its first 64 graphemes, trailing spaces trimmed, plus "…" |
| `scoredDate` | **removed** | nothing displays it any more |
| `score` | unchanged | `{ value, note }`; `note` now shows in the tooltip, and an empty note means no tooltip |

`VerdictRowView` (Reasoning page) is unchanged.
