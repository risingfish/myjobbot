# Feature Specification: Exclude Publishers by Domain

**Feature Branch**: `exclude-publishers`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Lets update the excluded publishers to also handle domains (including wildcard domains)"

**Builds on**: `docs/superpowers/specs/2026-10-09-exclude-publishers-design.md` (publisher exclusion by board name)

## Background

Saved-search results carry two clues about where a posting came from: the publisher's
*name* (for example "Trabajo.org", "JobMesh.io", "DailyRemote") and the *apply link* (for example
`https://us.trabajo.org/job-3137-…`). Today the publisher exclude list matches names only, as whole
words with punctuation ignored. Names are inconsistent: the same board shows up as "JobMesh.io"
and "JobMESH", and some boards publish under several regional hosts (`us.trabajo.org`). The user
wants to block a board by the web address its apply links point to, and to block every subdomain
of a board with one entry.

The user's live config already contains `"*.trabajo.org"`. It only takes effect because
punctuation is stripped and the leftover words "trabajo org" happen to match the publisher name
"Trabajo.org". This feature gives such entries the meaning the user intended.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Block a board by its exact domain (Priority: P1)

The user adds a domain such as `jobmesh.io` to the publisher exclude list. Saved-search results
whose apply link points at that host are dropped before they are stored, however the board
spelled its publisher name.

**Why this priority**: This is the core value. The apply link is the most reliable sign of which
board a result came from, and one domain entry replaces several name variants.

**Independent Test**: Configure `jobmesh.io` as the only exclusion, then refresh a search that
returns one result linking to `https://jobmesh.io/job/…` (publisher "JobMESH") and one linking to
`https://www.linkedin.com/jobs/view/…`. Only the LinkedIn result is stored, and the run's fetch
log records one skipped publisher.

**Acceptance Scenarios**:

1. **Given** the exclude list contains `jobmesh.io`, **When** a result's apply link host is `jobmesh.io`, **Then** the result is not stored, not shown to the agent, and counted as a skipped publisher.
2. **Given** the exclude list contains `jobmesh.io`, **When** a result's publisher name is "JobMESH" and its apply link host is `jobmesh.io`, **Then** the result is dropped (the domain decides; the name variant does not matter).
3. **Given** the exclude list contains `JobMesh.IO`, **When** a result's apply link host is `jobmesh.io`, **Then** the result is dropped (domains are compared case-insensitively).
4. **Given** the exclude list contains `jobmesh.io`, **When** a result's apply link host is `notjobmesh.io` or `jobmesh.io.example.com`, **Then** the result is kept (no partial or suffix-only matches).

---

### User Story 2 - Block a board and all its subdomains with a wildcard (Priority: P1)

The user adds a wildcard domain such as `*.trabajo.org`. Results whose apply link host is
`trabajo.org` itself or any subdomain of it (`us.trabajo.org`, `uk.trabajo.org`,
`jobs.eu.trabajo.org`) are dropped.

**Why this priority**: The user already relies on this entry. Boards with regional hosts cannot be
blocked reliably without it.

**Independent Test**: Configure `*.trabajo.org`, then refresh a search returning results that
link to `us.trabajo.org`, `trabajo.org`, `jobs.eu.trabajo.org` and `trabajo.org.example.com`. The first three
are dropped and the last is kept.

**Acceptance Scenarios**:

1. **Given** the exclude list contains `*.trabajo.org`, **When** a result's apply link host is `us.trabajo.org`, **Then** the result is dropped.
2. **Given** the exclude list contains `*.trabajo.org`, **When** a result's apply link host is `jobs.eu.trabajo.org`, **Then** the result is dropped (any depth of subdomain).
3. **Given** the exclude list contains `*.trabajo.org`, **When** a result's apply link host is the bare `trabajo.org`, **Then** the result is dropped: a wildcard entry covers the domain itself as well as its subdomains.
4. **Given** the exclude list contains the plain entry `trabajo.org` (no wildcard), **When** a result's apply link host is `us.trabajo.org` or `www.trabajo.org`, **Then** the result is kept: a plain entry matches only that exact host.
5. **Given** the exclude list contains `*.trabajo.org`, **When** a result's apply link host is `nottrabajo.org` or `trabajo.org.example.com`, **Then** the result is kept.

