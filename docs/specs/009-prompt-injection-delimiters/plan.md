# Implementation Plan: Run-bound delimiters against prompt injection

**Branch**: `009-prompt-injection-delimiters` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/009-prompt-injection-delimiters/spec.md`

## Summary

Every result of a tool that returns outside text is wrapped once in this run's markers, in the
agent loop both conversations share:
- the tools are `fetch_jobs`, `get_job_details`, `search_careers` and `open_link`;
- the markers are `<<data TAG>>` … `<</data TAG>>`, with `TAG` taken from the random run ID;
- the job named in a careers lookup's opening message is wrapped the same way.

Before wrapping, a pure scrub removes every look-alike marker start from every string, and
remembers which job each removal came from. Each removal is noted in the trace and flags that job
(`jobs.injection_seen_at`, migration 006, written with Kysely's builder). The web UI shows a badge
on flagged jobs. Both system prompts name the markers and say their contents are data.

## Technical Context

**Language/Version**: TypeScript on Node 24, ESM.

**Primary Dependencies**: existing only (zod, Kysely, Next.js). No new library.

**Storage**: MariaDB through Kysely. Migration `006_injection_flag` adds one nullable column to
`jobs`.

**Testing**:
- vitest: unit tests on fakes, the MariaDB contract and migration under `check:db`, and one UI test.
- SC-002 is a manual check against the owner's local model (quickstart §3).

**Target Platform**: the Docker stack on roboto.

**Project Type**: CLI agent with a Next.js web UI.

**Performance Goals**: markers add about 50 characters per wrapped result, under 5% of a typical
result (SC-004).

**Constraints**:
- The trace and audit log stay unwrapped.
- Code-enforced limits are unchanged (FR-007).
- Habit-hooks limits apply. `src/careers/tools.ts` is 144 lines and `src/agent/loop.ts` about 105,
  so the scrubbing and wrapping go in new files.

**Scale/Scope**: 8 tools, 2 conversations, 1 column, 1 badge.

## Constitution Check

*Checked against constitution v2.3.0.*

| Principle | How this plan complies |
|---|---|
| I. Habit-hooks clean | New modules: `src/agent/markers.ts` (markers, scrub) and `src/agent/wrapped.ts` (scrub, serialise and wrap a tool outcome). The loop calls `wrapped.ts`, so both modules are wired from `runAgent` in the sitting that creates them. |
| II. Test-first, checked | Tests come first in every sitting. **Split:** about 27 unit, 2 integration and 1 UI. **Gate:** `check` and `check:db` at every sitting end. The main agent's reporter is a plain function (`lookalikes.ts`), so it is unit-tested. |
| III. Purpose comments | Every new function gets one. |
| IV. Bounded, locked deps, used their own way | No new dependency. Migration 006 uses Kysely's schema builder, and `flagInjection` the query builder. |
| V. docs/specs | This directory. |

Result: **PASS**.

## Project Structure

### Documentation

```text
docs/specs/009-prompt-injection-delimiters/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/data-markers.md
└── checklists/requirements.md
```

### Source Code

```text
src/agent/markers.ts        NEW  dataMarkers(runId), scrub(value) → { value, hits } (R2–R4)
src/agent/wrapped.ts        NEW  wrapOutcome({ outsideText, outcome, markers }) → { content, hits } (R4)
src/agent/loop.ts                AgentDeps.markers + onLookalike; execute() looks the tool up by name (unknown → bare),
                                 records unwrapped content + wrapped flag in the trace, wrapped content in history
src/agent/prompt.ts              initialMessages(config, markers): the shared data sentence (R8)
src/tools/tool.ts                ToolSpec/Tool.outsideText (required) (R5)
src/tools/dispatch.ts            unchanged: returns { ok, content }; wrapping happens in the loop
src/tools/{fetchJobs,getJobDetails,listSources,recordMatches,finish}.ts   declare outsideText
src/careers/tools.ts             search_careers/open_link true, finish_lookup false; search_careers description made generic (no company)
src/careers/prompt.ts            lookupMessages(job, remembered, markers): job + remembered page wrapped; {company} removed from SYSTEM (R1, R8)
src/careers/lookUpJob.ts         markers + onLookalike (trace, flag the looked-up job) in agentDeps
src/app/lookalikes.ts       NEW  reportLookalike(context, hit): trace event, flagInjection, failures traced (R6)
src/app/run.ts                   build markers from runId; onLookalike → reportLookalike
src/db/migrations/006_injection_flag.ts NEW (schema builder); index.ts; schema.ts; rows.ts; store.ts
src/db/kysely/jobStore.ts        flagInjection (query builder)
src/db/kysely/jobViews.ts        JOB_COLUMNS + injection_seen_at
src/web/api.ts, rowViews.ts      JobRowView.injection
web/components/tables/TitleCell.tsx   badge; web/app/styles.css `.injection`
tests/markers.test.ts, tests/wrapped.test.ts, tests/toolDeclarations.test.ts   NEW (unit)
tests/prompt.test.ts (NEW; the two initialMessages tests move here from getJobDetails.test.ts)
tests/lookalikes.test.ts, tests/careersMarkers.test.ts   NEW (unit)
tests/agent-loop.test.ts, tests/webRows.test.ts   + cases (unit)
tests/helpers/descriptionContract.ts + flagInjection case; tests/integration/migrate.test.ts + 006
tests/client/jobRow.test.tsx   + badge case (UI)
```

**Structure Decision**: markers and wrapping live in `src/agent/` because the loop owns them and
both conversations reach them through `runAgent`. The tools only declare `outsideText`.

## Sittings (outline for /speckit-tasks)

1. **S0**: stop the stack (it is running production from main) and record a green baseline.
2. **S1, wrapping (US1, US2):**
   - `markers.ts`, `wrapped.ts` and `Tool.outsideText` on all eight tools.
   - The loop wraps results and keeps the trace unwrapped.
   - Both prompts name the markers, and the lookup's opening job is wrapped.
   - `onLookalike` writes the trace note only (`reportLookalike`), which already meets FR-006.
3. **S2, flag and badge (US3):**
   - Migration 006, `flagInjection` and the contract case.
   - `onLookalike` also flags the job, in both conversations.
   - The row view gets `injection`, and `TitleCell` shows the badge.
4. **S3, docs and live check:**
   - README (how outside text reaches the model) and the CLAUDE.md note.
   - After the merge: quickstart §2, and §3 on `myjobbot_test`.

## Risks

- **A small model may ignore the markers.** That's the reason for FR-007 and SC-002's manual
  check; the code limits don't depend on the model obeying.
- **Lookalike Unicode or escaped spellings get past the scrub** (R3). This is documented.
- **The lookup system prompt no longer embeds the job**, which moves to the wrapped opening
  message. Existing lookup tests that read the system prompt for the job change in S1.
