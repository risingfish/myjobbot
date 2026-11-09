# Research: SOLID conformance across the whole app (028)

## R1. How the review was done

- **Decision**: The app was split into eight areas covering every functional area in FR-001. Each
  area was read in full by one reviewer against Principle VI's five rules, with one shared brief:
  - report only real breaches with a concrete cost
  - ignore what the linter already enforces (length, parameter counts, comments)
  - fixes may not change behaviour, the schema, file formats or output; a breach that needs one of
    those is a follow-up

  Each area's inventory lists every module with its outcome, then each finding: its rule, location,
  cost, decision, fix and size. Applied database steps (`src/db/migrations/0*.ts`) are history and
  were not reviewed. The in-memory stores that implement app interfaces were reviewed for LSP.
- **Coverage**: 456 app modules (all of `src/`, `web/app`, `web/lib`, `web/components`,
  `web/proxy.ts`, `web/next.config.ts`) and 23 in-memory helpers. A script compared the module
  lists in the inventories with the files on disk: none missing, none outside an area.
- **Rationale**: one reader per area keeps each judgement grounded in the whole area. The shared
  brief keeps the eight inventories comparable.
- **Alternatives considered**: a lint-only pass (it can't judge responsibility or contracts); one
  reader for everything (22,000 lines is too much to hold at once).

## R2. What the review found

| Area | Inventory | Modules | Findings | SRP | OCP | LSP | ISP | DIP |
|---|---|---|---|---|---|---|---|---|
| Run, agent, tools, CLI, config, helpers | [01](inventory/01-run-agent-tools-cli.md) | 53 | 5 | 0 | 2 | 0 | 3 | 0 |
| Sources, Gmail, job rules, descriptions | [02](inventory/02-sources-gmail-jobs.md) | 52 | 9 | 1 | 4 | 0 | 2 | 2 |
| Careers lookup, companies, re-score | [03](inventory/03-careers-companies-rescore.md) | 39 | 7 | 1 | 1 | 0 | 3 | 2 |
| Evals, resume, profile | [04](inventory/04-evals-resume.md) | 35 | 9 | 1 | 4 | 0 | 1 | 3 |
| Accounts, mail, web security, web rules | [05](inventory/05-accounts-mail-webrules.md) | 75 | 8 | 2 | 3 | 0 | 3 | 0 |
| Stores and database (+ memory stores) | [06](inventory/06-stores-database.md) | 83 | 10 | 5 | 2 | 1 | 2 | 0 |
| Web server side | [07](inventory/07-web-server.md) | 70 | 10 | 4 | 2 | 0 | 1 | 3 |
| Web components | [08](inventory/08-web-components.md) | 72 | 6 | 2 | 3 | 0 | 0 | 1 |
| **Total** | | **479** | **64** | **16** | **21** | **1** | **15** | **11** |

61 findings are marked fix and 3 accept. The deep analyses found two more:
- **D10** (ISP): `AccountStore.isAdmin` is called by nothing outside the stores. It is counted
  above.
- An OCP breach in `sourcesOn`'s by-name Gmail check (`src/tools/sources.ts:13`). It is recorded
  under A1 and fixed with it, so it isn't counted separately. None needed a follow-up: every fix moves code or narrows
a type without changing behaviour, the schema or a file format.

The largest themes:
- **Wide contexts** (ISP): `ToolContext` mixes stores, operations and mutable run state (A2), and
  its callers take it whole (A1, C3). The careers lookup takes all of `CareersStore` (C1), and page
  loading takes all of `JobViews` (U1).
- **Per-variant branches** (OCP): checks for `gmail_alerts`, `linkedin`, `workday`, `jsearch_key`
  and link purposes by name (A3, S1, S5, C4, D4, D5, U5, K1). Per-verdict pass rules are written
  twice (E1).
- **Grouped interfaces** (SRP): sessions with sign-in attempts (D1), accounts with security events
  (D2), three kinds of one-time token in one store (D3). `store.ts` still holds five stores'
  interfaces (D9), and `uiState.ts` does four jobs (W1).
- **Hidden dependencies** (DIP): clocks, randomness and IMAP clients reached directly inside
  decisions (E5, S8, C5); rules inside server actions (W6); eval failure reasons copied from the
  agent loop's wording (E7).
- **The one LSP breach** (D7): the memory stores have no shared list of users, so they accept
  writes MariaDB refuses.

## R3. Findings accepted (owner approved)

FR-003 needs the owner's approval for each acceptance. The reviewers proposed three:

| ID | Rule | What | Proposed reason |
|---|---|---|---|
| A5 | OCP | `ownerMessage` branches on the three `resume_view` values | It is the only place the closed, user-facing three-value list is dispatched; a table would add indirection without removing a second branch anywhere. |
| U8 | ISP | every account flow takes the whole `AuthContext` | It is a container of stores and injected primitives, already `Pick`ed from `Stores`, fully in-memory in tests. Flows call each other (`recordSecurityEvent`, `startSession`, `mailTo`), so per-flow narrowing grows back to the whole. |
| K6 | DIP | 21 client components import their server actions | That is how Next.js server actions are designed to be used (Principle IV). The decisions behind them are already plain, tested functions. |

**Approved by the owner, 2026-11-08**: all three, "no need to over optimize or break Next.js's
patterns". They are closed as accepted.

## R4. Order of work

- **Decision**: eight sittings, each one area or a tightly linked pair, ordered by dependency. For
  delivery, S2, S3, S6 and S7 are each split in two (R9), keeping this order:
  - **S1**: the 027 follow-ups (US2)
  - **S2**: stores and database. The store interfaces move first, since every later area imports them.
  - **S3**: the run, tools and sources. The `ToolContext` split (A1 before A2) with the callers it
    reaches (S1–S5, S9, C3), and the board-link readers with the board name they carry (S5, C4),
    since both rewrite the same parsers.
  - **S4**: Gmail, the careers lookup, re-score
  - **S5**: evals and resume
  - **S6**: web rules and the web server side. U and W findings meet in `uiState`, `sourceActions`
    and the settings views.
  - **S7**: web components
  - **S8**: guidance and the final verification

  The order after S3 is S4 → S5, since both change the one-job session's clock (C5 then E5), and
  S6 → S7, since K5 needs U7.

  Each sitting ends with both checks green, its guard tests added, and a review against
  Principle VI before it lands (FR-006).
- **Rationale**: the store and context interfaces are what everything else depends on; doing them
  first means later sittings change each caller once.
- **Alternatives considered**: area by area in inventory order. It would touch `ToolContext`'s
  callers twice.

## R5. Removing the email-digest mark

- **Decision**: a new database step, `024_jobs_without_digest_mark`. It counts postings with a
  digest mark set, and with any it fails with a fixed message giving only the count. Otherwise it
  drops `jobs.emailed_at`. The schema's `JobsTable` loses the field. The SQLite import copies every
  column of an old row that it doesn't move into the user's view, so `splitJob` (`importPlan.ts`)
  gets a `RETIRED` set that it leaves out of the posting, starting with `emailed_at`, and `LIMITS`
  drops the field. An old SQLite database that still has the column imports as before.
- **Rationale**: nothing has ever written the column (no writer in the code base), so dropping it
  loses nothing. The refusal guards against the impossible case rather than discarding data
  silently (FR-008). A step that can fail before it changes anything is safe to re-run once the
  cause is fixed.
- **Alternatives considered**: moving it to `user_jobs` (it would carry an empty, unused column
  into the per-user table; the digest feature will design its own mark); leaving it (the gap stays).

## R6. Recording an eval run's user

- **Decision**:
  - The run file (`run.json`) gains an optional `userId`. `executeRun` sets it from the user the
    stores were opened for: `--user`, else user 1. Each test of a series is a run, so it records its
    own.
  - The report's header line adds ` · user <id>`, or ` · user not recorded` for older runs, after
    the view and before ` · unfinished`.
  - The note goes right before the comparison lines. `reportLines` takes it as a parameter.
  - `--against observed` notes when the run's user differs from a compared case's `userId`, or when
    either is missing.
  - A comparison (`--against <run>`) prints one note line before the comparison: either
    `note: these runs were scored for different users (<a> and <b>)`, or
    `note: a run's user wasn't recorded, so the users can't be checked`.
  - The series report shows each test's user. Old run files parse as before (the field is
    optional) and are never rewritten.
