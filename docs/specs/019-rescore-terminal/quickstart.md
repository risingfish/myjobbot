# Quickstart: validating the re-score terminal

## Prerequisites

- `.env` with `MYJOBBOT_DB_*` and the `LLM_*` variables; `MYJOBBOT_SEARXNG_URL` for the lookup.
- Migrations run on start (`014_rescore_runs`).

## Automated checks (every PR)

```bash
npm run check
```

```bash
npm run check:db
```

## Manual validation

1. **CLI (PR 2).** `npm start -- rescore <ats> <job_id>` prints `$ myjobbot rescore …`, a line per
   step with its time, and `done: …`. Run it twice at once: the second prints `already running`
   and exits 1.
2. **Live terminal (PR 3).** Open a scored job and press Re-score: the terminal opens under the
   header within a second, dark in both the light and the dark theme, lines arrive as the run
   works and the newest stays in view, a cursor shows while it runs, it ends with `done: …`, the
   panel refreshes, and the terminal stays until its × is pressed. Opening another job, or closing
   the panel, closes it too.
3. **Lookup steps (PR 3).** Re-score a LinkedIn alert job with no description: `search`, each
   `open careers page …` / `open job page …` line with its size and how it was read, then the
   scoring lines.
4. **Looking away (PR 3, PR 4).** Start a re-score, reload the page, reopen the job: from PR 4 its
   terminal opens at once with the lines so far and follows it; in PR 3, pressing Re-score does the
   same (no second run starts).
5. **History (PR 4).** Close the panel, reopen the job: History lists the re-score (score row with
   Log, or its own filtered/failed row with Log); Log shows the full log.
6. **No outside text.** No terminal line holds page or model words; addresses, sizes, counts and
   scores only.
