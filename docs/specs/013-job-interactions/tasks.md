---
description: "Tasks for feature 013: mark jobs Applied, and Hide from the panel, delivered as small PRs"
---

# Tasks: Job interactions (Applied and Hide)

**Input**: Design documents from `docs/specs/013-job-interactions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/job-actions.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file,
and the existing tests its change breaks, which are updated in that same test task, before the code.

**Organization**: by user story, in sittings. **Each sitting is one pull request** (plan
"Delivery"): a docs PR, then six code PRs.

**Delivery note (owner, 2026-10-23):** after PR 1 merged, the owner asked for sittings S2–S6 to be
delivered as one PR, from branch `013-applied-and-panel-hide`. The sittings are still worked in
order, tests first, with `npm run check` green at each sitting's end; their per-PR flow steps 1–2 and
5–6 happen once, for the combined PR.

- **Per-PR flow** (each sitting's first and last tasks):
  1. Check `docker compose top myjobbot | grep -c "cli.ts run"` prints 0 (as its own command), then
     `docker compose stop`. Make sure `docker:watch` isn't running.
  2. `git switch main && git pull --ff-only && git switch -c <branch>`.
  3. Create `.specify/sitting-in-progress` naming the sitting; write the tests, then the code.
  4. Run `npm run check` and `npm run check:db`, check the size (`git diff --stat main`), and delete
     the marker.
  5. Commit and push with no attribution lines, and open the PR with no footer. Its description
     lists that PR's quickstart steps.
  6. **Stop, and wait for the owner to merge it.** Then `npm run docker:up`, and the owner tries
     the PR in the UI before the next sitting starts.
- **Size**: about 10 files per PR, tests included. Past about 12, tell the owner before opening it.
  PR 4 is expected at about 25 (plan "Delivery": the store method, the server action and the click
  can't be split without leaving code only tests use).
- **Limits to design for** (constitution Principle I): functions at most 20 lines as Prettier lays
  them out, tests included. `toJobRowView` is at 19 lines and `JobRows` at 20 (the limit), so new
  fields and handlers go into helpers (T010, T017). Test files have a 200-line limit too
  (`tests/client/detailsPanel.test.tsx` is at 135), so the panel header's UI tests get their own
  file. habit-hooks also runs knip without the tests (`test-only-dead-code`): every export needs a
  production importer **in another file**, in the sitting that adds it. A pure function that only its
  own hook uses lives in its own module, which the hook imports.
  Duplicated code (jscpd) is fixed, not left: one shared save hook and one failure note (S2).
- **Libraries their own way** (constitution 2.3.0): Kysely's schema builder for migration 008 (with
  a `` sql`tinyint` `` fragment only), its query builder and `eb.fn.coalesce` for the mark; React's
  `useSyncExternalStore` for the browser's zone; `Intl.DateTimeFormat("sv-SE", …)` for dates, as
  `src/web/gmailPanel.ts:49` does; Next.js server actions for the change. No new library.
- **Tests that need the browser's dialog**: happy-dom 21 has no `window.confirm`. Stub it with
  `vi.stubGlobal("confirm", vi.fn(() => true))` (the pattern of `tests/helpers/fakeObserver.ts:27`;
  `tests/helpers/domSetup.ts` unstubs after each test).
- **UI tests stay at one `test()` per task**, each scenario a file-local helper (e.g.
  `markFromPanel()`, `expectHeader(...)`) so the test body stays within 20 lines.
- **No new comments** beyond each new function's one-line purpose doc comment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3 from spec.md

---

## Phase 1: Setup

### Sitting S0: planning docs PR (T001–T003), branch `013-job-interactions`

- [X] T001 Per-PR flow step 1 (already done on 2026-10-23: the stack and the watcher are stopped).
  Create `.specify/sitting-in-progress` naming S0.
- [X] T002 Run `npm run check` and `npm run check:db` and correct the ledger's baseline row below
  (taken from 012's final counts) if they differ.
- [X] T003 Delete the marker, and commit only `docs/specs/013-job-interactions/` ("Plan job
  interactions (013)"). Push it and open a docs-only PR. **Wait for the owner to merge it.**

---

## Phase 2: Foundational

### Sitting S1, PR 1: the stored mark (T004–T011), branch `013-pr1-applied-storage`

Nothing visible changes; Hide works as before.

- [X] T004 Per-PR flow steps 1–3, for sitting S1.
- [X] T005 [P] Integration test in `tests/integration/migrate.test.ts` (one new `test()`): on a
  database migrated to 007, seed a job through a Kysely `insertInto("jobs")`, run 008, and check it
  reads `applied = 0` and `applied_on` null; insert a second job naming neither column and check the
  same; and check `columnTypes(db, "jobs", ["applied", "applied_on"])` equals `["applied tinyint(4)
  NO 0 ", "applied_on varchar(32) YES NULL utf8mb4_bin"]`, as the 005 and 006 tests do (`:80`,
  `:91`). Add `008_applied` to the exact migration lists at `tests/integration/migrate.test.ts:56`,
  `:77` and `:113`.