---

### User Story 3 - Name entries keep working alongside domain entries (Priority: P2)

The user's list mixes board names and domains, for example `["dailyremote", "*.trabajo.org",
"jobmesh.io"]`. Name entries keep their current meaning (whole words, any case, matched against
the publisher name). Domain entries match the apply link host.

**Why this priority**: Existing configs must not stop working. Some boards (LinkedIn, ZipRecruiter)
are easier to name than to pin to a domain.

**Independent Test**: With the mixed list above, refresh a search whose results include a
DailyRemote result (apply link on another host), a `us.trabajo.org` result and a LinkedIn result.
Only the LinkedIn result is stored, and the skipped-publisher count is 2.

**Acceptance Scenarios**:

1. **Given** the list contains `dailyremote`, **When** a result's publisher name is "DailyRemote" and its apply link points elsewhere, **Then** it is dropped, exactly as before this feature.
2. **Given** the list contains only domain entries, **When** a result's publisher name happens to contain the domain's words (publisher "Trabajo.org", apply link `https://www.example.com/…`), **Then** it is kept: domain entries do not match on the name.
3. **Given** a result matches both a name entry and a domain entry, **When** it is filtered, **Then** it is dropped once and counted once.

---

### User Story 4 - Mistyped domain entries are rejected at startup (Priority: P3)

The user writes a malformed entry such as `trabajo.*`, `*trabajo.org`, `*.` or `https://trabajo.org/`.
The app refuses to start and names the bad entry, instead of silently matching nothing.

**Why this priority**: A silent no-op filter is the failure mode this feature fixes. It matters
less than matching itself because a bad entry is visible in the config.

**Independent Test**: Load a config containing each malformed entry in turn. Each is rejected
with a message naming the entry and saying what a valid domain entry looks like.

**Acceptance Scenarios**:

1. **Given** an entry with a wildcard anywhere except a leading `*.` label, **When** the config is loaded, **Then** loading fails with a message naming the entry.
2. **Given** an entry with a scheme, path or port (`https://trabajo.org/`, `trabajo.org:443`), **When** the config is loaded, **Then** loading fails with a message naming the entry.
3. **Given** an entry that is only a public suffix or an IP address (`*.com`, `co.uk`, `1.2.3.4`), **When** the config is loaded, **Then** loading fails with a message naming the entry, because `*.com` would block every `.com` board.

### Edge Cases

