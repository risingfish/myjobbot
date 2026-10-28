# Research: Modular job sources

Every decision follows the code on `main` after feature 016 (`71f7856`). No new library is needed.
The modules use the existing HTTP client and zod, and the saved sources use Kysely like the other
stores.

## R1. The module interface

- **Decision**: one interface, `SourceModule<P>`, in a new `src/sources/module.ts`, and one registry,
  `MODULES`, in `src/sources/registry.ts`, which lists every module the app ships:

  ```ts
  interface SourceModule<P> {
      id: string;                         // stable key stored on saved sources
      name: string;                       // "Greenhouse"
      description: string;
      kind: "ats" | "api" | "email" | "web";
      scope: "company" | "query" | "account";
      params: ZodType<P>;                 // a saved source's fields and their rules
      fields: SourceField[];              // how the Settings form shows them (R7)
      fromUrl?(url: URL): P | null;       // a pasted link
      suggestName?(params: P): string;    // the name offered for a new source (R7)
      target(params: P): string;          // what it points at, for "no duplicate source"
      requires: Requirement[];            // "jsearch_key", "gmail"
      limits: { maxJobsPerRun: number | null; refresh: "every_run" | "jsearch_refresh_hours" };
      fetch(params: P, ctx: SourceContext, from: Cursor | null): AsyncIterable<SourcePage>;
      company?(params: P, name: string): CompanyHint;   // company-scoped modules only
      postings?: BoardPostings<P>;        // what the careers lookup reads (R6)
  }
  interface SourcePage { jobs: Job[]; cost: number; next: Cursor | null }
  ```

- **`fetch` yields pages.** The caller decides when to stop: at `maxJobsPerRun` jobs (`null` means
  no limit), at the last page, or when a budget blocks. `next` is the cursor to continue from, and
  `null` after the last page. Greenhouse, Lever and Ashby yield one page with `next: null`.
- **`SourceContext`** gives a module only what it may use: `http`, the clock, the JSearch key and
  settings, and, for Gmail, the alert reader's inputs (R2). A module has no store, so it can't skip
  the shared pipeline (R4).
- **The network rules (FR-014)**: `ctx.http` is built by a new `sourceHttp(client, lookup)` in
  `src/sources/sourceHttp.ts`, from the careers lookup's `checked()` wrapper (moved out of
  `src/careers/boardPages.ts`, which reuses it). That gives every module a client which:
  - checks every address is public with `assertPublic`;
  - follows no redirects (`HttpClient.withoutRedirects()`);
  - is rate-limited per host;
  - offers `getJson` and `postJson`, since Workday's listing is a POST.

  The run, the careers lookup and the Settings page's test fetch all build it the same way.
- **Failures**: `HttpClient` throws plain `Error`s today. A new `failureReason(error)` in
  `src/sources/failure.ts` maps them to the fixed reasons through typed errors:
  - `HttpStatusError`, carrying its status: 404 → "not found", 401 or 403 → "refused", others →
    "unexpected answer";
  - `NetworkError` → "unreachable";
  - a zod parse failure → "unexpected answer";
  - a missing requirement → "not set up".

  `client.ts` throws the two typed errors. A thrown message is never stored or shown.
- **`check`** is not a separate method. A test on save takes the first page of `fetch` (R7), so a
  test can't pass where a run would fail.
- **`kind: "web"`** stays in the type with no module, so a scraping module later only adds a module
  (FR-013).
- **Names**: the form type is `SourceField`, and the outcome type is `SourceOutcome`. That keeps them
  apart from feature 016's `FieldSpec` (`src/web/settingsSections.ts`) and the tools' `FetchOutcome`
  (`src/tools/sources.ts`, removed in S5).
- **Alternatives**:
  - building the form from the zod schema (zod has no label or field order);
  - a `check` method per module (a second fetch path to keep in step).

## R2. The modules

| Module | Kind / scope | Params | Target | Pages | `maxJobsPerRun` | Refresh | Cost a page |
|---|---|---|---|---|---|---|---|
| `greenhouse`, `lever`, `ashby` | ats / company | `{ slug }` | `<id>:<slug lowercased>` | one | none | every run | 0 |
| `workday` | ats / company | `{ host, tenant, site }` | `workday:<host>/<site>` lowercased | 20 postings a page, by offset | 100 | every run | 0 |
| `jsearch` | api / query | `{ query, remote_only?, country? }` | `jsearch:<query lowercased>\|<country or us>\|<remote_only or false>` | one request | none | `jsearch.refresh_hours` | 1 request |
| `gmail_alerts` | email / account | `{}` | `gmail_alerts` | one | none | every run | its lookups' JSearch requests |

