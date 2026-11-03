# Research: Scoring evals

## R1. Which scoring path a case replays

- **Decision**: a case replays the **re-score** path: one job, read in full through `get_job`
  (the `jobDetails` payload: summary fields, description up to 6,000 characters, requirements,
  skills, `description_from`), saved through `record_matches`, under `rescoreMessages`' system
  prompt (the shared rubric plus the re-score steps) with the profile's resume and preferences.
- **Rationale**: a scheduled run scores most jobs from `next_jobs` summaries alone (no
  description) and reads `get_job_details` only for promising ones, inside a 25-job conversation
  whose order and neighbours change the answer. A single-job session is the repeatable unit; it
  is also exactly what Re-score does, so a better result in an eval is a better Re-score at once.
- **Finding**: neither path shows the model the company name (`summarizeJob` leaves it out).
  Cases keep the company for reports; whether to give it to the model is a candidate prompt
  change an eval can now measure.
- **Alternatives**: replaying whole run conversations from traces (measures change, not
  correctness; depends on neighbours); scoring from summaries only (misses the description, the
  part most prompt changes are about).

## R2. Was the observed score given on the summary or the details? (FR-005a)

- **Decision**: at capture, read the observed verdict's trace (`<data>/runs/*-<runId>.jsonl`,
  through the same file port, rooted at the data folder).
  - A **re-score** trace (it holds a `{ type: "rescore", ats, job_id }` event for this job): its
    `get_job` takes no arguments, so `details` when it holds any assistant `get_job` call, else
    `summary`.
  - A **run** trace: `details` when an assistant `tool_calls` entry calls `get_job_details` whose
    parsed `job_id` equals the job's id, compared as strings (the model may send a number);
    else `summary`.
  - No trace file (pruned, or `runId` null): `unknown`.
- **Rationale**: tool events carry no arguments, but assistant messages' `tool_calls` do; a
  comparison against observed (FR-012) is fair only for `details`.
- **Alternatives**: none cheap; the database doesn't record which jobs were read in full.

## R3. When a description arrived (FR-005)

- **Decision**: a description from the careers lookup (`description_source = 'careers'`) arrived
  at the job's latest `careers_audit` row with `step = 'finish'` and `outcome = 'found'`, read
  through a new `CareersStore.descriptionFoundAt(key)`. A description from the source arrived with
  the listing (taken as before any score).
- **Rationale**: `jobs` stores no description time; the lookup's audit is the only record.
- **Alternatives**: a `description_at` column (a migration and a run-path change for one flag).
- **Gate note**: `src/db/store.ts` is at 199 lines; S2 first moves `CareersStore` and
  `AuditEntry` into `src/db/careersStore.ts` (as `rescoreLogStore.ts` holds its own), updating
  imports, then adds the method (and `JobViews.recentlyScored`, R11). `loggedCareers`
  (`src/rescore/traceSteps.ts`) wraps every `CareersStore` method, so it gains
  `descriptionFoundAt` too.

## R4. Age as scored (FR-004)

- **Decision**: capture calls `jobDetails` twice with the same row: once with `now = capturedAt`
  (giving `daysOpenAtCapture`) and once with `now = observed.scoredAt` (giving the `job` payload
  the case stores, so `days_open` and `possible_ghost` are exactly what a run computed that day:
  `daysBetween(earliestSeen, scoredAt)` and `> ghost_threshold_days`). `shiftedDays =
  daysOpenAtCapture − daysOpenAsScored`. No observed score: one call at capture, shift 0. Runs
  send `job` as stored.
- **Guards**: an observed `scoredAt` after `capturedAt` (clock skew) uses the capture payload,
  shift 0 (spec edge case). An as-scored age below 0 (when pruning has moved `earliestSeen` past
  the score) is clamped to 0 and the ghost flag recomputed from 0, so the case still validates.
- **Rationale**: subtracting whole days from whole days can be one day off (first seen at day 0,
  scored at day 0.6, captured at day 1.5: 1 − floor(0.9) = 1, but the run counted floor(0.6) = 0);
  counting the way the run counts gives SC-003 by construction. Owner's proposal (2026-11-03),
  made exact.
- **Caveat**: pruning older reposts can move `earliestSeen` later; such a case reads younger than
  it did. Accepted as rare and small.

## R5. Ids and hashes

- **Decision**: case id `<ats>-<jobId>` when the job id matches `[A-Za-z0-9][A-Za-z0-9_-]{0,79}`,
  otherwise `<ats>--<first 16 hex of SHA-256(jobId)>` (a readable id can't start with `-`, so the
  two forms never collide); profile and prompt ids are the first 16 hex of the SHA-256 of their
  canonical JSON (sorted keys); run ids `<UTC yyyymmdd-hhmmss>-<4 hex>`, sortable.
- **Rationale**: readable file names, one case per job (a repeat capture is detected by name),
  safe on any file system, identical profiles and prompts stored once.

## R6. Files and validation

- **Decision**: one JSON file per profile, case, answer key and prompt; a run as `runs/<id>/run.json`
  plus `results.jsonl` (appended one line per attempt, so a stopped run keeps what it has) and the
  run's agent trace `runs/<id>/trace.jsonl` (kept for debugging; it holds job text and stays in
  `data/`). Every file carries `schema: 1` and is parsed with a zod strict schema; reading a
  folder returns `{ items, bad: [{ file, problem }] }`, `problem` built only from zod issue paths
  and codes (e.g. `job.days_open: invalid_type`), never the file's text; a `schema` other than 1
  gives `needs upgrade (schema N)`; a missing folder lists as empty.
