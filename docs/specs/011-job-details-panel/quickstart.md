# Quickstart: validating 011, one PR at a time

Contract: [contracts/job-details.md](contracts/job-details.md). Data: [data-model.md](data-model.md).

Before each PR is merged, `npm run check` and `npm run check:db` are green. After each merge, run
`npm run docker:up` and try that PR's steps at `http://localhost:8080/recommended` and `/jobs`.

## PR 1: posting icon

- Each row shows an external-link icon just left of Hide, on the same line. Clicking it opens the
  posting in a new tab.
- A job without a posting address shows no icon.
- Tab through a row: the icon, then Hide.

## PR 2: the panel

- Click a title: a panel slides in from the right, about 60% wide, showing the job section. The
  address gains `?job=…`.
- With the panel open:
  - click another title, and the panel switches;
  - the list still scrolls, and Hide still works;
  - scrolling the panel to its end doesn't scroll the list.
- Close it with the button, with Escape, and by clicking the list away from any title. The list
  hasn't moved, and focus is back on the title.
- Ctrl/Cmd-click a title: a new tab opens that page with the panel open.
- Reload with `?job=…` for a job in the first rows: the panel opens.
- Back and forward open and close it, and Forward still works after Back.
- Narrow the window, and the panel goes nearly full width.
- On Recommended, hide the open job: the row goes, and the panel still shows the job, as hidden.
- `/reasoning?job=…` shows no panel.

## PR 3: loading the details

- Reload with `?job=` for a job further down the list (not yet loaded), and the panel opens.
- The job section now shows pay and remote terms where known.

## PR 4: score

- A scored job shows the same total as its row, the model's own score, the boost, base and bonus,
  reasons and gaps.
- An unscored job says "not scored yet".

## PR 5: description

- The description shows in full and scrolls inside the panel, with any requirements and skills.
- A careers-page description names the page and links it. A job with none says "no description
  found".

## PR 6: warnings and history

- A job flagged by feature 009 shows the "tried to escape the data markers" warning with its date.
- A job scored more than once lists every score, the current one included, newest first.
- **SC-002**: with the browser's network tab open, a panel's details arrive within 1 second.
