# Implementation Plan: SOLID conformance across the whole app

**Branch**: `028-solid-conformance` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/028-solid-conformance/spec.md`

## Summary

- **The review is done.** Eight area inventories under [inventory/](inventory/) cover all 456 app
  modules and the 23 in-memory helpers. They hold 64 findings:
  - 61 to fix, including D10, which the deep analysis found
  - 3 accepted with the owner's approval, 2026-11-08 (A5, U8, K6)
  - 0 follow-ups

  [research.md](research.md) R2 has the totals by area and rule.
- **The fixes** are moves and narrowings that change no behaviour:
  - split wide contexts and grouped interfaces into the narrow ones their callers use (`ToolContext`,
    `CareersStore`'s users, `SessionStore`, `AccountStore`, `TokenStore`, `store.ts`, `uiState.ts`)
  - replace per-variant branches with registries or `Record`-keyed tables (sources' run hooks, board
    names, link purposes, requirements, verdict pass rules, field controls)
  - hand decisions their clocks, randomness and clients
  - give the memory stores one list of users, as MariaDB has
- **The 027 follow-ups**:
  - step `024` drops `jobs.emailed_at`, refusing if any posting holds a value
  - eval runs record their user, and reports show it and warn when compared runs differ
  - the store methods nothing calls go: `ApiCallLog.lastCallAt` and `AccountStore.isAdmin`
- **Guard tests**: each area's mechanical checks become tests, so a fixed breach can't come back.

## Technical Context

**Language/Version**: TypeScript 6.0.3 on Node 24

**Primary Dependencies**: Next.js 16.4, Kysely, zod (unchanged; no new dependency, SC-008)

**Storage**: MariaDB 10.11 through Kysely. One new step, `024_jobs_without_digest_mark`, which drops
one always-empty column. Eval files gain an optional `userId` on `run.json`.

**Testing**:
- vitest `node` (unit, memory stores), `dom` (UI) and `integration` (MariaDB contracts and
  migration tests).
- Store contracts move with the interfaces they test; their cases are unchanged.

**Target Platform**: the existing Docker stack and Kubernetes chart

**Project Type**: web service, CLI and scheduled agent run, in one repository

**Performance Goals**: a run takes no more than 10% longer than before (SC-005). The fixes change
types and call paths, not queries, apart from step 024.

**Constraints**:
- No change to behaviour, output, trace events, prompts, the schema (apart from 024) or file formats
  (apart from the run's `userId`) (FR-004).
- Every existing test keeps its expectations, except structure assertions and the eval report lines
  FR-009 changes. The run prompt snapshot doesn't change.
- No `eslint-disable`, no snoozes (Principle I).

**Scale/Scope**: 61 fixes across roughly 150 files, in twelve sittings, a commit each, in one pull request.

## Constitution Check

Checked against constitution **2.7.0**.

| Principle | How the plan meets it |
|---|---|
| I. Habit-hooks clean | Every sitting ends with `npm run check` and `npm run check:db` green and the marker removed. The fixes are written to the limits up front. |
| II. Test-first | Each sitting writes its guard tests and the follow-up tests first. The split is in the ledger below. Moved code keeps its existing tests. |
| III. Purpose comments only | Every moved or new function keeps or gets its one-line doc comment; no other comments. |
| IV. Bounded dependencies, libraries their own way | No new dependency. Kysely builders for step 024. Next.js server actions keep being imported by client components, as designed (K6). |
| V. Specs in docs/specs | This directory. |
| VI. SOLID | The feature *is* the SOLID pass. Each rule is applied as follows. |

**Principle VI by rule**:
- **SRP**: the grouped interfaces split, one job each: D1–D3, D6, D9, W1, W3, W5, W9, U3, U4, K3,
  K4, S7, C7, E9.
- **OCP**: per-variant branches become registries or `Record` tables, guarded by scans or types:
  A3, S1, S3–S5, C4, D4, D5, E1–E4, U5–U7, W7, W8, K1, K2, K5.
- **LSP**: the memory stores share one list of users, so they refuse what MariaDB refuses (D7).
- **ISP**: callers take the narrow part they use: A1, A2, A4, S2, S6, C1–C3, D8, D10, E8, U1, U2,
  W2.
- **DIP**: decisions are handed their clocks, randomness and clients: S8, S9, C5, C6, E5–E7, W4,
  W6, W10.
- The three acceptances (A5, U8, K6) were approved by the owner on 2026-11-08 (research R3).

**Gate**: passes. No complexity is added that needs justifying, and the acceptances carry the
owner's approval.

## Project Structure

### Documentation (this feature)

```text
docs/specs/028-solid-conformance/
├── spec.md
├── plan.md            # this file
├── research.md        # review method, totals, acceptances, order, the follow-ups' design
├── data-model.md      # the schema change, the run file field, the interfaces that move
├── quickstart.md      # how to check each sitting and the whole
├── contracts/
│   ├── eval-report.md     # the user in reports and the comparison note
│   └── upgrade-024.md     # step 024 and its refusal
├── inventory/         # the eight area inventories (FR-002)
└── tasks.md           # from /speckit-tasks
```

### Source Code (repository root)

The layout stays as it is. Fixes add small modules beside the code they come from. Each one's place
is in its finding's **Fix** line:
- `src/sources/runHooks.ts` with `src/sources/hooks/gmailAlerts.ts` (S1)
- `src/db/attemptStore.ts`, `src/db/securityEventLog.ts`, and the token stores split three ways
  (D1–D3)
- `src/db/owner.ts` (D6)
- the moved store interfaces from `src/db/store.ts` (D9)
- the `ToolContext` parts in `src/tools/context.ts` (A2)
- the web loaders split out of `web/lib/uiState.ts` (W1)

**Structure Decision**: no new top-level folders. Every new file sits in the area it serves.

## Sittings

| Sitting | Area | Findings | Story |
|---|---|---|---|
| S1 | The 027 follow-ups | step 024, eval run's user, D8, D10 | US2 |
| S2a | Store types moved | D6, D9 | US1 |
| S2b | Store splits, one user list | D1–D5, D7 | US1 |
| S3a | The run's contexts | A1, A2, A4, C3 | US1 |
| S3b | Sources and their hooks | A3, S1–S5, S9, C4 | US1 |
| S4 | Gmail, careers lookup, re-score | S6–S8, C1, C2, C5–C7 | US1 |
| S5 | Evals, resume, profile | E1–E9 | US1 |
| S6a | Web rules | U1–U7 | US1 |
| S6b | Web server side | W1–W10 | US1 |
| S7a | Display helpers out of components, filter labels (stack stopped) | K3, K4, K5 | US1 |
| S7b | Components' tables (stack running, UI work) | K1, K2 | US1 |
| S8 | Guidance and final check | FR-007; the inventory closed | US1 |

Each row is one sitting and one commit; the feature ships as one pull request (research R9). The
largest sittings are split so each commit stays small; tasks.md gives each part's tasks. S7a stops the stack because it moves code out of components into `src/`
(including `src/mail/messages.ts`), which isn't UI work under constitution 2.5.0. S7b changes only
components.

S1 is independent and ships first, with the backup note. S2 then S3 come before the rest, because
they change the interfaces the others import. After S3 the order is S4 → S5 (both change the
one-job session's clock, C5 then E5) and S6 → S7 (K5 needs U7). Then S8.

## Test ledger (Principle II)

Baseline (main after 027): unit 1142, integration 89, UI 78.

| Sitting | Unit | Integration | UI |
|---|---|---|---|
| S1 | +9 (eval runs ×7, the import's retired column, store methods used) | +1 (step 024 refuses, then drops) | +0 |
| S2 | +6 (`Stores` has no operations, store scans ×3, contract cases ×2) | +2 (the contract cases on MariaDB) | +0 |
| S3 | +8 (variant and import scans ×4, no bare `ToolContext`, run hooks ×3) | +0 | +0 |
| S4 | +5 (roots scans ×3, narrow-store types, the LAN check) | +0 | +0 |
| S5 | +5 (evals scans ×3, verdict bands, failure reasons) | +0 | +0 |
| S6 | +12 (web scans ×6, link purposes, one section per field, source switching ×2, re-score follow ×2) | +0 | +0 |
| S7 | +3 (notice lines, component scans ×2; all in S7a) | +0 | +0 |
| **Planned** | **+48** | **+3** | **+0** |

That is 94% unit and 6% integration among the new tests. All three shares move toward the target:
unit from 87.24% (1142 of 1309) to 87.50% (1190 of 1360), integration from 6.80% (89) to 6.76%
(92), and UI from 5.96% (78) to 5.74%. The three integration cases are needed because only MariaDB
can show them:
- that step 024 refuses a set mark, then drops the column once it is cleared (one case)
- that the foreign keys refuse a write for an unknown user (D7), for the resume and the source
  stores

The owner case of D7 is an assertion added to the existing search-settings contract test, which
already checks on MariaDB that the first save creates user 1.

This file and tasks.md carry the same counts.

## Complexity Tracking

None. Every change removes a breach and adds no layer that needs justifying.
