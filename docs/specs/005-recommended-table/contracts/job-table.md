# UI contract: the job table (Recommended and All Jobs)

## Columns, in order

Score · Title · Company · Location · Remote · Source · Posted · (action). There is no Scored
column.

## Score cell (`td.score-col`)

- Unscored: an empty cell.
- Scored with no note: `<span class="score">75</span>`, not focusable, with no tip.
- Scored with a note: `<span class="score" tabindex="0" aria-describedby=ID>75` followed by
  `<span role="tooltip" id=ID class="tip">note</span></span>`. The tip is hidden until the number is
  hovered or focused, and its text is the same note the cell shows today.

## Title cell (`td.title-cell`)

- The link text is `shortTitle`. When it differs from `title`, the link carries `title="<full title>"`.
- Then, unchanged: the filter note, "hidden by you", and the `<details>` "Why" block.
- All text in the cell wraps anywhere; the cell never forces the table wider than its container.

## Unchanged

The Company, Location, Remote, Source and Posted cells (with "N days open" and "⚠ possible
ghost"), the Hide/Unhide form, `data-hidden`, infinite scroll, and the Reasoning page's table.
