# Feature Specification: Login ways refactor

**Feature Branch**: `025-login-ways-refactor`

**Created**: 2026-11-07

**Status**: Draft

**Input**: Owner request, a follow-on to 024-user-accounts: "refactor the login system so each way
of signing in (password, email link, authenticator app, hardware key, recovery code) lives in its
own module behind one registry, removing per-way branching and the duplication found in the
SOLID/DRY review. Pure refactor: behaviour, security, database schema and every test's expectations
unchanged."

## Background: the review (2026-11-07)

Feature 024 built five ways of proving who you are (password, emailed link, authenticator app,
hardware key, recovery code) on a shared core: one sign-in path with shared limits and one
refusal, one action guard, one place that records security events and queues their notices, and
every one-time value spent in the statement that checks it. That core is sound. The review of the
code against SOLID and DRY found that the code is organised by layer rather than by way, so:

- **Adding a way means editing many places.** The kinds of way are listed three times (the store's
  list, the Account tab's names, the sign-in choice), and twelve files outside the stores compare
  against a way's kind: confirming identity, the sign-in dispatch, the proof parsing, the Account
  tab's per-way controls, the sign-in choice's field and its key route, the "Confirm it's you"
  dialog, the email link's mail rule, and the usable checks.
- **The password way has no home.** Its rules, its check, its change and its reset sit in four
  separate modules; the module named for password checks also holds the lockout every way uses.
- **One rule is written three times.** "Lock the account, then refuse a change that would leave no
  usable way" is repeated in three store operations (and again in the in-memory test stores), with
  a hand-copied row mapping.
- **One check is inlined three times.** "Is this way usable for this account" is redone in the
  email-link, link-spend and hardware-key code.
- **The account actions repeat their opening.** Sixteen server actions repeat the same parse,
  signed-in check and signed-out answer; two files redeclare the signed-out answer and the refusal
  type instead of sharing them.
- **Responsibilities sit in the wrong place.** Starting a session lives in the sign-in module
  though five flows use it; the authenticator's storage shares a store with the general way state,
  while hardware keys have their own.

## User Scenarios & Testing *(mandatory)*

The users of this change are the owner and anyone (including Claude) who later reads or extends the
login code. Account holders must notice nothing.

### User Story 1 - Nothing changes for account holders (Priority: P1)

Everything 024 delivered works exactly as before: signing in by each of the five ways, the
lockout, "Confirm it's you", setup and removal of each way, recovery, the Account tab, the admin
section, every message and every security event and notice.

**Why this priority**: A refactor that changes behaviour, above all security behaviour, is a
regression; this is the condition every other story is held to.

**Independent Test**: The whole existing suite passes with its expectations unchanged, and a
browser walk of sign-in by each way gives the same results as before.

**Acceptance Scenarios**:

1. **Given** the test suite as it stands after 024, **When** the refactor is done, **Then** every
   test passes with the same expectations; tests change only where they name a moved module, not in
   what they assert.
2. **Given** a signed-out browser, **When** it signs in by each of the five ways, fails five times,
   or meets "Confirm it's you", **Then** the answers, messages, limits and recorded events are the
   same as before.
3. **Given** the database after 024, **When** the refactored code runs against it, **Then** no
   migration is added and nothing stored changes shape.

---

### User Story 2 - Each way of signing in has one home (Priority: P1)

A reader looking for how one way works (its rules, how it checks a proof, how it is set up and
removed, how it signs in) finds it in one module for that way, and finds the shared parts (limits,
sessions, events, the guard) in modules named for what they are.

**Why this priority**: It is the point of the refactor: code that a reader, or a later feature,
can follow one way at a time.

**Independent Test**: For each of the five ways, list where its own logic lives; the answer is one
module (plus its UI controls), and no other module branches on that way's kind.

**Acceptance Scenarios**:

1. **Given** the five ways, **When** a reader looks for one way's logic, **Then** it is in one
   module named for that way, which states what the way is, how a proof is read and checked, and
   (where it has them) how it is set up and removed.
2. **Given** the password way, **When** a reader looks for its rule, digest, check, change and
   reset, **Then** they find them in or through the password module, and the shared lockout in a
   module named for attempts.
3. **Given** starting a session, **When** a reader looks for it, **Then** it is in a module for
   sessions, used by every flow that starts one.

---

### User Story 3 - Adding a way touches one module and its controls (Priority: P2)

A future way of signing in is added by writing one module for it and its UI controls, and listing
it once; confirming identity, sign-in, proof reading and the way lists pick it up without being
edited.

**Why this priority**: It is the open/closed half of the review; it pays off with the next way,
not before, so it ranks below the cleanup that pays off now.

**Independent Test**: The registry is the only list of ways in the code; a review finds no branch
on a way's kind outside the way modules and their UI controls.

**Acceptance Scenarios**:

1. **Given** the registry, **When** confirming identity, signing in, reading a proof or listing the
   ways, **Then** each looks the way up in the registry instead of branching on its kind.
2. **Given** the code after the refactor, **When** it is searched for comparisons against a way's
   kind, **Then** they appear only inside the way modules, their UI controls, the registry and the
   stores (whose rows are keyed by kind).

---

### User Story 4 - Each repeated rule is written once (Priority: P2)

The rules repeated today are written once each: keeping a usable way under a lock, checking that a
way is usable, and the account actions' opening.

**Why this priority**: Repetition of a security rule is where a later change fixes one copy and
misses another.

**Independent Test**: Each of the three rules has one definition, and every former copy calls it.

**Acceptance Scenarios**:

1. **Given** turning a way off, removing an authenticator and removing the last key, **When** each
   would leave no usable way, **Then** all three refuse through one shared, locked check.
2. **Given** a flow that needs to know whether a way is usable for an account, **When** it asks,
   **Then** it uses one shared check.
3. **Given** the account's server actions, **When** each reads its input and the signed-in
   account, **Then** they share one wrapper and one signed-out answer, and no file redeclares the
   refusal type.

---

### Edge Cases

- **A test that imports a moved function**: its import changes; what it asserts does not.
- **The password digest's experimental status (024 research R1)**: unchanged; the digest stays
  wrapped in one module.
- **Recovery codes**: they are a way to sign in and to confirm identity but not one a person turns
  on or off; the registry must say which ways appear as switches on the Account tab.
- **Email link**: it signs in and confirms identity through a link, not a typed proof; the
  registry must describe ways whose proof arrives by link or by a browser key as well as typed.
- **Next.js server action files**: they may export only async functions, so the shared wrapper
  must live outside them.

## Requirements *(mandatory)*

### Functional Requirements

**Unchanged behaviour**

- **FR-001**: Every behaviour of feature 024 MUST stay the same: answers, messages, limits,
  sessions, step-up, recorded events, notices, the gate, the guard and the stored data.
- **FR-002**: No database migration MUST be added, and nothing stored MUST change shape.
- **FR-003**: Every existing test MUST pass with its expectations unchanged; a test MAY change
  only the module it imports from, how it builds its fixtures, which contract file holds it, or,
  where an entry point is removed, call the one that replaces it with the same inputs and the same
  expectations.

**One home per way**

- **FR-004**: Each of the five ways MUST have one module holding its own logic: what it is, how its
  proof is read and checked, and its setup and removal where it has them.
- **FR-005**: One registry MUST list the ways, and it MUST be the only list of them; the stored kinds,
  the Account tab's ways and the sign-in choice MUST come from it.
- **FR-006**: Confirming identity, the sign-in dispatch, reading a proof, the "Confirm it's you"
  dialog and the rules that differ by way (an email link needs mail, and counts as set up once
  switched on) MUST look a way up in the registry or catalog, not branch on its kind; comparisons
  against a kind remain only in the way modules, their UI controls, the registry and the stores.
- **FR-007**: The password way's rule, digest, check, change and reset MUST be reached through the
  password module; the lockout shared by every way MUST live in a module for attempts.
- **FR-008**: Starting a session MUST live in a module for sessions.
- **FR-009**: The authenticator's storage MUST be its own store, apart from the general way state,
  as hardware keys already are.

**Written once**

- **FR-010**: Refusing a change that leaves no usable way, under the account's lock, MUST be one
  shared operation used by every store that can make such a change.
- **FR-011**: Whether a way is usable for an account MUST be one shared check.
- **FR-012**: The account's server actions MUST share one wrapper for reading input and the
  signed-in account, and one signed-out answer; the refusal type MUST be declared once.

### Key Entities

- **Way module**: one way of proving identity: its kind, its name as shown, whether it appears as a
  switch on the Account tab, how its proof is read and checked, and its setup and removal.
- **Registry**: the one list of way modules, looked up by kind.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the tests that pass before the refactor pass after it, with unchanged
  expectations.
- **SC-002**: Comparisons against a way's kind outside the way modules, their UI controls, the
  registry and the stores go to 0, and a check in the suite keeps them at 0.
- **SC-003**: Lists of the ways go from 3 to 1.
- **SC-004**: Copies of the keep-a-usable-way rule go from 3 to 1, of the usable check from 3 to 1,
  of the action opening from 16 to 1, and of the password rule-and-digest step from 4 to 1.
- **SC-005**: Adding a sixth way would need edits to its own module, its UI controls and one
  registry entry only (checked by review against the registry's users).
- **SC-006**: A browser walk of sign-in by each of the five ways, a lockout and "Confirm it's you"
  gives the same results as on the 024 branch.

## Assumptions

- This follows 024 and is built on a branch from `024-user-accounts`; it can merge with 024 or
  after it.
- It is internal: no new dependency, no change to the UI's look or wording, no change to the
  constitution.
- The owner's UI work in Claude Design is independent; if it lands first, this refactor keeps its
  results as they are.
- Tests are added only where a new shared module (the registry, the shared lock, the action
  wrapper) needs its own; the existing suite is the main safety net.
