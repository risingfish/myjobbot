# Implementation Plan: Split the README

**Branch**: `026-split-readme` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/026-split-readme/spec.md`

## Summary

Cut `README.md` from 1,281 lines (at `693a827`, with features 024 and 025) to ≤ 250: a summary, two quickstart paths, the parts, the job
sources, a scoring overview and links. Everything else moves, once each, to six pages in `docs/`
(how it works + UI, CLI, sources, database, developing, deploying), following the content map in
[data-model.md](data-model.md). Facts found out of date are corrected against the code
([research.md](research.md) R1, R5, R6). One new file outside the docs, `compose.full.yaml`, runs the
whole stack (app, web UI, MariaDB, SearXNG, browser) from a fresh clone
([contracts/compose-full.md](contracts/compose-full.md)); `.env.example` gains a comment block for
it. Both quickstart paths include 024's sign-in setup (base URL, first admin). The owner's text on
proxies and the sign-in limits goes into Deploying, and its fuller comment replaces
`web.trustedProxies`' in the chart's `values.yaml` (spec FR-015, research R6b). No app code changes.

## Technical Context

**Language/Version**: Markdown (GitHub-flavoured, with Mermaid); Docker Compose YAML (Compose 2.40)

**Primary Dependencies**: None new. New container image in `compose.full.yaml` only: `mariadb`,
pinned to an exact 11.8 LTS tag (R3). SearXNG and Playwright images reuse `compose.yaml`'s pins.

**Storage**: The full stack's own MariaDB in a named volume; nothing changes for existing databases

**Testing**: No new automated tests (no code). Validation is [quickstart.md](quickstart.md): page
shape, a one-off link checker (R7), the content-map walk (R8), `docker compose config --quiet`, one
fresh-clone bring-up, then `npm run check` (no `npm run check:db`: owner decision, see Constitution Check)

**Target Platform**: GitHub's Markdown rendering; Docker hosts (amd64, arm64)

**Project Type**: Documentation for the existing web service + CLI

**Performance Goals**: N/A

**Constraints**: README ≤ 250 lines, first quickstart command within 40 lines; one home per fact;
never print `.env` (`docker compose config` only with `--quiet`); no secrets in `compose.full.yaml`

**Scale/Scope**: 1 README rewritten, 6 new pages (~1,150 lines moved), 1 compose file, 2 lines in
`CLAUDE.md`, 1 block in `.env.example`, 1 comment in `values.yaml`

## Constitution Check

*Checked against constitution 2.6.0 (2026-11-07; its change from 2.5.0, the parameter limit, doesn't touch this feature).*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. No TypeScript is touched; each sitting still ends with `npm run check` green. |
| II. Test-first | Pass, with an owner decision. No code, so no tests to write first. New tests: **0 unit, 0 integration, 0 UI**. Each sitting ends with `npm run check` green. `npm run check:db` is **not** run: the feature is documentation only and touches no code or schema (owner decision, 2026-11-07), so the integration tests can't be affected. |
| III. Purpose comments | N/A (no functions). |
| IV. Bounded, locked dependencies | Pass with a note. No npm dependency. The one new image (`mariadb`) is pinned to an exact tag; it is a container the owner already runs (MariaDB is the project's database), in a file that is opt-in. The owner approved it on 2026-11-08 (11.8 LTS over 10.11 and 11.4), pinned as `mariadb:11.8.9`. |
| V. Specs in docs/specs | Pass. |
| Workflow: sittings, stack | The work is done in `myjobbot_alt`, the second session's checkout (its own clone with its own `.env` and `_alt` databases, standing in for the worktree the constitution names); the Docker stack serves the main checkout, so nothing here reaches it, and docs work doesn't touch `src/` or `web/` anyway. The stack may stay up. The fresh-clone bring-up uses its own project name (`myjobbot-fulltest`) and port (8099) and a throwaway database, then `down -v`. |
| Workflow: databases | The full stack makes its own database inside its own container; it never points at `myjobbot`, `myjobbot_dev*` or `myjobbot_test*`. |
| CLAUDE.md agreement | `CLAUDE.md`'s README pointers (Evals, Develop) are updated in the same change (FR-012). The constitution names no README section. |

Re-checked after Phase 1: unchanged.

## Project Structure

### Documentation (this feature)

```text
docs/specs/026-split-readme/
├── spec.md
├── plan.md               # this file
├── research.md           # R1–R8: facts checked in the code, decisions
├── data-model.md         # the content map: today's 48 blocks → new page and heading
├── quickstart.md         # how to validate
├── contracts/
│   ├── readme-outline.md # the README's headings and what each holds
│   └── compose-full.md   # compose.full.yaml's services, environment, guarantees
├── owner-proxy-text.md   # the owner's proxy text, verbatim (FR-015)
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks
```

### Files changed in the repository

```text
README.md                 # rewritten (≤ 250 lines)
docs/how-it-works.md      # new
docs/cli.md               # new
docs/sources.md           # new
docs/database.md          # new
docs/developing.md        # new
docs/deploying.md         # new
compose.full.yaml         # new
.env.example              # a "Full stack" comment block; "(README, Develop)" → docs/developing.md
CLAUDE.md                 # README "Evals" → docs/cli.md; "README, Develop" → docs/developing.md
deploy/helm/myjobbot/values.yaml   # web.trustedProxies: the owner's fuller comment (comment only)
```

**Structure Decision**: Sub pages sit flat in `docs/` beside `react-walkthrough.md`; `docs/specs/`
and `docs/superpowers/` are untouched.

## Approach

1. **Sub pages first, README last.** Each page is written from today's README by the content map,
   so while the work is in progress the old README still holds everything. The README is rewritten
   once all six pages exist, then links are checked.
2. **Move, then correct.** Text moves as is, with links retargeted; only the rows in research R6 are
   reworded, and each correction is checked against the file named there.
3. **The compose file and the README share a sitting**: the README's first quickstart path is the
   compose file, so both are proven together by the fresh-clone bring-up.

Suggested sittings (final split in `tasks.md`):

| Sitting | Work | Stack |
|---|---|---|
| 1 | `docs/how-it-works.md`, `docs/database.md` | may run |
| 2 | `docs/cli.md`, `docs/sources.md`, `docs/developing.md`, `docs/deploying.md` (with the proxies section), the `values.yaml` comment | may run |
| 3 | `compose.full.yaml`, `.env.example` block, `config --quiet`, fresh-clone bring-up; rewrite `README.md` | may run (bring-up as a separate project) |
| 4 | `CLAUDE.md` pointers, link check, content-map walk, 20-fact sample, the gate | may run |

## Follow-ups (out of scope, for the owner)

- The Sign-ins check can't catch a `trustedProxies` count that is too high, or 0 (research R6b). A
  way to see the raw `X-Forwarded-For` the app received (an admin-only diagnostic, say) would make
  the check complete.
- `docker/entrypoint.sh` requires `data/resume.md` even though an uploaded resume makes it optional
  (R5).
- `src/agent/llm.ts` sends `top_k` and `repeat_penalty`, which OpenAI's hosted API rejects; making
  them optional would let the LLM part honestly say "any OpenAI-compatible API" (R1).

## Complexity Tracking

None.
