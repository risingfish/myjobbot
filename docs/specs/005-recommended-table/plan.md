# Implementation Plan: Tighter job tables

**Branch**: `005-recommended-table` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/005-recommended-table/spec.md`

## Summary

Narrow the Recommended and All Jobs tables, which share `JobTable`:
- **Scored column**: drop it.
- **Score**: show only the number. The breakdown goes into a CSS-only tooltip that opens on hover
  and on keyboard focus.
- **Title**: cut to 64 user-perceived characters with "…", keeping the full title in the link's
  `title`.
- **Title column**: make it wrap anywhere, so an opened "Why" can't widen the table.

The truncation decision is a plain function in `src/web/` with unit tests; the components only
render it. Storage, the agent and the Reasoning page are untouched.

## Technical Context

**Language/Version**: TypeScript 5 on Node 24 (server) and current browsers (client)

**Primary Dependencies**: Next.js 16 / React 19 (existing); no new dependencies

**Storage**: none touched (MariaDB keeps `scored_at`; only the display drops it)

**Testing**: vitest: `node` project (unit), `dom` project (UI, happy-dom)

**Target Platform**: the owner's laptop browser; the web UI runs in Docker (`next dev`)

**Project Type**: web UI inside the existing agent repo (`web/` + `src/web/`)

**Performance Goals**: none new; pages stay within feature 004's timings

**Constraints**: no JavaScript needed for the tooltip, so server-rendered rows and rows added by
infinite scroll behave the same; habit-hooks limits (functions ≤ 20 lines, files ≤ 200 lines)

**Scale/Scope**: about 800 jobs; 4 components, 1 view type, 1 stylesheet, 1 new pure module

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (constitution v2.2.0)

| Principle | Status |
|---|---|
| I. Habit-hooks clean at every sitting boundary | Pass: small components; the new module is one short function |
| II. Test-first; `check` and `check:db` before done | Pass: tests are written first, see the split below; `check:db` still runs at each sitting's end |
| III. Purpose comments only | Pass: one-line doc comment on each new or changed function |
| IV. Bounded, locked dependencies | Pass: no new dependencies (`Intl.Segmenter` is built in) |
| V. Specs live in `docs/specs` | Pass |
| Workflow: sittings, main checkout, Docker stopped | Pass: S0 stops the stack, which is production since 004, so scheduled runs pause until merge |

**New tests' split (Principle II)**: about 5 unit tests (truncation: short, exactly 64, long,
emoji/accents; the row view carries the short title), 0 integration, and the existing UI tests in
`tests/client/jobRow.test.tsx` changed in place (score tooltip, truncated title, no Scored
cell), plus at most 1 new UI test for the table headers. That moves the mix toward unit.

Post-design re-check: still passes; no violations, so no Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
docs/specs/005-recommended-table/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/job-table.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/web/
├── api.ts              # JobRowView: + shortTitle, − scoredDate
├── rowViews.ts         # fills shortTitle; stops filling scoredDate
└── shortTitle.ts       # NEW: shortTitle(title, limit) → first 64 graphemes + "…"
web/components/tables/
├── Tables.tsx          # JOB_HEADERS without "Scored"
├── JobRow.tsx          # uses ScoreTipCell
├── ScoreTipCell.tsx    # NEW: number + focusable tooltip; VerdictRow keeps ScoreCell
├── TitleCell.tsx       # renders shortTitle, full title in the link's title attribute
└── JobCells.tsx        # WhenCells loses the Scored cell
web/app/styles.css      # .score-col narrow, .tip tooltip, .title-cell wrapping
tests/
├── shortTitle.test.ts  # NEW (unit)
├── helpers/rowFixtures.ts
└── client/jobRow.test.tsx
```

**Structure Decision**: keep the existing split. Decisions go in `src/web/` and are unit-tested;
rendering stays in `web/components/`.
