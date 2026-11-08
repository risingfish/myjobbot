# Implementation Plan: Each user's own data

**Branch**: `027-assign-data-to-first-user` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/027-assign-data-to-first-user/spec.md`

## Summary

- **The data**:
  - A posting stays one shared row in `jobs`.
  - Each user's view of it moves to a new `user_jobs`: when they saw it, which of their sources
    found it, their score, reasons and gaps, and their hidden and applied marks.
  - The verdict history and the re-score log gain a user.
  - The Gmail connection and alert state are keyed by user.
  - Four migration steps (`020`–`023`, one change each, the drop last) give everything that exists
    to user 1.
- **The stores**: `Stores` keeps only the shared stores; per-user stores come only from
  `stores.forUser(id)`, bound to that user, with no default, so a forgotten user fails typecheck.
- **The web**: every page, action and route uses the signed-in user's stores through `myStores()`;
  actions keep their own answers.
- **The run**: it works for every user with a source on, one after another, each with their own
  trace. Postings, their descriptions and careers lookups, company records and the JSearch budget
  stay shared.
- **The tools**: the CLI and evals take `--user <email>`, user 1 when left out.

## Technical Context

**Language/Version**: TypeScript 6.0.3 on Node 24

**Primary Dependencies**: Next.js 16.4, Kysely, zod (unchanged; no new dependency)

**Storage**: MariaDB 10.11 through Kysely. One new table, columns moved off `jobs`, and a `user_id`
added to `verdicts` and `rescore_runs`. Gmail's two tables are re-keyed by user.

**Testing**:
- vitest `node` (unit, memory stores), `dom` (UI) and `integration` (MariaDB, store contracts'
  strict cases, migration tests).
- The memory stores gain the same user binding.

**Target Platform**: the existing Docker stack and Kubernetes chart

**Project Type**: web service, CLI and scheduled agent run, in one repository

**Performance Goals**:
- For user 1 alone, page and run times stay as before (SC-005).
- Recommended's query stays indexed: `user_jobs (user_id, scored_at)`.

**Constraints**:
- Nothing is dropped before it is copied, and the step is safe to start twice (FR-006).
- No job data before sign-in (024).
- Production is backed up before the deploy that runs steps `020`–`023`.

**Scale/Scope**:
- 2–5 users and roughly 10k postings.
- About 60 source files touched: stores, run, tools, web loaders and actions.

## Constitution Check

Checked against constitution **2.6.0**.

| Principle | Status |
|---|---|
| I. Habit-hooks clean | ✅ Each sitting ends green. Modules keep one responsibility each (R14), which also keeps files under 200 lines. S1 binds the stores to user 1 before any caller changes, so every intermediate state still serves user 1 (tasks rule 4, "swap behind an interface"). |
| II. Test-first, 95/4/1 | ✅ Decisions stay in plain functions with unit tests (`usersToRun`, the run lines, `--user` parsing, the pruning rule). Store behaviour goes through the contracts: every case on memory, the strict ones on MariaDB. The migration has an integration test. Split below. |
| III. Purpose comments | ✅ |
| IV. Libraries their way | ✅ The migration uses Kysely's schema builder and `insertInto().expression(selectFrom…)` for the copy, with `sql` only for `tinyint`. No new dependency. |
| V. docs/specs | ✅ |

**Stack**: stopped for all four sittings. S1 adds a migration, S3 changes the run, and S2 and S4
change server code and stores, so none of them is UI-only work.

### New tests and their split (estimate)

| Kind | Count | What |
|---|---|---|
| Unit | 32 | the `user_jobs` contract cases on memory (an alert for another user's posting gives a view with no second lookup, the plain-text-to-Markdown re-score rule for two users, a user sees only their rows and labels, marks are per user, a shared posting scored separately, a refresh without a description keeps it, Gmail and alerts per user, clean-up keeps applied and keeps postings another user has); `forUser` binding; `usersToRun` and skip reasons; the run lines; the resume file for user 1 only; the budget checks across users (turning on, saving, the alert-lookup reserve); `--user` parsing and refusals; each web loader and action reading the signed-in user through `myStores()`, an admin included; a source scan that no `web/` or `src/app/` file names `OWNER_ID` |
| Integration | 4 | migrations `020`–`023` on a 019-shaped database (copy to user 1, types, FKs dropped and added, columns dropped, keys and indexes); strict contract cases: two users upserting the same posting at once, re-score `begin` locking per user, clean-up never deleting a posting another user still has |
| UI | 0 | the empty state a new account sees already has a test (`tests/client/rowsList.test.tsx`) |

That is about 89% unit and 11% integration for this feature; the whole suite stays near the 95/4/1
target.

## Project Structure

### Documentation (this feature)

```text
docs/specs/027-assign-data-to-first-user/
├── spec.md
├── plan.md
├── research.md        # R1–R13 (and R11b)
├── data-model.md
├── contracts/cli.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md           # /speckit-tasks
```

### Source Code (repository root)

```text
src/db/
├── migrations/020_user_jobs.ts, 021_history_owners.ts, 022_gmail_by_user.ts,
│   023_jobs_without_user_columns.ts, index.ts
├── schema/jobs.ts (JobsTable shrinks, UserJobsTable, verdicts.user_id),
│   schema/rescore.ts (user_id), schema/gmail.ts (user_id), schema.ts
├── store.ts                             # Stores: a container of shared stores + forUser
├── userStores.ts                        # composes UserStores only
├── postingStore.ts                      # PostingStore: known, setDescription, flagInjection, linkUnlinkedJobs, earliestSeen, prune
├── sourceStore.ts, searchSettingsStore.ts, resumeStore.ts   # each gains its own bound User…Store
├── accountStore.ts                      # + userIds()
└── kysely/
    ├── jobStore.ts (split: postingWrites.ts), jobViews.ts   # bound to a user; posting + user_jobs
    ├── postingStore.ts                  # the shared posting and its lifecycle
    ├── sourceStore.ts                   # replaceSource on user_jobs; scheduledOnForAll
    ├── rescoreLogStore.ts, gmailStore.ts, alertStore.ts   # bound to a user
    └── stores.ts
