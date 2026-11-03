# Contract: the `eval` commands

All run as `npm start -- eval <sub> …` (`src/cli.ts`; `main` passes the raw arguments on and each
subcommand parses its own flags, research R12), read `.env` like the other commands, and use
`evals/` and `runs/` under `MYJOBBOT_DATA_DIR`. Exit codes: 0 success, 1 a refusal or failure,
2 a usage error (as the other commands). Output is plain lines; no description text is ever
printed (FR-013).

## `eval check` (S1)

Loads every file and prints one line per kind and one per bad file:

```text
profiles 2 · cases 37 · answer keys 21 · prompts 3 · runs 4
bad: cases/greenhouse-4012345.json: job.days_open: invalid_type
bad: cases/lever-77.json: needs upgrade (schema 2)
bad: answer_keys/lever-9a.json: orphaned (no case)
bad: answer_keys/lever-77.json: orphaned (case is bad)
bad: cases/ashby-3.json: orphaned (no profile 9b1e…)
bad: runs/20261103-181200-3f2a/results.jsonl:14: score: too_big
```

Exits 1 when any file is bad. A missing `evals/` folder prints zero counts.

## `eval capture` (S2)

```text
eval capture <ats> <job_id> [--tag t]... [--fresh]
eval capture --recent <N> [--tag t]... [--fresh]
```

- Reads the stored job (checking its `ats`), its latest verdict, the resume and settings as a run
  resolves them (`settingsForRun`), the description's arrival (R3) and the observed run's trace
  (R2); writes the profile (if new) and the case.
- `--recent N` (1..200): the N jobs whose latest verdict is newest (`recentlyScored`).
- An existing case is left alone and reported (`exists: <case-id>`) unless `--fresh`.
- Prints one line per job, then the note of R13 once when any job had an observed score:

```text
captured greenhouse-4012345 · scored 72 (details) · 12 days as scored (shift 7)
captured linkedin-li_44 · scored 55 (summary) · description found after the score
exists: lever-9a
unknown job greenhouse 999
note: observed scores used the resume and preferences of their time; cases use today's
```

Exit 1 if any job is unknown.

## `eval answer-key` (S3)

```text
eval answer-key <case-id> <recommend|borderline|reject|zero> [--score 65-85] [--base a-b] [--bonus a-b]
           [--mention word]... [--note "text"]
```

Validates against the answer key schema; an earlier answer key moves into `history`. Prints
`answer key written: greenhouse-4012345 recommend 65-85`, plus `warning: 65-69 can't pass recommend at
threshold 70` when a range contradicts the verdict (saved anyway), or the rule broken (exit 1).

## `eval run` (S4)

```text
eval run [--tag t]... [--case id]... [--repeats N] [--model name]
```

- Selects cases (all, or matching any tag or id); refuses an empty set (exit 1). `--repeats`
  1..20, default 1; `--model` overrides `LLM_MODEL`.
- Writes each profile's prompt (if new) and `runs/<run-id>/run.json` with `endedAt: null`, appends
  one result per attempt (a failed attempt doesn't stop the run), then sets `endedAt`.
- Prints one line per attempt as it ends, then the summary:

```text
[ 3/30] greenhouse-4012345 #1   72  pass  4.2k tok  5.3s
[ 4/30] lever-9a #1            fail  no_record  1.1k tok  2.0s
run 20261103-181200-3f2a: 24/30 passed · 1 failed attempt · 128k tokens · 3m12s
```

- Never opens a writing store; never changes a job, score or history.

## `eval report` (S5)

```text
eval report <run-id> [--against <run-id> | --against observed] [--reasons]
```

```text
run 20261103-181200-3f2a · model qwen3 · prompt 9b1e… · 10 cases × 3 · unfinished
passed 24/30 (80%) · with answer keys 10/10 · tokens 128,410 in / 5,902 out · 3m12s
cases:
  greenhouse-4012345  Senior Engineer · Acme   recommend 65-85   52 58 61  fail  12.6k tok  15.1s
  lever-9a            Backend Dev · Beta       borderline        55 66 60  mixed  12.0k tok  14.0s
unstable (mixed or range ≥ 10): lever-9a (55-66)
answer key changed since the run: lever-9a
against 20261102-090000-aa11: 21→24 passed (+3 fixed, 0 broken) · tokens +4% · time −12s
  greenhouse-4012345  fail → fail   61 → 57
  lever-9a            fail → pass   55 → 66
against observed: 7 compared, 2 moved · left out 4 (summary 3, description changed 1)
```

`--reasons` adds each failing attempt's reasons and gaps, indented, as the model wrote them.
