# Implementation Plan: Read careers pages built by JavaScript

**Branch**: `010-rendered-careers-pages` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/010-rendered-careers-pages/spec.md`

## Summary

The careers lookup (008) found 1 of 20 jobs in production because most job boards build their
pages with JavaScript and the trimmed HTML is empty (research R1). This feature puts one function,
`readPage`, behind `open_link`. It tries three ways of reading a page, in order:

1. **Board data** for Ashby, Greenhouse, Lever and Workday links. It reuses the `src/sources/`
   readers and adds a Workday reader plus a `parseBoardLink` that recognizes board addresses.
2. **Plain download**, which is 008's existing path.
3. **Rendering** through a remote Playwright browser (`playwright-core` 1.64.1, the owner's
   choice), only for pages whose plain download is unreadable. Every browser request is checked by
   the same address rules as the plain download.

It also changes three tool behaviours that wasted the model's steps:
- a repeat search returns a note instead of searching again;
- aggregator hosts are dropped from search results;
- a refused open is returned as a result, so it doesn't count toward the two-errors abort.

Finally, jobs that failed unreadable before 010 get one retry (migration 005).

## Technical Context

**Language/Version**: TypeScript on Node 24 (`node:24.21.0-bookworm-slim`), ESM.

**Primary Dependencies**:
- Existing: zod, htmlparser2 12.0.0 and Kysely.
- New: **playwright-core 1.64.1**, pinned exactly. It has no dependencies, and the owner approved
  it on 2026-10-17.
- Browser service: `mcr.microsoft.com/playwright:v1.64.1-noble`, running
  `npx -y playwright@1.64.1 run-server`.

**Storage**: MariaDB through Kysely. Migration `005_page_sources` adds four columns to
`careers_audit` and marks the pre-010 retry rows (data-model.md).

**Testing**: vitest. Unit tests use in-memory stores and fakes. `check:db` covers the MariaDB
contract and migration, plus one real-browser test that runs only when `MYJOBBOT_TEST_BROWSER_URL`
is set.

**Target Platform**: the Docker stack on roboto (Linux). The browser service runs as an optional
compose profile, or on another host.

**Project Type**: CLI agent with a Next.js web UI. This feature touches only the agent.

**Performance Goals**:
- Board pages take one request per board per run.
- A rendering takes about 2–10 seconds, capped at `render_seconds` (default 15).
- No change to run time when the browser is off.

**Constraints**:
- Every request passes `assertPublic`.
- Pages are at most `page_chars`, with or without rendering.
- Rendering uses a fresh context each time, with no images, fonts or media.
- The browser client and server versions must match.
- `src/careers` stays independent of alerts.
- Habit-hooks limits apply.

**Scale/Scope**: about 10–20 lookups per run and up to 4 opens each. Rendering happens only on
unreadable pages.

## Constitution Check

*Checked against constitution v2.2.0.*

| Principle | How this plan complies |
|---|---|
| I. Habit-hooks clean | **Sittings:** each one ends green. **File splits:** `tools.ts` (125 lines), `lookUpJob.ts` and `trim.ts` would grow, so reading moves to `readPage.ts`, board pages to `boardPages.ts`, rendering to `render.ts` and `renderState.ts`, and the budget step to `fitPage.ts`. **Wiring:** each new module is reached from `open_link` or `run.ts` in the sitting that creates it. |
| II. Test-first, checked | Tests come before code in every sitting. **Split:** about 48 unit, 4 integration and 0 UI (R14). **Gate:** `check` and `check:db` at every sitting end. |
| III. Purpose comments | Every new function gets its one-line doc comment. |
| IV. Bounded, locked deps | `playwright-core` is pinned to exactly `1.64.1` and installed through the lockfile in the sitting of its first import. The owner chose it after options were presented (R7). The compose image is pinned to `v1.64.1-noble`. |
| V. docs/specs | This directory. |

Result: **PASS**. There are no violations, so the Complexity Tracking table isn't needed.

## Project Structure

### Documentation (this feature)

```text
docs/specs/010-rendered-careers-pages/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/page-reading.md
├── checklists/requirements.md
└── tasks.md            (next: /speckit-tasks)
```

### Source Code

```text
src/sources/
├── boardLink.ts        NEW  parseBoardLink(url) → BoardLink | null (R3)
├── workday.ts          NEW  searchWorkday(http, link, text), workdayPosting(http, link, path) (R4)
└── index.ts                 unchanged (Workday is not a regular source yet)
src/http/client.ts           + postJson(url, body); request() takes method/body (R4)
src/careers/
├── fetchPage.ts             checkPublic → assertPublic, exported in S3 when boardPages uses it (R8)
├── fitPage.ts          NEW  budget step split out of trim.ts: ranking, link budget, cut (R5)
├── trim.ts                  walks HTML, then fitPage
├── boardPages.ts       NEW  board data → TrimmedPage (listing / posting / no longer listed), per-run cache (R5, R6)
├── render.ts           NEW  BrowserPort, renderPage (private routeVerdict) (R8, R9)
├── renderState.ts      NEW  per-run on/off, connection, LAN self-test (R9, R10)
├── readPage.ts         NEW  board → plain → rendered, with fallbacks → PageRead (contract)
├── skipHosts.ts        NEW  dropSkipped(results, hosts) (R11)
├── tools.ts                 repeat-search note; failed opens returned; audit page_source/fallback/board (R11, R13)
├── lookUpJob.ts             openPage → readPage; retry row (R12)
├── lookUpJobs.ts            skip hosts in cachedSearch; rendering notes in the summary
└── session.ts               SoughtJob.retry
src/tools/careersStep.ts     retries() → retried alert jobs (even if scored) with SoughtJob.retry; browser deps from context
src/db/kysely/jobStore.ts    setDescription also clears scored_at (rescoring after a retry)
src/tools/context.ts         careers.browser (render state)
src/app/run.ts               create render state from MYJOBBOT_BROWSER_URL; seam for tests
src/config/schema.ts         careers_lookup.render_seconds / skip_hosts / lan_probe_url; env MYJOBBOT_BROWSER_URL
src/db/migrations/005_page_sources.ts  NEW; index.ts lists it
src/db/schema.ts, store.ts, kysely/careersStore.ts   new columns, AuditEntry fields, retries()
compose.yaml                 browser service (profile "browser", network "browser" 172.31.250.0/24, shm_size 1gb)
.env.example, README.md, CLAUDE.md   MYJOBBOT_BROWSER_URL, the browser service, the firewall note

