# Quickstart: validating body filters and Re-score

## Prerequisites

- `.env` with `MYJOBBOT_DB_*`, the `LLM_*` variables and, for the lookup, `MYJOBBOT_SEARXNG_URL`
  (and `MYJOBBOT_BROWSER_URL` to render pages).
- `data/config.json` and `data/resume.md`.
- Feature work is done with the Docker stack stopped. Validate in the stack only after merging and
  rebuilding (`npm run docker:up`).
- Check compose changes with `docker compose config --quiet`. Never run plain
  `docker compose config`, because it prints `.env`.

## Automated checks (every PR)

```bash
npm run check
```

```bash
npm run check:db
```

- `check` covers matching, settings, notes, the re-score plan, the one-job store, the session with a
  fake chat, the fixed messages and the Re-score button.
- `check:db` runs the re-score contract (`clearScore`) on `myjobbot_test`.

## Manual validation

1. **Settings (US2).** Open Settings → Filters and add "clearance" under "Description must not
   include" and "typescript" under "Description must include one of". Save, reload, and both terms
   are still there. Add "---" and save: nothing is saved, and
   the row says a term needs a letter or digit. Use Reset on each list: it is empty.
2. **All jobs (US3).** Add "clearance" and "typescript" back to their lists and save. Open All jobs. A job whose description mentions a
   clearance shows "hidden by body filter", and so does one whose description never mentions
   TypeScript. A job hidden by both its title and its description shows
   "hidden by title filter".
3. **Runs (US1).** Run `npm start -- run`. In the trace (`data/runs/*.jsonl`), no `next_jobs` result
   contains a job whose description holds the term, and the run still finishes. On All jobs, those
   jobs are still listed, with no score.
4. **Re-score (US4).** Open a scored job's panel and press Re-score. The button reads
   "Re-scoring…", then the score, reasons and gaps update without a reload, and the reasoning
   history gains a row. While it runs, other actions on the page (Hide, Applied, Load more,
   opening another job) wait for it; that is expected.
   - **Filtered job:** add a body term that the job's description contains and press Re-score
     again. The panel says it was not re-scored because it is hidden by the body filter, and the
     job leaves Recommended.
   - **Job with no description:** re-score a LinkedIn alert job with no description. The careers
     lookup runs (it appears in `careers_audit`), then the job is scored.
   - **Failure:** stop the LLM server and press Re-score. The panel says the re-score failed, and
     the old score is unchanged.
5. **Traces.** Each re-score leaves its own `data/runs/<time>-<id>.jsonl`, with a `rescore` event
   before its `start` event. The job's text appears in it only inside the markers.
