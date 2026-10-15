# Quickstart: checking the tighter job tables

## Automated

```bash
npm run check      # unit (shortTitle, row view) and UI (job row, headers) tests
npm run check:db   # unchanged integration suite, still green
```

## Manual (owner's browser, after `npm run docker:up` or `npm run web`)

1. Open `/recommended` with the window 1280 px wide and every "Why" closed. There is no
   horizontal scrollbar under the table; in the console,
   `(t => t.scrollWidth <= t.clientWidth)(document.querySelector('.table'))` is `true`.
2. The headers read Score, Title, Company, Location, Remote, Source, Posted; there is no Scored.
3. Hover a score that has a boost or breakdown, and the note appears. Tab to it, and the same note
   appears. A score with no note shows nothing.
4. Find a title ending in "…": it is at most 64 characters before the "…", and hovering shows the
   full title. The link opens the posting.
5. Open "Why" on the job with the longest reasons: the text wraps inside Title, and the table
   width doesn't change (step 1's check is still `true`).
6. Repeat steps 1–5 on `/jobs`; also scroll to load more rows, and check that they look the same.
7. Hide and Unhide a job on each page: unchanged behaviour.
8. `/reasoning` looks as before (its score cell still prints the breakdown).
