# Implementation Plan: Exclude Publishers by Domain

**Branch**: `exclude-publishers` | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/001-exclude-publisher-domains/spec.md`

## Summary

`jsearch.exclude_publishers` gains domain entries:
- A plain entry (`jobmesh.io`) matches that exact host.
- A wildcard entry (`*.trabajo.org`) matches the domain and every subdomain.

Domain entries are matched against the host of the job's apply link. Name entries keep today's
whole-word match against the publisher name. Malformed domain entries fail config load.

Approach:
- A new `src/jobs/publisherDomain.ts` classifies, validates and matches domains with
  [tldts](https://www.npmjs.com/package/tldts), pinned exactly at `7.4.18`. It is the only file
  that imports tldts.
- `isExcludedPublisher` takes the job, not just its publisher.
- `refreshSearch` passes the job to it.
- The schema refines `exclude_publishers` entries.

Details are in [research.md](research.md).

## Technical Context

- **Language/Version**: TypeScript 6.0 on Node 24 (ESM, run via tsx)
- **Primary Dependencies**: zod 4.6 for config. New: `tldts` `7.4.18` (exact pin, added to
  `dependencies` and `package-lock.json`), which brings in `tldts-core`.
- **Storage**: SQLite (`data/myjobbot.db`). No schema change.
- **Testing**: vitest 5, with tests in `tests/`
- **Target Platform**: Linux, CLI and Docker
- **Project Type**: single-project CLI agent with a small web UI
- **Performance Goals**: not a concern. There are tens of results per fetch and a handful of
  entries.
- **Constraints**: habit-hooks limits: functions ≤ 12 lines, ≤ 3 params, complexity ≤ 10,
  files ≤ 200 lines, no unused exports (knip). Every `src/` function gets a one-line `/** */`.
- **Scale/Scope**: about 4 source files and 4 test files touched, plus the README.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is the unfilled template, so there are no ratified principles
to gate on. The project rules in `CLAUDE.md` are used instead:

| Gate | Pre-design | Post-design |
|---|---|---|
| New dependencies exact- or `~`-pinned and in the lockfile | Pass: `tldts` exact-pinned, with lockfile entries spliced in (see tasks T006) | Pass |
| Functions and files within habit-hooks limits | Pass: small helpers planned | Pass: `publisherDomain.ts` holds about 6 functions of ≤ 8 lines each |
| No unused exports or dependencies (knip) | Pass | Pass: each export has a caller (`schema.ts`, `companyFilter.ts`); `tldts` is imported by `publisherDomain.ts` |
| One-line doc comment on every new `src/` function | Planned | Planned |
| Tests in `tests/`, `npm run check` green before done | Planned | Planned |

No violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
docs/specs/001-exclude-publisher-domains/
├── spec.md
├── plan.md                               # this file
├── research.md                           # R1–R8 decisions
├── data-model.md                         # entry kinds, normalisation, flow
├── quickstart.md                         # validation scenarios
├── contracts/exclude-publishers-config.md
├── checklists/requirements.md
└── tasks.md                              # /speckit-tasks (not yet created)
```

### Source Code (repository root)

```text
src/
├── jobs/
│   ├── publisherDomain.ts   # NEW (imports tldts): isDomainEntry, isValidDomainEntry, linkMatchesDomains (+ private host/normalise helpers)
│   └── companyFilter.ts     # isExcludedPublisher(job: Pick<Job,"publisher"|"url">, excluded): name OR domain
├── config/
│   └── schema.ts            # publisherTerm = filterTerm + domain-entry refinement naming the entry
└── tools/
    └── searchFetch.ts       # pass the job (not job.publisher) to isExcludedPublisher

tests/
├── publisherDomain.test.ts  # NEW: classify, validate, match (plain, wildcard, apex, look-alikes, ports, IDN, garbage)
├── companyFilter.test.ts    # update to the new signature; name/domain separation; null publisher + domain
├── config.test.ts           # each malformed entry rejected with its text in the message; valid ones accepted
└── searchSources.test.ts    # fixture dropped by a domain entry; name+domain overlap counted once

package.json / package-lock.json  # tldts 7.4.18 (exact)
README.md                    # settings row + JSearch paragraph: domain/wildcard entries, "a dot means domain"
```

**Structure Decision**: single project. The domain logic goes in its own module under
`src/jobs/`, next to the existing name matcher, and the publisher rule stays reachable through one
entry point (`isExcludedPublisher`).

### Design notes for implementation

- `isDomainEntry(entry)`: true if the entry contains `.` and no whitespace.
- `entryHost(entry)` (private): strip `*.` and return tldts `parse(rest)`. Used for both
  validation and matching.
- `isValidDomainEntry(entry)`: the hostname equals the entry text (lowercased, trailing dot
  removed) and the registrable `domain` is not `null` (research R3).
- `linkMatchesDomains(url, entries)`: get `parse(url).hostname`, then call
  `some(entry => hostMatches(host, entry))`.
- `isExcludedPublisher` splits `excluded` with `isDomainEntry` and returns
  `nameMatch || linkMatchesDomains(job.url, domainEntries)`. The `null` publisher guard applies
  only to the name branch.
- The schema error uses zod 4's `error` callback, so the message can interpolate `issue.input`.

## Rollout

Add `tldts` `7.4.18` exact to `package.json` and splice its two entries into
`package-lock.json`, following tasks T006. A plain `npm install` drops the optional
platform-binary entries (npm/cli#4828). Do this in the same session as the first `tldts` import,
or knip's unused-dependency check fails.

The user's `data/config.json` already contains `"*.trabajo.org"`, which takes on its intended
meaning with no edit. Optionally, add `"jobmesh.io"` to replace name-based variants.

The 2026-10-09 design spec's "Behaviour" section is superseded by
[contracts/exclude-publishers-config.md](contracts/exclude-publishers-config.md) for entries
containing a dot.

## Complexity Tracking

None.
