# Data Model: Markdown job descriptions

## Schema change (migration `007_description_format`, PR 1)

| Column | Type | Meaning |
|---|---|---|
| `jobs.description_format` | `varchar(16)`, null | `'markdown'` or `'text'` for the stored `description`; null when there is no description |

- Added with `db.schema.alterTable("jobs").addColumn("description_format", "varchar(16)")`; a data
  step through `db.withTables<...>().updateTable("jobs")` sets `'text'` where `description` is not
  null. Listed in `src/db/migrations/index.ts`; `src/db/schema.ts` gains the column.
- Rule: `description_format` is null exactly when `description` is null. Every write of
  `description` writes the format with it (upsert, `setDescription`).
- **One known exception**: `import-sqlite` copies old SQLite rows as they are (`SELECT *`), so an
  imported description has a null format. Every reader treats a null format as `'text'`, so it
  shows and reads as plain text, which is what it is, and is scored again when it first becomes
  Markdown.

## Job record (`src/jobs/job.ts`)

- `Job` gains `descriptionFormat: "markdown" | "text"`, `"text"` in `NO_DETAILS`; `JobDetails`
  (an `Omit` of `Job`) picks it up. `makeJob` cuts the description with `capDescription` (PR 6).
- `src/db/rows.ts`: `DetailFields` and `toParams` write `description_format` (null with no
  description); `jobRowSchema` and `jobViewSchema` (and so `jobDetailSchema`) gain it as
  `z.enum(["markdown", "text"]).nullable()`.
- `src/db/kysely/jobViews.ts`: `JOB_COLUMNS` gains `description_format`. The views select an
  explicit column list, so without it every MariaDB view row would fail its schema while the memory
  store (which parses whole rows) stays green.

## Found description (`FoundDescription`, `src/db/store.ts`)

Gains `format: "markdown" | "text"` in PR 3 (in PR 1, `setDescription` writes `'text'`). The careers
lookup stores the format of what it found: a board posting's own format from PR 3, `'markdown'` for
downloaded and rendered pages from PR 9, and `'text'` otherwise.

## Careers reads (`PageRead`, `src/careers/readPage.ts`)

A job page's read gains `description: { text: string; format: "markdown" | "text" } | null`, the
description to store if the lookup finishes as found. `session.jobPage` keeps it. The model's page
text (`text`) stays a readable copy.

## Re-scoring rule (FR-014, PR 5)

On upsert of an existing row: when the stored format is `'text'` or null and the incoming one is
`'markdown'`, `scored_at` becomes null (score, reasons and gaps kept). Otherwise `scored_at` is
untouched. Same rule in the memory store.

## Views

- `DescriptionDetail` (`src/web/api.ts`) gains `format: "markdown" | "text" | null` (PR 4).
- The model's copy and boost text come from `readableDescription(description, format)`
  (`src/descriptions/readable.ts`, PR 2): Markdown with link addresses removed, or the text
  unchanged (a null format counts as `'text'`).
