# Quickstart: Job interactions (Applied and Hide)

How to check each PR once it is merged and the stack is rebuilt (`npm run docker:up`). Every PR also
passes `npm run check` and `npm run check:db` before it is opened. The web UI is at
`http://<MYJOBBOT_HOSTS host>:8080`. Behaviour is specified in
[contracts/job-actions.md](contracts/job-actions.md), and storage in [data-model.md](data-model.md).

## PR 1: storing the mark

- Nothing visible changes; Hide works as before.
- In MariaDB, `SELECT applied, COUNT(*), COUNT(applied_on) FROM jobs GROUP BY applied;` shows one
  row: `0`, every job, `0`. This check only holds until PR 4 lets jobs be marked.

## PR 2: one way to save a change

- Nothing visible changes. Hide and Unhide work exactly as before on both tables, including the
  "Couldn't save — try again" note when a save fails.

## PR 3: the Applied column

- Both tables start with an "Applied" column, and every row shows a blue `?`. Hovering it says
  "Mark as applied". Clicking it does nothing yet.

## PR 4: marking from the rows

1. On **All jobs**, click a row's `?`: it turns into a green `✓` within about half a second
   (SC-002). Hovering it says "Applied on <today's date as YYYY-MM-DD>", in your browser's time
   zone.
2. Reload: still `✓`, same date (SC-003). Open **Recommended**: the same job (if listed) shows `✓`.
3. Click the `✓` and choose **Cancel**: nothing changes. Click it again and choose **OK**: it is a
   `?` again, and a reload agrees.
4. Tab through a row: the applied button is its own stop before the title link.
5. Mark a job, let a run finish (`npm start -- run`, or the 09:00 run), and reload: the mark and its
   date are unchanged (FR-008).
6. Marking doesn't move a job on or off Recommended, or change its score (FR-012).
7. **Failure**: stop the database or click a row for a job pruned since the page loaded: the row
   keeps its `?` and says "Couldn't save — try again".
8. **Cross-site refusal** (FR-010): in the browser's network panel, copy a mark's request as cURL,
   change its `Origin` header to `http://example.com`, and run it. Next.js refuses it, and a reload
   shows the job unchanged. Do the same with a Hide request; it should be refused the same way.

## PR 5: the panel's Applied

1. Open a job not applied to: the header reads **Applied** (green), then **Close**.
2. Click Applied: it becomes **Applied ✓**, the row behind shows `✓`, and the Job section shows
   "Applied: <date and time>".
3. Click a row's `?` while its panel is open: the panel switches to **Applied ✓** too.
4. Click **Applied ✓** and confirm: the green **Applied** button returns and the row shows `?`.
5. Open a job by its address when it isn't in the first page of rows (for example, copy a job's
   address from far down All jobs and open it in a new tab): Applied works there too.

## PR 6: the panel's Hide

1. Open a job: the header reads **Applied**, **Hide**, **Close**.
2. On **Recommended**, click **Hide**: the panel closes and the job's row is gone.
3. On **All jobs**, that job's row shows **Unhide**. Open its panel: **Hide** is greyed out and
   says it is already hidden.
4. Unhide it from its row, reopen the panel: **Hide** is enabled again.
5. Mark a hidden job applied: it stays hidden, and Unhide leaves it applied (Edge Cases).

## After PR 6: final checks (owner, real stack)

- Repeat PR 4 step 8 if not done then.
- Time five row marks and five panel marks in the browser's network panel; the slowest should be
  under half a second (SC-002). Record it in tasks.md (T059).

## The cleanup keeps applied jobs (FR-014)

PR 4's contract case proves this on both stores. A live check would need an applied job unseen for
`job_retention_days` (90), so it is optional.