- [X] T006 [P] Unit tests (two `test()`s, on the memory stores): in `tests/pageData.test.ts`, a stored
  job's row view has `applied: false` and `appliedOn: null`; in `tests/jobDetail.test.ts`,
  `toJobDetailView({ ...(await storedDetail({})), applied: true, applied_on:
  "2026-10-23T16:40:00.000Z" }, [], context).job` has `applied: true` and that `appliedOn`. Add the defaults
  to `jobRowView()` in `tests/helpers/rowFixtures.ts` (`applied: false, appliedOn: null`) and to
  `UNSCORED` in `tests/helpers/memoryStore.ts:9` (`applied: 0, applied_on: null`).
- [X] T007 Add `src/db/migrations/008_applied.ts` exporting `applied: Migration`, whose `up` runs
  `db.schema.alterTable("jobs").addColumn("applied", sql`tinyint`, (column) =>
  column.notNull().defaultTo(0)).addColumn("applied_on", "varchar(32)").execute()` (the chain of
  `005_page_sources.ts:17`); list it as `"008_applied"` in `src/db/migrations/index.ts`.
- [X] T008 Add `applied: Generated<number>` and `applied_on: Text` to `JobsTable` in
  `src/db/schema.ts`; add `applied: z.number().transform((flag) => flag === 1)` and `applied_on:
  text` to `jobViewSchema` in `src/db/rows.ts`; add `"applied", "applied_on"` to `JOB_COLUMNS` in
  `src/db/kysely/jobViews.ts`.
