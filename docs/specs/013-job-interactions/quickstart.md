# Quickstart: Job interactions (Applied and Hide)

How to check each PR once it is merged and the stack is rebuilt (`npm run docker:up`). Every PR also
passes `npm run check` and `npm run check:db` before it is opened. The web UI is at
`http://<MYJOBBOT_HOSTS host>:8080`. Behaviour is specified in
[contracts/job-actions.md](contracts/job-actions.md), and storage in [data-model.md](data-model.md).

## PR 1: storing the mark

- Nothing visible changes; Hide works as before (SC-005).
- In MariaDB, `SELECT applied, COUNT(*), COUNT(applied_on) FROM jobs GROUP BY applied;` shows one
  row: `0`, every job, `0`.
- After the next run, every job is still unapplied and nothing else changed.

## PR 2: the row's control

1. On **All jobs**, every row starts with a blue `?`. Hovering it says "Mark as applied".
2. Click one: it turns into a green `✓` within about half a second (SC-002). Hovering it says
   "Applied on <today's date>" in your browser's time zone.
3. Reload: still `✓`, same date (SC-003). Open **Recommended**: the same job (if listed) shows `✓`.
4. Click the `✓` and choose **Cancel**: nothing changes. Click it again and choose **OK**: it is a
   `?` again, and a reload agrees.
5. Tab through a row: the applied button is its own stop before the title link.
6. Mark a job, let a run finish (`npm start -- run`, or the 09:00 run), and reload: the mark and its
   date are unchanged (FR-008).
7. **Failure**: stop the database or open a row for a job pruned since the page loaded, then click:
   the row keeps its `?` and says "Couldn't save — try again".

## PR 3: the panel's Applied

1. Open a job not applied to: the header reads **Applied** (green), **Hide**, **Close**.
2. Click Applied: it becomes **Applied ✓**, the row behind shows `✓`, and the Job section shows
   "Applied: <date and time>".
3. Click a row's `?` while its panel is open: the panel switches to **Applied ✓** too.
4. Click **Applied ✓** and confirm: the green **Applied** button returns and the row shows `?`.

## PR 4: the panel's Hide

1. On **Recommended**, open a job and click **Hide**: the panel closes and the job's row is gone.
2. On **All jobs**, that job's row shows **Unhide**. Open its panel: **Hide** is greyed out and
   says it is already hidden.
3. Unhide it from its row, reopen the panel: **Hide** is enabled again.
4. Mark a hidden job applied: it stays hidden, and Unhide leaves it applied (Edge Cases).

## Cleanup keeps applied jobs (PR 1, FR-014)

The store contract cases prove this on both stores. For a live check, an applied job older than
`job_retention_days` stays listed on All jobs after a run.
