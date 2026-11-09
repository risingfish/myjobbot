# Feature Specification: SOLID conformance across the whole app

**Feature Branch**: `028-solid-conformance`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "028", the scope recorded in issue #119. A SOLID conformance pass
(constitution Principle VI) over all of the app's functionality, together with the follow-ups found
after 027 (each account's own data). The owner clarified that the pass is for all functionality in
the app, not just the user data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every part of the app conforms to the SOLID principles (Priority: P1)

Constitution Principle VI (2.7.0) made SOLID a standing rule:
1. one responsibility per module, class and function, never unrelated jobs grouped together
2. new variants through a registry or interface, not per-variant branches
3. every implementation honours its interface's contract
4. narrow interfaces, and containers that hold stores, not operations
5. decisions take their dependencies, so they can be unit-tested

New work follows it, but most of the app predates it. The owner wants all of the app's
functionality reviewed against it once (every area listed in FR-001). Every breach is to be found,
and every one fixed or consciously accepted, so the rule describes all the code that exists, not
just the code still to come.

**Why this priority**: it is the point of the feature. Every later feature builds on these areas,
and each breach makes the next change harder to make and to test.

**Independent Test**: one functional area at a time. The inventory lists every module in the area,
each with its outcome against the five rules. Every finding in the area is fixed or accepted with a
reason the owner approved. The full checks pass, and the area's user-visible behaviour is unchanged.

**Acceptance Scenarios**:

1. **Given** the app's functional areas, **When** the review is done, **Then** every module of every
   area appears in the inventory as reviewed, with its findings or "none".
2. **Given** a finding, **When** the feature is complete, **Then** it is fixed, or it is accepted
   with a one-line reason the owner approved; none is left open.
3. **Given** an area's fixes, **When** the full checks run, **Then** every test passes with its
   expectations unchanged, except tests that assert the inner structure being changed.
4. **Given** all the fixes, **When** a run, a re-score, the web UI, the CLI, the evals and every
   sign-in way are used, **Then** their output and behaviour are the same as before.
5. **Given** a rule that can be checked mechanically for a kind of code, **When** the area is done,
   **Then** a test keeps the breach from coming back.

---

### User Story 2 - The follow-ups from 027 are closed (Priority: P2)

The 027 review left three items, tracked in #119:
- **The email-digest mark sits on the shared job posting.** It means something per user (this job
  went out in my digest), but it is stored where every user sees it. No feature reads or writes it,
  so it is always empty.
- **Eval runs don't record their user.** Captured cases record whose scores they came from, but a run
  and its report don't say whose resume, profile and settings the scores used. Comparing two runs
  can silently compare two different people.
- **Two store operations are never called**: the API call log's `lastCallAt`, and the account
  store's `isAdmin`, which the deep analysis found. They are findings of User Story 1's review
  (D8, D10) in the stores area, closed here.

**Why this priority**: they are small, known, and the only places where 027's data model is still
incomplete. They don't depend on the wider review.

**Independent Test**: upgrade a copy of a 027 database. The shared posting no longer has the digest
mark, and every count is unchanged. Run evals for two users: each report names its user, and
comparing the two runs warns that they were scored for different users.

**Acceptance Scenarios**:

1. **Given** a database from 027, **When** the release is deployed, **Then** the shared posting has
   no per-user field, and every posting, view, score and mark is still there.
2. **Given** a second account, **When** the owner runs evals with `--user` for it, **Then** the run
   records that user, and its report shows the user's id. A run without `--user` shows user 1.
3. **Given** two runs for different users, **When** one is reported against the other, **Then** the
   report says plainly that they were scored for different users, before any comparison.
4. **Given** a run saved before this feature, **When** it is reported, **Then** it still reads, and
   its user is shown as not recorded.
5. **Given** a series run with `--user`, **When** the series is reported, **Then** each of its tests
   shows the user it ran for.

---

### Edge Cases

- **A finding whose fix would change** the database schema, a stored file format or a user-visible
  output. It is out of scope for this pass: it is recorded in the inventory as a follow-up, not
  fixed here. The digest mark and the eval run's user are the exceptions, covered by User Story 2.
- **A finding that spans areas**, such as an interface used by several of them. It is recorded once,
  under the area that owns the interface, and fixed there with its callers.
- **A finding in test-only code.** It is out of scope, except the in-memory stores and test helpers
  that implement the app's interfaces. They follow any interface they implement.
- **A fix that would need a new dependency.** Not allowed in this feature.
- **Database steps already applied in production** are history and are not rewritten. Only the new
  step this feature adds follows the current rules.
- **A posting that holds a digest mark.** Nothing has ever written one, but the upgrade must not
  discard a value silently: it refuses and names the reason.
- **Reports and old run files:**
  - an eval run file from before this feature reads, with its user shown as not recorded;
  - a report comparing against such a run says the users can't be checked, and still shows the
    numbers.

## Requirements *(mandatory)*

### Functional Requirements

**The review (all functionality)**

- **FR-001**: Every functional area of the app MUST be reviewed against each of Principle VI's five
  rules:
  - the agent loop and its prompts
  - the run and its fetch phase
  - the scoring tools
  - job sources and their modules
  - Gmail alerts
  - the careers lookup and page reading
  - company records and the company search
  - job descriptions
  - job filters and boosts
  - re-score and its log
  - evals and prompt variants
  - the resume and its profile
  - settings and their resolution
  - accounts, sign-in ways, sessions and mail
  - web security
  - the stores and the database layer
  - the CLI
  - the web UI's pages, actions and components
  - the shared helpers (HTTP, errors, configuration)
- **FR-002**: The review MUST produce an inventory, kept with this feature's documents:
  - each module, by area
  - each finding: its location, the rule it breaks, and the decision (fix, accept with a reason, or
    follow-up)
- **FR-003**: Every finding marked fix MUST be fixed. Every accepted finding MUST carry a one-line
  reason the owner approved, and every follow-up MUST say why it can't be fixed here. No finding
  may remain without a decision.
- **FR-004**: The fixes MUST NOT change behaviour:
  - the CLI's output and exit codes
  - the web UI's pages and actions
  - sign-in and its security rules
  - the run's trace events and the model's prompts
  - the database schema and stored file formats, apart from FR-008 and FR-009

  Every existing test's expectations MUST stay the same, except:
  - a test that asserts the inner structure being changed
  - a test that asserts output FR-009 deliberately changes (the eval report header and series
    lines)
- **FR-005**: Where a rule can be checked mechanically for a kind of code (for example, that a
  container holds stores and no operations, or that no caller branches on a variant's name), the
  feature MUST add a test that keeps the breach from coming back, as earlier features did for
  per-way branching and for naming the owner.
- **FR-006**: Each area's fixes MUST be reviewed against Principle VI before they land, and land
  with the full checks green.
- **FR-007**: The project's guidance (CLAUDE.md, the constitution's examples, the docs pages) MUST be
  updated wherever a fix moves or renames something they name.

**The 027 follow-ups**

- **FR-008**: The shared posting MUST hold no per-user fact, so the email-digest mark MUST be removed.
  The upgrade MUST keep every posting, view, score, mark, history and count unchanged. It MUST
  refuse, naming the reason, if any posting holds a digest mark.
- **FR-009**: Every eval run, including each test of a series, MUST record the user it scored for:
  the one named with `--user`, else user 1. Its report MUST show that user by account id, never by
  email. A report comparing two runs MUST say, before the comparison, when they were scored for
  different users or when either run's user wasn't recorded. A report comparing a run with
  production's own scores (`--against observed`) MUST say so when the run's user differs from the
  user a compared case was captured from, or when either wasn't recorded. Run files saved before this
  feature MUST still read, unchanged, with the user shown as not recorded.
- **FR-010**: The store operations that nothing calls MUST be removed from their interfaces and from
  every implementation. These are the API call log's `lastCallAt` and the account store's `isAdmin`.

### Key Entities

- **Functional area**: one part of the app's functionality, as listed in FR-001, made of the modules
  that implement it. The unit of review and of delivery.
- **Review inventory**: the record of the review. Every module by area, and every finding with its
  location, rule and decision.
- **Shared posting**: one job as its source describes it, stored once for every user. It loses the
  email-digest mark.
- **Eval run**: one scoring run over captured cases. It gains the user it scored for.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All of the FR-001 areas are reviewed. 100% of the app's modules appear in the
  inventory, and none sits outside an area.
- **SC-002**: 0 findings are left without a decision when the feature is complete.
- **SC-003**: Every rule the review found mechanically checkable has a test that guards it.
- **SC-004**: All of the following pass with their expectations unchanged, apart from FR-004's
  exception:
  - every test that passed before the feature
  - the full checks
  - the database integration checks
- **SC-005**: A scheduled run after the release takes no more than 10% longer than before, and its
  trace has the same events.
- **SC-006**: 0 per-user fields remain on shared records, checked table by table against the 027
  audit.
- **SC-007**: 100% of eval runs made after the release name their user in their report, and 100% of
  comparisons between runs for different users say so.
- **SC-008**: No new runtime dependency is added.

## Assumptions

- **The review's scope** is the app's code, everything outside the tests. The in-memory stores and
  test helpers that implement app interfaces are included; tests and the database steps already
  applied are not.
- **Delivery is by area.** The inventory is produced during planning, as research for the plan.
  The fixes are then made area by area, in sittings, with the checks green after each. The owner
  decides at planning whether it ships as one pull request or several, each merged before the next.
- **The email-digest mark is removed, not moved.** Nothing has ever written it, so every production
  value is empty. The digest feature will add its own per-user mark when it is designed. The part
  that changes the database ships with a backup note, as 027 did.
- **Production is on v0.2.0 (027)**, at database step 023.
- **The CLI, the web UI and the run keep their user-facing wording.** The only new output is the user
  line in eval reports and the different-users warning.