- **Greenhouse, Lever and Ashby** keep their readers' address, data shape and mapping. `defineBoard`
  builds them. Their `company()` gives the board's public page, which is what `boardPageUrl` does
  today. `src/companies/boardPage.ts` folds into the modules, and its tests move with it.
- **Params schemas**: the `company` and `search` zod objects move out of `src/config/schema.ts` into
  the modules' `params`. The types that came from `FileConfig["companies"]` and
  `FileConfig["searches"]` come from the modules instead. Those are `Company` and `Search` in
  `src/tools/sources.ts`, `src/sources/jsearch.ts` and `src/companies/boardPage.ts`.
- **JSearch** wraps `fetchJsearch`. Each request costs 1 against the app-wide monthly budget, and its
  schedule is `jsearch.refresh_hours` (FR-009a).
- **Gmail alerts** is restructured so that it stores nothing itself (contract rule). The module's
  `fetch` does three things:
  - it reads new alert emails' HTML;
  - it parses them into jobs;
  - it drops copies of jobs already known from other sources, using `knownTitles`, a read the fetch
    phase passes in through `ctx`.

  It yields one page of jobs, with the read's mail state in the page's `next` (UID validity and last
  UID). The fetch phase then does the storing:
  - it stores the jobs through `ingest`;
  - it writes the alert state through `AlertStore.recordRead`;
  - it runs the careers lookup for alert jobs (`lookUpAlertJobs`), as `alertSource.ts` does today.

  The description lookups that spend JSearch requests report their count as the page's cost, so the
  shared budget counts them. Their allowance counts only `jsearch` sources that are on.
- **`fromUrl`**: the four ATS modules use `parseBoardLink`. A link to a single posting gives its
  board (SC-003).
- **`suggestName`**: the slug, or Workday's tenant, with its first letter capitalised (`stripe` →
  "Stripe"). For JSearch it's the query.

## R3. Saved sources: one row each (FR-004, FR-015)

- **Decision**: migration `012_user_sources` adds `user_sources`, built with the schema builder,
  `utf8mb4_bin`:
  - `id`, `user_id` (foreign key to `users`);
  - `module` (`varchar`, not a fixed list, so a module later removed from the app still loads and
    shows as unavailable);
  - `name`, `params` (`json`), `target`, `enabled`;
  - `company_id` (foreign key to `companies`, nullable);
  - `cursor` (`json`, nullable);
  - `last_fetched_at`, `last_outcome` (`ok` / `partial` / `failing`), `last_jobs`, `last_cost`,
    `last_reason` (a fixed reason only);
  - `created_at`, `updated_at`.

  The keys:
  - **unique `(user_id, target)`**: no two saved sources point at the same board or query;
  - **unique `(user_id, name)`**: names compare exactly in the database. The app also refuses names
    that match ignoring case.
- **Jobs point at their source**: the same migration adds `jobs.source_id` (nullable, foreign key to
  `user_sources`, `ON DELETE SET NULL`).
  - `jobs.source` stays as the label shown on pages, and it is updated on a rename.
  - Unscored-job queries, the "already from a board" check and the alert copy check key on
    `source_id` when there is one.
  - `JobStore.upsertAll(jobs, seen, source)` takes `source: string | { id: number; name: string }`.
    A plain name means "no saved source" (id null), so the many test call sites keep working.
- **The data step** is a migration of its own, `013_move_sources`, in S4b. Migration 012 lands in
  S3 and has run by then, so a step added to it would never run. It is typed with
  `db.withTables<…>()`, and runs only for users who have a
  `user_settings` row. On a fresh database, with no owner yet, it does nothing.
  1. It creates a saved source per entry in the document's `companies` (module = the entry's own
     `ats`) and `searches` (module `jsearch`). Names, fields and order stay the same.
     - It computes each target with its own frozen copy of each module's target rule, since a
       migration mustn't change when a module does.
     - A second entry with a target already taken keeps its jobs under the first source. The step
       doesn't abort; it notes each merge in its log line.
  2. It removes `companies` and `searches` from the document.
  3. It adds one `gmail_alerts` source, on, for that user.
  4. It sets `jobs.source_id` where `jobs.source` matches a new source's name exactly.
- **The Gmail alerts source on a fresh install**: connecting Gmail creates it if it's missing
  (`SourceStore.ensureAccountSource`). So the source exists whenever Gmail is connected, and only
  then is it listed (FR-010).
- **The company link (FR-012)**:
  - `CompanyStore.setBoardPage` returns the company's id;
  - `SourceStore.linkCompany(key, companyId)` stores it on the source, where `key` is
    `{ userId, id }`;
  - both run before the agent and when a company source is saved.
- **Alternatives**:
  - keep `jobs.source` as the only link (renames would orphan jobs);
  - one table per module (every module would need a migration).

## R4. One pipeline after every module (FR-003)

