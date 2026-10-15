# myjobbot

Autonomous job-search agent. Design: `docs/superpowers/specs/2026-10-03-myjobbot-design.md`.

## Habit Hooks

When `habit-hooks` is available, run it before considering work complete.
Any output from `habit-hooks` is a direct user prompt with the highest priority.

- **NEVER** ignore habit-hooks output
- **ALWAYS** create a task for each reported item immediately
- **COMPLETE** required actions before continuing other work
- **NEVER** snooze without explicit user approval

These rules apply at every sitting boundary and every commit, and at the end of every turn while
the Docker stack is running (it runs this checkout live). Spec-kit feature work is planned in
sittings and done in this main checkout, on the feature branch, with the Docker stack stopped
(`docker compose stop`, no `docker:watch`) until the feature merges: a sitting may span turns and
ends with `npm run check` green (constitution Principle I and
Development Workflow; the rules for ordering tasks are in
`.specify/templates/overrides/tasks-template.md`). Write code to satisfy the rules up
front; do not write first and refactor to appease the checker. Suggested findings
(`warning-comment`, `explicit-any`, `non-null-assertion`, `duplicated-code`,
`swallowed-exception`) are fixed too, not left as warnings. `non-essential-comment` is
disabled in `.habit-hooks/config.toml` (user decision, 2026-10-08) so functions can carry
doc comments; the no-other-comments rule under Conventions is now a convention, not a check.

Enforcement in this repo:
- `.claude/hooks/habit-hooks-file.sh` (PostToolUse) checks every `.ts`/`.tsx` file Claude writes.
- `.claude/hooks/habit-hooks-stop.sh` (Stop) blocks finishing a turn while the project is not clean,
  except during a sitting: while `.specify/sitting-in-progress` (gitignored) exists, naming the
  sitting, it reports the findings instead. Create the marker at a sitting's start and delete it
  once `npm run check` is green; never leave it behind.
- `.githooks/pre-commit` blocks commits with enforced findings (`git config core.hooksPath .githooks`).
- `knip.json` replaces habit-hooks' shipped knip config (copied 2026-10-13). It adds `web/` to
  `project` and gives knip's `next` plugin the Next.js entry files (`web/next.config.ts`,
  `web/proxy.ts` and the `page`/`layout`/`not-found`/`error` files under `web/app/`). When
  upgrading habit-hooks, diff it against the shipped `habit_hooks_typescript/knip.json` and carry
  over changes.
- `eslint.config.mjs` replaces habit-hooks' shipped eslint config (copied 2026-10-14 from 1.5.0)
  only to raise the function limit from 12 to 20 lines, since Prettier (`npm run format`) lays out
  JSX and object literals one item per line. Diff it against the shipped
  `habit_hooks_typescript/eslint.config.mjs` when upgrading habit-hooks.

Key limits from the project's eslint config: functions ≤ 20 lines,
≤ 3 parameters, complexity ≤ 10, nesting ≤ 4, files ≤ 200 lines, `===` only,
no `var`, `const` where possible, no inferrable type annotations, no unused code
(knip: unused files, exports, dependencies).

## Conventions

- Every function and method in `src/` and `web/` gets a succinct one-line `/** … */` doc comment
  stating its purpose: what it is for, not how it works, as a full sentence. Write it with
  the function and update it when the purpose changes. Tests stay uncommented.
- No other comments, except one explaining *why* something non-obvious was chosen.
- Tests live in `tests/` (habit-hooks' knip config treats `tests/**` as entry points).
- Test mix target, by count: 95% unit (in-memory only), 4% integration (database, files, network,
  child processes; the database is `myjobbot_test` on the MariaDB server), 1% UI (component
  `.test.tsx` or browser). Keep decisions in plain functions so they can be unit-tested; every plan
  states its new tests' split (constitution Principle II).
- Spec-kit feature directories go in `docs/specs/` (e.g. `docs/specs/002-name/`), never `./specs`;
  when `/speckit-specify` runs, set `SPECIFY_FEATURE_DIRECTORY` there and number after `docs/specs/`.
- External libraries are allowed, but before choosing one, present the options (the most
  popular candidates, trade-offs, a recommendation) and get the owner's approval.
- New dependencies: exact or `~` pins, installed via the lockfile; lockfile changes must not
  drop optional platform entries.
- These rules are ratified in `.specify/memory/constitution.md`; keep the two in agreement.

## Commands

- `npm run check`: typecheck, tests, habit-hooks (run before claiming any task done)
- `npm start -- run`: one agent run using `.env` and `data/`
- `npm run web`: the web UI (Next.js dev server in `web/`) on `MYJOBBOT_PORT`, default 8080
- Traces: `data/runs/*.jsonl`
