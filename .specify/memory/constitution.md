# myjobbot Constitution

## Core Principles

### I. Habit-hooks clean at every sitting boundary

All TypeScript in `src/`, `web/` and `tests/` MUST pass habit-hooks with zero findings:
- at the end of every **sitting** (see Development Workflow) and at every commit
- at the end of every turn whenever the Docker stack is running, because it runs the main
  checkout's `src/` and `web/` live. Feature work is done in the main checkout or a worktree (see
  Development Workflow) with the stack stopped, except UI work, which may keep it running.

The limits:
- functions at most 20 lines, at most 4 parameters, complexity at most 10, nesting at most 4
- files at most 200 lines
- `===` only, no `var`, `const` where possible, no inferrable type annotations
- no unused code: knip's unused files, exports, dependencies and test-only code

Suggested findings (`warning-comment`, `explicit-any`, `non-null-assertion`, `duplicated-code`,
`swallowed-exception`) MUST be fixed too. Findings MUST NOT be snoozed without the owner's
explicit approval. Code MUST be written to satisfy the rules up front, not written first and
refactored to appease the checker.

Rationale: small, checked units keep an autonomous agent's code reviewable.

### II. Test-first, checked before done

Tests MUST be written before the code they cover and MUST live in `tests/`. `npm run check`
(typecheck, unit and UI tests, habit-hooks) and `npm run check:db` (the integration tests against
the test database) MUST both pass before any sitting is called done, and before any commit or
PR. Within a sitting, each task runs the tests it touches.

New tests MUST keep the suite moving toward a mix, by count, of **95% unit, 4% integration and
1% UI** (owner decision, 2026-10-14):
- **Unit**: in-memory code only, with no database, files, network, child processes or rendered
  components. Code that talks to those MUST keep its decisions in plain functions, so the
  decisions can be unit-tested and only the thin edge needs an integration test.
- **Integration**: touches a database (the checkout's own test database on the MariaDB server,
  see Development Workflow, Databases), files, a network server or a child process.
- **UI**: renders components (`.test.tsx`, vitest's `dom` project) or drives a real browser.

Every plan MUST state how its new tests split across the three, and SHOULD move existing tests
toward the target where it touches them.

Rationale: the agent runs unattended; the check is the only proof a change works, and it is run
constantly, so most of it has to be fast and exact.

### III. Purpose comments only

Every function and method in `src/` and `web/` MUST carry a succinct one-line `/** … */` doc
comment stating its purpose (what it is for, not how it works), written with the function and
updated when the purpose changes. This includes components, hooks and server actions. No other
comments are allowed, except one explaining *why* something non-obvious was chosen. Tests stay
uncommented.

Rationale: the owner is learning from this code; purposes help, narration doesn't.

### IV. Bounded, locked dependencies

External libraries are allowed. Before a specific one is chosen, the options (the most popular
candidates, with their trade-offs and a recommendation) MUST be presented to the owner, and the
owner MUST approve the choice. No library is added without that approval.

Every third-party dependency MUST be pinned exactly or with `~`, never floor-only, and MUST be
installed through the lockfile. Lockfile changes MUST NOT drop optional platform entries.

Once a library or framework is brought in to do a job, code MUST use it the way it is designed to
be used: its own API, syntax and conventions, not hand-rolled workarounds around it. For example,
Kysely is used through its builders, the schema builder for DDL in migrations and the query
builder for queries and data steps, never raw SQL strings; its `sql` tag is only for a fragment
the builder cannot express (such as the MariaDB type `` sql`tinyint` ``). Code written before this
rule (migrations 001–004 use `sql.raw`) is known debt, brought in line when it is next touched,
not mass-rewritten unprompted.

Rationale: libraries save work, but each one is code the owner has to trust, so the owner picks
it. A floor-only pin lets any future release, including a compromised one, into a clean build;
a lockfile missing platform entries breaks installs on other machines. Working around a library
throws away the checking and portability it was chosen for, and leaves the reader two ways of
doing one thing.

### V. Specs live in docs/specs

Spec-kit feature directories MUST live in `docs/specs/NNN-name/`, never `./specs`.

Rationale: one documentation root for the project.

### VI. SOLID design, always

All code MUST follow the SOLID principles at all times (owner decision, 2026-11-08):
- **Single responsibility**: a module, class or function has one job. Unrelated jobs are not
  grouped in one file or one interface, even when they touch the same data.
- **Open/closed**: a new variant (a way of signing in, a job source, a store) is added beside the
  existing ones, through a registry or interface, not by editing per-variant branches.
- **Liskov substitution**: every implementation of an interface (Kysely and memory stores, source
  modules, ways of signing in) honours the same contract; the shared contract tests prove it.
- **Interface segregation**: callers depend on the narrow interface they use (`Pick<…>`, a bound
  store), not on a container with unrelated members; a container holds stores, not operations.
- **Dependency inversion**: decisions depend on interfaces and are handed their dependencies (stores,
  clocks, HTTP, mail), so they can be unit-tested with in-memory implementations.

SOLID is part of every review: every spec, plan and task list (`/speckit-specify`, `/speckit-plan`,
`/speckit-tasks`, `/speckit-analyze`), and every code review of a change. A plan's Constitution
Check names how its design meets each principle, and an analysis reports a breach as it would any
other principle.

Rationale: code organised by responsibility can be read, tested and changed one part at a time;
grouping unrelated jobs makes every later change touch code it has nothing to do with.

## Quality Gates

- `.claude/hooks/habit-hooks-file.sh` (PostToolUse) checks every `.ts`/`.tsx` file Claude writes.
- `.claude/hooks/habit-hooks-stop.sh` (Stop) blocks finishing a turn while the project is not
  clean. While a sitting is in progress (`.specify/sitting-in-progress` exists), it reports instead;
  the marker is removed when the sitting ends green.
- `.githooks/pre-commit` blocks commits with enforced findings
  (`git config core.hooksPath .githooks`).
- `knip.json` and `eslint.config.mjs` replace habit-hooks' shipped configs (the ESLint copy raises
  the function limit to 20 lines, owner decision 2026-10-14, because Prettier lays out JSX and
  object literals one item per line, and the parameter limit from 3 to 4, owner decision
  2026-11-07). When habit-hooks is upgraded, both MUST be diffed against
  the shipped configs and changes carried over.
