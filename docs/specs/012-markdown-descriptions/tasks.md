---
description: "Tasks for feature 012: Markdown job descriptions, delivered as small PRs"
---

# Tasks: Markdown job descriptions

**Input**: Design documents from `docs/specs/012-markdown-descriptions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/descriptions.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind and file,
and the existing tests and fixtures its change breaks, which are updated in the same task.

**Organization**: by user story, in sittings. **Each sitting is one pull request** (spec "Delivery",
research R9): nine code PRs ordered so every reader of a description, and the re-scoring rule,
handle Markdown before any source writes it, then a docs PR.

- **Per-PR flow** (each sitting's first and last tasks):
  1. Check `docker compose top myjobbot` shows no run in progress, then
     `docker compose --profile browser stop` (`web` mounts `./web` and `./src` live).
  2. `git switch main && git pull --ff-only && git switch -c <branch>`.
  3. Create `.specify/sitting-in-progress` naming the sitting; write the tests, then the code.
  4. Run `npm run check` and `npm run check:db`, check the size (`git diff --stat main`), and delete
     the marker.
  5. Commit and push with no attribution lines, and open the PR with no footer. Its description
     lists that PR's quickstart steps.
  6. **Stop, and wait for the owner to merge and test it.** Then `npm run docker:up` and
     `docker compose --profile browser up -d browser`.
- **Size**: about 10 files per PR, tests included. Past about 12, tell the owner before opening it.
- **Boards need a configured company** to show their conversion (no companies are configured today);
  the PR descriptions for PRs 6–8 say so, per quickstart.
- **Libraries their own way** (constitution 2.3.0):
  - turndown through `TurndownService` options, `remove`, `addRule` and an `escape` override (its
    documented extension points), never by post-processing its output with string fixes;
  - react-markdown through `skipHtml`, `allowedElements`, `unwrapDisallowed`, `urlTransform` and
    `components`; never `dangerouslySetInnerHTML`, never `rehype-raw`;
  - Kysely's schema builder for migration 007, its query builder for the data step, and `eb.case()`
    for the re-scoring rule.
- **Pins**: `turndown` `7.2.4`, `react-markdown` `10.1.0`, `@types/turndown` `5.0.6` (dev), exact,
  installed through the lockfile in the sitting of their first import; check the lockfile keeps its
  optional platform entries.
- **Outside text** (feature 009): the model's copy of a description stays inside the run's data
  markers; `get_job_details` and `open_link` already declare `outsideText: true`
  (`tests/toolDeclarations.test.ts`), and the loop's tests show declared tools are wrapped.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3 from spec.md

---

## Phase 1: Setup

### Sitting S0: planning docs PR (T001–T003), branch `012-markdown-descriptions`

- [X] T001 Per-PR flow step 1 (the stack may be running: stop it first). Create
  `.specify/sitting-in-progress` naming S0.
- [X] T002 Run `npm run check` and `npm run check:db` and record the counts in the ledger below.
- [X] T003 Delete the marker, and commit only `docs/specs/012-markdown-descriptions/` ("Plan Markdown
  job descriptions (012)"). Push it and open a docs-only PR. **Wait for the owner to merge it.**

---

## Phase 2: Foundational - every reader handles Markdown before any source writes it

### Sitting S1, PR 1: the format column (T004–T011), branch `012-pr1-description-format`

- [X] T004 Per-PR flow steps 1–3, for sitting S1.
- [X] T005 [P] Integration test in `tests/integration/migrate.test.ts`: on a database migrated to
  006, seed a job with a description and one without through a Kysely `insertInto("jobs")` (not
  `upsertAll`, which writes the new column), run 007, and check `jobs.description_format` is
  `'text'` and null. Update the exact migration lists at `tests/integration/migrate.test.ts:56` and
  `:77` to include `007_description_format`.
- [X] T006 [P] Contract cases in `tests/helpers/descriptionContract.ts` (memory and MariaDB): an
  upserted job with a description stores `description_format` `'text'` by default and one without
  stores null; an upsert with `descriptionFormat: "markdown"` stores `'markdown'`; `findJob`,
  `jobViews.allJobs` and `jobViews.jobDetail` return it; `setDescription` stores `'text'`.
- [X] T007 Create `src/db/migrations/007_description_format.ts` with
  `db.schema.alterTable("jobs").addColumn("description_format", "varchar(16)")` and a data step
  `db.withTables<...>().updateTable("jobs").set({ description_format: "text" }).where("description",
  "is not", null)`; list it in `src/db/migrations/index.ts`; add `description_format: Text` to
  `src/db/schema.ts`. Rule (data-model.md): "`description_format` is null exactly when `description`
  is null", except rows copied by `import-sqlite` (null format, read as `'text'`).
- [X] T008 In `src/jobs/job.ts`, add `descriptionFormat: "markdown" | "text"` to `Job` with `"text"`
  in `NO_DETAILS` (`JobDetails` is an `Omit` of `Job`). In `src/db/rows.ts`, add it to
  `DetailFields`, write `description_format` in `toParams` (null with no description), and add it to
  `jobRowSchema` and `jobViewSchema` as `z.enum(["markdown", "text"]).nullable()`. In
  `src/db/kysely/jobViews.ts`, add `description_format` to `JOB_COLUMNS` (the views select a fixed
  column list).
- [X] T009 In `src/db/kysely/jobStore.ts`, add `description_format` to `REFRESHED`, and have
  `setDescription` write `description_format: "text"` (a constant until S3); mirror both in
  `tests/helpers/memoryStore.ts`. `src/gmail/alertStore.ts`'s `alertJobRecord` copies
  `match.descriptionFormat` with the description, with one assertion added to its existing test in
  `tests/gmailAlerts.test.ts` (or wherever `alertJobRecord` is tested).
- [X] T010 Run the touched tests, then `npm run check` and `npm run check:db`.
- [X] T011 Per-PR flow steps 4–6: commit ("Record each job description's format (012 PR 1)"), push,
  open PR 1 (quickstart "PR 1"). Expect about 12 files; say so if more. **Wait for the owner.**

### Sitting S2, PR 2: the readable copy (T012–T018), branch `012-pr2-readable-copy`

- [X] T012 Per-PR flow steps 1–3, for sitting S2.
- [X] T013 [P] [US1] Unit tests in a new `tests/readable.test.ts`: `readableDescription` turns
  `[Apply here](https://x.example/a)` into `Apply here`, including link words that span two lines;
  leaves escaped `\[not a link\]`, `\<b>` and a code span containing `]` alone; returns `'text'` and
  null-format descriptions unchanged (including one containing `[a](b)`); returns null for null.
- [X] T014 [US1] Create `src/descriptions/readable.ts` (`readableDescription(description, format)`,
  contract "Readable copy").
- [X] T015 [P] [US1] Unit tests: in `tests/getJobDetails.test.ts`, a `'markdown'` job's description
  reaches the model with its link words and no addresses (wrapping is the loop's job, FR-006); in
  `tests/pageData.test.ts`, next to "boosts count matches in the description", a Markdown
  description whose only "aws" is in a link address earns no "aws" boost, while the word in its text
  does (FR-010).
- [X] T016 [US1] Use `readableDescription` in `src/tools/getJobDetails.ts` (before the
  6,000-character cut), `src/web/rowViews.ts` (`scoreBoost`) and `src/web/pageData.ts`
  (`recommendedJobs`).
- [X] T017 [US1] Run the touched tests, then `npm run check` and `npm run check:db`.
- [X] T018 [US1] Per-PR flow steps 4–6: commit ("Give the model and boosts descriptions without link
  addresses (012 PR 2)"), push, open PR 2 (quickstart "PR 2"). **Wait for the owner.**

### Sitting S3, PR 3: the careers lookup's board path keeps a description's format (T019–T025), branch `012-pr3-careers-board-format`

- [X] T019 Per-PR flow steps 1–3, for sitting S3.
- [X] T020 [P] [US1] Unit tests in `tests/careersBoardPages.test.ts`: a board job page whose posting
  has a `'markdown'` description gives the model the title, location and `readableDescription` (no
  link addresses), and carries `description: { text: <the Markdown>, format: "markdown" }`; a
  `'text'` posting gives today's page text and `format: "text"`; a blank Workday description counts
  as none; a careers page (job list) carries no description. Update `asRead` in
  `tests/helpers/careersPages.ts:42-43` for the new `PageRead.description` field.
- [X] T021 [P] [US1] Unit tests: in `tests/careersOutcome.test.ts`, a found lookup returns the job
  page's `description` with its format, and a downloaded page (no `description` yet) returns its
  page text as `'text'` (update the `jobPage` literal at `tests/careersOutcome.test.ts:7`); in
  `tests/careersLookup.test.ts` (next to its storage cases at `:16`, `:149`), a found lookup stores
  that description with its format. Contract case in `tests/helpers/descriptionContract.ts`:
  `setDescription` stores `found.format`. Add `format` to the existing `setDescription` calls at
  `tests/getJobDetails.test.ts:39`, `tests/helpers/jobDetailContract.ts:16` and
  `tests/helpers/descriptionContract.ts:22`.
- [X] T022 [US1] Add `format: "markdown" | "text"` to `FoundDescription` in `src/db/store.ts`, and
  store it in `setDescription` (`src/db/kysely/jobStore.ts`, `tests/helpers/memoryStore.ts`). In
  `src/careers/boardPages.ts`, carry the board posting's `descriptionFormat`, treat a blank
  description as none, build the model's text with `readableDescription`, and return
  `description: { text, format }` for job pages. Add
  `description: { text: string; format: "markdown" | "text" } | null` to `PageRead` in
  `src/careers/readPage.ts` (null for downloads and careers pages until S9).
- [X] T023 [US1] Keep the description on `session.jobPage` (`src/careers/session.ts`,
  `src/careers/tools.ts`); `src/careers/outcome.ts` returns it (falling back to the page text as
  `'text'`); `src/careers/lookUpJob.ts` stores it with its format.
- [X] T024 [US1] Run the touched tests, then `npm run check` and `npm run check:db`.
- [X] T025 [US1] Per-PR flow steps 4–6: commit ("Keep a board description's format in the careers
  lookup (012 PR 3)"), push, open PR 3 (quickstart "PR 3"). Expect about 13 files; say so.
  **Wait for the owner.**

### Sitting S4, PR 4: showing Markdown (T026–T033), branch `012-pr4-markdown-display`

- [X] T026 Per-PR flow steps 1–3, for sitting S4.
- [X] T027 [P] [US3] Unit tests in a new `tests/markdownDisplay.test.ts` (US2, US3):
  `markdownHref` keeps `https://` and `http://` addresses and returns `""` for `javascript:`,
  `JavaScript:`, `data:`, `vbscript:`, `mailto:`, relative and malformed addresses;
  `descriptionHeading` maps 1 and 2 → `h4`, 3 → `h5`, 4–6 → `h6`.
- [X] T028 [US3] Create `web/lib/markdown.ts` (`markdownHref`, `descriptionHeading`, contract
  "Display").
- [X] T029 [P] [US1] Two UI tests in `tests/client/panelSections.test.tsx`:
  - a `'markdown'` description shows its heading as an `h4`, a list, bold and italic with no `##` or
    `**` visible, and an `https://` link with `target="_blank"`, `rel="noopener noreferrer"` and
    `referrerpolicy="no-referrer"`;
  - hostile Markdown (raw `<script>`, `<form>` and `<iframe>`, `![x](https://t.example/p.png)`,
    `[a](javascript:alert(1))`, `[b](data:text/html,x)`, `<javascript:alert(1)>`) renders no script,
    form, iframe or image, and no link with those addresses (their words may remain).

  Update the existing tests the new `format` field breaks: `tests/jobDetail.test.ts:44,49` (the
  `toEqual` on `DescriptionDetail`), `tests/helpers/panelPage.tsx:12`, and the `CAREERS` literal at
  `tests/client/panelSections.test.tsx:32`, which also gains a `'text'` description containing
  `## x`, `**y**` and `- z` with assertions that it renders no `h4`, `strong` or `li` (FR-004,
  FR-011; the UI test count stays 2 new).
- [X] T030 [US1] Install `react-markdown@10.1.0` (exact). Create
  `web/components/panel/MarkdownText.tsx` per contract "Display" (a `details-markdown` wrapper, using
  `web/lib/markdown.ts`); add `format` to `DescriptionDetail` in `src/web/api.ts` and
  `src/web/jobDetail.ts`; `web/components/panel/DescriptionSection.tsx` uses `MarkdownText` for
  `'markdown'` and today's text paragraph otherwise.
- [X] T031 [US1] In `web/app/styles.css`, style `.details-markdown` headings (`h4`–`h6`, overriding
  `.details-section h4`), lists, block quotes, code and links (wrapping long words and addresses,
  like `.details-text`).
- [X] T032 [US1] Run the touched tests, then `npm run check` and `npm run check:db`.
- [X] T033 [US1] Per-PR flow steps 4–6: commit ("Show Markdown descriptions safely in the panel
  (012 PR 4)"), push, open PR 4 (quickstart "PR 4", including the step to configure boards before
  PRs 6–8). **Wait for the owner.**

### Sitting S5, PR 5: scoring again once (T034–T038), branch `012-pr5-rescore-once`

- [X] T034 Per-PR flow steps 1–3, for sitting S5.
- [X] T035 [P] [US2] Contract cases in `tests/helpers/descriptionContract.ts` (memory and MariaDB,
  FR-014): a scored `'text'` job upserted again as `'markdown'` gets `scored_at` null with its score,
  reasons and gaps kept; so does a scored job stored with no description (null format) that is
  upserted with a Markdown one; upserting the same Markdown again
  after re-scoring leaves `scored_at` set; a `'text'` to `'text'` upsert leaves it set.
- [X] T036 [US2] In `src/db/kysely/jobStore.ts`'s `upsertAll`, add `scored_at` to the duplicate-key
  update as an `eb.case()` (stored format `'text'` or null and `VALUES(description_format)`
  `'markdown'` → null, else `scored_at`), placed **before** `description_format` (research R6);
  mirror it in `tests/helpers/memoryStore.ts`.
- [X] T037 [US2] Run the touched tests, then `npm run check` and `npm run check:db`.
- [X] T038 [US2] Per-PR flow steps 4–6: commit ("Score a job again when its description first becomes
  Markdown (012 PR 5)"), push, open PR 5 (quickstart "PR 5"). **Wait for the owner.**

**Checkpoint**: every reader handles Markdown and the re-scoring rule is in place; nothing stored is
Markdown yet.

---

## Phase 3: User Story 2 - Nothing in a description can harm the owner or the app (Priority: P1)

**Goal**: HTML becomes Markdown under the allow-list, starting with Ashby.

**Independent Test**: the hostile test set passes; quickstart "PR 6" with an Ashby company.

### Sitting S6, PR 6: the conversion and Ashby (T039–T046), branch `012-pr6-convert-ashby`

- [X] T039 Per-PR flow steps 1–3, for sitting S6.
- [X] T040 [P] [US2] Unit tests in a new `tests/markdown.test.ts` (the hostile set, SC-002), as
  `test.each` tables, one row per contract line:
  - kept: ATX headings, nested `-` lists, bold, italic, inline code, a fenced code block (and one
    containing backticks, fenced longer), a block quote, `---`, `[words](https://…)` with
    `(`/`)`/spaces in the address percent-encoded;
  - removed with contents: each element in contract "Removed with their contents", comments, and
    `img` (by rule); `<pre><code>a<script>b</script></code></pre>` keeps `a` and not `b`;
  - unwrapped: `div`, `span`, `table`, `font`, `aside`; `onclick` and `style` leave no trace;
  - links with `javascript:`, `data:`, `mailto:` and relative addresses become their words; a link
    with no words becomes nothing; `Wow!` right before a link keeps the link (escaped `\!`);
  - text reading `<script>alert(1)</script>` and `<https://aws.example.com>` stays escaped text;
    Markdown-looking text (`# not a heading`, `C*`, `snake_case`) shows as written;
  - broken HTML (unclosed, stray closers) keeps all its text; blank paragraphs, items and headings
    are dropped; `<li><img></li>` leaves at most a bare `-`; nothing readable gives null; outside
    code there is no unescaped `<`.
- [X] T041 [US2] Install `turndown@7.2.4` and `@types/turndown@5.0.6` (dev), exact. Create
  `src/descriptions/toMarkdown.ts`: a factory building a configured `TurndownService` (research R1:
  options, `remove`, the image, link and code-block rules, the `escape` override) and
  `htmlToMarkdown(html): string | null` on the base service.
- [X] T042 [P] [US2] Unit tests in a new `tests/descriptionCap.test.ts`: `capDescription` leaves text
  at or under 20,000 characters alone, cuts `'text'` at the limit, and cuts `'markdown'` at the last
  newline before it (FR-008).
- [X] T043 [US2] Create `src/descriptions/cap.ts` (`capDescription`) and use it in `makeJob`
  (`src/jobs/job.ts`).
- [X] T044 [P] [US2] Unit test in `tests/sources.test.ts`: an Ashby posting's `descriptionHtml` with
  a heading, a list and a script becomes a `"markdown"` description with the heading and list and no
  script; a posting without it has no description. Add `descriptionHtml` to
  `tests/fixtures/ashby.json`, and send it from `ashbyBoard` in `tests/helpers/boardData.ts:15`. The
  careers tests using it (`tests/careersReadPage.test.ts:29`, `tests/careersBoardPages.test.ts:39`,
  `tests/careersLookup.test.ts:154`) match loosely and may need no change; run them.
- [X] T045 [US2] In `src/sources/ashby.ts`, read `descriptionHtml` (no longer `descriptionPlain`)
  and store `htmlToMarkdown` with `descriptionFormat: "markdown"`.
- [X] T046 [US2] Run the touched tests, then `npm run check` and `npm run check:db`; per-PR flow
  steps 4–6: commit ("Convert job descriptions to Markdown, starting with Ashby (012 PR 6)"), push,
  open PR 6 (quickstart "PR 6"), noting an Ashby company must be configured to see it. Expect about
  12 files. **Wait for the owner.**

### Sitting S7, PR 7: Greenhouse and Workday (T047–T051), branch `012-pr7-greenhouse-workday`

- [X] T047 Per-PR flow steps 1–3, for sitting S7.
- [X] T048 [P] [US2] Unit tests: in `tests/sources.test.ts`, Greenhouse's escaped `content`
  (`&lt;h2&gt;…`) becomes Markdown with the heading, decoded once (an escaped `&amp;lt;script&amp;gt;`
  stays the escaped words `<script>`, never a tag), replacing the plain-text expectation at
  `tests/sources.test.ts:18`; in `tests/careersWorkday.test.ts`, Workday's raw `jobDescription`
  becomes Markdown **without decoding first** (text `&lt;b&gt;` stays the words `<b>`), a blank one
  gives none, and one over 20,000 characters is cut by `capDescription`, updating the `toEqual` at
  `tests/careersWorkday.test.ts:25`.
- [X] T049 [US2] In `src/sources/htmlText.ts`, export `decodeEntities` and delete
  `escapedHtmlToText`; `tests/htmlText.test.ts` keeps only decoding cases. `src/sources/greenhouse.ts`
  converts `decodeEntities(content)`; `src/sources/workday.ts`'s `workdayPosting` converts
  `jobDescription` as is, caps it, and returns its format; both `descriptionFormat: "markdown"`;
  `src/careers/boardPages.ts` passes Workday's format on (S3's board path).
- [X] T050 [US2] Run the touched tests, then `npm run check` and `npm run check:db`.
- [X] T051 [US2] Per-PR flow steps 4–6: commit ("Convert Greenhouse and Workday descriptions to
  Markdown (012 PR 7)"), push, open PR 7 (quickstart "PR 7"). **Wait for the owner.**

---

## Phase 4: User Story 1 (continued) - Lever's whole posting (FR-012)

### Sitting S8, PR 8: Lever (T052–T056), branch `012-pr8-lever-posting`

- [X] T052 Per-PR flow steps 1–3, for sitting S8.
- [X] T053 [P] [US1] Unit tests in `tests/sources.test.ts`: a Lever posting's `description`, two
  `lists` (`{ text, content }` with `<li>` items) and `additional` become one Markdown description:
  the opening, then each list's `text` as a heading followed by its items, then the closing section,
  in that order; a list `text` containing `<` or `&` shows as written; missing `lists` or
  `additional` are skipped. Add those fields to `tests/fixtures/lever.json` and update the
  expectation at `tests/sources.test.ts:33`.
- [X] T054 [US1] In `src/sources/lever.ts`, read `description`, `lists` and `additional` (zod,
  `.nullish()`), assemble the HTML (`<h3>` with the list's `text` escaped, then `<ul>content</ul>`
  per list) and store `htmlToMarkdown` with `descriptionFormat: "markdown"`; stop reading
  `descriptionPlain`.
- [X] T055 [US1] Run the touched tests, then `npm run check` and `npm run check:db`.
- [X] T056 [US1] Per-PR flow steps 4–6: commit ("Store Lever's whole posting as Markdown (012 PR 8)"),
  push, open PR 8 (quickstart "PR 8"), noting a Lever company must be configured to see it, and
  that stored Lever jobs from companies no longer configured stay plain text. **Wait for the owner.**

---

## Phase 5: FR-004 - careers pages downloaded or rendered

### Sitting S9, PR 9: careers pages (T057–T063), branch `012-pr9-careers-markdown`

- [X] T057 Per-PR flow steps 1–3, for sitting S9.
- [X] T058 [P] [US2] Unit tests in a new `tests/pageMarkdown.test.ts`: `pageToMarkdown` drops `nav`,
  `header`, `footer` and hidden elements with their contents whatever the element (`<p hidden>`,
  `<li aria-hidden="true">`, `<h2 style="display:none">`, `<div style="visibility: hidden">`, and a
  hidden element inside a code block), keeps `aside` and the posting's own content, and otherwise
  follows `htmlToMarkdown`'s rules; `htmlToMarkdown` on the same page still keeps `header` text (the
  rule doesn't leak into the base service).
- [X] T059 [US2] Add `pageToMarkdown(html)` to `src/descriptions/toMarkdown.ts`: a second service from
  the factory with an `addRule` filter function for chrome and hidden elements (research R7).
- [X] T060 [P] [US1] Unit tests in `tests/careersReadPage.test.ts`: a downloaded or rendered job page
  carries `description: { text: <Markdown>, format: "markdown" }` (cut by `capDescription` at 20,000
  characters, with a case over the limit) while the model's text is unchanged; an unreadable
  conversion falls back to the page text as `'text'`; a careers page carries none.
- [X] T061 [US1] In `src/careers/readPage.ts`, set `description` for downloaded and rendered job
  pages from `pageToMarkdown` and `capDescription`.
- [X] T062 [US1] Run the touched tests, then `npm run check` and `npm run check:db`.
- [X] T063 [US1] Per-PR flow steps 4–6: commit ("Store careers-page descriptions as Markdown (012
  PR 9)"), push, open PR 9 (quickstart "PR 9"). **Wait for the owner.**

---

## Phase 6: Polish & Cross-Cutting Concerns

### Sitting S10, PR 10: docs (T064–T067), branch `012-docs-readme`

- [X] T064 Per-PR flow steps 1–3, for sitting S10.
- [X] T065 Run quickstart "SC checks": SC-003 and SC-005 against the sources it names (Lever and
  Ashby `descriptionPlain`; Greenhouse through the old `escapedHtmlToText` from git), and SC-004's
  ten timed panel opens.
- [X] T066 Update `README.md` (the Description section of the details panel, how descriptions are
  stored, the job-row diagram's `description` and `description_format`, the careers lookup's
  "Results", and that a board's conversion needs a configured company) and `CLAUDE.md` (a line on
  `src/descriptions/`, turndown and react-markdown, and the `description_format` rule), and fill the
  ledger below.
- [X] T067 Per-PR flow steps 4–6 for a docs-only PR ("Document Markdown job descriptions (012)").

---

## Dependencies & Execution Order

- **S0 → S1 → … → S10**, each merged before the next starts.
- **S1** (format) blocks everything: every later step reads or writes the format.
- **S2–S5** make every reader handle Markdown (the model, boosts, the careers lookup's board path,
  the panel) and put the re-scoring rule in place before **S6** makes the first source write it.
- **S6** brings the conversion and `capDescription`; S7–S9 reuse them.
- **Lever (S8)** moves only with its lists, so each Lever job is scored again once (research R6).

## Parallel Opportunities

Within a sitting, the [P] test tasks touch different files:
- S1: T005, T006. S2: T013, T015. S3: T020, T021. S4: T027, T029. S5: T035.
- S6: T040, T042, T044. S7: T048. S8: T053. S9: T058, T060.

## Implementation Strategy

1. **PRs 1–5**: the format, every reader, and the re-scoring rule; nothing changes on real jobs.
   Configure the boards to test before PR 6.
2. **PR 6** is the first visible Markdown (Ashby), with the hostile test set.
3. **PRs 7–9** extend it to Greenhouse and Workday, Lever's full posting, and careers pages.
4. **PR 10** documents it.

## Test ledger (constitution Principle II, target mix 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (T002) | 473 | 45 (1 skipped without a browser) | 52 |
| Planned new | ~52 (T013, T015, T020, T021, T027, T040, T042, T044, T048, T053, T058, T060, and the memory runs of T006, T021's contract case and T035) | ~5 (T005, and the MariaDB runs of T006, T021's contract case and T035) | 2 (T029) |
| After the combined PR (T066) | 543 (+70) | 50 (+5; 1 skipped without a browser) | 54 (+2) |

**Delivery note (owner, 2026-10-23):** sittings S7–S10 (Greenhouse and Workday, Lever, careers pages,
docs) were delivered as one PR at the owner's request, after PRs 1–6 merged separately.

**SC checks (T065, 2026-10-23, live postings):** SC-003 and SC-005 hold. Five Lever postings: every
old word present in order, the Markdown 4–7 times longer with the lists and closing section; no boost
term lost, one posting gaining `typescript` and `javascript` from its requirement lists. Five
Greenhouse postings: every old word present, except that the old converter left `&mdash;` undecoded
(the word "mdash"), which turndown now decodes; no boost term lost or gained. Ashby (PR 6): only link
addresses missing from the readable copy, as intended. SC-004 (panel timing) waits for Markdown rows:
none is stored until a configured board runs.
