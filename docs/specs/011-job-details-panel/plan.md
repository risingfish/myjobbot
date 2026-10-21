# Implementation Plan: Job details panel

**Branch**: `011-job-details-panel` (planning); each PR gets its own branch from `main` |
**Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/011-job-details-panel/spec.md`

## Summary

The job title stops leaving the app. It opens a **non-modal** `<dialog>` panel that slides in from
the right, about 60% of the window wide, over the Recommended and All jobs tables. The list stays
usable: clicking another title switches the panel, and Hide still works. The open job lives in the
address (`?job=<ats>:<jobId>`, via Next.js-supported `history.pushState`).

The panel fetches one job's details through a server action, `loadJobDetails`, which delegates to
`loadDetailsFor` in `web/lib/rows.ts`. That reads `JobViews.jobDetail` and `jobVerdicts` (Kysely
query builder) and shows them in named sections: Job, Score, Description, Warnings and History. The
later categorizer trace slots in as one more section.

A new external-link icon left of Hide keeps the posting one click away. Delivery is a docs PR, then
**six small code PRs**, one sitting each, each tested in the UI before the next.

## Technical Context

**Language/Version**: TypeScript on Node 24; Next.js 16 (App Router), React 19.

**Primary Dependencies**: existing only. The icon is inline SVG, and the panel is the native
`<dialog>`.

**Storage**: MariaDB through Kysely. It only gains reads; no migration.

**Testing**: vitest. Unit tests use memory views, the contract runs on MariaDB under `check:db`,
and UI tests use happy-dom with `next/navigation.js` mocked.

**Target Platform**: the web container on roboto, viewed in a desktop browser (narrow windows
supported).

**Project Type**: Next.js web UI inside the agent's repo.

**Performance Goals**:
- Details within 1 second (SC-002): a primary-key read plus one verdict query, timed in quickstart
  PR 6.
- Rows unchanged (SC-005).

**Constraints**:
- Habit-hooks limits apply; `tests/helpers/memoryStore.ts` is near 200 lines.
- Job text is always rendered as text (FR-011).
- About 10 files per PR.

**Scale/Scope**: 2 pages, 1 panel, 5 sections, 2 reads, 1 server action, 6 code PRs.

## Constitution Check

*Checked against constitution v2.3.0.*

| Principle | How this plan complies |
|---|---|
| I. Habit-hooks clean | Each PR's sitting ends green, and each new module is wired in its PR. **PR 1:** the icon is rendered in rows. **PR 2:** the panel by `RowsList`. **PR 3:** the read, `loadDetailsFor` and the action are called by the panel. **PR 4–5:** the sections are rendered by the panel. **PR 6:** the verdict read is called by `loadDetailsFor`. |
| II. Test-first, checked | Each sitting writes its tests before its code. **Split:** about 18 unit, 5 integration and 6 UI. **Gate:** `check` and `check:db` per PR. |
| III. Purpose comments | On every new function and component. |
| IV. Bounded deps, used their own way | No new dependency. Next.js server actions, and `pushState` with `useSearchParams`, as its docs describe; the Kysely query builder; the native `<dialog>`. |
| V. docs/specs | This directory. |
| Development Workflow | The workflow says the stack stays stopped "until the feature is merged". Here the owner chose (spec "Delivery") to merge 011 one PR at a time, so **each merged PR is a merge point**. The stack stops before each PR's branch and is rebuilt after it merges, so the owner can test that PR. A PATCH note in the constitution can make this general if the owner wants. |

Result: **PASS**.

## Project Structure

### Documentation

```text
docs/specs/011-job-details-panel/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/job-details.md
└── checklists/requirements.md
```

### Source Code, by PR

```text
PR 1 (S1): posting icon                                         about 4 files
  web/components/common/PostingLink.tsx    NEW
  web/components/pages/RowsList.tsx             action cell: PostingLink, then HideButton
  web/app/styles.css                            inline action cell
  tests/client/hide.test.tsx                    + icon cases (UI)

