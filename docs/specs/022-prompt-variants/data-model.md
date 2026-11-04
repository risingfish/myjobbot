# Data model: Prompt variants

New files under `data/evals/` (inside the gitignored `data/`), beside feature 020's:

```
data/evals/
  variants/<name>.md             header + template text
  series/<name>.json             a saved experiment
  series-runs/<seriesRunId>.json one time a series ran
```

## Variant (`variants/<name>.md`)

```
---
schema: 1
exportedAt: <ISO time>
exportedFrom: <16 hex>
gitCommit: <sha or "null">
---
<template text>
```

| Field | Type | Rules |
|---|---|---|
| name | string | the file name; `[a-z0-9][a-z0-9-]{0,39}`; `code` reserved |
| schema | 1 | in the header |
| exportedAt | ISO time | |
| exportedFrom | 16 hex | content id of the code's system template at export (research R5) |
| gitCommit | string \| null | |
| text | string | everything after the header's closing `---`, kept exactly; must contain `{data}`, `{threshold}` and `{preferences}` and no other `{word}` marker to be runnable (research R4) |

A header that doesn't parse, or a missing closing `---`, makes the file bad (named by `eval check`).
A body that fails R4 is a valid file but a refused variant: `eval check` lists it with its
problems, and `eval run` and `eval series run` refuse it.

## Run (feature 020, `runs/<id>/run.json`): two new optional fields

| Field | Type | Rules |
|---|---|---|
| variant | string \| null | optional; absent reads as null (the code's prompt) |
| promptChanged | boolean | optional; absent reads as false; true when the variant was exported from another version of the code's prompt |

## Series (`series/<name>.json`)

| Field | Type | Rules |
|---|---|---|
| schema | 1 | |
| tags | string[] | as a run's `--tag`; each `[a-z0-9-]{1,40}` |
| cases | string[] | as a run's `--case` |
| repeats | int | 1..20 |
| tests | array | 1..10, in order; each `{ label, variant, model }` |
| tests[].label | string | `[a-z0-9][a-z0-9-]{0,39}`, unique in the series |
| tests[].variant | string \| null | a variant name, or null for the code's prompt |
| tests[].model | string \| null | null for `LLM_MODEL` |
| createdAt | ISO time | |

With neither tags nor cases, a series runs every case, as `eval run` does.

## Series run (`series-runs/<id>.json`)

| Field | Type | Rules |
|---|---|---|
| schema | 1 | |
| id | string | `<yyyymmdd-hhmmss>-<4 hex>`, as run ids; equals the file name |
| series | string | the series name |
| startedAt | ISO time | |
| endedAt | ISO time \| null | null until every test has run |
| runs | `{ [label]: runId \| null }` | one entry per test of the series at the time; null until that test's run starts |

## Derived (not stored)

- **Test row**: per test of a series run, its run's pass rate, tokens and time (020's
  `summarize`), and whether its variant had drifted.
- **Case grid**: per case, its state under each test; a case **splits** the tests when its states
  differ. Split cases are listed first.