tests/
├── careersBoardLink.test.ts, careersWorkday.test.ts, careersBoardPages.test.ts   NEW (unit)
├── careersFitPage.test.ts, careersReadPage.test.ts, careersRender.test.ts        NEW (unit)
├── careersRenderState.test.ts, careersSkipHosts.test.ts, careersStep.test.ts     NEW (unit)
├── careersTools.test.ts, careersLookup.test.ts, careersLookUpJobs.test.ts        + cases (unit)
├── httpClient.test.ts, config.test.ts                                            + cases (unit)
├── helpers/fakeBrowser.ts, helpers/boardData.ts                                  NEW
├── helpers/careersStoreContract.ts, helpers/memoryCareersStore.ts                + retries, columns, plantRetryOnce
├── helpers/descriptionContract.ts, helpers/memoryStore.ts                        setDescription clears scored_at
└── integration/migrate.test.ts (+005), integration/render.test.ts NEW (gated)
```

**Structure Decision**:
- **Board recognition and reading** go in `src/sources/`, so a future board source shares them
  (FR-022).
- **How a page reaches the model** stays in `src/careers/`.
- **Rendering** lives in `src/careers/` because only the lookup uses it. Its address check is the
  shared `assertPublic`.

## Sittings (outline; tasks.md has the detail)

1. **S0**: stop the stack and record a green baseline.
2. **S1: shared reading path.**
   - Split out `fitPage`.
   - Rename `checkPublic` to `assertPublic` (still private; exported in S3).
   - Add `readPage` with only the plain step.
   - Migration 005 and the audit columns, with `page_source = html`.
3. **S2: retry once (FR-023).** `retries()`, `SoughtJob.retry`, the `retry` row, retried jobs
   picked even when already scored, and `setDescription` clearing `scored_at`.
4. **S3: board data (US1, MVP).** `parseBoardLink`, `postJson`, the Workday reader, `boardPages`,
   and the board step with the `board_failed` fallback.
5. **S4: rendering (US2, US3).**
   - Install playwright-core 1.64.1.
   - `render.ts` and `renderState.ts`, the config and env settings, and the self-test.
   - Wired into `readPage` and `run.ts` in the same sitting, so knip stays clean.
6. **S5: tool behaviour (US4).** Skip hosts, the repeat-search note, and failed opens returned
   instead of thrown.
7. **S6: stack and docs.** The compose browser service and network, docs, and the gated
   real-browser integration test.
8. **S7: live validation** after the merge, recording counts only.

## Risks

- **Version lock:** a client and server version mismatch fails to connect. Both are pinned to
  1.64.1 together, the quickstart says to bump them together, and a connection failure turns
  rendering off for the run instead of failing it.
- **DNS rebinding between the agent's check and Chromium's lookup (R8):** the firewall rule and
  self-test are the backstop. The residual risk is documented.
- **Large Greenhouse boards** with `content=true`: these can be several MB. They are read once per
  run, and the reader is unchanged; if it proves too big, the listing can drop `content` later.
- **Workday's undocumented endpoint:** it can change. A failure falls back to plain download, then
  rendering.