- **Writes**: `EvalFiles` writes `<name>.tmp` through the port and then calls `port.rename`;
  `nodeFilePort.write` is a plain write that creates parent folders. The port is rooted at the
  data folder (`MYJOBBOT_DATA_DIR`); eval files live under `evals/`, traces are read from `runs/`.
- **Rationale**: FR-009, SC-006; strict schemas reject stray fields from hand edits.
- **Alternatives**: one big JSON per run (lost on interruption); SQLite (owner chose files).

## R7. Tokens and time

- **Decision**: `scoreCase` takes `makeChat(responseLog: Trace) => ChatFn`; production passes
  `(log) => createChat(env, log)`, which writes `llm_response` events; the session sums
  `response.usage.prompt_tokens` and `completion_tokens` from them (null when absent). Tests wrap
  `scriptedChat` in a helper that writes `{ type: "llm_response", response: { usage } }` per reply.
  Time is wall clock around the session.
- **Rationale**: no change to `src/agent/llm.ts`; testable without a server.

## R8. Pass rules (FR-008)

- **Decision**: with threshold T from the case's profile and the model's score S (base + bonus,
  no title boosts): `recommend` passes at S ≥ T, `reject` at S < T, `zero` at S = 0, `borderline`
  at |S − T| ≤ 10; given ranges and `mustMention` words (case-insensitive substring of any reason
  or gap) must also hold; a failed attempt never passes; a case without an answer key has `passed` null.
- **Rationale**: the same threshold Recommended uses. Recommended adds title boosts afterwards;
  they aren't model behaviour, so they are out of scope (spec Assumptions).
- **Answer key sanity**: `eval answer-key` warns (and still saves) when a range contradicts the verdict at
  the case's threshold, e.g. `recommend 65-85` at T = 70.

## R9. Running a case

- **Decision**: one shared builder for a one-job session's agent deps is exported from
  `src/rescore/session.ts` (`oneJobAgentDeps`, with the re-score's 6 steps and 3 minutes) and used
  by both the re-score and the eval session, so the two can't drift (and jscpd stays quiet).
  The eval session runs `runAgent` with `rescoreMessages(profile as config, markers)` and two tools:
  - `get_job` (eval's own, declared `outsideText: true`, added to `tests/toolDeclarations.test.ts`)
    returning the case's `job`;
  - `record_matches` over a one-case store: `findJob` returns a minimal row (`ats` from `source`,
    `job_id`, `description` null when the case's description is `"(none provided)"`), so
    alert-only jobs get the same "scored from the alert only" gap as in production;
    `recordVerdict` keeps the verdict in memory; `flagInjection` only records that a look-alike
    was removed; nothing reaches the database.
- **Markers**: built per attempt from `randomUUID()`, never from the run id (whose timestamp form
  would make the tag guessable; feature 009).
- **Failure codes**, from a pure `failureOf(result, tally)` over the `AgentResult` (the loop never
  throws: model errors end it with a reason starting `LLM error:`):
  - a verdict was recorded → none;
  - reason starts with `LLM error:` → `model_error`;
  - wall-clock budget exhausted → `timed_out`;
  - at least one `record_matches` call and every one failed → `invalid_tool_call`;
  - otherwise → `no_record`.
- **Trace**: the session's events go to `runs/<id>/trace.jsonl`.
- **Rationale**: same prompt and tools as Re-score, so measured changes carry straight over; the
  frozen `get_job` keeps the age fixed (FR-011).

## R10. Prompts per profile

- **Decision**: a run stores `prompts: { <profileId>: <promptId> }`, one for every profile its
  cases use; the prompt text has the attempt's markers replaced by `{open}` / `{close}` so equal
  prompts hash equal. Reports show the prompt id when there is one, else the count.
- **Rationale**: the system prompt contains the profile's preferences and threshold, so cases
  from different profiles get different prompts in the same run.

## R11. Recently scored (`--recent N`)

- **Decision**: a new `JobViews.recentlyScored(limit): JobKey[]`: distinct jobs ordered by their
  latest `verdicts.scored_at`, newest first (not `jobs.scored_at`, which `clearScore` empties),
  with a contract case run on memory and MariaDB.
- **Rationale**: `verdictHistory` carries no job key, and re-scores add several verdicts per job.

## R12. CLI arguments

- **Decision**: `main` (`src/cli.ts`) takes the command name without parsing flags
  (`parseArgs({ strict: false })`, or the first token) and passes the remaining raw arguments on;
  `run`, `rescore` and `import-sqlite` parse their own positionals as before, and each `eval`
  subcommand parses its own flags with `parseArgs` in strict mode. Usage errors exit 2, as today.
- **Rationale**: today's strict top-level `parseArgs` refuses every flag before dispatch.

## R13. Reproducibility notes

- `gitCommit`: `git rev-parse HEAD` when it runs, else null (the container has no `.git`).
- Capture prints once, when any captured job has an observed score: "observed scores used the
  resume and preferences of their time; cases use today's" (spec edge case).
- Preferences have no length limit in settings, so the profile sets none either.
- Capture reads the resume and settings through `settingsForRun` (`src/app/runSettings.ts`), as a
  run resolves them.

## R14. Test mix

- Baseline (main after #94): 817 unit, 64 integration, 64 UI (945). Planned new: 50 unit, 3
  integration, 0 UI → 867 / 67 / 64 (86.5% / 6.8% / 6.8% of 945 → 86.9% / 6.7% / 6.4% of 998). The
  unit share rises and the integration and UI shares fall, toward 95/4/1.
