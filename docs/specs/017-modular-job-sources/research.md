# Research: Modular job sources

Every decision follows the code on `main` after feature 016 (`71f7856`). No new library is needed.
The modules use the existing HTTP client and zod, and the saved sources use Kysely like the other
stores.

## R1. The module interface

- **Decision**: one interface, `SourceModule<P>`, in a new `src/sources/module.ts`, and one registry,
  `MODULES`, in `src/sources/registry.ts`, which lists every module the app ships:

  ```ts
  interface SourceModule<P> {
      id: ModuleId;                       // stable key stored on saved sources
      name: string;                       // "Greenhouse"
      description: string;
      kind: "ats" | "api" | "email" | "web";
      scope: "company" | "query" | "account";
      params: ZodType<P>;                 // a saved source's fields and their rules
      fields: FieldSpec[];                // how the Settings form shows them (R7)
      fromUrl?(url: URL): P | null;       // a pasted link
      target(params: P): string;          // what it points at, for "no duplicate board"
      requires: Requirement[];            // "jsearch_key", "gmail"
      limits: { maxPerRun: number; refresh: "every_run" | "jsearch_refresh_hours" };
      fetch(params: P, ctx: SourceContext, from: Cursor | null): AsyncIterable<SourcePage>;
      company?(params: P, name: string): CompanyHint;   // company-scoped modules only
      postings?: BoardPostings<P>;        // what the careers lookup reads (R6)
  }
  interface SourcePage { jobs: Job[]; cost: number; next: Cursor | null }
  ```

- **`fetch` yields pages.** The caller, not the module, decides when to stop: at `maxPerRun` jobs, at
  the last page, or when a budget blocks. `next` is the cursor to continue from, and `null` after the
  last page. Greenhouse, Lever and Ashby yield one page with `next: null`, since their feeds return
  everything at once.
- **`SourceContext`** gives a module only what it may use: the rate-limited HTTP client (public
  addresses checked, as today), the clock, the JSearch key and settings, and, for Gmail, the alert
  stores. A module can't reach the job store, so it can't skip the shared pipeline (R4) or the network
  rules (FR-014).
- **`check`** is not a separate method. Testing a source on save means taking the first page of
  `fetch` (R7). There's one way to fetch, so a test can't pass where a real run would fail.
- **`kind: "web"`** stays in the type with no module, so a scraping module later only adds a module
  (FR-013).
- **Rationale**: the owner's interface (2026-10-28), shaped so that each platform's quirks stay inside
  its module. `fields` sits beside `params` because zod describes rules, not forms: a select's
  options, a field's label and which fields are optional on screen all belong to the form.
- **Alternatives**:
  - building the form from the zod schema (fragile, and zod has no notion of a label or field order);
  - a `check` method per module (a second fetch path to keep in step).

## R2. The modules

| Module | Kind / scope | Params | Pages | Cost |
|---|---|---|---|---|
| `greenhouse`, `lever`, `ashby` | ats / company | `{ slug }` | one | 0 |
| `workday` | ats / company | `{ host, tenant, site }` | 20 postings a page, by offset | 0 |
| `jsearch` | api / query | `{ query, remote_only?, country? }` | one request | 1 request |
| `gmail_alerts` | email / account | `{}` | one | 0 |

- **Greenhouse, Lever and Ashby** keep their readers' address, data shape and mapping. `defineBoard`
  becomes the helper these three modules are built with, so each stays small.
- **Workday** is new as a source (R6).
- **JSearch** wraps `fetchJsearch`. Each request costs 1 against the app-wide monthly budget, and its
  schedule is `jsearch.refresh_hours` (FR-009a). The monthly cap and the refresh check move out of
  `searchFetch.ts` into the run's fetch phase (R5), as checks on a module's `cost` and `refresh`.
- **Gmail alerts** wraps `fetchAlerts`. Its alert-specific steps stay inside the module:
  - reading only the HTML part;
  - skipping copies of jobs already known from other sources;
  - finding descriptions through JSearch and the careers lookup.

  It requires a usable Gmail connection and the sealing key.
- **`fromUrl`** for the four ATS modules uses the existing `parseBoardLink`. A link to a single
  posting resolves to its board (SC-003).

## R3. Saved sources: one row each (FR-004, FR-015)

- **Decision**: migration `012_user_sources` adds `user_sources`, built with the schema builder,
  `utf8mb4_bin`:
  - `id`, `user_id` (foreign key to `users`);
  - `module`, `name`, `params` (`json`), `target`, `enabled`;
  - `company_id` (foreign key to `companies`, nullable): company-scoped sources only;
  - `cursor` (`json`, nullable): where the last run stopped (R5);
  - `last_fetched_at`, `last_outcome` (`ok` / `partial` / `failing`), `last_jobs`, `last_reason`
    (a fixed reason, never fetched text);
  - `created_at`, `updated_at`.

  The keys:
  - **unique `(user_id, target)`**: no two saved sources point at the same board or query;
  - **unique `(user_id, name)`**: names compare exactly in the database. The app also refuses names
    that match ignoring case, as today.
