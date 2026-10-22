# Implementation Plan: Markdown job descriptions

**Branch**: `012-markdown-descriptions` | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/012-markdown-descriptions/spec.md`

## Summary

Job descriptions become Markdown wherever a source sends HTML: Greenhouse, Ashby, Workday, Lever (its
whole posting) and careers pages the lookup finds. **turndown** converts the HTML with an allow-list
of kept formatting, so nothing dangerous is stored; **react-markdown** shows it in the details panel
with raw HTML skipped, images unrendered and only web links, opening in a new tab. A new
`description_format` column tells Markdown from the plain text JSearch still sends and from rows
stored before this feature. The model and the title boosts read a copy with link addresses removed.
Each job is scored again once, the first time its description changes to Markdown.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx), React 19 / Next.js 16 for the web UI

**Primary Dependencies**: turndown 7.2.4 and react-markdown 10.1.0 (both approved by the owner on
2026-10-22, research R1–R2), @types/turndown 5.0.6 (dev); existing Kysely 0.29, zod 4, htmlparser2

**Storage**: MariaDB through Kysely; migration `007_description_format` adds one column (R3)

**Testing**: vitest (`node`, `dom` and `integration` projects); the store contract runs on memory and
on `myjobbot_test`

**Target Platform**: the Docker stack on the owner's LAN (agent, web UI, browser service)

**Project Type**: CLI agent plus a Next.js web UI in one repository

**Performance Goals**: the panel still opens within 1 second (SC-004); converting one posting is a
few milliseconds, well inside a run

**Constraints**: descriptions at most 20,000 characters, the model's copy at most 6,000; no raw HTML
stored or rendered; nothing loaded from outside when a description is shown

**Scale/Scope**: about 1,040 stored jobs today (319 Lever, 695 JSearch, alerts), but no companies are
configured, so only boards configured again (and careers lookups) produce Markdown; each such job is
re-scored once

## Constitution Check

*Checked against constitution v2.3.0. GATE passes before Phase 0 and again after Phase 1.*

| Principle | Status |
|---|---|
| I. Habit-hooks clean | Pass. New code is small modules (`src/descriptions/`, one panel component); each PR's new modules are reached from production code in the same sitting (R9 orders them so). |
| II. Test-first | Pass. Tests precede code in every sitting. Display decisions are plain functions with unit tests, so the split is ~50 unit / ~5 integration / 2 UI (R10), which moves the mix (83 / 8 / 9 today) toward 95 / 4 / 1. |
| III. Purpose comments | Pass. Every new function gets its one-line doc comment. |
| IV. Bounded, locked dependencies | Pass. Both libraries were presented with alternatives and approved by the owner; pinned exactly and installed through the lockfile in the sitting of their first import. Used through their own APIs: turndown's `remove`/`addRule`, react-markdown's props and `components`. Migration 007 uses Kysely's schema builder and a builder data step; the re-scoring rule uses `eb.case()` with a `VALUES()` fragment as the upsert does today. |
| V. Specs in docs/specs | Pass. |

## Project Structure

### Documentation (this feature)

```text
docs/specs/012-markdown-descriptions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/descriptions.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── descriptions/
│   ├── readable.ts          # readableDescription: the model's and boosts' copy (PR 2)
│   ├── cap.ts               # capDescription: the 20,000-character cut (PR 6)
│   └── toMarkdown.ts        # turndown services from one factory (PR 6); pageToMarkdown (PR 9)
├── db/
│   ├── migrations/007_description_format.ts, migrations/index.ts, schema.ts   # PR 1
│   ├── rows.ts, store.ts    # PR 1
│   └── kysely/jobStore.ts   # format written (PR 1); re-scoring rule (PR 5)
│       kysely/jobViews.ts   # JOB_COLUMNS gains the format (PR 1)
├── jobs/job.ts              # descriptionFormat (PR 1); capDescription (PR 6)
├── gmail/alertStore.ts      # copies the match's format (PR 1)
├── tools/getJobDetails.ts   # readable copy for the model (PR 2)
├── careers/boardPages.ts, readPage.ts, session.ts, tools.ts, outcome.ts, lookUpJob.ts
│                            # board path keeps the format (PR 3); downloads (PR 9)
├── sources/
│   ├── ashby.ts             # PR 6
│   ├── greenhouse.ts, workday.ts, htmlText.ts  # PR 7
│   └── lever.ts             # whole posting (PR 8)
└── web/rowViews.ts, pageData.ts (PR 2), jobDetail.ts, api.ts (PR 4)

web/
├── lib/markdown.ts          # markdownHref, descriptionHeading (PR 4)
├── components/panel/MarkdownText.tsx, DescriptionSection.tsx   # PR 4
└── app/styles.css           # description headings and links (PR 4)

tests/
├── readable.test.ts, markdown.test.ts, pageMarkdown.test.ts, descriptionCap.test.ts,
│   markdownDisplay.test.ts                       # unit
├── sources, careers, job and web tests (extended) # unit
├── helpers/descriptionContract.ts                # format and re-scoring (memory + MariaDB)
├── integration/migrate.test.ts                   # migration 007
└── client/panelSections.test.tsx                 # 2 UI tests
```

**Structure Decision**: one new folder, `src/descriptions/`, holds the conversion and the readable
copy, since boards, the careers lookup, tools and the web views all use them. Everything else
extends existing files.

## Delivery (research R9)

| PR | Sitting | Content | Owner can test |
|---|---|---|---|
| docs | S0 | spec, plan, research, data model, contract, quickstart, tasks | — |
| 1 | S1 | `description_format` column (all rows `'text'`) | Nothing visible; the column exists |
| 2 | S2 | Readable copy for the model and title boosts | Nothing visible; tests |
| 3 | S3 | Careers lookup's board path keeps a description's format | Nothing visible; tests |
| 4 | S4 | Display with react-markdown | Nothing on real jobs; tests show Markdown safely |
| 5 | S5 | Scoring again once on the change to Markdown | Nothing visible; contract tests |
| 6 | S6 | turndown conversion and hostile tests; `capDescription`; Ashby | Ashby jobs formatted (with an Ashby company configured) |
| 7 | S7 | Greenhouse; Workday through the careers lookup | Greenhouse jobs, and lookups that land on Workday, formatted |
| 8 | S8 | Lever's whole posting | Lever jobs formatted with their lists (with a Lever company configured) |
| 9 | S9 | Careers pages downloaded or rendered | Lookup-found descriptions formatted |
| 10 | S10 | README, CLAUDE.md and the test ledger | — |

## Complexity Tracking

No constitution violations to justify.
