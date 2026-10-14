# myjobbot Constitution

## Core Principles

### I. Habit-hooks clean at all times

All TypeScript in `src/`, `web/` and `tests/` MUST pass habit-hooks with zero findings, at all
times, not only at commit:
- functions at most 20 lines, at most 3 parameters, complexity at most 10, nesting at most 4
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
(typecheck, tests, habit-hooks) MUST pass before any task is called done.

Rationale: the agent runs unattended; the check is the only proof a change works.

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

Rationale: libraries save work, but each one is code the owner has to trust, so the owner picks
it. A floor-only pin lets any future release, including a compromised one, into a clean build;
a lockfile missing platform entries breaks installs on other machines.

### V. Specs live in docs/specs

Spec-kit feature directories MUST live in `docs/specs/NNN-name/`, never `./specs`.

Rationale: one documentation root for the project.

## Quality Gates

- `.claude/hooks/habit-hooks-file.sh` (PostToolUse) checks every `.ts`/`.tsx` file Claude writes.
- `.claude/hooks/habit-hooks-stop.sh` (Stop) blocks finishing a turn while the project is not
  clean.
- `.githooks/pre-commit` blocks commits with enforced findings
  (`git config core.hooksPath .githooks`).
- `knip.json` and `eslint.config.mjs` replace habit-hooks' shipped configs (the ESLint copy raises
  the function limit to 20 lines, owner decision 2026-10-14, because Prettier lays out JSX and
  object literals one item per line). When habit-hooks is upgraded, both MUST be diffed against
  the shipped configs and changes carried over.
- `non-essential-comment` is disabled in `.habit-hooks/config.toml` (owner decision,
  2026-10-08) so functions can carry doc comments; Principle III's no-other-comments rule is a
  convention, not a check.
- No exemptions: no `eslint-disable`, no snoozes, no ignore entries added to make a check pass.

## Development Workflow

- Features go through spec-kit: specify, clarify, plan, tasks, analyze, implement. Every plan
  has a Constitution Check against Principles I–V.
- `npm run check` is the gate before any task is called done (Principle II).
- habit-hooks output is a direct instruction from the owner, with the highest priority: each
  reported item becomes a task and is completed before other work continues.

## Governance

This constitution records the project's existing rules. Amendments are made by the owner and
recorded here with a version bump: MAJOR for removing or redefining a principle, MINOR for adding
or materially extending one, PATCH for wording. `CLAUDE.md` remains the day-to-day guide and MUST
agree with this constitution; when they differ, both are brought back in line in the same change.
Every plan's Constitution Check cites the version it was checked against.

**Version**: 1.3.0 | **Ratified**: 2026-10-13 | **Last Amended**: 2026-10-14
