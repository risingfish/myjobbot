# Data Model: Job interactions (Applied and Hide)

## `jobs` table: two new columns (migration `008_applied`)

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| `applied` | `tinyint` | no | `0` | 1 when the owner has marked the job applied |
| `applied_on` | `varchar(32)` | yes | `NULL` | ISO 8601 UTC time of the first mark since the last undo |

The migration uses Kysely's schema builder only: `alterTable("jobs").addColumn("applied",
sql`tinyint`, (column) => column.notNull().defaultTo(0)).addColumn("applied_on", "varchar(32)")`.
Existing rows read as not applied (FR-001). Both columns inherit the table's `utf8mb4_bin`
collation.

**Invariant**: `applied = 1` ⇔ `applied_on IS NOT NULL`. Only `JobViews.setApplied` writes either
column, and it writes both in one statement.

`src/db/schema.ts`: `JobsTable` gains `applied: Generated<number>` and `applied_on: Text`.
`src/db/rows.ts`: `jobViewSchema` gains `applied: z.number().transform((flag) => flag === 1)` and
`applied_on: text`; `JOB_COLUMNS` in `src/db/kysely/jobViews.ts` lists both.

## State transitions

```text
not applied --mark(now)--> applied (applied_on = now)
applied --mark(later)--> applied (applied_on unchanged)          FR-009
applied --undo (confirmed)--> not applied (applied_on = NULL)    FR-013
any --agent run (upsert, re-score)--> unchanged                  FR-008
applied --prune--> kept, whatever last_seen is                   FR-014
not applied --prune--> deleted when last_seen < cutoff (as today)
```

Hidden is independent: none of these transitions reads or writes `hidden`, and Hide doesn't touch
the applied columns.

## Store interface (`src/db/store.ts`)

```ts
interface AppliedMark { ats: string; jobId: string; applied: boolean; at: string }
interface JobViews {
    // …existing methods
    setApplied(mark: AppliedMark): Promise<{ appliedOn: string | null } | null>; // null: no such job
}
```

`JobStore.pruneLastSeenBefore(cutoff)` keeps its signature and skips applied jobs.

## View types (`src/web/api.ts`)

`JobRowView` gains:
- `applied: boolean`
- `appliedOn: string | null`, the stored ISO time, formatted only in the browser (research R4)

`toJobRowView` in `src/web/rowViews.ts` copies both from the `JobView`. `JobDetailView.job` extends
`JobRowView`, so the panel gets them too.

## Store contract cases (`tests/helpers/storeContract.ts`)

1. Marking sets the mark and time, and returns the time; reading the job back shows both.
2. Marking again keeps the first time.
3. Undoing clears both; marking after an undo records the new time.
4. A missing job returns `null`.
5. An upsert of the same job (an agent run) keeps `applied` and `applied_on`.
6. The prune keeps an applied job past the cutoff and deletes an unapplied one; after an undo, the
   job is pruned.
