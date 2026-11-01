# Research: Body filters

Decisions behind [plan.md](plan.md), each checked against the code on 2026-11-01.

## R1. Where the setting lives and what it is called

- **Decision**: a top-level search setting `body_filter: { include: string[], exclude: string[] }`,
  built by `bodyFilterTerms` in `src/config/schema.ts` beside `titleFilterTerms`, each list a
  `filterTerm` array defaulting to `[]`, and added as `body_filter: bodyFilterTerms.prefault({})`.
  - **Sanitizer**: `SearchFallbacks.titleFilter` becomes `filterLists(value, name)`, used by both
    `title_filter` and `body_filter` in `SANITIZERS` (`src/config/searchSettings.ts`), so a bad
    entry is dropped per list with a notice naming `body_filter.include[i]` or
    `body_filter.exclude[i]`.
  - The shared sanitizer also accepts an `extra_exclude` key; under `body_filter` such a key is
    sanitized and then dropped by the schema, which is harmless.
  - **Settings fields**: two entries in `SECTIONS` (`src/web/settingsSections.ts`):
    `{ name: "body_include", section: "filters", stored: ["body_filter", "include"], check: ["body_filter", "include"] }`
    and the same for `body_exclude` at `["body_filter", "exclude"]`. The field names differ from the
    stored keys because `include` and `exclude` already name the title filter's fields.
- **Rationale**: FR-001 calls for an exclude list and an include list, the title filter's shape
  without `extra_exclude`. Following `title_filter` reuses its sanitizer and its nested `stored`
  paths, so nothing new is invented. A separate setting keeps the title filter judging titles only.
- **Alternatives**:
  - `title_filter.body_include` / `body_exclude`: rejected, because the title filter then judges
    descriptions too, and its defaults (non-empty include) don't fit descriptions.
  - Two flat settings `body_include` and `body_exclude`: rejected; the pair is one filter, like
    `title_filter`.
  - `description_filter`: the owner calls the feature "body filters", so the setting keeps that
    name.

## R2. How a term matches a description

- **Decision**: a new `src/jobs/bodyFilter.ts` with
  `passesBodyFilter(description, format, filter): boolean`, where `filter` is
  `FileConfig["body_filter"]`. It returns `true` when the description is null or empty, or when both
  lists are empty. Otherwise it normalizes `readableDescription(description, format)` with
  `normalizeTitle` and returns
  `(include.length === 0 || include.some(has)) && !exclude.some(has)`, with `has` being `hasWord`.
