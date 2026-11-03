# Quickstart: validating scoring evals

## Prerequisites

- `.env` with `MYJOBBOT_DB_*` (capture) and `LLM_*` (run); `data/` present.
- The Docker stack stopped for the whole feature, S1 to S6 (`docker compose stop`).

## Automated checks (every PR)

```bash
npm run check
npm run check:db
```

Evals never run in either (FR-015).

## Manual validation

1. **Format (S1).** `npm start -- eval check` with no `data/evals/` prints zero counts. Hand-write
   `data/evals/cases/x-1.json` with `"schema": 1` and a wrong field type, and another with
   `"schema": 2`: both are named under `bad:` (one `invalid_type`, one `needs upgrade`), and the
   command exits 1 (SC-006). Delete them.
2. **Capture (S2).** Capture one job scored a week ago, one never scored and one LinkedIn alert job
   whose description the careers lookup found after its score. Check each case's `dates` and
   `job.days_open` against the job's age on its scoring day (SC-003), `observed.read`, and
   `descriptionChangedSinceScored`. Capture the first again: `exists`, file unchanged.
   `--recent 20` finishes in under a minute (SC-001).
3. **Labels (S3).** Label a case, relabel it: the old one is in `history`. A range of `90-80` or a
   verdict `maybe` is refused; `recommend --score 65-85` at threshold 70 saves with a warning.
4. **Run (S4).** Run 5 labeled cases with `--repeats 2`: 10 results, each profile's prompt saved
   once, `endedAt` set, no change to any score in the web UI. Run again and stop it with Ctrl-C:
   its results so far remain and `endedAt` stays null.
5. **Report (S5).** Report the first run, then against a second run of the same cases with no
   change: the spread is visible, few cases move, fixed and broken are counted (SC-004, SC-005).
   Report the stopped run: it says unfinished. Report `--against observed`: summary-only and
   description-changed cases are counted as left out. No description text appears without
   `--reasons`, and none with it beyond reasons and gaps (SC-007).
6. **Repository.** `git status` shows nothing under `data/` (SC-007).