- `non-essential-comment` is disabled in `.habit-hooks/config.toml` (owner decision,
  2026-10-08) so functions can carry doc comments; Principle III's no-other-comments rule is a
  convention, not a check.
- No exemptions: no `eslint-disable`, no snoozes, no ignore entries added to make a check pass.

## Development Workflow

- Features go through spec-kit: specify, clarify, plan, tasks, analyze, implement. Every plan
  has a Constitution Check against Principles I–VI.
- **Sittings.** A task list groups its tasks into numbered sittings. A sitting:
  - may span several turns
  - is worked in the main checkout, on the feature branch, with the Docker stack stopped
    (`docker compose stop`, and `docker:watch` not running) from the first code change until the
    feature is merged and the stack is rebuilt, unless the sitting is **UI work**
  - may instead be worked in a **git worktree** of the repository, on the feature branch, when
    another session is working in the main checkout (owner decision, 2026-11-04). The worktree
    runs its own `npm ci`, has its own `.env` (never printed) naming its own databases, and runs
    `npm run check` and `npm run check:db` itself. Its code never reaches the stack, which serves
    the main checkout, until the feature merges
  - **UI work** may keep the stack running, so the owner watches the change live in the `web`
    service (owner decision, 2026-11-02). UI work means changes to the web UI's components,
    styles and page wiring that add no database migration and don't change the agent run's code
    path (`src/agent/`, `src/tools/`, `src/sources/`, `src/careers/`, `src/app/` and the stores it
    writes through). A sitting that adds a migration or changes the run stops the stack, because
    the stack's scheduled run and the `web` service would apply it to the database the stack
    points at from an unmerged branch. While the stack runs, every turn ends with habit-hooks clean
    (Principle I). A task list says, per sitting, whether the stack runs.
  - ends with `npm run check` green
  - is the only point where work may be committed (when the owner asks)

  Tasks are ordered so every sitting can end green:
  - a new module is reached from a production entry point within the sitting that creates it
  - a dependency is installed in the sitting of its first import
  - a test sits in the same sitting as the code it imports, before it
  - an implementation is replaced by first moving callers behind an interface on the old one,
    then swapping in one sitting

  `/speckit-analyze` checks every sitting boundary against Principle I. The project's tasks
  template (`.specify/templates/overrides/tasks-template.md`) carries these rules.
- **Databases** (owner decision, 2026-11-04). `myjobbot` belongs to the production deployment on
  the Kubernetes cluster and is never used by local work. Local work uses one database pair per
  checkout, each with its own user created by the owner: the main checkout `myjobbot_dev` (app)
  and `myjobbot_test` (integration tests); a second session's worktree `myjobbot_dev_alt` and
  `myjobbot_test_alt`. Integration tests use only the checkout's test database
  (`MYJOBBOT_TEST_DB_NAME`, whose name MUST hold `_test` at its end or before another `_`;
  `MYJOBBOT_TEST_DB_HOST`/`_PORT`/`_USER`/`_PASSWORD` may connect to it separately), and every
  database is `utf8mb4` / `utf8mb4_general_ci`.
- `npm run check` and `npm run check:db` are the gate before any sitting is called done
  (Principle II).
- habit-hooks output is a direct instruction from the owner, with the highest priority: each
  reported item becomes a task and is completed before other work continues.

## Governance

This constitution records the project's existing rules. Amendments are made by the owner and
recorded here with a version bump: MAJOR for removing or redefining a principle, MINOR for adding
or materially extending one, PATCH for wording. `CLAUDE.md` remains the day-to-day guide and MUST
agree with this constitution; when they differ, both are brought back in line in the same change.
Every plan's Constitution Check cites the version it was checked against.

**Version**: 2.7.0 | **Ratified**: 2026-10-13 | **Last Amended**: 2026-11-08