- **Rationale**: the user is part of what a run measured, like its model and view, which the header
  already names. A note rather than a refusal keeps comparisons possible when they are deliberate.
- **Alternatives considered**: refusing cross-user comparisons (it would block a deliberate
  comparison); storing the email (FR-009 forbids it).

## R7. Guard tests (FR-005)

- **Decision**: each sitting adds the mechanical checks its inventory proposes. The list below is a
  summary; tasks.md names every guard and the sitting that writes it. They are in the
  style of `tests/wayBranches.test.ts` and `tests/ownerIdScan.test.ts`: a source scan with a short
  explicit allow-list, or a type-level `Record<Variant, …>` that makes a missing entry fail to
  compile. The proposed checks are:
  - source-variant names (`module ===`, `ats ===`) only in `src/sources/modules/`, the run hooks and
    `src/gmail/`
  - requirement names only in the source registry and its tables
  - no bare `ToolContext`, `JobViews` or `Stores` parameter in decisions that need less
  - the `Stores` container has no function members other than `forUser` and `close`
  - no `Date.now`, `new Date()` or `randomUUID` in the evals', careers' and re-score's decisions,
    outside their composition roots
  - every link purpose opens on `/link`
  - every Settings field belongs to exactly one section
  - one home for the timestamp format (K4) and for the settings-notice wording (K3)

  `Record`-keyed tables replace per-variant `if`/ternary chains (K1, K2, K5, D5, U5, E1, E3), so a
  new variant fails `tsc` until it has an entry.
- **Rationale**: a scan or a type catches a breach coming back; a review alone does not.

## R8. Behaviour unchanged (FR-004)

- **Decision**:
  - Every existing test keeps its expectations, with two exceptions:
    - a test that asserts the inner structure being changed (for example, a store split renames the
      contract file a case lives in)
    - the eval report and series assertions whose output FR-009 changes (T007 names them) The run
    prompt snapshot (`tests/__snapshots__/prompt.test.ts.snap`) must not change.
  - The integration contracts run unchanged against MariaDB.
  - Each sitting's review checks that the trace events and the CLI and web output are untouched.
  - Moves that are types-only (A2, D9) change no runtime object.
- **Rationale**: these are the existing guarantees of behaviour. Keeping them unchanged is the
  evidence that the refactor is pure.

## R9. Delivery

- **Decision** (owner, 2026-11-09): the sitting parts are worked through without stopping, each
  committed when it ends green, and one pull request is opened at the end with a commit per part.
  S2, S3 and S6 are split into two sittings each (`a`, `b`), and S7 into a stack-stopped part (S7a)
  and a UI-only part (S7b); tasks.md lists each part's tasks. S1 holds the one database step, so the
  pull request carries the backup note, and production's upgrade follows the 027 runbook's backup
  and check steps.
- **Rationale**: every part ends green, so each commit can be reviewed on its own within the one
  pull request.