- **Rationale**:
  - `hasWord` is exactly what the title exclude terms use (FR-002, the owner's Q3 answer): whole word
    or phrase, an optional plural "s", and punctuation already turned into spaces by
    `normalizeTitle`.
  - Include terms use `hasWord` too, not the title include's word-start match: in a long
    description, "go" must not match "good" or "goal" (FR-002).
  - Exclusion wins over inclusion, as in `passesTitleFilter` (spec edge case).
  - `readableDescription` gives the text the model reads, with links reduced to their words (FR-003,
    and the Markdown edge case).
  - Matching costs one normalization of at most 20,000 characters per job. It runs in memory and is
    unit-tested.
- **Alternatives**: a search index or SQL `LIKE`. Rejected: neither gives word boundaries with
  punctuation treated as spaces, and the job counts are small.

## R3. Where a run applies the filter

- **Decision**: `isWanted` (`src/tools/unscored.ts`) also calls `passesBodyFilter`. Its parameter
  widens from `Pick<JobRow, "title" | "company">` to also take `description` and
  `description_format`.
- **Rationale**: `isWanted` is the one gate before the model. `next_jobs`, `list_sources`' counts,
  `finish`'s check, and the careers lookup's retry list all go through `unscoredJobs`. So a matching
  job is never shown to the model and never keeps a run from finishing (FR-004, SC-002).
  - Jobs with no description pass both lists (FR-005), so the careers lookup still finds
    descriptions for alert jobs. Were the include list to hold back a job with no description, the
    lookup (which only takes wanted jobs) would never fetch one.
  - `next_jobs` reads the job after the lookup has stored its description, so the filter applies
    once the description arrives (spec edge case).
  - `alertLookupStep`'s title-only check before lookups stays as it is: an alert job has no
    description at that point.
- **Alternatives**: filtering in the store query. Rejected: the matching rules aren't expressible in
  SQL, and they must stay a plain function.

## R4. The note on All jobs

- **Decision**: one plain function, `filterMatch(job, filters)` in `src/jobs/filterMatch.ts`,
  checks the excluded company, then the title filter, then `passesBodyFilter`, and names the first
  that matches (`"company" | "title" | "body"`) or gives null. `FILTER_NOTES` beside it holds the
  three notes. `filterNote` (`src/web/rowViews.ts`), `isWanted` (runs) and `rescoreStep`
  (Re-score) all call it. `RowContext` extends its `FilterSet`, built by `filterSet(config)`.
- **Rationale**: FR-009 and US3 scenario 2 say one note, with the title filter named first. One
  function keeps the order in one place, avoids a `duplicated-code` finding, and keeps
  `src/web/` from importing `src/rescore/`. Recommended's `scoredFrom` query doesn't change
  (FR-008).

## R5. Re-score runs in the web server, at once

- **Decision**: a server action `rescoreJob(ats, jobId)` runs the re-score in the Next.js process
  and returns when it is done. There is no queue and no change to the agent container.
- **Rationale**:
  - The owner chose "at once" (Q4).
  - The agent container only runs `docker/run.sh` on a supercronic schedule, so it has no daemon
    that could take a queued request.
  - The `web` service already loads `.env` (the `LLM_*` variables) and mounts `data/` (the resume),
    so it can build a chat client and a trace file the same way a run does.
- **Accepted limit**: Next.js runs one server action at a time per client, so while a re-score runs
  (up to about 2 minutes with a lookup), Hide, Applied, Load more and opening another job wait
  behind it. For one owner pressing Re-score now and then, that is accepted and written down (spec
  Assumptions, quickstart §4) rather than moving the re-score to a Route Handler.
- **Second entry point**: the CLI command `npm start -- rescore <ats> <job_id>` builds the same
  deps through `openRescore` (`src/rescore/open.ts`). It lands first, in PR 3, so the core has a
  production caller (knip) and the owner can try it before the button exists.
- **Alternatives**: a `rescore_requests` table read by the next run. Rejected: that is option B,
  which the owner declined.

## R6. How one job is scored

- **Decision**: a re-score is a small agent session that reuses `runAgent`. It has its own run id,
  its own trace file in `data/runs/`, the run's data markers and the run's scoring rubric.
  - **Prompt**: `src/agent/prompt.ts`'s rubric and preferences block moves into
    `src/agent/rubric.ts`, so the run prompt and the re-score prompt share one text. The rubric
    holds only what both share; the scoring-rules line naming `next_jobs` and `get_job_details`
    stays in the run's prompt. The re-score prompt's steps are: call `get_job`, then save its score
    with one `record_matches` call. The re-score has its own nudge and compaction notice, because the
    run's name `finish` and `list_sources`, which the session doesn't have.
  - **Tools**:
    - `get_job`: no parameters, `outsideText: true`. It returns `get_job_details`' fields for the one
      job, built by the same exported `jobDetails` function.
    - `record_matches`: the existing tool. Its narrowed context type
      (`{ store: Pick<JobStore, "findJob" | "recordVerdict"> } & Pick<ToolContext, "now" | "runId">`,
      T022) lets the re-score pass a store limited to the one job.
  - **One-job store**: `oneJobStore(store, key)` returns a `JobStore` view whose `findJob` and
    `recordVerdict` know only that job. A verdict for any other id comes back as `unknown`.
  - **Limits**: `isFinished` turns true once the verdict is recorded. `limits` take
    `config.agent` with `max_steps: 6` and `max_wall_clock_min: 3` (SC-005), and with
    `max_consecutive_tool_errors` and `context_chars` as configured.
- **Rationale**:
  - The job's text reaches the model only inside a tool result, so it is wrapped in the markers and
    scrubbed of look-alikes, exactly as in a run (FR-014). Neither the job's fields nor its id go
    into the system prompt, a tool description or a user message.
  - The trace, the LLM response log and the verdict's `run_id` give the re-score the same audit
    trail as a run's scoring.
  - Reusing the loop also reuses its budget, look-alike reporting and error handling.
- **Alternatives**:
  - One forced `tool_choice` chat call with the job in a user message. Rejected: it puts outside text
    outside a tool result, and it duplicates the loop's tracing.
  - Restricting `get_job_details` to one id. Rejected: the model would still have to copy a job id
    out of a message.

## R7. The order a re-score follows

- **Decision**: the pure function `rescoreStep(job, config, { lookedUp })` in `src/rescore/plan.ts`
  returns one of:
  - `{ kind: "filtered", by: "company" | "title" | "body" }`: whatever `filterMatch` names (R4),
    in that order; a job with no description passes the body filter there;
  - `{ kind: "lookup" }`: there is no description and the job hasn't been looked up in this
    re-score;
  - `{ kind: "score" }`.

  The flow in `src/rescore/rescore.ts` repeats this:
  1. Plan the job.
  2. If the plan is `lookup`, call `deps.lookUp` for that one job, then re-read the job and plan it
     again, this time with lookups done. `deps.lookUp` is built by `openRescore` as
     `(job) => lookUpCareers(careersDeps(parts), [job])`, so tests pass a fake. A thrown lookup error
     is traced as `rescore_lookup_failed` and the flow carries on with lookups done.
  3. If the plan is `filtered`, clear the score (R8) and return the filter's note.
  4. If the plan is `score`, run the session (R6).
- **Rationale**:
  - The title and company filters run before the lookup, which saves the lookup, as a run does.
  - The body filter runs after it (Q5, FR-011, FR-012).
  - A lookup that fails or finds nothing doesn't fail the re-score: the job is scored from what it
    has (spec edge case). For an alert job, `record_matches` adds the "scored from the alert only"
    gap, as in a run.
- **Alternatives**: always looking up. Rejected: Q5 limits lookups to jobs with no description.

## R8. Removing a score when a filter now matches

- **Decision**: `JobViews.clearScore(key): Promise<boolean>`. It sets `score`, `base_score`,
  `bonus_score`, `reasons`, `gaps` and `scored_at` to null for the job, keyed by `ats` and
  `job_id`, and keeps its verdict history.
  - It is written in `KyselyJobViews` (114 lines) and in the memory views.
  - A new contract `tests/helpers/rescoreContract.ts` runs against both stores, because
    `storeContract.ts` is at 188 lines.
- **Rationale**:
  - A job with a null score is unscored, so it leaves Recommended, and on All jobs it carries the
    filter's note (FR-012).
  - The filter keeps it from the model in later runs.
  - History rows stay, so the panel's reasoning history still shows its earlier verdicts.
  - `hidden` and `applied` aren't touched (FR-011).
- **Alternatives**: a `filtered` flag column. Rejected: the score's absence already says it, and a
  migration would add nothing.

## R9. The careers lookup from the web server

- **Decision**:
  - `runClients` and `pageRenderer` move out of `src/app/run.ts` (194 lines) into
    `src/app/runParts.ts`, and `openRunLogs` moves into `src/app/runLogs.ts`. Both the run and the
    re-score use them.
  - `careersDeps` moves into `src/careers/deps.ts` and takes a plain `CareersParts` interface (store,
    searxngUrl, lookup, pages, boards, renderer, settings, chat, trace, jobs, runId, now, http,
    markers), so `src/careers` never reads `ToolContext`. `careersStep.ts` maps its context onto
    it, and `openRescore` builds it from the run's parts.
  - The compose `web` service joins the `browser` network, so rendering works when
    `MYJOBBOT_BROWSER_URL` is set. Check the change with `docker compose config --quiet`.
- **Rationale**:
  - Every page fetch keeps `assertPublic`, the redirect checks and the `careers_audit` rows, because
    the same code runs (FR-011).
  - `searxng` is already on the default network that `web` uses.
- **Alternatives**: a lookup only through plain downloads from the web server. Rejected: unreadable
  pages would then fail where a run would render them.

## R10. What the panel shows

- **Decision**:
  - `PanelRescore` (`web/components/panel/PanelRescore.tsx`) sits in the header's actions, before
    Applied. While it works, the button reads "Re-scoring…" and is disabled.
  - `rescoreJob` returns `{ outcome: "scored", row } | { outcome: "filtered", note, row } | { outcome: "failed" }`,
    where `row` is the job's refreshed `JobRowView`.
  - A plain function `rescoreNote(result)` (`src/web/rescoreNote.ts`) gives the text:
    - `"filtered"`: "Not re-scored: hidden by title filter" (or the body or company note);
    - `"failed"`: "Re-score failed; the old score is kept".
  - On `"scored"` and `"filtered"`, the panel reloads its details: `useJobDetails` takes a
    `refresh` count. The list row is replaced through a new `markRescored` in `useJobChanges`, the
    way `markApplied` updates the row and the panel. The plain `withJobRow` (`web/lib/pageRows.ts`)
    does the replacing and, on Recommended, removes a job left with no score, as Hide does.
- **Rationale**: FR-013 calls for fixed messages that never echo model or page text. The button
  follows Hide and Applied's shape (a hook, then a note), but not `useSave` and `SaveFailedNote`:
  its result isn't `{ ok }`, and "Couldn't save" is the wrong message. This is the one exception
  to CLAUDE.md's job-action rule, and T053 writes it down there.

## R11. Delivery and test split

- **Decision**: five PRs, each about 10 files, each merged and tested before the next. The table is
  in [plan.md](plan.md).
- **Test split**: 39 new unit tests, 2 integration tests (the re-score contract on MariaDB, and
  `openRescore` against a temporary data folder) and 1 UI test (the Re-score button).
  - Baseline on 2026-11-01: 735 unit, 59 integration and 62 UI. The 797 tests in the `node` and
    `dom` projects include 62 UI tests, and the integration count comes from 017's ledger.
  - After the feature: 774 / 61 / 63. Unit moves from 85.86% to 86.19%, integration from 6.89% to
    6.79%, and UI from 7.24% to 7.02%. Every share moves toward 95 / 4 / 1.