src/app/
├── runAll.ts                            # the loop over users
├── run.ts                               # runForUser: one user's run
├── usersToRun.ts                        # who runs, skip reasons (pure)
├── runLines.ts                          # how each user's outcome reads, the exit code (pure)
└── runSettings.ts, beforeAgent.ts       # the user's settings and resume
src/sources/fetchPhase.ts, src/gmail/connection.ts, src/gmail/alertStore.ts, src/gmail/alertLookupStep.ts, src/config/resolve.ts
src/web/saveSource.ts, src/web/sourceRules.ts, src/web/resumeView.ts, src/app/importSqlite.ts
src/cli.ts, src/cliUser.ts               # --user parsing and lookup
src/rescore/, src/evals/ (command.ts)    # take UserStores; cases record userId
web/lib/myStores.ts                      # myStores(): the signed-in user's stores
src/config/resumeFile.ts                 # ownsResumeFile: data/resume.md is user 1's
web/lib/{uiState,pages,rows,resumeRows,actions,settingsActions,sourceActions,gmailActions,resumeActions}.ts
web/app/api/rescores/[id]/route.ts
scripts/copy-prod.sh                     # unchanged list; verified against new tables
tests/helpers/memoryStore.ts (split), memoryJobViews.ts, memoryPostingStore.ts, …   # shared + forUser, ownerStores()
tests/helpers/storeContract.ts (+ userJobContract cases)
tests/integration/userJobsMigration.test.ts   # the four steps
```

**Structure Decision**: Per-user scoping lives in the stores (bound at creation), so the run's
tools, the rescore and eval code and the web keep their current calls on whichever stores they are
handed. The shared tables keep their stores unbound. Each module has one job (R14): the posting is
its own shared store, each cross-user listing sits on its owning store, `Stores` is only a
container, and the run's loop, selection and output wording are separate files.

## Sittings (detailed in tasks.md)

| Sitting | Delivers | Stack |
|---|---|---|
| S1 data and stores | migrations `020`–`023`, schema, `PostingStore`, `Stores` split into shared + `forUser`, `import-sqlite` split, every caller handed user 1's stores; behaviour unchanged (US1) | stopped |
| S2 the web | `myStores()` and every loader, action and route on the signed-in user; isolation tests; Gmail per user on Settings (US2, US4) | stopped |
| S3 runs | `runAll` and `runForUser`, skip reasons, per-user traces, shared postings and lookups, per-user Gmail alerts, shared budget, clean-up across users (US3, US4) | stopped |
| S4 tools and docs | `--user` for run, rescore and evals; README, CLAUDE.md, quickstart walk (US5) | stopped |

One PR at the end (the owner's choice for 025), unless the owner asks for one per sitting.

## Complexity Tracking

None.