PR 2 (S2): the panel                                            about 11 files
  web/lib/jobParam.ts                      NEW  parseJobParam, jobParam, withJob
  web/lib/useOpenJob.ts                    NEW  ?job= state through pushState, null-safe
  web/components/panel/{DetailsPanel,PanelSection,JobSection}.tsx   NEW
  web/components/tables/TitleCell.tsx           title → withJob link (useOpenJob)
  web/components/pages/RowsList.tsx             DetailsPanel on job pages only
  web/app/styles.css                            .details-panel
  tests/jobParam.test.ts (unit), tests/client/detailsPanel.test.tsx (UI)
  tests/client/jobRow.test.tsx                  title-link test rewritten

PR 3 (S3): loading the details                                  about 15 files (see research R8)
  tests/helpers/memoryJobViews.ts          NEW  MemoryJobViews moved out of memoryStore.ts
  src/db/store.ts, src/db/rows.ts, src/db/kysely/jobViews.ts        jobDetail read
  tests/helpers/jobDetailContract.ts NEW (+ both storeContract runners)
  src/web/api.ts, src/web/jobDetail.ts NEW, src/web/pageData.ts (export rowContext)
  web/lib/rows.ts (loadDetailsFor), web/lib/actions.ts (loadJobDetails)
  web/components/panel/{DetailsPanel,JobSection}.tsx                fetch, pay, workplace
  tests/jobDetail.test.ts NEW, tests/webRows.test.ts, tests/client/detailsPanel.test.tsx

PR 4 (S4): score                                                about 5 files
  src/web/api.ts, src/web/jobDetail.ts          score (total, model, boost, parts)
  web/components/panel/ScoreSection.tsx    NEW
  tests/jobDetail.test.ts, tests/client/detailsPanel.test.tsx

PR 5 (S5): description                                          about 5 files
  src/web/api.ts, src/web/jobDetail.ts          description, origin
  web/components/panel/DescriptionSection.tsx   NEW
  tests/jobDetail.test.ts, tests/client/detailsPanel.test.tsx

PR 6 (S6): warnings and history                                 about 10 files
  src/db/store.ts, src/db/kysely/jobViews.ts, tests/helpers/memoryJobViews.ts   jobVerdicts
  tests/helpers/jobDetailContract.ts, web/lib/rows.ts, src/web/jobDetail.ts, src/web/api.ts
  web/components/panel/{WarningsSection,HistorySection}.tsx   NEW
  tests/jobDetail.test.ts, tests/webRows.test.ts, tests/client/detailsPanel.test.tsx
```

**Structure Decision**:
- Panel components go in `web/components/panel/`.
- Pure logic goes in `web/lib/jobParam.ts` and `src/web/jobDetail.ts`.
- Validation and reads go in `web/lib/rows.ts`, beside `loadRows`.
- The new reads go in `JobViews`.

## Sittings and PRs (outline for /speckit-tasks)

Each sitting is one PR:
1. Stop the stack.
2. Branch from an up-to-date `main`.
3. Write the tests, then the code.
4. Run `check` and `check:db`.
5. Push and open the PR.
6. **Stop until the owner merges and tests it.**
7. After the merge, rebuild the stack.

The sittings:
- **S0:** the docs-only PR.
- **S1:** PR 1, the posting icon (US3).
- **S2:** PR 2, the panel (US1, and US3's title change).
- **S3:** PR 3, loading the details (US1 deep links, US2's pay and remote terms).
- **S4:** PR 4, the score (US2).
- **S5:** PR 5, the description (US2).
- **S6:** PR 6, warnings and history (US2).

## Risks

- **A non-modal dialog isn't a full modal:** Escape, the outside click and focus are this
  feature's own code. Unit and UI tests cover the listeners in happy-dom, and the real focus and
  layout are checked by hand per quickstart.
- **Deep links in PR 2:** a job not in the loaded rows shows "job not found" until PR 3. This is
  noted in PR 2's description.
- **PR 3's size:** about 15 files, mostly store plumbing. It's called out in the PR description.
