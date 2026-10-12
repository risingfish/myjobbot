# Research: Exclude Publishers by Domain

All findings were checked against the code on 2026-10-12. The tldts behaviour was probed with
`tldts@7.4.18` on Node 24.

## R1. Library choice

- **Decision**: `tldts`, pinned exactly at `7.4.18` to match the repo's exact-pin style. It is
  added to `package-lock.json` together with its one dependency, `tldts-core`. Those two
  lockfile entries are spliced in by hand (tasks T006), because `npm install` drops the
  optional platform-binary entries (npm/cli#4828). The lockfile pins `tldts-core` too, although tldts itself declares it
  as `^7.4.18`.
- **Rationale**: tldts is the most popular hostname/public-suffix library on npm, at about
  97M downloads a week. It is MIT-licensed and ships its own types. One `parse()` call gives:
  - the hostname of a URL or a bare domain
  - whether the hostname is valid
  - the registrable `domain`, which comes from the bundled public-suffix list and is `null` for a
    bare suffix like `com` or `co.uk`

  So it handles both reading apply-link hosts (R2) and validating entries (R3).
- **Alternatives considered** (weekly downloads, 2026-10-12):
  - `validator` (26M): `isFQDN` validates entries but doesn't extract hosts, and needs
    `@types/validator`.
  - `psl` (44M): only does public-suffix lookups, and tldts supersedes it.
  - `parse-domain` (0.3M) and `is-valid-domain` (0.6M): much less used.
  - Glob libraries (`minimatch`, `picomatch`): their `*` matches exactly one label, never the
    bare domain, which is the wrong rule for option A.
  - Node built-ins (`URL.parse` + `domainToASCII` + a label regex): would mean maintaining our
    own validation rule. The user chose a library.

## R2. Reading the host from an apply link

- **Decision**: `parse(job.url).hostname`. A `null` hostname means "no host".
- **Rationale**, from probed results:
  - `https://US.Trabajo.ORG./x` gives `us.trabajo.org`: lowercased, with the trailing dot removed.
  - `https://user@jobmesh.io:8443/a` gives `jobmesh.io`: credentials and port dropped.
  - `https://bücher.de/` gives `bücher.de`: Unicode is kept, and entries come back the same way,
    so the two compare correctly without punycode. **Caveat (found in review):** tldts lowercases
    only ASCII letters, so `Öko-jobs.de` comes back unchanged. Links and entries are therefore
    lowercased before `parse()`.
  - `garbage` gives `garbage`. A domain entry always contains a dot and has a registrable
    domain, so it can never equal a host without a dot. The link is therefore never dropped by a
    domain entry (FR-009).
  - `see jobmesh.io` (text with spaces) and `/jobs/view/1` (relative) give `null`.
  - `jobmesh.io/job/1` and `//jobmesh.io/x` (no scheme) give `jobmesh.io`. These are read by
    their host, as the spec's edge cases record.
  - `mailto:a@b.io` gives `b.io`. JSearch apply links are `http(s)`, so this case is accepted
    rather than special-cased.

## R3. Normalising and validating a domain entry

- **Decision**:
  - Strip a leading `*.` if present. This marks the entry as a wildcard.
  - Call `parse(rest)`.
  - The entry is valid only if both hold:
    1. `hostname` is not `null` and equals `rest` lowercased with one trailing dot removed. This
       means the entry was already a bare host, not a URL or `host:port`.
    2. `domain` is not `null`. This means the entry is not just a public suffix and not an IP.
  - The normalised domain is that `hostname`.
- **Rationale**: tldts is lenient about entries. It pulls `trabajo.org` out of both
  `https://trabajo.org/` and `trabajo.org:443`, and the equality check in condition 1 turns that
  leniency into a rejection. Probed results:
  - Rejected for a `null` hostname: `trabajo.*`, `*trabajo.org`, `*.`, `a..b`, `-a.com`. (`foo bar.com`
    also gives `null`, but it never reaches this check: whitespace makes it a name entry, per R4.)
  - Rejected because the hostname differs from the entry: `https://trabajo.org/`, `trabajo.org:443`.
  - Rejected for a `null` domain: `com`, `co.uk`, `.com`, `1.2.3.4`. This is new protection
    beyond the spec's original list: `*.com` would otherwise block every `.com` host, which is
    almost certainly a typo.
  - Accepted: `JobMesh.IO` (as `jobmesh.io`), `trabajo.org.` (as `trabajo.org`), `bücher.de`, `a_b.com`.

## R4. Deciding whether an entry is a name or a domain

- **Decision**: an entry is a domain entry if it contains a `.` and no whitespace (FR-002).
  Otherwise it is a name entry, matched exactly as today.
- **Rationale**: These are the spec's rules. No current name-entry use breaks:
  - `dailyremote` has no dot.
  - `stripe careers` has a space.
  - The user's `*.trabajo.org` was always meant as a domain.
- **Alternatives considered**: a separate `exclude_publisher_domains` setting. It was rejected
  because the user asked to extend the existing list, and their config already mixes both kinds.

## R5. How a wildcard matches (from the clarification, option A)

- **Decision**:
  - Plain `d` matches only when `host === d`.
  - Wildcard `*.d` matches when `host === d` or `host.endsWith("." + d)`.
- **Rationale**: The `"." + d` suffix compares whole labels, so `nottrabajo.org` and
  `trabajo.org.example.com` never match (FR-005).

## R6. Where the check plugs in

- **Decision**: change `isExcludedPublisher` in `src/jobs/companyFilter.ts` to take
  `Pick<Job, "publisher" | "url">` instead of `string | null`. It splits the entries by kind:
  name entries go through the existing `matchesAnyName`, and domain entries go through a new
  `src/jobs/publisherDomain.ts`, which is the only file that imports tldts. `refreshSearch` passes
  the job it already holds.
- **Rationale**: `refreshSearch` (`src/tools/searchFetch.ts`) has only one call site. It already
  filters before the board-duplicate check and before `upsertAll`, and already counts drops as
  `jobs.length - wanted.length`. So FR-007 and FR-008 (count each job once) hold without touching
  the storage or log code.
- **Alternatives considered**: doing the domain check inline in `searchFetch.ts`. This was
  rejected because it spreads the publisher rule across two files.

## R7. Config validation and error message

- **Decision**: add a `publisherTerm` schema in `src/config/schema.ts`. It is `filterTerm` plus a
  refinement: a domain entry must pass the R3 check. The message is built with zod 4's `error`
  callback and includes the entry, for example `"trabajo.*" is not a valid domain entry; use a
  host like "jobmesh.io" or "*.trabajo.org"`. Confirmed: zod 4.6.5 prints that message with the
  entry's array index in the path.
- **Rationale**: `loadConfig` throws the zod error as-is, which meets FR-010.

## R8. Constitution

`.specify/memory/constitution.md` is still the blank template, with no ratified principles. The
gates used instead are the project rules in `CLAUDE.md` and habit-hooks:
- function and file size limits
- one-line doc comments
- tests in `tests/`
- no unused code or dependencies (knip)
- new dependencies exact- or `~`-pinned and installed through the lockfile
- `npm run check` green