- **Apply link that cannot be read as a web address** (empty, relative such as `/jobs/view/1`, garbage): domain entries never match it, and name entries still apply.
- **Apply link without a scheme** (`jobmesh.io/job/1` or `//jobmesh.io/x`): read by its host (`jobmesh.io`), so domain entries apply to it.
- **Apply link host with a trailing dot or uppercase letters** (`US.Trabajo.ORG.`): compared as `us.trabajo.org`.
- **Apply link with a port or credentials** (`https://user@jobmesh.io:8443/…`): only the host (`jobmesh.io`) is compared.
- **Publisher name missing**: name entries cannot match, but domain entries still apply to the apply link.
- **A board name that contains a dot** (`Remote.co`, `Talent.com`): an entry with a dot is read as a domain. `remote.co` therefore blocks apply links on `remote.co`, and no longer blocks results that are merely *named* "Remote.co" but link elsewhere. The README says so.
- **Redirecting apply links** (an aggregator link that redirects to the employer): only the link as delivered is checked. No requests are made to follow it.
- **Duplicate entries** (`jobmesh.io` twice, or `jobmesh.io` and `JOBMESH.IO`): harmless; a result is dropped and counted once.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The publisher exclude list MUST accept domain entries alongside the existing name entries in the same setting (`jsearch.exclude_publishers`).
- **FR-002**: An entry MUST be treated as a domain entry when it contains at least one dot and no whitespace. Every other entry stays a name entry with today's matching (whole words, any case, against the publisher name).
- **FR-003**: A plain domain entry (`jobmesh.io`) MUST match a result whose apply link host equals that domain, ignoring case and a trailing dot.
- **FR-004**: A wildcard domain entry MUST start with `*.` followed by a valid domain. It MUST match an apply link host that equals that domain or is a subdomain of it at any depth (`*.trabajo.org` matches `trabajo.org`, `us.trabajo.org` and `jobs.eu.trabajo.org`). A plain domain entry MUST NOT match subdomains, `www.` included.
- **FR-005**: Domain matching MUST compare whole labels only: `jobmesh.io` and `*.jobmesh.io` MUST NOT match `notjobmesh.io` or `jobmesh.io.example.com`.
- **FR-006**: Domain entries MUST be matched against the apply link host only, never against the publisher name. Name entries MUST be matched against the publisher name only, never against the apply link.
- **FR-007**: A result matched by any entry MUST be dropped before it is stored, exactly where publisher-name exclusion happens today: never stored, never shown to the agent, never in the web UI.
- **FR-008**: Results dropped by domain entries MUST be counted in the existing `skipped_publishers` figure of the search fetch log, and a result matched by several entries MUST be counted once.
- **FR-009**: A result whose apply link has no readable host MUST NOT be dropped by a domain entry.
- **FR-010**: A domain entry that is malformed MUST cause config loading to fail with a message naming the entry. Malformed means any of: a wildcard anywhere except a leading `*.`; a scheme, path or port; empty labels such as `a..b`; a bare `*.`; or a bare public suffix or IP address such as `*.com`, `co.uk` or `1.2.3.4`.
- **FR-011**: The README MUST document domain and wildcard entries, with an example of each. It MUST also note that an entry containing a dot is read as a domain, so board names like `Remote.co` now match by apply link host.

### Key Entities

- **Publisher exclusion entry**: one string in `jsearch.exclude_publishers`. It is either a *name entry* (matched as words against the publisher name) or a *domain entry*: plain (`jobmesh.io`) or wildcard (`*.trabajo.org`), matched against the apply link host.
- **Saved-search result**: carries a publisher name (optional) and an apply link (always present, but not always a readable web address).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With `*.trabajo.org` configured, 0 results whose apply link is on `trabajo.org` or any of its subdomains are stored by a search refresh. Today's stored data has 15 such results.
- **SC-002**: With `jobmesh.io` configured, results published as both "JobMesh.io" and "JobMESH" that link to `jobmesh.io` are dropped by that single entry. Today blocking them takes two name entries.
- **SC-003**: Every existing name-only config (for example `["dailyremote"]`) drops exactly the same results before and after the change.
- **SC-004**: 100% of malformed domain entries listed in FR-010 are rejected when the config loads, each with a message naming the offending entry.
- **SC-005**: No result is dropped because a domain entry appears as a substring or suffix of an unrelated host (verified by the `notjobmesh.io` and `jobmesh.io.example.com` cases).

## Assumptions

- Domain entries apply only to saved-search (JSearch) results, as publisher exclusion does today. Company boards (Greenhouse, Lever, Ashby) are not filtered.
- The apply link delivered with each result is the only address checked. Alternative apply links that the search API may offer, and redirect targets, are out of scope.
- Results already stored before a domain is excluded stay stored, and removing an entry does not bring back dropped results. This matches the existing publisher-exclusion behaviour.
- Dropped results still count against the monthly search budget. The search API cannot exclude publishers or domains itself.
- No separate counter for domain-matched versus name-matched drops is needed. One `skipped_publishers` count is enough for the log.
- Internationalised domain names are compared in Unicode, lowercased, on both the entry side and the link side. No punycode conversion is needed.
- Wildcards are allowed only as a whole leading label (`*.example.com`). Patterns such as `job*.com` or `*.co.*` are not supported.
