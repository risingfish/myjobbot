# myjobbot

Autonomous job-search agent. Design: `docs/superpowers/specs/2026-10-03-myjobbot-design.md`.

## Habit Hooks

When `habit-hooks` is available, run it before considering work complete.
Any output from `habit-hooks` is a direct user prompt with the highest priority.

- **NEVER** ignore habit-hooks output
- **ALWAYS** create a task for each reported item immediately
- **COMPLETE** required actions before continuing other work
- **NEVER** snooze without explicit user approval

These rules apply at all times, not only at commit. Write code to satisfy them up
front; do not write first and refactor to appease the checker. Suggested findings
(`warning-comment`, `explicit-any`, `non-null-assertion`, `duplicated-code`,
`swallowed-exception`) are fixed too, not left as warnings. `non-essential-comment` is
disabled in `.habit-hooks/config.toml` (user decision, 2026-10-08) so functions can carry
doc comments; the no-other-comments rule under Conventions is now a convention, not a check.

Enforcement in this repo:
- `.claude/hooks/habit-hooks-file.sh` (PostToolUse) checks every `.ts`/`.tsx` file Claude writes.
- `.claude/hooks/habit-hooks-stop.sh` (Stop) blocks finishing a turn while the project is not clean.
- `.githooks/pre-commit` blocks commits with enforced findings (`git config core.hooksPath .githooks`).

Key limits from the TypeScript plugin's eslint config: functions ≤ 12 lines,
≤ 3 parameters, complexity ≤ 10, nesting ≤ 4, files ≤ 200 lines, `===` only,
no `var`, `const` where possible, no inferrable type annotations, no unused code
(knip: unused files, exports, dependencies).

## Conventions

- Every function and method in `src/` gets a succinct one-line `/** … */` doc comment
  stating its purpose: what it is for, not how it works, as a full sentence. Write it with
  the function and update it when the purpose changes. Tests stay uncommented.
- No other comments, except one explaining *why* something non-obvious was chosen.
- Tests live in `tests/` (habit-hooks' knip config treats `tests/**` as entry points).
- New dependencies: exact or `~` pins, installed via the lockfile.

## Commands

- `npm run check`: typecheck, tests, habit-hooks (run before claiming any task done)
- `npm start -- run`: one agent run using `.env` and `data/`
- Traces: `data/runs/*.jsonl`