- **Jobs point at their source**: migration 012 adds `jobs.source_id` (nullable, foreign key to
  `user_sources`, `ON DELETE SET NULL`).
  - `jobs.source` stays as the label shown on pages, and it is updated when a source is renamed.
  - Unscored-job queries, the "already from a board" check, and the alert copy check switch to
    `source_id`.
  - A job whose source was deleted keeps its label and a null `source_id`, and ages out as today.
- **The data step**, in the same migration and typed with `db.withTables<…>()`:
  1. It creates the owner's saved sources from the stored settings document's `companies` (one per
     board) and `searches` (one `jsearch` source each). Their names, fields and order stay the same.
  2. It removes `companies` and `searches` from the document.
  3. It adds one `gmail_alerts` source for the owner, which is on.
  4. It sets `jobs.source_id` by matching `jobs.source` to the new names, with `Gmail alerts` going
     to the alerts source.

  Re-running it changes nothing (FR-008), because a migration step runs once per database.
- **Rationale**: one row per source holds what a source now carries: on/off, its last outcome, its
  cursor and its company. That suits feature 015's `user_settings` document poorly. `target` makes
  "no duplicate board" a database rule.
- **Alternatives**:
  - keep `jobs.source` as the only link (renames would orphan jobs, and the label would double as a
    key);
  - one table per module (every new module would need a migration).

## R4. One pipeline after every module (FR-003)

- **Decision**: a new `src/sources/ingest.ts` stores each page a module yields:
  1. It drops `jsearch` results from an excluded publisher, as today.
  2. It drops results from a query-scoped source that a company-scoped source already supplied. That
     is today's JSearch "board copy" rule, now applied to any query source.
  3. It stores the rest through `JobStore.upsertAll(jobs, seen, source)`, with `source` now
     `{ id, name }`. That links company records, as today.

  The title filter and excluded companies still apply when jobs are offered for scoring, as today.
  Descriptions are still capped as each job is made (`makeJob`), so every module gets the cap.
- **Gmail alerts** goes through the same storing step. Its copy-skipping stays inside the module, as
  R2 says, because it compares an alert's title against every other source.

## R5. Fetching moves out of the model's hands (FR-016, FR-007, FR-007a, FR-009a)