- [X] T009 Update `upsertAll`'s doc comment in `src/db/kysely/jobStore.ts:33` to name the applied
  mark among what an upsert keeps ("…keeping first seen, score, the hidden flag and the applied mark
  of known jobs…"); the code needs no change (research R11).
- [X] T010 Add `applied: boolean` and `appliedOn: string | null` to `JobRowView` in `src/web/api.ts`.
  In `src/web/rowViews.ts`, add one spread `...appliedMark(job)` to `toJobRowView` from a new
  private `appliedMark(job): Pick<JobRowView, "applied" | "appliedOn">` with its doc comment
  (`toJobRowView` is at 19 lines). Fix any other `JobRowView` literals the typecheck names.
- [X] T011 Per-PR flow steps 4–6 ("Store when a job was marked applied (013 PR 1)").

### Sitting S2, PR 2: one way to save a change (T012–T018), branch `013-pr2-save-core`

A refactor with no change in behaviour, so the Applied code in S4 to S6 doesn't duplicate Hide's
(research R13). Every existing Hide test passes unchanged.

- [X] T012 Per-PR flow steps 1–3, for sitting S2.
- [X] T013 [P] Unit tests in a new `tests/saveOutcome.test.ts` (three `test()`s) for the pure
  `saveOutcome(result)` in a new `web/lib/saveOutcome.ts`: an `{ ok: true, … }` result is the saved
  result, an `{ ok: false, error }` result is a failure, and `null` (a rejected send) is a failure.
- [X] T014 Add `web/lib/saveOutcome.ts` (T013), and `web/lib/useSave.ts`, which imports it:
  `useSave(send, onSaved)`, where `send: () => Promise<R>` for a result `R extends { ok: boolean }`
  and `onSaved` receives the successful result, returns `{ status, submit }` with `status` one of
  `"idle" | "saving" | "failed"`; `submit(event)` prevents the default, sets `"saving"`, awaits
  `send()` (a rejection becomes `null`), and calls `onSaved(result)` on success.
- [X] T015 Move `web/lib/useHide.ts` onto `useSave`: `useHide(job, onHidden)` keeps its signature,
  sends `setJobHidden(job.ats, job.jobId, !job.hidden)`, and its `onSaved` ignores the result and
  calls `onHidden(!job.hidden)`, as today.
- [X] T016 Add `web/components/forms/SaveFailedNote.tsx`: the `{" "}<small className="note">Couldn't
  save — try again</small>` fragment, shown when `status === "failed"`; use it in
  `web/components/forms/HideButton.tsx`.
- [X] T017 Add `web/lib/useJobChanges.ts`: `useJobChanges(rows, panel)` returning `markHidden(job,
  hidden)`, the body that `JobRows` in `web/components/pages/RowsList.tsx` has today (both
  `rows.markHidden` and `panel.noteHidden`). `JobRows` calls it and only renders; update `JobRows`'
  doc comment (it no longer handles hides itself).
- [X] T018 Per-PR flow steps 4–6 ("Share one way to save a job change (013 PR 2)"). Confirm
  `tests/client/hide.test.tsx`, `rowsList.test.tsx` and `detailsPanel.test.tsx` pass with no edits.

---

## Phase 3: User Story 1 - Mark a job applied from the list (Priority: P1) 🎯 MVP

**Goal**: a blue `?` / green `✓` per row that marks and, after a confirmation, undoes Applied.

**Independent Test**: on All jobs, click a `?`; it becomes `✓` and stays after a reload. Click the
`✓`, confirm, and it is `?` again (quickstart PR 4).

### Sitting S3, PR 3: the Applied column, read-only (T019–T024), branch `013-pr3-applied-column`

Rows show their saved state; nothing can be clicked yet.

- [X] T019 [US1] Per-PR flow steps 1–3, for sitting S3.
- [X] T020 [P] [US1] Unit tests in a new `tests/appliedTime.test.ts` (five `test()`s) for
  `rowLabel(job, timeZone)` (research R4, exact strings): "Mark as applied" for an unapplied job;
  `"Applied on 2026-10-23"` for `appliedOn: "2026-10-23T23:30:00.000Z"` in `"America/Los_Angeles"`;
  `"Applied on 2026-10-24"` for the same instant in `"Asia/Tokyo"`; `"Applied"` when the zone is
  `null`; and "Mark as applied" for an unapplied job even when the zone is `null`. Only `rowLabel` is imported: `appliedLabel` stays private until S5
  gives it a production caller.
- [X] T021 [P] [US1] Update the UI tests the new column changes (no new `test()`):
  `tests/client/rowsList.test.tsx` `JOB_HEADERS` (`:10`) gains `"Applied"` first, and its
  server-render test (`:38`) also renders an applied job and checks the HTML
  `toContain('aria-label="Applied"')` and `not.toContain("Applied on")` (FR-011: no date before the
  browser's zone is known). Neither assertion names an element, so S4 moving the label to a button
  keeps them true.
- [X] T022 [US1] Add `web/lib/appliedTime.ts`: a private `appliedLabel(iso, timeZone)` formatting the
  date with `Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeZone })` (`YYYY-MM-DD`); the
  exported `rowLabel(job, timeZone)`; and the exported `useLocalTimeZone()` returning
  `Intl.DateTimeFormat().resolvedOptions().timeZone` through `useSyncExternalStore` with a no-op
  subscribe and a server snapshot of `null`.
- [X] T023 [US1] Add `web/components/tables/AppliedMark.tsx`: a `<span role="img">` showing `?`
  (class `unapplied`) or `✓` (class `applied`), with `aria-label` and `title` from
  `rowLabel(job, useLocalTimeZone())`. Render it in a new first `<td className="applied-cell">` of
  `web/components/tables/JobRow.tsx`, and put `"Applied"` first in `JOB_HEADERS`
  (`web/components/tables/Tables.tsx`); update `JobRow`'s doc comment (the mark in its first cell).
  In `web/app/styles.css` add `--applied: #1e7a3c` to `:root` and `--applied: #6fd08f` to its
  `@media (prefers-color-scheme: dark)` block; the blue `?` uses the existing `--accent` (`#2b4fb0` /
  `#93a8ff`). Add the `.applied-cell` styles, scoping the glyph rules as `span.applied` and
  `span.unapplied`.
- [X] T024 [US1] Per-PR flow steps 4–6 ("Show which jobs are marked applied (013 PR 3)").

### Sitting S4, PR 4: marking from the rows (T025–T040), branch `013-pr4-applied-rows`

- [X] T025 [US1] Per-PR flow steps 1–3, for sitting S4.
- [X] T026 [P] [US1] One contract case in a new `tests/helpers/appliedContract.ts` (memory and
  MariaDB, one `test()` named "the applied mark is set once, undone, kept through runs and the
  cleanup, and independent of hiding"; each step a file-local helper), wired into
  `tests/storeContract.test.ts` and `tests/integration/storeContract.test.ts` like
  `descriptionContract` (`tests/helpers/storeContract.ts` is at 181 lines). It covers data-model
  cases 1–7:
  - marking returns `{ appliedOn: at }`, and the job reads back applied with that time;
  - marking again with a later `at` returns and keeps the first time (FR-009);
  - `scoredFrom` lists the same jobs, and `findJob` the same score and `scored_at`, before and after
    a mark (FR-012);
  - `hidden` is unchanged by a mark, and the mark by `setHidden` (Edge Cases);
  - an upsert of the applied job keeps the mark (FR-008);
  - with both jobs' `last_seen` before the cutoff, the prune deletes the unapplied job and keeps the
    applied one with its verdicts (FR-014); run the prune **before** any upsert that would move
    `last_seen`;
  - undoing returns `{ appliedOn: null }` and clears both; marking again with a later `at` records
    that new time (Edge Cases); undoing once more, the next prune deletes the job; a missing job
    returns `null`.
- [X] T027 [P] [US1] Unit tests in `tests/webRows.test.ts` (seven `test()`s) for
  `setAppliedFor(views, change, now)`: `{ ok: true, appliedOn: now.toISOString() }` on a first mark;
  the original time on a repeat; `{ ok: true, appliedOn: null }` on undo; `{ ok: false, error: "No
  such job." }` for a missing job; and `"Invalid applied request"` thrown for a missing `ats`, an
  empty `jobId`, and a non-boolean `applied` (one `test()` each).
- [X] T028 [P] [US1] Unit tests in `tests/pageRows.test.ts` (four `test()`s) for
  `withJobApplied(key, appliedOn)`: sets `applied` and `appliedOn` on the matching row; leaves other
  rows alone; clears both for `null`; leaves a verdicts page unchanged.
- [X] T029 [P] [US1] Unit tests in a new `tests/appliedRequest.test.ts` (three `test()`s) for the pure
  `appliedRequest(job)` in a new `web/lib/appliedRequest.ts`: an unapplied job asks to mark with no
  confirmation; an applied job asks to undo with the confirmation "Mark as not applied?"; and the
  request names the job's `ats` and `jobId`.
- [X] T030 [P] [US1] UI test in a new `tests/client/applied.test.tsx` (one `test()`), mocking
  `web/lib/actions.js` with `setJobApplied` as `tests/client/hide.test.tsx` mocks `setJobHidden`, and
  stubbing `confirm` with `vi.stubGlobal`, and rendering `name="recommended"`: "Mark as applied"
  sends `("greenhouse", "a", true)`, the row stays listed (FR-012) and its button's name is
  `rowLabel(job, Intl.DateTimeFormat().resolvedOptions().timeZone)`, worked out in the test since
  the suite sets no `TZ`; with `confirm` returning `false` a click sends nothing and shows no failure
  note; with `true` it sends `false` and the row shows "Mark as applied"; a failed mark keeps the `?`
  and shows "Couldn't save — try again"; a failed undo keeps the `✓` (FR-013). In the same task:
  update `tests/client/rowsList.test.tsx:40` to the new noscript text; and in
  `tests/client/jobRow.test.tsx`, pass `onApplied={() => {}}` to `<JobRow>` (`:12`) and add
  `vi.mock("../../web/lib/actions.js", () => ({ setJobApplied: vi.fn() }))`, since `JobRow` now
  imports the action through `AppliedButton`. Tests that never click Applied need no
  `setJobApplied` in their mocks (vitest only throws when a missing mock export is used).
- [X] T031 [US1] Add `AppliedChange` (`ats`, `jobId`, `applied: boolean`, `at: string`; not
  `AppliedMark`, the component's name) and `setApplied(change: AppliedChange): Promise<{ appliedOn:
  string | null } | null>` to `JobViews` in
  `src/db/store.ts`. Implement it in `src/db/kysely/jobViews.ts`: one `updateTable("jobs")` setting
  `applied: 1, applied_on: eb.fn.coalesce("applied_on", eb.val(change.at))` when marking, or `applied:
  0, applied_on: null` when undoing, by `ats` and `job_id`; `null` when no row matched (mysql2's
  found-rows count, as `setHidden` relies on); otherwise `selectFrom("jobs").select("applied_on")`
  for the same key. Implement the same in `tests/helpers/memoryJobViews.ts`.
- [X] T032 [US1] Make `pruneLastSeenBefore` skip applied jobs: `.where("applied", "=", 0)` in
  `src/db/kysely/jobStore.ts:105`, and keep `job.applied === 1` rows in the filter of
  `tests/helpers/memoryStore.ts:76`. Update its doc comment ("…except those marked applied…").
- [X] T033 [US1] Add `AppliedResult` and `setAppliedFor(views, change, now)` to `web/lib/rows.ts`,
  with an `appliedChange` zod schema of `hideChange`'s fields with `applied: z.boolean()`; add the
  server action `setJobApplied(ats, jobId, applied)` to `web/lib/actions.ts`, calling it with
  `new Date()` (contract). Cross-site refusal (FR-010) comes from Next.js's server-action origin
  check and `web/proxy.ts`, as for `setJobHidden` (research R6). The suite has no harness for a
  running Next.js server, so the quickstart's PR 4 step 8 checks it by hand.
- [X] T034 [US1] Add `web/lib/appliedRequest.ts` with `appliedRequest(job)` (T029), and
  `web/lib/useApplied.ts`, which imports it: `useApplied(job, onApplied)` built on `useSave`. Its own
  `submit(event)` asks `confirm(request.confirm)` first when the request has one; on Cancel it calls
  `event.preventDefault()` and returns **before** `useSave`'s `submit`, so the status stays `"idle"`
  and no failure note shows. Otherwise it hands over to `useSave`'s `submit`, which sends
  `setJobApplied(...)` and on success calls `onApplied(result.appliedOn)`.
- [X] T035 [US1] Add `web/components/forms/AppliedButton.tsx`: a `form.applied-form` whose button
  holds the glyph and carries `rowLabel`'s text as its `aria-label` and `title`, disabled while
  saving, followed by `SaveFailedNote`. `web/components/tables/AppliedMark.tsx` becomes the bare
  glyph (`aria-hidden`), taking only `applied`, since the button now names it and nothing shows the
  mark outside a button; update its doc comment.
- [X] T036 [US1] Add `withJobApplied` to `web/lib/pageRows.ts`, and `markApplied(job, appliedOn)` to
  `PageRows` in `web/lib/usePageRows.ts`, built by a small private helper beside `markHidden` so
  `usePageRows` stays within 20 lines. It never removes a row (FR-012). Update `usePageRows`' doc
  comment ("…following hides and marks").
- [X] T037 [US1] Add `markApplied(job, appliedOn)` to `useJobChanges` (`web/lib/useJobChanges.ts`),
  calling `rows.markApplied` (S5 adds the panel, T045).
- [X] T038 [US1] Give `JobRow` (`web/components/tables/JobRow.tsx`) an `onApplied(appliedOn)` prop
  and render `AppliedButton` in its first cell, now `<td className="applied-cell"
  data-keeps-panel>`; pass it through `JobTable` (`web/components/tables/Tables.tsx`) from
  `JobRows`, using `useJobChanges`' `markApplied`. Update the doc comments of `JobRow`, `JobTable`
  and `JobRows` for the new prop.
- [X] T039 [US1] Change `RowsList`'s `<noscript>` note to "Loading more rows, Hide and Applied need
  JavaScript."; style `form.applied-form button` in `web/app/styles.css` (no border, the glyph's
  colour). In `README.md`, change the sentence at `:85` that calls Hide and the Gmail panel "the UI's
  only writes" to include Applied, so the README isn't wrong between PR 4 and PR 6.
- [X] T040 [US1] Per-PR flow steps 4–6 ("Mark jobs applied from their rows (013 PR 4)"). It is about
  25 files: tell the owner when opening it.

**Checkpoint**: User Story 1 works on its own; the panel is unchanged.

---

## Phase 4: User Story 2 - Mark a job applied from the details panel (Priority: P1)

**Goal**: the panel's green Applied button and "Applied ✓", in step with the row.

**Independent Test**: open a job's panel, click Applied; the panel shows "Applied ✓", the row shows
`✓`, and both survive a reload (quickstart PR 5).

### Sitting S5, PR 5: the panel's Applied (T041–T049), branch `013-pr5-applied-panel`

- [X] T041 [US2] Per-PR flow steps 1–3, for sitting S5.
- [X] T042 [P] [US2] Unit tests in `tests/appliedTime.test.ts` (three `test()`s) for
  `appliedFact(job, timeZone)`, the Job section's value: `"2026-10-23 09:40"` for `appliedOn:
  "2026-10-23T16:40:00.000Z"` in `"America/Los_Angeles"`; `"Not applied"` for an unapplied job; and
  `"Yes"` for an applied job while the zone is `null`. `appliedLabel` stays private: `rowLabel` and
  `appliedFact` are its only callers.
- [X] T043 [P] [US2] Unit tests in a new `tests/panelActions.test.ts` (three `test()`s) for the pure
  `panelApplied(job)` in `web/lib/panelActions.ts`: `"offer"` for an unapplied job, `"done"` for an
  applied one, and `"done"` for a job both applied and hidden (the two are independent).
- [X] T044 [P] [US2] UI test in a new `tests/client/panelHeader.test.tsx` (one `test()`, scenarios as
  helpers, `confirm` stubbed with `vi.stubGlobal`), with its own `actions` mock (`loadMoreRows`,
  `setJobHidden`, `setJobApplied`, `loadJobDetails`) and the page helpers of
  `tests/helpers/panelPage.tsx` (`tests/client/detailsPanel.test.tsx` is at 135 lines): the header
  of an unapplied job reads Applied, then Close; clicking Applied sends `true`, the button becomes
  "Applied ✓", the row shows the applied button, and the Job section shows `appliedFact(job, zone)`
  for the machine's own zone, worked out in the test; a row's `?` clicked while the panel is open
  switches the panel too; "Applied ✓" with `confirm` returning `false` sends nothing, and with
  `true` brings the green button back; a failed save keeps the button and shows "Couldn't save — try
  again"; a job already applied opens on "Applied ✓"; and a job opened by address that isn't listed
  (as `tests/client/detailsPanel.test.tsx:79` does) switches to "Applied ✓" after its click, and
  still shows "Applied ✓" after another, listed row is then marked (FR-006; US2 scenarios 1–6).
- [X] T045 [US2] Replace `noteHidden` in `usePanelJob` (`web/lib/useOpenJob.ts`) with
  `noteChange(job, change)` taking `Partial<Pick<JobRowView, "hidden" | "applied" | "appliedOn">>`.
  It changes the kept row only for the job the panel shows, using the passed `job` as the base when
  the kept row isn't that job: `setKept((current) => (isJob(job, key) ? { ...(current !== null &&
  isJob(current, job) ? current : job), ...change } : current))`. A panel showing an unlisted job
  then follows its own changes, and a change to another row never replaces it. `useJobChanges` calls
  it for hides and marks. Update `usePanelJob`'s doc comment ("…and noting changes to the job it
  shows").
- [X] T046 [US2] Add `web/lib/panelActions.ts` with `panelApplied(job)` (T043), and
  `web/components/panel/PanelHeader.tsx`: the heading (moved from `PanelContent` in
  `DetailsPanel.tsx` with `headingText`, keeping its `id` and `tabIndex`), then a `div.details-actions`
  holding
  `PanelApplied` and Close. `PanelApplied` uses `useApplied` and `SaveFailedNote`: a green
  `button.applied-action` reading "Applied" for `"offer"`, else a button reading "Applied ✓". The
  actions render once the panel has a row (`job ?? view.job`). Update `PanelContent`'s doc comment
  (the header is now `PanelHeader`).
- [X] T047 [US2] Give `DetailsPanel` an `onApplied(job, appliedOn)` prop from `JobRows`
  (`useJobChanges`' `markApplied`), and render `PanelHeader` from `PanelContent`.
- [X] T048 [US2] In `web/lib/appliedTime.ts`, give the private `appliedLabel` a `style` parameter
  (`"date" | "dateTime"`, the latter adding `timeStyle: "short"`; `rowLabel` passes `"date"`), and
  export `appliedFact(job, timeZone)` (T042). In `web/components/panel/JobSection.tsx`, add `<Fact
  label="Applied" value={appliedFact(job, useLocalTimeZone())} />` (one line, keeping the function
  within 20) and update its doc comment's list of facts. In `web/app/styles.css`, style
  `.details-actions` (a flex row with a gap, so `.details-head`'s `space-between` keeps the buttons
  together) and the green `.details-head .applied-action`, which must outrank `.details-head button`
  (`styles.css:228`).
- [X] T049 [US2] Per-PR flow steps 4–6 ("Mark jobs applied from the details panel (013 PR 5)").

**Checkpoint**: User Stories 1 and 2 work; the panel has no Hide yet.

---

## Phase 5: User Story 3 - Hide a job from the details panel (Priority: P2)

**Goal**: a Hide button between Applied and Close that closes the panel once saved.

**Independent Test**: on Recommended, open a job and click Hide; the panel closes and the row is
gone (quickstart PR 6).

### Sitting S6, PR 6: the panel's Hide, and docs (T050–T058), branch `013-pr6-panel-hide`

- [X] T050 [US3] Per-PR flow steps 1–3, for sitting S6.
- [X] T051 [P] [US3] Unit test in `tests/panelActions.test.ts` (one `test()`) for `panelHide(job)`:
  `"enabled"` for a job not hidden, `"disabled"` for a hidden one.
- [X] T052 [P] [US3] UI test in `tests/client/panelHeader.test.tsx` (one `test()`, scenarios as
  helpers): the header reads Applied, Hide, Close in that order; Hide on Recommended sends `true`,
  closes the panel and drops the row; Hide on All jobs closes the panel and the row shows Unhide; a
  failed save keeps the panel open with "Couldn't save — try again"; for a hidden job on All jobs,
  Hide is disabled and named "Hide (already hidden)" (US3 scenarios 1–4; FR-004).
- [X] T053 [US3] Add `panelHide(job)` to `web/lib/panelActions.ts`, and `PanelHide` to
  `web/components/panel/PanelHeader.tsx` between `PanelApplied` and Close, styled like Close: it uses
  `useHide(job, () => onHidden(job))` (the panel only ever hides, so it ignores `useHide`'s boolean)
  and `SaveFailedNote`, and for `"disabled"` renders a disabled button with
  `title="Already hidden"` and `aria-label="Hide (already hidden)"`.
- [X] T054 [US3] Add `hideFromPanel(job)` to `useJobChanges` (`web/lib/useJobChanges.ts`, which then
  takes `close` as its third argument): `markHidden(job, true)`, then `close()`. Pass it to
  `DetailsPanel` as `onHidden`. Focus returns as it does for Close.
- [X] T055 [P] Update `README.md`: the rows' Applied column and its undo (near the Hide passage at
  `README.md:83`); the panel's header buttons (near `:89`) and the Job section's "Applied" fact (the
  bullet at `:92`); the `applied` / `applied_on` columns in the job-row diagram (beside `hidden` at
  `:548`); and that the cleanup keeps applied jobs, at `:596` and in the `job_retention_days` row at
  `:709`.
- [X] T056 [P] Add one line to `CLAUDE.md`'s Conventions: the applied mark is written only through
  `JobViews.setApplied` (both columns together, the server's time), and the cleanup never prunes an
  applied job.
- [X] T057 Fill the ledger's last row with the final counts.
- [X] T058 [US3] Per-PR flow steps 4–6 ("Hide jobs from the details panel (013 PR 6)").

**Checkpoint**: all three stories work.

### After PR 6 merges (owner, with the stack rebuilt)

- [ ] T059 Run the quickstart's final checks with the real stack: the cross-site request (PR 4 step
  8), and five row marks and five panel marks timed in the browser's network panel, the slowest
  against SC-002's half second. Report both to the owner; they go into tasks.md in the next commit to
  `main` the owner asks for.

---

## Dependencies & Execution Order

- **S0 → S1 → … → S6**, each merged and tried by the owner before the next starts (small PRs).
- **S1** gives the columns and `JobRowView` fields; **S2** the shared `useSave`, `SaveFailedNote`
  and `useJobChanges`. Both block everything after them.
- **S3** adds the read-only mark and `appliedTime.ts`; **S4** makes it clickable, adding
  `setApplied`, the cleanup rule, the action and `useApplied`, which S5 reuses.
- **S5 (US2)** creates `PanelHeader`, `panelActions.ts` and `noteChange`, which S6 extends.
- **S6 (US3)** touches no applied code.

### Within each sitting

- The per-PR flow's first task, then the test tasks (all [P]: different files), then the code in
  task order, then the closing flow task.
- Every new export has a production importer in another file, in the sitting that adds it:
  `saveOutcome` (from `useSave`), `useSave`, `SaveFailedNote` and `useJobChanges` (S2, from
  `useHide`, `HideButton` and `RowsList`); `rowLabel` and `useLocalTimeZone` (S3, from
  `AppliedMark`); `setApplied`, `setAppliedFor`, `setJobApplied`, `appliedRequest` (from
  `useApplied`) and `withJobApplied` (S4); `appliedFact`, `panelApplied` and `PanelHeader` (S5);
  `panelHide` (S6). `appliedLabel` is never exported.

## Parallel Example: User Story 1 (S4)

```text
T026 contract case      tests/helpers/appliedContract.ts
T027 setAppliedFor      tests/webRows.test.ts
T028 withJobApplied     tests/pageRows.test.ts
T029 appliedRequest     tests/appliedRequest.test.ts
T030 row UI             tests/client/applied.test.tsx
```

## Implementation Strategy

- **MVP**: S1 to S4. The owner can see, mark and undo Applied on every row, the core of the request.
- **Increments**: S5 adds the panel's Applied, and S6 the panel's Hide. Each is a PR the owner tries
  in the UI before the next.

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

New tests by count, so each moves the mix toward 95 / 4 / 1: integration stays at 2 (each contract
case runs once per store, so one bundled case) and UI at 3.

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (after 012, T002) | 543 | 50 (1 skipped without a browser) | 54 |
| Planned new | 32 (T006 2, T013 3, T020 5, T026's memory run 1, T027 7, T028 4, T029 3, T042 3, T043 3, T051 1) | 2 (T005, T026's MariaDB run) | 3 (T030, T044, T052) |
| Planned after | 575 (84.1%, from 83.9%) | 52 (7.6%, from 7.7%) | 57 (8.3%, from 8.3%: 8.33 from 8.35) |
| After the combined PR (T057) | 575 (+32) | 52 (+2; 1 skipped without a browser) | 57 (+3) |
