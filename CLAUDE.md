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
(`warning-comment`, `explicit-any`, `non-null-assertion`, `non-essential-comment`,
`duplicated-code`, `swallowed-exception`) are fixed too, not left as warnings.

Enforcement in this repo:
- `.claude/hooks/habit-hooks-file.sh` (PostToolUse) checks every `.ts`/`.tsx` file Claude writes.
- `.claude/hooks/habit-hooks-stop.sh` (Stop) blocks finishing a turn while the project is not clean.
- `.githooks/pre-commit` blocks commits with enforced findings (`git config core.hooksPath .githooks`).

Key limits from the TypeScript plugin's eslint config: functions ≤ 12 lines,
≤ 3 parameters, complexity ≤ 10, nesting ≤ 4, files ≤ 200 lines, `===` only,
no `var`, `const` where possible, no inferrable type annotations, no unused code
(knip: unused files, exports, dependencies).

## Conventions

- Tests live in `tests/` (habit-hooks' knip config treats `tests/**` as entry points).
- New dependencies: exact or `~` pins, installed via the lockfile.
