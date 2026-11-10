# Feature Specification: Deactivate and delete an account

**Feature Branch**: `029-deactivate-delete-account`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "On the Account page, add "Deactivate account" and "Delete account"."

## Clarifications

### Session 2026-11-08

- Q: What does deactivating do, and who reactivates? → A: The user can still sign in normally.
  Deactivating deletes their Gmail connection and stops pulling, classifying and scoring jobs for
  them. They reactivate it themselves on the Account tab.
- Q: Can admins act on other accounts? → A: No. Own account only.
- Q: Is delete immediate? → A: No. Deleting deactivates the account at once and deletes it 30 days
  later, unless the user cancels in the meantime.

### Session 2026-11-09

- Q: What stops while deactivated? → A: Categorizing and scoring jobs for that user stop. JSearch
  (shared by all users) keeps running for everyone else; the user's own actions that score nothing
  (test on save, profile extraction) stay allowed.
- Q: Are a deleted user's files (run traces, model logs, eval captures) removed? → A: No; historical
  files stay, under the usual log retention.

## Background

Since 027, each account has its own data: its view of jobs (scores, reasons, gaps, hidden and
applied marks), verdict history, re-score runs, Gmail connection, search settings, sources, resume
and profile. Postings, company records, the careers audit and the JSearch call count are shared.
Scheduled runs work for every account with a source on and a resume.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deactivate my account (Priority: P1)

A user who wants a break deactivates their account on the Account tab. Their Gmail connection is
removed and runs stop working for them, but they can still sign in and look at, hide and mark their
jobs. Reactivating starts the runs again.

**Why this priority**: Deletion builds on it (a pending deletion is a deactivated account).

**Independent Test**: A second account with a source on, a resume and Gmail connected deactivates;
its Gmail connection is gone, the next run does nothing for it, it can still sign in and browse; it
reactivates and the next run works for it again.

**Acceptance Scenarios**:

1. **Given** an active account, **When** the user chooses Deactivate account and confirms, **Then**
   its Gmail connection is deleted and the Account tab shows it as deactivated, with Reactivate.
2. **Given** a deactivated account, **When** a scheduled run starts, **Then** it fetches nothing,
   scores nothing, reads no mail and makes no JSearch calls for that account.
3. **Given** a deactivated account, **When** the user signs in, **Then** sign-in works as usual and
   every page shows their jobs, with a notice that the account is deactivated.
4. **Given** a deactivated account, **When** the user tries Re-score or connecting Gmail, **Then**
   they are told to reactivate first.
5. **Given** a deactivated account, **When** the user chooses Reactivate, **Then** the next scheduled
   run works for them again; Gmail stays disconnected until they connect it again.

---

### User Story 2 - Delete my account (Priority: P2)

A user who is done with myjobbot asks to delete their account. It is deactivated at once and deleted
30 days later; until then they can sign in and cancel.

**Why this priority**: The final, privacy-relevant step; it relies on deactivation.

**Independent Test**: A second account with data asks to delete; it is deactivated at once and shows
the deletion date; cancelling restores it to deactivated; letting the date pass removes the account
and all its own data, leaving shared data and other accounts untouched.

**Acceptance Scenarios**:

1. **Given** a user whose last proof is over 10 minutes old, **When** they choose Delete account,
   **Then** they are asked to confirm it's them first.
2. **Given** a confirmed user, **When** they choose Delete account, **Then** the page says what will be
   removed and when, and asks them to type their email; nothing happens until they do.
3. **Given** they confirm, **When** the request is saved, **Then** the account is deactivated (as in
   User Story 1) and every page shows the deletion date with a link to cancel it on the Account tab.
4. **Given** a pending deletion, **When** the user chooses Cancel deletion, **Then** the deletion is
   called off and the account stays deactivated until they reactivate it.
5. **Given** a pending deletion whose date has passed, **When** the deletion runs, **Then** the
   account, its sign-in and all its own data are removed, every sign-in ends, and it can't sign in.
6. **Given** the only admin, **When** they open the Account tab, **Then** Delete account is
   unavailable with the reason (make another admin first).
7. **Given** mail is set up, **When** deletion is requested, cancelled or carried out, **Then** a
   notice is mailed to the account's address each time.

---

### Edge Cases

- A run or re-score is working for the account when it is deactivated: it finishes the job in hand
  but starts nothing new for that account.
- The only admin can deactivate (they can still sign in and manage Settings → Admin) but can't
  request deletion. An admin with a pending deletion loses the admin mark only when the deletion is
  carried out; if they become the last admin meanwhile, the deletion is held, and the Account tab
  says why, until another admin exists or they cancel.
