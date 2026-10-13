---
description: "Task list for Exclude Publishers by Domain"
---

# Tasks: Exclude Publishers by Domain

**Input**: Design documents from `docs/specs/001-exclude-publisher-domains/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/exclude-publishers-config.md, quickstart.md

**Tests**: Included. The project works test-first: tests live in `tests/`, and `npm run check`
must pass before any task is done. Each test task is written to fail first. The implementation
task that follows makes it pass.

**Organization**: Tasks are grouped by user story (spec.md US1–US4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1–US4)

## Rules for every task

- **habit-hooks limits**: functions ≤ 12 lines, ≤ 3 parameters, complexity ≤ 10, nesting ≤ 4,
  files ≤ 200 lines, `===` only, `const` where possible, no inferrable type annotations.
- **Doc comments**: every new or changed function in `src/` gets a one-line `/** … */` comment
  stating its purpose as a full sentence. Add no other comments unless one explains a
  non-obvious *why*. Tests stay uncommented.
- **No unused code at any task boundary**: knip flags dependencies nothing imports and exports
  only tests use, and lint flags private functions nothing calls. Never leave `src/` with a helper
  that has no caller, an export with only a test caller, or `tldts` installed but not imported.
  The **atomic units** below exist for this reason: finish each one before stopping.
- **tldts**: only `src/jobs/publisherDomain.ts` imports it.
- **Do not commit.** The user wants to review the uncommitted diff.

---

## Phase 1: Setup

- [X] T001 Run `npm test` on the untouched tree to confirm vitest starts and passes before any
  feature work.

*There is no Foundational phase. On its own, the domain module would have no `src/` caller, so it
is built inside US1, which is the first story that wires it in.*

---

## Phase 2: User Story 1: Block a board by its exact domain (Priority: P1) 🎯 MVP

**Goal**: A plain entry such as `jobmesh.io` drops results whose apply link host is exactly that
domain, however the publisher name is spelled.

**Independent Test**: With `exclude_publishers: ["stripe.com"]`, refreshing the fixture search
stores only the LinkedIn result, and the log shows `skipped_publishers: 1`.

### Tests for User Story 1 (write first, confirm they fail)

- [X] T002 [P] [US1] Create `tests/publisherDomain.test.ts` with tests for
  `isDomainEntry(entry)`:
  - `true` for `jobmesh.io`, `*.trabajo.org` and `Remote.co`.
  - `false` for `dailyremote`, `stripe careers` and `foo bar.com`. Whitespace makes an entry a
    name entry.
  - Rule: "an entry is a domain entry if it contains a `.` and no whitespace".
- [X] T003 [US1] In `tests/publisherDomain.test.ts`, test `linkMatchesDomains(url, entries)` for
  plain entries. Each case as entry vs link gives the result shown:
  - `jobmesh.io` vs `https://jobmesh.io/job/1`: match
  - `JobMesh.IO` vs `https://jobmesh.io/job/1`: match
  - `jobmesh.io` vs `https://JobMesh.IO./x`: match
  - `jobmesh.io` vs `https://user@jobmesh.io:8443/a`: match
  - `bücher.de` vs `https://Bücher.DE/x`: match
  - `jobmesh.io` vs `jobmesh.io/job/1`: match. A link without a scheme is read by its host.
  - `jobmesh.io` vs `https://www.jobmesh.io/`: no match. A plain entry does not match
    subdomains.
  - `jobmesh.io` vs `https://notjobmesh.io/`: no match
  - `jobmesh.io` vs `https://jobmesh.io.example.com/`: no match
  - links `garbage`, `see jobmesh.io`, `/jobs/view/1` and `""`, each with entry `jobmesh.io`:
    no match
  - `["jobmesh.io", "JOBMESH.IO"]` (duplicate entries) vs `https://jobmesh.io/job/1`: match
  - an empty entry list: no match
- [X] T004 [P] [US1] In `tests/companyFilter.test.ts`:
  - Change the existing `isExcludedPublisher` calls to the new signature
    `isExcludedPublisher({ publisher, url }, excluded)`.
  - Add: publisher "JobMESH", url `https://jobmesh.io/job/1`, entries `["jobmesh.io"]` is
    excluded.
  - Add: publisher `null`, url `https://jobmesh.io/job/1`, entries `["jobmesh.io"]` is
    excluded. The `null` guard applies only to name entries.