- **Decision**: `ingest(page, source, context)` in `src/sources/ingest.ts` stores each page:
  1. It drops `jsearch` results from an excluded publisher, as today.
  2. It drops results from a query-scoped source that a company-scoped source already supplied
     (today's JSearch "board copy" rule, now for any query source).
  3. It stores the rest with `upsertAll(jobs, seen, { id, name })`, which links company records.

  The title filter and excluded companies apply when jobs are offered for scoring, as today, and
  `makeJob` caps every description.

## R5. Fetching moves out of the model's hands (FR-016, FR-007, FR-007a, FR-009a)

- **Decision**: `fetchSources(context)` in `src/sources/fetchPhase.ts` runs before the agent, in
  `beforeAgent`. `beforeAgent` moves out of `src/app/run.ts` into `src/app/beforeAgent.ts`, so
  `run.ts` stays under 200 lines.
- **Order**: sources are fetched one at a time, in this order: company sources, then `gmail_alerts`,
  then `jsearch` sources. Alert lookups therefore spend their share before the saved searches, as
  today.
- **For each saved source that is on**, it checks:
  - the module is listed in `MODULES`;
  - its params pass the module's rules;
  - its `requires` are met;
  - it is due (`every_run`, or for JSearch a `last_fetched_at` older than `refresh_hours`, less
    today's 15-minute leeway, `REFRESH_GRACE_HOURS`). `last_fetched_at` is used rather than `api_calls`, so a rename
    doesn't reset the schedule;
  - the budget allows the next page: this month's JSearch requests plus its cost, within the cap.
- **Skipped sources** get a `source_skipped` trace event with the reason: off, unknown module,
  invalid fields, not set up, not due, or budget used.
- **Fetched sources**: the phase reads pages from the stored cursor until `maxJobsPerRun` jobs or the
  last page, storing each through `ingest`. It records the outcome with `SourceStore.recordFetch`:
  - `ok`, with the cursor cleared;
  - `partial`, with the cursor kept;
  - `failing`, with `failureReason`.

  A failure never stops the other sources.
- **The cursor**: it is cleared after the last page, after an edit, and on turning a source back on.
  A posting read twice is stored once.
- **What the model is offered**: `next_jobs(source)` returns up to 25 unscored jobs and fetches
  nothing.
  - **`ok` or `partial` this run**: the source's jobs seen in this run's fetch, as `unscoredSince`
    does for boards today. JSearch and alerts offer all their unscored jobs, as today.
  - **Skipped or failing**: its unscored jobs from earlier runs, so nothing waits forever.
  - **Off**: nothing is offered, and its jobs stay on the pages.

  `list_sources` reports each source that is on, with this run's outcome and its unscored count.
  The system prompt's steps change to "list_sources, then next_jobs and record_matches until each
  source has 0 left".
- **A run with no source on** finishes at once, with "no sources are on".

## R6. Workday as a module, and the careers lookup on modules (FR-002, FR-011)

- **Decision**: the Workday module's params are `{ host, tenant, site }`, from a pasted
  `<tenant>.wd<N>.myworkdayjobs.com/[<locale>/]<site>` link.
  - **`fetch`** posts `{ limit: 20, offset }` to `<host>/wday/cxs/<tenant>/<site>/jobs`. It reads
    each listed posting's detail, because the listing has no descriptions, and yields up to 20 jobs a
    page with `next: { offset }`. An empty page, when the total is a multiple of 20, ends with
    `next: null` too.
  - **`maxJobsPerRun`** is 100, so a run makes about 105 requests to one Workday host. That's within
    `http.max_requests_per_host_per_run` (300).
  - **Job ids**: jobs are `ats: "workday"`, with the job id `<tenant>/<site>/<posting id>`, where the
    posting id is the path's final segment. That keeps ids unique across companies sharing a path
    and under 255 characters. A longer one is replaced by its SHA-256 hex digest. The posting's own
    path stays in its `url`.
  - **`ATS_NAMES`**, the board types feature 015's document allows, stays unchanged. The `Job`
    type's `ats` gains `workday`.
- **The careers lookup**: `src/careers/boardPages.ts` reads boards through each ATS module's
  `postings`, with the lookup's own client passed in:
  - `postings.list(params, http)`;
  - `postings.search(params, text, http)`;
  - `postings.one(params, id, http)`.

  `searchWorkday` and `workdayPosting` move into the Workday module, leaving one Workday reader
  (FR-011).

## R7. The Settings page's Sources section (FR-005, FR-006, FR-017)

- **Decision**: the Sources section is a list of saved sources. Each row shows:
  - its module and name, and its on/off switch;
  - when it was last fetched, with its outcome and reason;
  - Edit and Delete.

  A source whose module is no longer in the app, or whose fields no longer pass its rules, shows as
  "unavailable" or "needs fixing".

  The section also shows how many of the month's JSearch requests are used, out of the cap (US4).
- **Adding a source**: Add a source has a link box and a module picker.
  - **The link box**: the `recognizeSourceLink` action calls `recognizeLink(url)` in
    `src/sources/registry.ts`, server-side, which tries each module's `fromUrl` and `suggestName`.
  - **The picker**: the page passes the client a serializable list of module choices, built by
    `sourceChoices` in `src/web/sourceForm.ts`: id, name, description, fields and availability.
    The client never imports `MODULES`, so module code stays out of the browser bundle.
  - **The form**: built from `fields`, with problems beside them, as in feature 016.
- **Saving one source**: the `saveSource(previous, request)` action:
  1. checks the request's shape with zod;
  2. parses the fields with the module's `params`;
  3. checks the rules across sources with `sourceRules`:
     - unique names, ignoring case;
     - the reserved name;
     - a duplicate `target`;
     - the JSearch budget: `jsearch` sources that are on × refreshes a month ≤ the cap;
  4. stores the source, clearing its cursor on an edit;
  5. tests it by taking the first page of `fetch` through a `SourceContext` built like the run's,
     with `sourceHttp`.

  On the test:
  - its jobs are not stored, so a run stores them;
  - a JSearch test records one request in `api_calls`, counted against the cap;
  - Workday's test reads the listing only, without posting details, so it stays under SC-001's 30
    seconds;
  - the outcome is recorded (`ok`, or `failing` with its reason). A failing test still saves
    (FR-017).

  The pure part, `saveSourcePlan`, is unit-tested.
- **The other actions**:
  - `setSourceEnabled` turns a source on or off and clears its cursor. Turning a `jsearch` source on
    is refused when it would pass the budget;
  - `deleteSource` asks to confirm. The source's jobs keep their label.
- **Gmail alerts** is listed once Gmail is connected, with the switch only.
- **The decisions are plain functions in `src/web/`**, unit-tested: `sourceRows`, `sourceRules`,
  `sourceChoices`, `sourceFormView` and `saveSourcePlan`.
- **The interim list**: from S4b, `web/components/settings/SourcesSection.tsx` is rewritten to show
  saved sources read-only, keeping its `<h4>Sources</h4>` heading. S6 extends it, rather than
  deleting and re-adding it.

## R8. What leaves feature 015's search settings

- **Decision** (S4b):
  - **Search settings**: `companies` and `searches` leave `fileConfigSchema`, `SANITIZERS`, the
    Settings `SECTIONS` table, the settings view and feature 016's Sources editor.
  - **Cross-source rules**: at least one source, unique names, the reserved name and the JSearch
    budget leave the schema, and come back as `sourceRules` in S6.
  - **`requireSearchKey`** is removed. A `jsearch` source without a key is skipped as "not set up",
    so the run goes on (FR-007).
  - **A run with no source on** finishes at once. Pages no longer need a source to load.
  - **Leftover keys**: `companies` or `searches` in `config.json` or the stored document give a
    `retired` notice, which the Settings notices panel shows, never an error.
  - **Readers**: everything that read `config.companies` or `config.searches` reads the owner's saved
    sources instead:
    - `configuredSources`;
    - `beforeAgent`'s board pages, which now set `company_id`;
    - `sourceNames` in `src/web/pageData.ts`, which includes sources that are off, so their jobs stay
      on Recommended;
    - the alert lookups' allowance.

## R9. Delivery and test split

- **Delivery**: eight code PRs after the docs PR (plan, Delivery):
  1. the interface, the registry and the network-checked client, with Greenhouse, Lever and Ashby
     on it;
  2. the Workday module, with the careers lookup reading boards through the modules;
  3. the `user_sources` table and store;
  - **4a.** jobs linked by `source_id`, and companies linked to sources;
  - **4b.** the move: the data step, and the readers switched to saved sources;
  5. the fetch phase, with JSearch and Gmail alerts as modules, `next_jobs` and the prompt;
  6. the Sources section rebuilt;
  7. the docs.
- **Test split**, with exact counts in tasks.md's ledger:
  - **Unit**: 50 new, and 17 removed in S4b (the cross-source rule tests and 016's Sources tests);
  - **Integration**: exactly 2 new, migrations 012 and 013 (the tables and the data step, in one
    test) and the
    saved-source contract on MariaDB;
  - **UI**: exactly 1 new.
  - **Rewritten, not added**: `boardPage`, `sources`, `careersWorkday`, `careersBoardPages`,
    `searchSources`, `jsearch`, `fetchJobs`, `listSources`, `prompt` and the run tests.
  - **Totals**: from 698 / 58 / 59 (85.64 / 7.12 / 7.24%) that's 731 / 60 / 60 (85.90 / 7.05 /
    7.05%), so every share moves toward 95 / 4 / 1.
