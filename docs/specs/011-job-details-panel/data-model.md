# Data Model: Job details panel

No schema change and no migration: everything shown is already stored.

## New reads (`JobViews`, `src/db/store.ts`)

- `jobDetail(key: { ats: string; jobId: string }): Promise<JobDetailRow | null>`: one job's
  stored row. It has every `JobView` column plus `compensation`, `workplace_type`,
  `description_source`, `description_url`, `requirements`, `skills`, `preferred_skills` and
  `injection_seen_at`. It is a Kysely `selectFrom("jobs")` by `ats` and `job_id`, parsed by a zod
  schema in `src/db/rows.ts`.
- `jobVerdicts(key): Promise<VerdictView[]>`: that job's verdicts, newest first (`scored_at` then
  `id`, descending), with the same joined builder as `verdictHistory`.
- **Memory implementation**: `MemoryJobViews` moves out of `tests/helpers/memoryStore.ts` (189
  lines) into `tests/helpers/memoryJobViews.ts` before gaining these reads, to stay under 200 lines.
- **Contract**: cases in a new `tests/helpers/jobDetailContract.ts`, wired into both store-contract
  runners:
  - a known job comes back with every field;
  - an unknown key gives `null` / `[]`;
  - the same `job_id` on another board isn't returned;
  - verdicts come newest first and only for that job.

## View (`src/web/api.ts`, mapped by `toJobDetailView` in `src/web/jobDetail.ts`)

`JobDetailView`:
- `job`: the `JobRowView` fields (via `toJobRowView` and the exported `rowContext`), plus `pay`
  (`compensation`, or null) and `workplace` (`workplace_type`, or null). Added in PR 3.
- `score`: `{ total, model, boost, base, bonus, reasons, gaps, scoredAt } | null`. `total` is the
  row's boosted score, `model` the stored score and `boost` the row's note. Null means "not scored
  yet". Added in PR 4.
- `description`: `{ text, requirements, skills, preferredSkills, origin }`, where `origin` is
  `{ kind: "source" } | { kind: "careers", url } | null`. A null `text` means "no description
  found". Added in PR 5.
- `warnings`: `string[]`, today only the injection warning with its date. Added in PR 6.
- `history`: `{ scoredAt, total, base, bonus, run }[]`, every verdict including the current one,
  newest first. Added in PR 6.

## Address

`?job=<ats>:<jobId>`. It is parsed by `parseJobParam` (split on the first `:`, both parts
non-empty) and written by `withJob(search, key | null)` (`URLSearchParams`, other parameters kept).
