# Contract: Re-score

## Server action

```ts
rescoreJob(ats: string, jobId: string): Promise<RescoreResult>

type RescoreResult =
    | { outcome: "scored"; row: JobRowView }
    | { outcome: "filtered"; note: "hidden: excluded company" | "hidden by title filter" | "hidden by body filter"; row: JobRowView }
    | { outcome: "failed" };
```

- It runs in the web server and returns once the re-score is done. Nothing is queued for a run.
- It resolves the settings the way a run does: `config.json`, the stored search settings and
  `data/resume.md`.
- Any thrown error comes back as `{ outcome: "failed" }`. The detail goes to the re-score's trace,
  never to the browser.
- An unknown job, or one whose stored `ats` differs from the request's, returns `{ outcome: "failed" }`.
- Its input is checked with `jobRequest` (`web/lib/rows.ts`) before any model call; an invalid one
  returns `{ outcome: "failed" }`.
- Next.js runs one server action at a time per client, so the page's other actions wait while a
  re-score runs. This is accepted (research R5).

## Flow (`rescore(deps, key)` in `src/rescore/rescore.ts`)

1. Read the job. `rescoreStep` decides what happens:
   - **filtered**: `JobViews.clearScore(key)`, then return `filtered` with the note.
   - **lookup**: `deps.lookUp(soughtJob({ row, retry: false }))`, which `openRescore` builds as
     `lookUpCareers(careersDeps(parts), [job])`. A lookup that finds nothing isn't a failure, and a
     thrown lookup error is traced as `rescore_lookup_failed`, not a failure either. Re-read the job
     and decide again, with `lookedUp: true`.
   - **score**: run the one-job session.
2. The session ends after a verdict is recorded (`scored`), or when its budget runs out or the model
   or tools fail (`failed`). On `failed`, the score is untouched, so the old score stays (a
   description the lookup stored, or a look-alike flag, may have been written).

## The one-job session

- **Run id**: a new UUID. It is used for:
  - the trace file `data/runs/<time>-<id>.jsonl`, which holds `{ type: "rescore", ats, job_id }`
    before the session's `start` event (settings notices may come first);
  - the LLM log `<time>-<id>.llm.jsonl` in the log folder;
  - the data markers;
  - the verdict's `run_id`.
- **Messages**:
  - System: the steps "Call get_job, then save its score with one record_matches call", then the
    shared rubric (`src/agent/rubric.ts`) with the markers sentence, the threshold and the
    preferences. The rubric never names `next_jobs`, `get_job_details`, `list_sources` or
    `finish`.
  - Nudge and compaction notice: the re-score's own, naming only `get_job` and `record_matches`.
  - User: the resume, then "Re-score the job now."
  - No job field and no job id appears in any prompt or tool description.
- **Tools**:
  - `get_job`: no parameters, `outsideText: true`. It returns the same fields as
    `get_job_details` for this job (summary, description up to 6,000 characters, origin, lists).
  - `record_matches`: unchanged schema and description. Its store is `oneJobStore(store, key)`, so
    a verdict for any other id is reported in `unknown_job_ids` and not written.
- **Limits**: `max_steps` is 6 and `max_wall_clock_min` is 3 (SC-005). The other limits are the
  run's `agent` settings. `isFinished` turns
  true once the verdict is recorded.
- **Look-alikes**: a scrubbed look-alike marker is traced and flags the job (`injection_seen_at`),
  as in a run.

## Panel

- A **Re-score** button sits in the header actions, before Applied, for any job the panel shows.
- While a re-score runs, the button reads "Re-scoring…" and is disabled.
- `scored`: the panel reloads its details (score, reasons, gaps, history), and the list row is
  replaced with `row`.
- On Recommended, a re-scored job left with no score (`filtered`) leaves the list, as a hidden one
  does.
- `filtered`: same reload, plus the note "Not re-scored: <note>".
- `failed`: the note "Re-score failed; the old score is kept". Nothing reloads.
- The panel never shows model or page text in a note.
