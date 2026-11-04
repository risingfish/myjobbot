# Quickstart: validating prompt variants

## Prerequisites

- Feature 020 in place, with a few captured cases and answer keys (tag `smoke`).
- `.env` with `MYJOBBOT_DB_*` and `LLM_*`; the database reachable (VPN off or local sharing on).
- The Docker stack stopped for S1–S5 (S1 changes the run's rubric code).

## Automated checks (every PR)

```bash
npm run check
npm run check:db
```

The run prompt snapshot (`tests/__snapshots__/prompt.test.ts.snap`) must not change.

## Manual validation

1. **Export (S1).** `eval prompt export baseline`, then `eval run --tag smoke --variant baseline`
   and a plain `eval run --tag smoke`: both runs store the same prompt id (SC-002). Export
   `baseline` again: `exists`, file unchanged.
2. **Variant runs (S2).** Copy `baseline.md` to `short.md`, edit one rubric line, run with
   `--variant short`, then `eval report <short-run> --against <baseline-run>`: the header names the
   variant, and moves are listed. Delete `{data}` from a copy and run it: refused before any
   attempt, naming `{data}`. Edit a line of `src/agent/rubric.ts` in a scratch checkout (or change
   `exportedFrom` in a variant's header) and run: the drift warning appears and the report shows it.
3. **Diff (S3).** `eval prompt diff baseline short` shows only the edited line; `eval prompt diff
   code baseline` prints `no differences`.
4. **Series (S4).** `eval series save try --tag smoke --repeats 2 --test now=code --test short=short`,
   `eval series run try`, `eval series report try`: two tests, their pass rates, tokens and time
   match each run's own report, and split cases come first. Stop a series run partway: its report
   shows the remaining tests as `not run`. A series naming a missing variant is refused before any
   model call.
5. **Safety.** Scheduled runs and Re-score are untouched: the run prompt snapshot is unchanged, a
   re-score after the feature sends the same system message as before (compare its trace's first
   request), no stored score changed during any eval, and no description text appears in any
   output.