- A deleted account's email is free again; a new account made with it starts empty.
- Deleting removes the account's links to shared postings; postings no account links to any more
  are left to the usual pruning.
- Deleting user 1 is allowed when another admin exists; commands that default to user 1 (the
  command-line re-score, the evals) then need an email named, and say so.
- The deletion runs at most once and either fully or not at all, even if two processes reach the
  date together.
- Reactivate while a deletion is pending isn't offered; Cancel deletion comes first.

## Requirements *(mandatory)*

### Functional Requirements

**Deactivate**

- **FR-001**: The Account tab MUST offer Deactivate account to the signed-in user, with one explicit
  confirmation, and Reactivate on a deactivated account.
- **FR-002**: Deactivating MUST delete the account's Gmail connection and alert progress, and keep
  all its other data unchanged.
- **FR-003**: Scheduled runs MUST do no work for a deactivated account: no fetching, no careers
  lookups, no scoring, no Gmail reading, no JSearch calls.
- **FR-004**: A deactivated account MUST still sign in by every way it has, and use every page;
  Re-score and connecting Gmail MUST refuse with "reactivate first".
- **FR-005**: Reactivating MUST let the next scheduled run work for the account again; Gmail stays
  disconnected until reconnected.

**Delete**

- **FR-006**: The Account tab MUST offer Delete account, after "Confirm it's you" when the last proof
  is over 10 minutes old, a summary of what will be removed and when, and typing the account's
  email.
- **FR-007**: Requesting deletion MUST deactivate the account (FR-002, FR-003) and set a deletion
  date 30 days later, shown on every page with a link to Cancel deletion on the Account tab.
- **FR-008**: Cancel deletion MUST clear the date and leave the account deactivated.
- **FR-009**: Once the date has passed, the deletion MUST remove, in one step that either fully
  happens or doesn't: the account, its ways of signing in, recovery codes, hardware keys, sessions,
  tokens and challenges, its security events, its view of every job, verdict history, re-score runs
  and steps, Gmail connection, search settings, sources, resume and profile.
- **FR-010**: The deletion MUST NOT change shared data (postings, company records, the careers
  audit, the JSearch call count) or any other account's data.
- **FR-011**: The deletion MUST be carried out within a day of its date without anyone acting.
- **FR-012**: The last admin MUST NOT be able to request deletion, and a pending deletion MUST be
  held while carrying it out would leave no admin.

**Both**

- **FR-013**: When account mail is set up, deactivating, reactivating, requesting deletion,
  cancelling it and carrying it out MUST each mail a notice to the account's address and record a
  security event, except carrying out a deletion, which only mails (its events go with the
  account), and only once the deletion has happened, to the address read just before. Without
  mail, all still work.
- **FR-014**: Every action MUST be server-checked like other account changes (own origin, the
  forgery cookie, the sign-in, step-up for deletion) and act only on the signed-in account.
- **FR-015**: No log, trace or message MUST hold the typed email, a password, code or token.

### Key Entities

- **Account state**: active or deactivated (since when), and an optional deletion date.
- **An account's own data**: everything 027 gives a user (listed in FR-009).
- **Shared data**: postings, companies, careers audit, JSearch call count (FR-010).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A scheduled run makes 0 requests and writes 0 rows for a deactivated account.
- **SC-002**: After a deletion is carried out, a search of every table finds 0 rows belonging to the
  account.
- **SC-003**: Every shared row and every other account's rows are unchanged by a deletion.
- **SC-004**: A deletion is carried out no later than 31 days after it was requested, unless held
  (FR-012) or cancelled.
- **SC-005**: A user can deactivate, reactivate, request or cancel deletion in under a minute each.

## Assumptions

- Deactivating doesn't sign the user out or change their ways of signing in.
- Hiding, marking applied, changing settings, sources and resume, test on save and profile
  extraction stay allowed while deactivated; runs (fetching, lookups, scoring, mail) and Re-score
  stop for that user only.
- A deletion removes database rows only; run traces, model logs and eval captures in `data/` stay
  (they name users by id).
- Sign-in attempts recorded by address (not by account) stay, since they protect the deployment;
  account creation codes survive the deletion of the admin who made them.
- The deletion is carried out by a scheduled check (for example with each run, or daily); the plan
  chooses which.
- Tests follow the constitution's mix: the rules (who may, what is removed, when deletion is due) as
  plain functions with unit tests; the removal and the state changes in the store contracts, run on
  MariaDB in integration tests; one UI test for the Account tab's controls.
