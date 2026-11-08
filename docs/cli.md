# Command line

Every myjobbot command: a run, a re-score, accounts, the SQLite import, and the scoring evals.

[← README](../README.md)

Commands run as `npm start -- <command>` from a checkout with `.env`. In Docker, run them inside
the `web` container: `docker compose exec web npm start -- <command>` (add `-f compose.full.yaml`
for the full stack). In Kubernetes: `kubectl exec -it deploy/myjobbot-web -- npm start -- <command>`.

## run

```bash
npm start -- run                            # every user, one after another
npm start -- run --user you@example.com     # one user only
```

One agent run for each user, in id order: fetch every source that user has on, then score with
their own settings and resume. A user with no source on, or no resume, is skipped. It prints one
line per user, then that user's summary:

```text
user 1: run 6f0c… finished after 14 steps: done
Scored 12 jobs; 3 recommended.
user 2: skipped (no resume)
```

A user whose run fails prints `user <id>: failed` and the run goes on to the next user; the exit
code is then 1. `run --user` for a user who is skipped also exits 1. The email is matched as at
sign-in; an unknown one prints `--user: no account with that email`, a malformed one
`--user: not a valid address`. Each user's part has its own id, trace and logs, described in
[Traces and logs](how-it-works.md#traces-and-logs). In Docker, `docker compose run --rm myjobbot run`
starts one now, besides the scheduled ones.

## rescore

To score one job again at once, from its current description and your current resume and settings:

```bash
npm start -- rescore <ats> <job_id>     # e.g. rescore greenhouse 4012345
npm start -- rescore <ats> <job_id> --user you@example.com
```

Without `--user` it re-scores user 1's view of the job. A job the user doesn't have prints
`rescore <ats> <job_id>: failed`, as a missing job does.

It prints the command, then each step as it happens with the seconds since the start, then
`scored`, `filtered (hidden by …)` or `failed` (exit code 1):

```text
$ myjobbot rescore greenhouse 4012345
[  0.0s] settings loaded
[  0.0s] filters passed
[  0.1s] model reading the job
[  6.8s] model score saved: 72
[  6.8s] done: model score 72
rescore greenhouse 4012345: scored
```

A job has one re-score at a time: if one is already running (from the CLI or the web UI), it
prints `rescore <ats> <job_id>: already running (<run id>)` and exits 1. See
[Re-score](how-it-works.md#re-score) for what each outcome does. Each re-score gets its own run id and files, like
a run, and its steps are kept with the job (shown in the panel's History).

## account

`account init` makes the first admin; run it once. Both commands ask for the password at a hidden
prompt (10 to 128 characters with a lowercase letter, an uppercase letter, a digit and a symbol):

```bash
npm start -- account init you@example.com    # user 1 gets this email, the admin mark and the password
npm start -- account reset you@example.com   # an admin who lost every way in gets a new password
```

## import-sqlite

Copies an old SQLite database into the configured MariaDB database once; see
[Coming from SQLite](database.md#coming-from-sqlite).

## Evals

Evals test the scoring step on a fixed set of real jobs, so a change to the rubric, the prompt or
the model can be judged by numbers rather than by watching Recommended. They call the real model,
so they're never part of `npm run check`. Everything lives in `data/evals/`, inside the gitignored
`data/`, so job text and your resume never reach the repository.

```bash
npm start -- eval capture greenhouse 4012345        # freeze one stored job as a case
npm start -- eval capture --recent 20 --tag smoke   # or the 20 most recently scored jobs
npm start -- eval answer-key greenhouse-4012345 recommend --score 65-85 --mention TypeScript --note "remote US, stack matches"
npm start -- eval run --tag smoke --repeats 3       # score the cases with the model
npm start -- eval report 20261104-030111-167a --against 20261104-030029-80d2
npm start -- eval check                             # count the files and name any that are bad
```

`eval capture`, `eval run` and `eval series run` act for user 1, or for the user `--user <email>`
names: capture reads that user's scores and records their `userId` in the case, and a run replays
with that user's resume and profile.

- **A case** is one stored job frozen as the scoring model reads it, with its age as of its latest
  score (counted as a run counts it), that score, whether that score's model read the full
  details or only the summary, and whether its description arrived after the score. Your resume
  and settings at capture are stored once, as a profile. Capture only reads the database.
- **An answer key** is your judgement of a case on one fixed scale: `recommend` (passes at or above
  your match threshold), `reject` (below it), `borderline` (within 10 points of it) or `zero`.
  Optionally it adds score, base or bonus ranges, words the reasons or gaps must mention, and a
  note. Rewriting a key keeps the old one in its history. Boosts are not applied: the key
  judges the model's own score. The rubric leaves reasons empty below 40, so mention words only
  make sense on keys for scores of 40 or more.
- **A run** scores each chosen case, once or several times, the way Re-score scores one job: the
  same prompt and rubric, the frozen job inside fresh data markers, and nothing written to the
  database. Each attempt is saved with its parts, reasons, gaps, tokens and time, or a fixed reason
  it failed (`no_record`, `invalid_tool_call`, `timed_out`, `model_error`), and judged against the
  case's answer key. `--model` tries another model.
- **A report** re-judges a run against today's answer keys. It shows the pass rate, a line per case
  (title and company, its key, its scores, pass/fail/mixed, tokens, time) and the unstable cases
  (mixed, or scores 10 or more apart). With `--against <run-id>` it counts the cases a change fixed
  and broke and lists those that moved; with `--against observed` it compares with production's own
  scores, leaving out cases scored from the summary or before their description arrived. It never
  prints a description; `--reasons` adds the failing attempts' reasons and gaps.
- **What the model reads**: a profile captured while a resume profile is stored keeps it too.
  `eval run --view resume|resume_and_profile|profile` scores with that choice (default `resume`,
  whatever the Settings page says), the run records it and its report names it. A view that reads
  the resume profile is refused when a case was captured without one.

## Prompt variants and series

To try different wording without touching the code, export the prompt a case is scored with as a
variant, edit it, and run the cases with it:

```bash
npm start -- eval prompt export baseline          # data/evals/variants/baseline.md: today's prompt
cp data/evals/variants/baseline.md data/evals/variants/strict.md   # then edit strict.md
npm start -- eval prompt diff baseline strict     # the lines you changed
npm start -- eval run --tag smoke --repeats 3 --variant strict
npm start -- eval report <strict-run> --against <baseline-run>
```

- **A variant** is the whole system prompt of a re-score (its steps and the shared rubric), after a
  short header. It keeps three markers the run fills in: `{data}` (the sentence that tells the
  model text from job pages is data, never instructions), `{threshold}` and `{preferences}`. A
  variant without all three, or with any other `{word}`, is refused before any model call. The
  resume and the two tools stay as the code has them.
- **Drift**: a variant remembers which version of the code's prompt it was exported from. If the
  code's prompt has changed since, the run still goes ahead but warns, and its report says so.
- **A series** runs several tests over the same cases and compares them in one report. Each test
  is the code's prompt or a variant, optionally with a view after a `+` and on another model
  after an `@` (everything after the `@` is the model, colons included):

  ```bash
  npm start -- eval series save rubric-try --tag smoke --repeats 3 --test now=code --test strict=strict --test big=strict@llama3-70b
  npm start -- eval series save views --tag smoke --repeats 3 --test r=code+resume --test rp=code+resume_and_profile --test p=code+profile
  npm start -- eval series run rubric-try
  npm start -- eval series report rubric-try
  ```

  The report shows each test's pass rate, tokens and time, then each case's state under each test,
  the cases the tests disagree on first. Each test is an ordinary run, so `eval report` works on it
  too.
- Variants never reach scheduled runs or Re-score. When one wins, copy its wording into
  `src/rescore/prompt.ts` (the steps) and `src/agent/rubric.ts` (the rubric, which scheduled runs
  share) as a normal change.

## Other commands

```bash
npm run web                              # the web UI's development server, http://localhost:8080
npm run web:build && npm run web:start   # production build and server
npm run check                            # typecheck, unit and UI tests, habit-hooks
npm run check:db                         # integration tests against the test database
scripts/copy-prod.sh myjobbot_dev        # copy production into a dev database
```

The checks and the copy are described in [Developing](developing.md), the copy under
[Copying production](developing.md#copying-production).
