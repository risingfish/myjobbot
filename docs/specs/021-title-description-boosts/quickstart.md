# Quickstart: Title and description boosts

All commands run in the worktree, `/home/zac/code/myjobbot-021-boosts`, never in the main checkout
(its own databases are `myjobbot_dev` and `myjobbot_test`; the Docker stack is stopped). See
research R7.

## 1. Set up the worktree (once)

```sh
cd /home/zac/code/myjobbot-021-boosts
npm ci                                   # from the lockfile
cp ../myjobbot/.env .env                 # copy only; never print it
sed -i '/^MYJOBBOT_DB_NAME=/d; /^MYJOBBOT_TEST_DB_NAME=/d' .env
printf 'MYJOBBOT_DB_NAME=myjobbot_dev_alt\nMYJOBBOT_TEST_DB_NAME=myjobbot_test_alt\n' >> .env
```

This session's own databases are created once by the owner, with their own user: `myjobbot_dev_alt`
for the app (the live look in §3) and `myjobbot_test_alt` for `check:db` (the name must hold
`_test`; the tests empty every table), both `utf8mb4` / `utf8mb4_general_ci` like the others, with
the user granted rights on those two only. The main checkout uses `myjobbot_dev` and
`myjobbot_test` the same way; `myjobbot` belongs to the Kubernetes cluster. The owner then sets
`MYJOBBOT_DB_USER` and `MYJOBBOT_DB_PASSWORD` in the worktree's `.env` to that user; Claude never
sees or writes the password. The databases stay for the next feature worked in a second session.

## 2. Checks (end of every sitting)

```sh
npm run check        # typecheck, unit + UI tests, habit-hooks, in this worktree
npm run check:db     # MariaDB integration tests on myjobbot_test_alt, incl. step 016
```

Expected: both green. The new cases cover the scenarios in the spec:

| Scenario | Where it's proved |
|----------|-------------------|
| Description term mentioned 4× adds its points once (US1.1) | `tests/boosts.test.ts` (unit) |
| Title-only term never adds description points, and back (US1.2, US2.2, SC-003) | `tests/boosts.test.ts` |
| Same term in both lists, found in both → higher value once (US3) | `tests/boosts.test.ts` |
| `maxBoost` never below a real boost, repeats in one list included (SC-004) | `tests/boosts.test.ts`, `tests/pageData.test.ts` |
| Note and panel list each applied boost with place and points (US4) | `tests/boostViews.test.ts`, `tests/pageData.test.ts`, `tests/jobDetail.test.ts`, `tests/client/panelSections.test.tsx` |
| Repeat within one list refused, across lists accepted (US5.2–3) | `tests/settingsProblems.test.ts`, `tests/settingsSave.test.ts` |
| Each list falls back on its own (FR-012) | `tests/searchSettings.test.ts` |
| Carry-over decision (FR-013) | `tests/boostCarryOver.test.ts` (unit) |
| Step 016 copies once, leaves others alone | `tests/integration/boostMigration.test.ts` (integration) |
| Two cards in the Filters grid, each saving (US5.1) | §3 below, by hand (no UI test in this PR) |

## 3. Look at it live (required for US5, on this session's `myjobbot_dev_alt` only)

The worktree's own dev server, on another port, on `myjobbot_dev_alt` (from the worktree's
`.env`), so step 016 never runs on `myjobbot` or `myjobbot_dev` before the merge:

```sh
MYJOBBOT_PORT=8081 npm run web
```

Then open `http://<host>:8081/settings`:

1. Before changing anything: `myjobbot_dev_alt` is a copy of production (2026-11-04), so step 016
   has run on the server's first start and both cards hold the owner's old title boosts (SC-006
   on real data; none of its 8 terms differ only in case or punctuation, checked 2026-11-04).
2. The Scoring section shows Threshold, then Title boosts and Description boosts side by side.
3. Add `senior: 5` to Title boosts and `typescript: 10`, `react: 10` to Description boosts, and
   `react: 5` to Title boosts; each saves at once ("Saved").
4. Add `react` again to Description boosts → refused on that row.
5. No setting on the page (Preferences, Scoring, Filters) shows a Reset button or a "(default)"
   marker.
6. On All jobs, pick a job whose title has a title-boost term and whose description has a
   description-boost term: its note lists each with `(title)`, `(description)` or `(title and
   description)` and its points, and its panel's Boosts fact lists the same lines.

## 4. After merge (production)

The first start of the merged image on the Kubernetes cluster runs step 016 on `myjobbot` once. Check that Settings shows the old list in both
cards, and that Recommended shows the same jobs with the same scores as before the merge (SC-006).