- [X] T005 [P] [US1] In `tests/searchSources.test.ts`, add the test "JSearch results on an
  excluded domain are dropped before storing". It mirrors the existing excluded-publisher test,
  but uses `jsearch: { exclude_publishers: ["stripe.com"] }`, and expects:
  - only `jsearchId("js-linkedin-1")` is served
  - `unscoredForSource` has length 1
  - the last log event matches `{ job_count: 1, skipped_duplicates: 0, skipped_publishers: 1 }`

### Implementation for User Story 1 (atomic unit: T006–T009, finish all four before stopping)

- [X] T006 [US1] Add `tldts` exact-pinned at `7.4.18` to `dependencies` in `package.json`, and
  its entries to `package-lock.json`.
  - **Don't use a plain install.** `npm install --save-exact tldts@7.4.18`, even with
    `--package-lock-only`, drops the `@rolldown/binding-*` and `lightningcss-*` optional
    entries (npm/cli#4828).
  - **Steps instead:**
    1. Run that install once.
    2. Copy the generated `package-lock.json` aside.
    3. `git checkout package-lock.json`.
    4. Splice in only the root `dependencies` change and the `node_modules/tldts` and
       `node_modules/tldts-core` entries, keeping key order.
    5. Run `npm ci`.
  - **Expected result:** the lockfile diff is +19 lines, and 15 `@rolldown/binding-*` entries
    remain.
- [X] T007 [US1] Create `src/jobs/publisherDomain.ts`, importing `parse` from `tldts`:
  - `export function isDomainEntry(entry: string): boolean`, implementing the rule in T002.
  - `export function linkMatchesDomains(url: string, entries: string[]): boolean`. It reads
    `linkHost(url)`, returns `false` for a `null` host, and otherwise returns
    `entries.some((entry) => hostMatches(host, entry))`.
  - Private `linkHost(url)`, which is `parse(url).hostname`.
  - Private `entryHost(entry)`, which is `parse(entry).hostname`.
  - Private `hostMatches(host, entry)`. For now it only handles plain entries:
    `host === entryHost(entry)`.
- [X] T008 [US1] In `src/jobs/companyFilter.ts`, change `isExcludedPublisher` to
  `isExcludedPublisher(job: Pick<Job, "publisher" | "url">, excluded: string[]): boolean`.
  - Split `excluded` with `isDomainEntry`.
  - Return `(job.publisher !== null && matchesAnyName(job.publisher, names)) || linkMatchesDomains(job.url, domains)`.
  - Update its doc comment to cover both kinds.
  - Import `Job` as a type from `./job.js`.
- [X] T009 [US1] In `src/tools/searchFetch.ts`, change the filter in `refreshSearch` to pass
  `job` instead of `job.publisher`. No other change: the drop count stays
  `jobs.length - wanted.length`, so a result is counted once (FR-008).
  - Run T002–T005; they must pass.
  - Run `habit-hooks`; it must be clean, since this ends the atomic unit.

**Checkpoint**: plain domain entries work end to end. This is the MVP.

---

## Phase 3: User Story 2: Block a board and all its subdomains with a wildcard (Priority: P1)

**Goal**: `*.trabajo.org` drops results whose apply link host is `trabajo.org` itself or any
subdomain of it, at any depth (clarification option A).

**Independent Test**: With `exclude_publishers: ["*.linkedin.com"]`, the fixture's
`www.linkedin.com` result is dropped and the Stripe result is kept.

### Tests for User Story 2 (write first, confirm they fail)

- [X] T010 [P] [US2] In `tests/publisherDomain.test.ts`, test wildcard entries with
  `linkMatchesDomains`. Each case as entry vs link gives the result shown:
  - `*.trabajo.org` vs `https://trabajo.org/x`: match. The wildcard covers the bare domain.
  - `*.trabajo.org` vs `https://us.trabajo.org/job-1`: match
  - `*.trabajo.org` vs `https://jobs.eu.trabajo.org/`: match
  - `*.trabajo.org` vs `https://nottrabajo.org/`: no match
  - `*.trabajo.org` vs `https://trabajo.org.example.com/`: no match
- [X] T011 [P] [US2] In `tests/searchSources.test.ts`, add the test "a wildcard domain drops
  results on any subdomain". With `exclude_publishers: ["*.linkedin.com"]`, it expects only
  `jsearchId("js-dup-stripe")` to be served, and `skipped_publishers: 1`.

### Implementation for User Story 2

- [X] T012 [US2] In `src/jobs/publisherDomain.ts`, add a private `wildcardBase(entry)`. It returns
  the entry without its leading `*.`, or `null` for a plain entry.
  - Extend `hostMatches` so that a wildcard entry matches when
    `host === domain || host.endsWith("." + domain)`, where `domain` is
    `entryHost(wildcardBase(entry))`.
  - Keep each function ≤ 12 lines.
  - Run T010–T011; they must pass.

**Checkpoint**: the user's existing `*.trabajo.org` entry now works as a domain.

---

## Phase 4: User Story 3: Name entries keep working alongside domain entries (Priority: P2)

**Goal**: A mixed list behaves correctly. Name entries match only the publisher name, domain
entries match only the apply link host, and a result matched by both is counted once.

**Independent Test**: `["dailyremote", "*.trabajo.org", "jobmesh.io"]` drops DailyRemote by name,
and drops trabajo and jobmesh results by link. A domain entry never matches on the name.

### Tests for User Story 3

- [X] T013 [P] [US3] In `tests/companyFilter.test.ts`, add these cases. Each gives publisher,
  url and entries, then the result:
  - "DailyRemote", `https://example.com/j`, `["dailyremote", "*.trabajo.org"]`: excluded, by
    name, unchanged behaviour.
  - "Trabajo.org", `https://www.example.com/j`, `["trabajo.org"]`: kept. A domain entry does not
    match the name.
  - "LinkedIn", `https://www.linkedin.com/jobs/view/1`, `["dailyremote", "jobmesh.io"]`: kept.
  - "Remote.co", `https://www.example.com/j`, `["remote.co"]`: kept. An entry with a dot is read
    as a domain, which is the documented behaviour change.
- [X] T014 [P] [US3] In `tests/searchSources.test.ts`, add the test "a result matched by a name
  and a domain entry is counted once". With
  `exclude_publishers: ["stripe careers", "stripe.com"]`, it expects `skipped_publishers: 1` and
  `job_count: 1`.

### Implementation for User Story 3

- [X] T015 [US3] No new code is expected: T008's split already gives this behaviour. Run
  T013–T014. If any fail, fix `isExcludedPublisher` in `src/jobs/companyFilter.ts`, not the
  tests.

**Checkpoint**: existing name-only configs drop exactly what they did before (SC-003).

---

## Phase 5: User Story 4: Mistyped domain entries are rejected at startup (Priority: P3)

**Goal**: A malformed domain entry stops config loading with a message naming the entry.

**Independent Test**: `testFileConfig({ jsearch: { exclude_publishers: ["trabajo.*"] } })` throws
a message containing `"trabajo.*"`.

### Tests for User Story 4 (write first, confirm they fail)

- [X] T016 [P] [US4] In `tests/publisherDomain.test.ts`, test `isValidDomainEntry(entry)`:
  - `true` for `jobmesh.io`, `JobMesh.IO`, `trabajo.org.`, `*.trabajo.org`, `bücher.de` and
    `a_b.com`.
  - `false` for `trabajo.*`, `*trabajo.org`, `*.`, `a..b`, `-a.com`, `https://trabajo.org/`,
    `trabajo.org:443`, `*.com`, `co.uk`, `.com` and `1.2.3.4`.
- [X] T017 [P] [US4] In `tests/config.test.ts`, add the test "jsearch.exclude_publishers rejects
  malformed domain entries by name":
  - For each of `trabajo.*`, `https://trabajo.org/`, `trabajo.org:443` and `*.com`,
    `testFileConfig({ jsearch: { exclude_publishers: [entry] } })` throws a message containing
    the entry text.
  - `["dailyremote", "jobmesh.io", "*.trabajo.org"]` is accepted unchanged.
  - Keep the existing `--` letter-or-digit test as is.

### Implementation for User Story 4 (atomic unit: T018–T019)

- [X] T018 [US4] In `src/jobs/publisherDomain.ts`, add
  `export function isValidDomainEntry(entry: string): boolean`. Let `rest` be
  `wildcardBase(entry) ?? entry`. The entry is valid when both hold:
  1. `parse(rest).hostname` is not `null` and equals `rest.toLowerCase()` with one trailing dot
     removed.
  2. `parse(rest).domain` is not `null`.

  If US4 is built before US2, write `wildcardBase` here instead of in T012.
- [X] T019 [US4] In `src/config/schema.ts`, add
  `const publisherTerm = filterTerm.refine((entry) => !isDomainEntry(entry) || isValidDomainEntry(entry), { error: (issue) => ... })`.
  - The message is `` `"${issue.input}" is not a valid domain entry; use a host like "jobmesh.io" or "*.trabajo.org"` ``.
  - Use it in `jsearch.exclude_publishers: z.array(publisherTerm).default([])`.
  - Import both functions from `../jobs/publisherDomain.js`.
  - Run T016–T017; they must pass, and `habit-hooks` must be clean.

**Checkpoint**: all four stories work.

---

## Phase 6: Polish & Cross-Cutting

- [X] T020 [P] In `README.md`, update the `jsearch.exclude_publishers` settings-table row (line
  ~402) and the "Saved searches (JSearch)" paragraph (line ~422):
  - A plain domain entry (`"jobmesh.io"`) drops results whose apply link is on exactly that host.
  - A wildcard (`"*.trabajo.org"`) also covers the bare domain and every subdomain.
  - Any entry containing a dot is read as a domain, so `"remote.co"` matches by link, not by name.
  - Bad domain entries and bare public suffixes (`"*.com"`) stop the app at startup.
- [X] T021 Run `npm run check` (typecheck, vitest, habit-hooks) and fix every finding, including
  suggested ones. Do not snooze any.
- [X] T022 Run the manual checks in `docs/specs/001-exclude-publisher-domains/quickstart.md`
  that need no API spend:
  - the `sqlite3 -readonly` counts
  - a bad-entry startup check against a copy of the config (set `MYJOBBOT_DATA_DIR` to a
    scratch copy; never edit `data/config.json`)

  Skip `npm start -- run` unless the user approves the JSearch request. SC-001's live check
  stays deferred until then.
- [X] T023 Mark all completed tasks `[X]` in this file. Leave every change uncommitted and show
  the user `git diff` and `git status`.

---

## Dependencies & Execution Order

- **Setup (T001)** comes first.
- **US1 (T002–T009)** is the MVP and the base for every later story. T006–T009 form one atomic
  unit.
- **US2 (T010–T012)** needs `hostMatches` from T007.
- **US3 (T013–T015)** needs the T008 split. It can run alongside US2.
- **US4 (T016–T019)** needs US1. It shares `wildcardBase` with US2 (see T018). T018–T019 form one
  atomic unit.
- **Polish (T020–T023)** comes after all stories.

Within a story: write the tests and see them fail, then implement, then see them pass.

## Parallel Opportunities

- US1 tests: T002, T004 and T005 touch three different files. T003 follows T002 in the same file.
- US2 tests T010 and T011 can run in parallel.
- US3 tests T013 and T014 can run in parallel, and alongside US2.
- US4 tests T016 and T017 can run in parallel.
- T020 (README) can start as soon as the behaviour is settled.

Same-file conflicts to serialise:
- `tests/publisherDomain.test.ts`: T002, T003, T010, T016
- `tests/searchSources.test.ts`: T005, T011, T014
- `tests/companyFilter.test.ts`: T004, T013
- `src/jobs/publisherDomain.ts`: T007, T012, T018

## Implementation Strategy

1. **MVP**: Phases 1–2 (US1). A plain domain entry blocks a board by its apply link. Stop and
   check it with `npm run check`.
2. **Increment**: US2 (wildcards), which fixes the user's live `*.trabajo.org` entry.
3. **Increment**: US3 (mixed lists, confirming backward compatibility).
4. **Increment**: US4 (validation at startup).
5. **Polish**: README, then a full `npm run check`, then hand over the uncommitted diff.
