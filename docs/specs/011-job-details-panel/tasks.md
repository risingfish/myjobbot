---
description: "Tasks for feature 011: job details panel, delivered as small PRs"
---

# Tasks: Job details panel

**Input**: Design documents from `docs/specs/011-job-details-panel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/job-details.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file.

**Organization**: by user story, in sittings. **Each sitting is one pull request** (spec "Delivery").

- **Per-PR flow** (each sitting's first and last tasks):
  1. Check `docker compose top myjobbot` shows no run in progress, then
     `docker compose --profile browser stop`. Stop first, because `web` mounts `./web` and `./src`
     live.
  2. `git switch main && git pull --ff-only && git switch -c <branch>`.
  3. Create `.specify/sitting-in-progress` naming the sitting; write the tests, then the code.
  4. Run `npm run check` and `npm run check:db`, check the PR's size (`git diff --stat main`), and
     delete the marker.
  5. Commit, push, and open the PR. Its description lists that PR's quickstart steps.
  6. **Stop, and wait for the owner to merge and test it.** Then `npm run docker:up` and
     `docker compose --profile browser up -d browser`.
- **Size**: about 10 files per PR, tests included. PR 3 is knowingly about 15 (research R8). Any
  other PR past about 12 files means telling the owner before opening it.
- **Never in a 011 PR**: the `.gitignore` line for `compose.override.yaml`.
- **Libraries their own way** (constitution 2.3.0):
  - Next.js server actions (`web/lib/actions.ts`, which only delegates);
  - `history.pushState` with `useSearchParams`;
  - the native `<dialog>`;
  - the Kysely query builder.
- **Outside text**: every job field is rendered as React text, never with `dangerouslySetInnerHTML`
  (FR-011).
- **Wiring**: each new component and read is reached from a page within its PR (knip runs in
  production mode).
- **UI tests** mock `next/navigation.js` like `tests/client/nav.test.tsx` does, with a
  `useSearchParams` that reads `window.location.search` and re-renders on `pushState` and
  `popstate`. The shared mock goes in `tests/helpers/navigation.ts`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3 from spec.md

---

## Phase 1: Setup

### Sitting S0: planning docs PR (T001–T003)

- [X] T001 Per-PR flow step 1 (stop the stack). On branch `011-job-details-panel`, create
  `.specify/sitting-in-progress` naming S0.
- [X] T002 Run `npm run check` and `npm run check:db` and record the counts in the ledger below.
- [X] T003 Delete the marker, and commit only `docs/specs/011-job-details-panel/` ("Plan the job
  details panel (011)"). Push it and open a docs-only PR. **Wait for the owner to merge it.**

---

## Phase 2: User Story 3, part 1 - Open the original posting from the list (Priority: P2)

**Goal**: an external-link icon just left of Hide opens the posting in a new tab.

**Independent Test**: quickstart "PR 1".

### Sitting S1, PR 1: posting icon (T004–T008), branch `011-pr1-posting-icon`

- [X] T004 Per-PR flow steps 1–3, for sitting S1.
- [X] T005 [US3] UI test in `tests/client/hide.test.tsx` (it renders `RowsList` with the actions
  mocked):
  - A row with a `url` shows a link named "Open the posting", with `href` set to the posting,
    `target="_blank"` and `rel="noopener noreferrer"`. It comes before the Hide button in the same
    cell.
  - A row with `url: null` has no such link.
- [X] T006 [US3] Create `web/components/common/PostingLink.tsx`: an `<a>` with an inline SVG
  external-link icon (`aria-hidden="true"`), `aria-label="Open the posting"`, `target="_blank"`,
  `rel="noopener noreferrer"` and `data-keeps-panel`. It renders nothing when `url` is null
  (`webUrl` in `src/web/rowViews.ts` already turns non-http(s) addresses into null).
- [X] T007 [US3] In `web/components/pages/RowsList.tsx`, render `<PostingLink url={job.url} />` then
  `<HideButton …/>` inside one `<span className="row-actions">`. In `web/app/styles.css`, lay
  `.row-actions` out inline (flex with a small gap) so the icon sits left of Hide (`form.hide` is a
  block today), and size the icon.
- [X] T008 [US3] Per-PR flow steps 4–6: commit ("Add a posting link icon beside Hide (011 PR 1)"),
  push, and open PR 1. **Wait for the owner.**

**Checkpoint**: the posting is one click away from an icon; nothing else has changed.

---

## Phase 3: User Story 1 - See a job without leaving the list (Priority: P1) 🎯 MVP

**Goal**: the title opens a non-modal panel from the right, about 60% wide.
- Another title switches it.
- The close button, Escape, or a click outside closes it.
- The list stays usable.
- The open job lives in the address.

**Independent Test**: quickstart "PR 2".

### Sitting S2, PR 2: the panel (T009–T018), branch `011-pr2-details-panel`

- [X] T009 Per-PR flow steps 1–3, for sitting S2.
- [X] T010 [P] [US1] Unit test `tests/jobParam.test.ts`:
  - `parseJobParam("greenhouse:123")` gives `{ ats: "greenhouse", jobId: "123" }`.
  - It splits on the first `:` only (`"jsearch:a:b"` gives jobId `"a:b"`).
  - `null`, `""`, `"x"`, `":1"` and `"x:"` give `null`.
  - `jobParam` is its inverse.
  - `withJob("?sort=1", key)` gives `"?sort=1&job=greenhouse%3A123"`.
  - `withJob("?sort=1&job=x%3Ay", null)` gives `"?sort=1"`, and `withJob("", null)` gives `"?"`
    or `""`; settle on one and test it.
- [X] T011 [US1] Create `web/lib/jobParam.ts` (`parseJobParam`, `jobParam`, `withJob` through
  `URLSearchParams`).
- [X] T012 [P] [US1] UI tests, written before T013–T017:
  - New `tests/helpers/navigation.ts` holds the `next/navigation.js` mock (see the header).
  - New `tests/client/detailsPanel.test.tsx` renders `RowsList` with fixture rows from
    `tests/helpers/rowFixtures.ts`:
    - Clicking a title opens a dialog named by that job's title. It shows the job section
      (company, location, remote, source, posted, hidden), and the address has
      `?job=<ats>%3A<jobId>`.
    - Clicking another title switches the dialog to that job.
    - The close button, an Escape keydown on `document`, and a pointerdown on a non-title element
      outside the panel each close it and remove `?job=`. A pointerdown on another title or on
      Hide doesn't close it.
    - Dispatching `popstate` after setting the address to no job closes the panel without a new
      `pushState`.
    - With `?job=` naming a job that isn't in the rows, the panel says "job not found".
    - Hiding the open job on Recommended keeps the panel showing it, as hidden.
    - A title containing `<script>` is shown as text.
    - A `verdicts` page with `?job=` shows no panel.
  - In `tests/client/jobRow.test.tsx`, rewrite the title-link test:
    - the title's `href` is `?job=greenhouse%3Aa`, with no `target`;
    - it stays a link when `url` is null;
    - its `title` attribute case is kept.
- [X] T013 [US1] Create `web/lib/useOpenJob.ts`:
  - It reads `job` from `useSearchParams()`, treating `null` as no job.
  - `open(key)` and `close()` call `window.history.pushState(null, "", withJob(location.search,
    …))`.
  - `close()` only pushes when the address still names a job.
- [X] T014 [US1] Create `web/components/panel/PanelSection.tsx` (a heading and its content) and
  `web/components/panel/JobSection.tsx`. The job section shows the job fields from a `JobRowView`,
  says "unknown" for missing values, and shows the hidden state.
- [X] T015 [US1] Create `web/components/panel/DetailsPanel.tsx`, a non-modal
  `<dialog className="details-panel" aria-labelledby>`:
  - It calls `show()` when a job opens and `close()` when none is open.
  - It closes on its close button, on a document `keydown` Escape, and on a document `pointerdown`
    outside the panel whose target isn't inside `[data-keeps-panel]`.
  - On open, focus moves to the heading. On close, it returns to the opening title, or to `main`
    after a deep link.
  - It keeps the job it opened, even if its row leaves the list.
  - "job not found" shows for an unknown key.
  - Sections render in order, so later PRs append theirs.
- [X] T016 [US1] [US3] In `web/components/tables/TitleCell.tsx`, the title becomes
  `<a href={withJob(search, key)} data-keeps-panel>`, using `useOpenJob` directly. A plain left
  click calls `open(key)` with `preventDefault`; modified clicks follow the link. In
  `web/components/pages/RowsList.tsx`, render `<DetailsPanel>` only when `data.kind === "jobs"`,
  and mark `HideButton`'s form `data-keeps-panel`.
- [X] T017 [US1] Add `.details-panel` to `web/app/styles.css`:
  - fixed to the right edge, `width: 60vw` (FR-013), full height, using the existing colour tokens
    and dark mode;
  - slides in, respecting `prefers-reduced-motion`;
  - a body that scrolls with `overscroll-behavior: contain`;
  - under 800px wide, `width: calc(100vw - 1rem)`.
- [X] T018 [US1] Per-PR flow steps 4–6: commit ("Open a job's details in a side panel (011 PR 2)"),
  push, and open PR 2. In its description, note that a deep link to a job not yet loaded shows "job
  not found" until PR 3. **Wait for the owner.**

**Checkpoint**: US1 works from row data, and the title opens the panel (US3 complete).

### Sitting S3, PR 3: loading the details (T019–T029), branch `011-pr3-load-details`

- [X] T019 Per-PR flow steps 1–3, for sitting S3.
- [X] T020 [US1] Move `MemoryJobViews` from `tests/helpers/memoryStore.ts` into a new
  `tests/helpers/memoryJobViews.ts`, unchanged, so the new reads keep `memoryStore.ts` under 200
  lines. Run `npm test` to show nothing changed.
- [X] T021 [P] [US1] Contract cases in a new `tests/helpers/jobDetailContract.ts`, wired into
  `tests/storeContract.test.ts` and `tests/integration/storeContract.test.ts`:
  - `jobViews.jobDetail({ ats, jobId })` returns a seeded job with `compensation`,
    `workplace_type`, the description fields, requirements, skills, score parts, reasons, gaps,
    `hidden` and `injection_seen_at`.
  - An unknown key gives `null`.
  - The same `job_id` on another board isn't returned.
- [X] T022 [US1] Add `jobDetail(key): Promise<JobDetailRow | null>` to `JobViews` in
  `src/db/store.ts`. Implement it in `src/db/kysely/jobViews.ts` with
  `selectFrom("jobs").where("ats", "=", …).where("job_id", "=", …)`, parsed by a zod schema in
  `src/db/rows.ts`, and in `tests/helpers/memoryJobViews.ts`.
- [X] T023 [P] [US1] Unit tests:
  - `tests/jobDetail.test.ts`: `toJobDetailView(row, context)` gives `job` with the row view's
    fields plus `pay` and `workplace` (null when missing).
  - `tests/webRows.test.ts`: `loadDetailsFor(views, config, request)`:
    - throws "Invalid job request" for an empty `ats`, an `ats` over 32 characters, an empty
      `jobId` or one over 255;
    - returns `null` for an unknown job;
    - returns the view for a known one.
- [X] T024 [US1] Export `rowContext` from `src/web/pageData.ts`. Create `src/web/jobDetail.ts`
  (`toJobDetailView`, with `job` only for now) and add `JobDetailView` to `src/web/api.ts`.
- [X] T025 [US1] Add `loadDetailsFor` to `web/lib/rows.ts` (zod check, `views.jobDetail`,
  `toJobDetailView`). Add `loadJobDetails(ats, jobId)` to `web/lib/actions.ts`; it only delegates.
- [X] T026 [P] [US1] UI tests in `tests/client/detailsPanel.test.tsx` (with the action stubbed):
  - A job not in the rows is fetched and shown.
  - A `null` answer shows "job not found" (update T012's not-found case to stub `null`).
  - A rejected call shows "Couldn't load details: …".
  - Switching jobs before the first answer arrives shows only the second job.
  - Pay and remote terms show once loaded.
- [X] T027 [US1] `DetailsPanel` calls `loadJobDetails` when a job opens:
  - "Loading…" shows until the answer arrives.
  - An answer for a job that's no longer open is ignored.
  - An error shows "Couldn't load details: …".
  - `null` shows "job not found".

  `JobSection` shows `pay` and `workplace` from the loaded details, falling back to the row.
- [X] T028 [US1] Check the PR's size. It is expected to be about 15 files; say so, and why, in the
  PR description.
- [X] T029 [US1] Per-PR flow steps 4–6: commit ("Load a job's details for its panel (011 PR 3)"),
  push, and open PR 3. **Wait for the owner.**

---

## Phase 4: User Story 2 - The panel explains the job and its score (Priority: P1)

**Goal**: the score with its parts and boost; the description and its origin; warnings; and every
score.

**Independent Test**: quickstart "PR 4" to "PR 6".

### Sitting S4, PR 4: score (T030–T035), branch `011-pr4-score`

- [X] T030 Per-PR flow steps 1–3, for sitting S4.
- [X] T031 [P] [US2] Unit tests in `tests/jobDetail.test.ts`:
  - An unscored job gives `score: null`.
  - A scored one gives `total` equal to the row's boosted score, `model` the stored score, `boost`
    the row's note, and base, bonus, reasons, gaps and `scoredAt`.
- [X] T032 [US2] Add `score` to `JobDetailView` in `src/web/api.ts` and `src/web/jobDetail.ts`,
  reusing `jobScore` from `src/web/rowViews.ts` (exported if it isn't already).
- [X] T033 [P] [US2] UI test in `tests/client/detailsPanel.test.tsx`:
  - The score section shows the total, model score, boost, base, bonus, reasons and gaps, or "not
    scored yet".
  - A reason containing `<script>` is shown as text.
- [X] T034 [US2] Create `web/components/panel/ScoreSection.tsx` and add it after the job section in
  `DetailsPanel`.
- [X] T035 [US2] Per-PR flow steps 4–6: commit ("Show a job's score in its panel (011 PR 4)"), push,
  and open PR 4. **Wait for the owner.**

### Sitting S5, PR 5: description (T036–T041), branch `011-pr5-description`

- [X] T036 Per-PR flow steps 1–3, for sitting S5.
- [X] T037 [P] [US2] Unit tests in `tests/jobDetail.test.ts`:
  - `description.text: null` when there's no description.
  - Requirements, skills and preferred skills are mapped.
  - `origin` is `{ kind: "careers", url }` for `description_source = "careers"`,
    `{ kind: "source" }` for `"source"`, and `null` with no description.
- [X] T038 [US2] Add `description` to `JobDetailView` in `src/web/api.ts` and
  `src/web/jobDetail.ts`.
- [X] T039 [P] [US2] UI test in `tests/client/detailsPanel.test.tsx`:
  - A careers-origin description shows its text, its requirements and skills, and "from the careers
    page" with a link.
  - A job without one says "no description found".
  - A description containing `<script>` is shown as text.
- [X] T040 [US2] Create `web/components/panel/DescriptionSection.tsx` and add it after the score
  section in `DetailsPanel`.
- [X] T041 [US2] Per-PR flow steps 4–6: commit ("Show a job's description and where it came from in
  its panel (011 PR 5)"), push, and open PR 5. **Wait for the owner.**

### Sitting S6, PR 6: warnings and history (T042–T050), branch `011-pr6-warnings-history`

- [X] T042 Per-PR flow steps 1–3, for sitting S6.
- [X] T043 [P] [US2] Contract case in `tests/helpers/jobDetailContract.ts`:
  `jobViews.jobVerdicts({ ats, jobId })` lists only that job's verdicts, newest first (`scored_at`
  then `id`, descending), the current one included; an unknown key gives `[]`.
- [X] T044 [US2] Add `jobVerdicts(key): Promise<VerdictView[]>` to `JobViews` in `src/db/store.ts`.
  Implement it in `src/db/kysely/jobViews.ts` through a private joined builder (verdicts
  left-joined to jobs), shared with `verdictHistory`, and in `tests/helpers/memoryJobViews.ts`.
- [X] T045 [P] [US2] Unit tests:
  - `tests/jobDetail.test.ts`: `warnings` holds the injection warning with its date when
    `injection_seen_at` is set, and is empty otherwise; `history` maps each verdict in order.
  - `tests/webRows.test.ts`: `loadDetailsFor` includes the job's verdicts.
- [X] T046 [US2] Add `warnings` and `history` to `JobDetailView` in `src/web/api.ts` and
  `src/web/jobDetail.ts`, and have `loadDetailsFor` also read `views.jobVerdicts`.
- [X] T047 [P] [US2] UI test in `tests/client/detailsPanel.test.tsx`:
  - The warning shows when present, and the Warnings section is absent otherwise.
  - The history lists every score, newest first.
- [X] T048 [US2] Create `web/components/panel/WarningsSection.tsx` and
  `web/components/panel/HistorySection.tsx`, and append them in `DetailsPanel`.
- [X] T049 [US2] Check the PR's size.
- [X] T050 [US2] Per-PR flow steps 4–6: commit ("Show a job's warnings and score history in its
  panel (011 PR 6)"), push, and open PR 6. **Wait for the owner.**

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T051 After PR 6 merges, run quickstart PR 6's SC-002 timing. Then, in a small docs PR, update
  `README.md` (the web UI section: the panel, the icon, `?job=`) and the test ledger below.

---

## Dependencies & Execution Order

- **S0 → S1 → S2 → S3 → S4 → S5 → S6**, each merged before the next starts.
- **US3:** the icon is in S1, and the title opening the panel is in S2.
- **US1:** S2, plus S3's loading so deep links work.
- **US2:** S3's pay and remote terms, then S4 to S6.

## Parallel Opportunities

Within a sitting, the [P] test tasks touch different files:
- S2: T010, T012.
- S3: T021, T023, T026.
- S4: T031, T033.
- S5: T037, T039.
- S6: T043, T045, T047.

## Parallel Example: S3

```text
Task: "T021 Contract cases tests/helpers/jobDetailContract.ts"
Task: "T023 Unit tests tests/jobDetail.test.ts, tests/webRows.test.ts"
Task: "T026 UI tests tests/client/detailsPanel.test.tsx"
```

## Implementation Strategy

1. **PR 1** (icon): the smallest visible change, which proves the flow.
2. **PR 2** (panel), the MVP: a working panel from row data.
3. **PR 3** (loading): links to any job work, and pay and remote terms show.
4. **PR 4–6**: the score, the description, then warnings and history. After PR 6 the panel is
   complete, and ready for the trace feature's "Path" section.

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (T002) | 449 | 41 (1 skipped without a browser) | 31 |
| Planned new | ~18 (T010, T021 and T043 on memory, T023, T031, T037, T045) | ~5 (T021, T043 on MariaDB) | ~6 (T005, T012, T026, T033, T039, T047) |
| After PR 6 (T051) | 473 (+24) | 45 (+4; 1 skipped without a browser) | 52 (+21) |

UI tests came out well above plan (+21 against ~6): each panel behaviour (opening, switching, the
three ways to close, deep links, loading and its failures, each section) is its own short
`RowsList` test, since the panel's wiring lives in React effects that unit tests can't reach. The
overall mix is now 83 / 8 / 9 (it was 86 / 8 / 6 at the baseline), so the UI share is above the
1% target. SC-002, measured on the live stack (2026-10-22, ten opens on All jobs, click to the
History section): median 72 ms, slowest 353 ms, against a 1-second target.
