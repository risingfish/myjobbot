# Contract: command line (027)

Commands that act on job data take an optional `--user <email>`. The email is normalised as at
sign-in. Without the flag, a command acts for user 1, so every command behaves as before for the
owner, except the run's summary lines (below).

| Command | Change |
|---|---|
| `npm start -- run` | runs for every user (every account, email or not), one after another, in id order; prints one line per user |
| `npm start -- run --user <email>` | runs for that user only |
| `npm start -- rescore <ats> <job_id> [--user <email>]` | re-scores that user's view of the job; a job the user doesn't have prints `rescore <ats> <job_id>: failed`, exit 1, as a missing job does today |
| `npm start -- eval capture <ats> <job_id> [--user <email>]`, `eval capture --recent N [--user <email>]` | captures from that user's scores; the case records `userId` |
| `npm start -- eval run … [--user <email>]`, `eval series run <name> [--user <email>]` | replays with that user's resume and profile |
| `npm start -- import-sqlite <path>` | unchanged; the copy goes to user 1 |

The other commands (`eval check`, `answer-key`, `report`, `prompt`, `series save` and `series report`, and `account`) are
unchanged.

**Refusals** (exit 1, nothing done):
- An unknown email prints `--user: no account with that email`.
- A malformed one prints `--user: not a valid address`.

Neither line ever repeats the email typed.

**Run lines**: one per user, in id order. The `user <id>: ` prefix is the one FR-018 exception.
- A user who ran prints `user <id>: run <runId> <status> after <N> steps: <reason>`, today's line
  with the prefix, then that user's summary line on the next line, as today.
- A skipped user prints `user <id>: skipped (no sources are on)` or `user <id>: skipped (no resume)`.
- A failed user prints `user <id>: failed`, and the run goes on to the next user.
- The exit code is 1 when any user failed. Skips are not failures, but `run --user` for a user who
  is skipped exits 1, as a run with no resume does today.

**Logs**: each user's part has its own random run id and today's files: `data/runs/<timestamp>-<runId>.jsonl`,
plus `.llm.jsonl` and `.jobs.jsonl` under `MYJOBBOT_LOG_DIR`. The trace's first event records `userId`.