- **Decision**: a new fetch phase, `fetchSources(context)` in `src/sources/fetchPhase.ts`, runs before
  the agent, in `beforeAgent` after the backfill. For each saved source that is on, it checks three
  things:
  - the module is available (it's in `MODULES` and its `requires` are met);
  - it's due (`every_run`, or for JSearch the last call is older than `refresh_hours`);
  - the budget allows it (JSearch requests this month plus the page's cost are within the cap).

  Then it reads pages from the stored cursor until `maxPerRun` jobs or the last page, storing each
  through `ingest`. It records the outcome on the source:
  - `ok`;
  - `partial`, with the cursor kept, when it stopped at the limit;
  - `failing`, with a fixed reason.

  A failing source never stops the others (FR-007).
- **The cursor**:
  - after the last page, the cursor is cleared, so the next run starts from the first page;
  - editing a source's fields, or turning it off and on, clears it too (FR-007a);
  - a posting read twice is stored once, since the upsert is keyed by board and job id.
- **The model only scores**:
  - `list_sources` reports each source that is on: its fetch outcome this run and its unscored count;
  - `fetch_jobs` becomes `next_jobs(source)`. It returns up to 25 unscored jobs from a source and
    fetches nothing. The new name says what the tool does, and the README's tool list changes with it;
  - the system prompt's steps change to "list_sources, then next_jobs until each source has 0 left".
- **Rationale**: the owner decides what is fetched (2026-10-28), so code fetches everything that is
  on. Paging, cursors and budgets are plain code, testable without a model. The agent's steps and
  context go only to scoring.
- **Alternatives**: keep the model calling `fetch_jobs` to fetch (a source could be skipped, and
  paging would happen inside model turns).

## R6. Workday as a module, and the careers lookup on modules (FR-002, FR-011)

- **Decision**: the Workday module's params are `{ host, tenant, site }`, from a pasted
  `<tenant>.wd<N>.myworkdayjobs.com/<site>` link.
  - **`fetch`** posts to `<host>/wday/cxs/<tenant>/<site>/jobs` with `{ limit: 20, offset }`. Then it
    reads each listed posting's detail (`GET …<externalPath>`), because the listing has no
    descriptions. Each page yields up to 20 jobs, with the cursor `{ offset }`.
  - **`maxPerRun`** is 100, so a run makes about 105 requests to one Workday host. That's within
    `http.max_requests_per_host_per_run` (300) at 1 request a second.
  - **Jobs** are `ats: "workday"`, with the posting path as the job id. The `Job` type's `ats` gains
    `workday`. `ATS_NAMES`, the board types feature 015's settings document allows, stays as it is,
    since a Workday board needs a host and a site, not a slug. From PR 6, the Settings form lists
    modules, not board types.
  - **`company`** gives the source's name and the site's public address as its careers page.
- **The careers lookup**: `src/careers/boardPages.ts` reads boards through each ATS module's
  `postings`, instead of calling `fetcherFor` and `searchWorkday` itself.
  - **`postings.list(params)`**: Greenhouse, Lever and Ashby list a board's postings.
  - **`postings.search(params, text)`** and **`postings.one(params, id)`**: Workday searches by title
    and reads one posting, as `searchWorkday` and `workdayPosting` do today.
  - Those two move into the Workday module, so there's one Workday reader (FR-011).

## R7. The Settings page's Sources section (FR-005, FR-006, FR-017)

- **Decision**: the Sources section becomes a list of saved sources. Each row shows:
  - its module's name, its name and its on/off switch;
  - when it was last fetched, with its outcome and reason;
  - Edit and Delete.

  Below the list, **Add a source** has two ways in: a link box, and a module picker that shows the
  chosen module's form.
  - **The link box**: pasting a link calls `recognizeLink(url)`, which tries each module's `fromUrl`,
    then opens that module's form already filled in, with a suggested name.
  - **The form** is built from the module's `fields`: text inputs, selects and checkboxes. Problems
    show beside fields, as in feature 016.
  - **Not available**: a module whose `requires` aren't met says so and can't be tested.
- **Saving one source**: the `saveSource(previous, request)` server action:
  1. checks the request's shape with zod;
  2. parses the fields with the module's `params`;
  3. checks the rules across sources: unique names ignoring case, the reserved "Gmail alerts" name,
     a duplicate `target`, and the JSearch budget (searches × refreshes a month ≤ the cap);
  4. stores the source;
  5. tests it by taking the first page of `fetch`.

  The test's outcome is recorded like a run's (`ok`, or `failing` with its reason). A failing test
  still saves (FR-017).
- **Gmail alerts** is listed once Gmail is connected, with only on/off, since it has no fields.
- **The other actions**:
  - `setSourceEnabled` turns a source on or off and clears its cursor;
  - `deleteSource` deletes it, after a confirm, and its jobs keep their label.
- **The decisions are plain functions in `src/web/`**, unit-tested:
  - `sourceRows`: the list view;
  - `recognizeLink`;
  - `sourceRules`: the checks across sources;
  - `sourceFormView`: a module's fields, shown with its values and problems.

  The action and the components only wire them up.

## R8. What leaves feature 015's search settings

- **Decision**:
  - **The search settings**: `companies` and `searches` leave `fileConfigSchema`, `SEARCH_KEYS`, the
    Settings `SECTIONS` table and feature 016's Sources editor.
  - **The rules across sources**: "at least one company or search", unique names, the reserved name
    and the JSearch budget leave the schema. They become `sourceRules` (R7), checked on save.
  - **A run with no source on** finishes at once, with "no sources are on" in its trace and summary.
    It's no longer a config error, so Recommended and the other pages no longer need a source to load.
  - **Leftover keys**: `companies` or `searches` left in `config.json` or in the stored document are
    named in a `retired` notice ("no longer used; sources are managed in Sources"), never in an error.
  - **Readers**: everything that read `config.companies` or `config.searches` reads the owner's saved
    sources instead:
    - the board pages in `beforeAgent`;
    - `sourceNames` in `src/web/pageData.ts`;
    - `requireSearchKey`;
    - the alert lookups' search count.

## R9. Delivery and test split

- **Delivery**: seven code PRs after the docs PR (plan, Delivery):
  1. the module interface and registry, with Greenhouse, Lever and Ashby on it, and no change in
     behaviour;
  2. the Workday module, with the careers lookup reading boards through the modules;
  3. the `user_sources` table and store;
  4. the move: migration 012's data step, `jobs.source_id`, and the readers switched to saved sources;
  5. the fetch phase, with JSearch and Gmail alerts as modules, `next_jobs` and the prompt;
  6. the Sources section rebuilt;
  7. the docs.

  PR 4 must land whole: once the data step moves `companies` and `searches` out of the document,
  every reader has to read saved sources.
- **Test split**:
  - **Unit**: the modules (fake HTTP), the fetch phase and its cursor, `ingest`, the rules and form
    helpers, and the contract's memory run;
  - **Integration**: exactly 3 new: migration 012's tables, its data step, and the bundled
    saved-source contract on MariaDB;
  - **UI**: exactly 1 new, for the Sources section;
  - **Rewritten, not added**: the run tests that drive `fetch_jobs` move to `next_jobs` and the fetch
    phase.
  - **Totals**: about 60 new unit tests. From 698 / 58 / 59 (85.64 / 7.12 / 7.24%) that's about
    758 / 61 / 60 (86.2 / 6.9 / 6.8%), so every share moves toward 95 / 4 / 1. tasks.md fixes the
    exact counts.
