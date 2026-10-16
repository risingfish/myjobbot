# Implementation Plan: Job details from company careers pages

**Branch**: `008-careers-page-lookup` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/008-careers-page-lookup/spec.md`

## Summary

When the agent fetches the Gmail alerts source, alert jobs that still have no description after
JSearch get a **careers lookup**:

1. **Pick the jobs.** The run picks the unscored alert jobs that pass the filters, have no
   description and have never been looked up. It takes up to 10 a run and 30 minutes in total.
2. **Run each one as its own short conversation.** It reuses `runAgent`, with three tools:
   - `search_careers`: SearXNG, "<company> careers", up to 10 numbered results.
   - `open_link`: fetches a numbered link, trimmed by **htmlparser2** to text plus numbered links,
     at most 12,000 characters. A careers page is shown along with the job being looked for.
   - `finish_lookup`: ends the lookup.
3. **Keep the model off free-form addresses.** The model only picks numbers, never types an
   address. The code refuses anything that isn't public `http(s)`, and re-checks every redirect.
4. **Store the result.** A found job page's trimmed text becomes the job's description
   (`description_source = 'careers'`), and the agent then scores it as usual.
5. **Audit every step** in `careers_audit`. A failed lookup gets a warning with a fixed reason.
6. **Remember careers pages** per company in `careers_pages`.

The lookup takes only `SoughtJob` (title, company, location) and knows nothing about alerts, so
the job boards can call it later.

## Technical Context

**Language/Version**: TypeScript 6.0.3, Node 24

**Primary Dependencies**:
- **New**: `htmlparser2` **12.0.0**, exact pin, owner-approved 2026-10-16 (research R3).
- **Existing**: openai (the run's `ChatFn`), zod, Kysely and mysql2, and `node:net` `BlockList` /
  `node:dns/promises` (built in).
- **New optional service**: `searxng/searxng`, pinned tag, in `compose.yaml` under the `search`
  profile.

**Storage**: MariaDB. Migration `004_careers_lookup`:
- `jobs.description_source`, `jobs.description_url`
- `careers_pages`
- `careers_audit`

(See [data-model.md](data-model.md).)

**Testing**: vitest. Unit (`node`), integration (`integration`, `myjobbot_test`), UI (`dom`, none
new).

**Target Platform**: the agent container's scheduled runs. Web container unchanged.

**Project Type**: CLI agent plus web UI, sharing `src/`

**Performance Goals**: a lookup is 2–5 model turns on the local LLM, typically 1–3 minutes, with
a 5-minute budget checked between turns (a single slow model call can overrun it). Lookups run
one at a time, capped at 10 a run and 30 minutes in total (checked between lookups), inside the
run's 120-minute budget.

**Constraints**:
- Every page and result list handed to the model is ≤ `page_chars` (12,000).
- A lookup opens at most 3 pages, so its conversation is at most about 54,000 characters
  (~14 K tokens; typical ~30,000), which fits a 16 GB card at 16 K context (contract, "Context
  bound").
- Fetches reach public `http(s)` hosts only, with at most 5 redirects, a 2 MB download cap and
  the configured timeout.
- No page, job or email text in the audit log.
- Habit-hooks limits.

**Scale/Scope**: about 10–40 alert jobs a day, of which about 5–15 need a lookup. Expect around
100 audit rows a day, pruned with jobs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (constitution v2.2.0)

| Principle | Status |
|---|---|
| I. Habit-hooks clean at every sitting boundary | Pass: the decisions (trimming, ranking, address checks, the link registry, choosing jobs, mapping outcomes, parsing SearXNG) are small pure modules in `src/careers/`. The IO edges (fetch, DNS, the store) are thin. Each sitting reaches what it adds from a production entry point (tasks). |
| II. Test-first; `check` and `check:db` | Pass: split below; HTML fixtures are synthetic pages shaped like the measured ones (R4) |
| III. Purpose comments only | Pass |
| IV. Bounded, locked dependencies | Pass: htmlparser2 12.0.0 is presented with alternatives and approved, exact pin, through the lockfile with platform entries kept. The SearXNG image is pinned by tag. |
| V. Specs live in `docs/specs` | Pass |
| Storage rules (CLAUDE.md) | Pass: numbered step `004_careers_lookup.ts`, `schema.ts`, a new `careersStoreContract.ts`, a new `descriptionContract.ts` for the `description_source`/`setDescription` cases (`storeContract.ts` is at 181 of 200 lines), the new tables added to `tests/helpers/testDb.ts` `TABLES`, `utf8mb4_bin`. Production has `001`–`003` applied; `004` is new, so nothing is rewritten. |
| Workflow: sittings, main checkout, Docker stopped | Pass: S0 stops the stack before the first code change |
| DRY (owner, spec input) | Pass: one loop (`runAgent`), one HTTP client (`getText` shares `getJson`'s retry), one trimming step, and the existing `unscoredJobs`, `normalizeTitle` and `normalizeCompany` |

**New tests' split (Principle II)**, against node 283, dom 30, integration 29:

| Area | Unit |
|---|---|
| `trimPage` (drops, hidden, blocks, links, resolving, cap, `more_pages`, ranking) | 10 |
| address checks (`BlockList` ranges, scheme, port) | 4 |
| `fetchPublicPage` (private host refused, redirect to private refused, 6th redirect refused, timeout → `FetchTimedOut`), with a fake DNS | 4 |
| `HttpClient.getText` (shared retry, size cap, content type, returns redirects unfollowed), with a fake fetch | 5 |
| SearXNG parsing and the query URL | 3 |
| link registry and tool behaviour (numbers, refusals, `as`, finish rules, zero-link note) | 8 |
| lookup conversation with a scripted fake chat (found via the careers page, found straight from search, not found, gave up, unreadable careers page, LLM error, step audit rows, remembered page used, forgotten on failure and on zero links) | 12 |
| `lookUpCareers` (order and summary, per-run and time caps, per-company search cache, not-configured note, search failure stops, lookup error contained, skipped audit rows) | 9 |
| careers-store contract on the memory fake | 4 |
| `setDescription` / `description_source` on the memory job store | 2 |
| config schema (defaults, env URL) | 2 |
| `fetch_jobs` alerts page carries `careers`; `get_job_details` shows `description_from` | 2 |
| **Total** | **65** |

- **Integration**: the careers-store contract on MariaDB (4), the `description_source` and
  `setDescription` cases (2, in a new `tests/helpers/descriptionContract.ts`, since
  `storeContract.ts` is near 200 lines), and the migration test updated in place. **6**. (Each contract case
  counts once as unit, on the memory store, and once as integration, on MariaDB.)
- **UI**: 0.
- **Result**: 348 / 35 / 30. The unit share moves from 82.7% to about 84.3%. The tasks ledger
  has the per-sitting breakdown.

Post-design re-check: pass. No Complexity Tracking needed.

## Project Structure

### Documentation (this feature)

```text
docs/specs/008-careers-page-lookup/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/careers-lookup.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/careers/                  # the lookup; knows nothing about alerts (FR-019)
├── trim.ts                   # trimPage(html, { baseUrl, maxChars, sought?, links? }) → TrimmedPage (links unnumbered; the registry numbers them); htmlparser2 callbacks; pure
├── rank.ts                   # orders links by word overlap with the sought title; pure
├── addresses.ts              # isPublicAddress(ip) via BlockList; allowedUrl(url) scheme/port; pure
├── searxng.ts                # searchUrl(base, company), parseResults(json, max) (zod); pure
├── registry.ts               # LinkRegistry: numbered addresses per lookup; pure
├── outcome.ts                # maps tool state + loop result to LookupOutcome / reason; pure
├── prompt.ts                 # the lookup system prompt and first message
├── tools.ts                  # search_careers, open_link, finish_lookup (defineTool)
├── fetchPage.ts              # public-only fetch: DNS check, manual redirects, getText; edge
├── lookUpJob.ts              # one lookup: runAgent with the lookup tools, audit rows, setDescription
└── lookUpJobs.ts             # lookUpCareers(deps, sought): caps, per-company cache, remembered pages, summary
src/http/client.ts            # + getText(url, { maxBytes, headers }) via a shared private request(); TextGetter
src/agent/trace.ts            # + taggedTrace(trace, fields) for the lookup's trace events
src/app/run.ts                # chat created before the context and passed in; MYJOBBOT_SEARXNG_URL; prune audit rows
src/tools/context.ts          # + chat, careers { store, searxngUrl, lookup }
src/tools/alertSource.ts      # after fetchAlerts: choose the sought jobs (unscoredJobs + no description + not attempted) → lookUpCareers
src/tools/unscored.ts         # unscoredJobs moved out of fetchJobs.ts, so alertSource ↔ fetchJobs don't import each other
src/tools/sources.ts          # FetchOutcome gains careers?
src/tools/fetchJobs.ts        # alerts page gains careers summary
src/tools/getJobDetails.ts    # + description_from
src/config/schema.ts          # careers_lookup section; env MYJOBBOT_SEARXNG_URL
src/db/migrations/004_careers_lookup.ts, migrations/index.ts, schema.ts
src/db/store.ts               # + CareersStore, Stores.careers; JobStore.setDescription
src/db/kysely/careersStore.ts, kysely/jobStore.ts (setDescription, description_source on upsert), kysely/stores.ts
compose.yaml                  # optional searxng service (profile "search")
docker/searxng/settings.yml   # json format on, limiter off
.env.example, README.md (careers lookup section), CLAUDE.md (careers note)
tests/
├── careersTrim.test.ts, careersAddresses.test.ts, careersFetchPage.test.ts, careersSearxng.test.ts,
│   careersTools.test.ts, careersLookup.test.ts, careersLookUpJobs.test.ts (unit)
├── httpClient.test.ts (+ getText), config.test.ts, fetchJobs.test.ts, getJobDetails.test.ts (+)
├── helpers/careersPages.ts (synthetic HTML), careersStoreContract.ts, descriptionContract.ts,
│   memoryCareersStore.ts, fakeDns.ts, testDb.ts (TABLES + careers tables)
└── integration/storeContract.test.ts (+ careers and description contracts), integration/migrate.test.ts (updated)
```

**Structure Decision**: a new `src/careers/` module, peer to `src/gmail/` and `src/sources/`. It
depends only on `agent/` (the loop, which itself uses `tools/dispatch`), `tools/tool.ts`
(`defineTool`), `http/`, `db/store` and `jobs/`, never on `gmail/`, so any source can use it. The alerts
source in `src/tools/alertSource.ts` is its only caller in this feature.

## Build order (for /speckit-tasks)

Each sitting is reachable from production and ends green:

| Sitting | Work |
|---|---|
| S0 | Stop the stack. |
| S1 | Migration 004 (both tables plus the `jobs` columns) and `upsertAll` writing `description_source`. |
| S2 | US1, end to end: the `getText` refactor, `htmlparser2`, the `careers/*` modules, the `CareersStore` audit/attempted/prune methods, `setDescription`, the config, the run wiring, `alertSource`, the `fetch_jobs` summary, and `get_job_details` `description_from`. |
| S3 | US2: step audit rows and the search-unavailable `skipped` row. |
| S4 | US3: remembered pages. |
| S5 | The `compose.yaml` SearXNG service, `.env.example`, README and CLAUDE.md. |
| S6 | Live run on `myjobbot_test` (quickstart §2–5). |

S2 is large. Tasks may split it at the tools/conversation boundary only if the first half is
already called from `alertSource`.
