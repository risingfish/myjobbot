# Quickstart: Markdown job descriptions

How to check each PR once it is merged and the stack is rebuilt (`npm run docker:up`, then
`docker compose --profile browser up -d browser`). Every PR also passes `npm run check` and
`npm run check:db` before it is opened. PR numbers match the task list's sittings.

**Boards need a configured company.** `data/config.json` has no companies today, so a board's
conversion only shows once a company on that board is configured. To watch a job being scored again
(PR 5), configure the company and let one run score its jobs **before** the PR that converts that
board merges.

## PR 1: the format

- Every existing job still shows its description exactly as before.
- In MariaDB, `SELECT description_format, COUNT(*) FROM jobs GROUP BY description_format;` shows
  `text` for every job with a description and null for the rest.

## PR 2: the readable copy

- Nothing visible changes (no description is Markdown yet). The unit tests show a Markdown
  description reaching the model and the boosts without its link addresses.

## PR 3: the careers lookup's board path

- Nothing visible changes. The unit tests show a board job page with a Markdown description reaching
  the lookup's model without link addresses, and stored as Markdown.

## PR 4: display

- Every existing job still shows its description as before (all `'text'`), including a description
  containing `##` or `**`, which shows those characters.
- The UI tests show a Markdown description formatted, with links opening in a new tab, and hostile
  Markdown rendering nothing harmful.
- **Before PR 6**: add an Ashby company (and, before PR 7, a Greenhouse one; before PR 8, a Lever
  one) to `data/config.json` and let a run score their jobs, so their re-scoring can be watched.

## PR 5: scoring again once

- Nothing visible changes yet. The contract tests show a scored plain-text (or no-format) job marked
  for scoring again when it is upserted as Markdown, once.

## PR 6: conversion and Ashby

- With an Ashby company configured, its jobs' panels show formatted descriptions, with no `##`, `**`
  or tags visible, and description headings, lists and links styled inside the panel.
- A job scored before this PR keeps showing its old score, then a new one after it is scored again
  (once). A second run doesn't mark it again.
- In the trace (`data/runs/*.jsonl`), `get_job_details` events have `wrapped: true` (the model saw
  them inside the data markers) and their descriptions keep link words but no link addresses.

## PR 7: Greenhouse and Workday

- With a Greenhouse company configured, its jobs show formatted and are scored again once.
- Workday isn't a stored source: after a run with Gmail alerts, a job whose careers lookup landed on a
  Workday site (`*.myworkdayjobs.com`) shows its description formatted.

## PR 8: Lever's whole posting

- With a Lever company configured, a Lever job's panel shows its opening, then each list ("What We
  Require", …) under its own heading, then the closing section, and the job is scored again once.
- Stored Lever jobs from companies no longer configured keep their plain text.

## PR 9: careers pages downloaded or rendered

- After a run with Gmail alerts, a job whose description the lookup found on a company's own site
  shows it formatted, without the site's menus, header or footer.
- Careers descriptions found before this PR still show as plain text.

## SC checks (PR 10)

- **SC-002**: the hostile sets run in `npm run check` (conversion and display unit tests, and the two
  UI tests).
- **SC-003 / SC-005**: on a sample of real postings from each configured board, compare the readable
  copy of the Markdown with the old plain text: for Lever and Ashby, the board's own
  `descriptionPlain` (still in its API); for Greenhouse, the old `escapedHtmlToText` taken from git
  (`git show <commit before PR 7>:src/sources/htmlText.ts`) applied to the same `content`. Same words
  in order (for Lever, within the parts the old text had); every boost term matched before is still
  matched, and any new one comes from added content.
- **SC-004**: time ten panel opens on All jobs as in feature 011 (under 1 second).
