# Feature Specification: Each user's own data

**Feature Branch**: `027-assign-data-to-first-user`

**Created**: 2026-11-07

**Status**: Draft

**Input**: Owner request: "assign existing data to the first user (user 1). Tie the data that today
belongs to nobody (jobs and their scores and marks, search settings, sources, resume and profile,
Gmail connection, run history and re-score log, companies, evals as applicable) to an owning user,
with every existing row assigned to user 1, as the first step toward per-user data after 024
(accounts) and 025 (login ways refactor)."

## Background

Feature 024 added accounts but left the data shared: every signed-in account sees and changes the
same jobs, settings, sources, resume and Gmail connection (024 spec, Clarifications). Some data is
already stored per user, all of it user 1's: search settings, saved sources, the resume and its
profile. The rest belongs to no one: jobs with their scores, reasons, verdict history and the hidden
and applied marks; the Gmail connection and its alert progress; the re-score log. Company records,
the careers-page lookup audit and the JSearch call count are facts about employers and the
deployment, not about a person.

## Clarifications

### Session 2026-11-07

- Q: After 027, what does a signed-in user see? → A: Their own data only. Ownership is recorded and
  enforced; a new account starts empty; all existing data becomes user 1's.
- Q: How are jobs owned? → A: A posting (its title, company, description and the rest of what the
  source said) is stored once for everyone. Each user's view of it is their own: whether they have
  it at all, its score, reasons and gaps, verdict history, and the hidden and applied marks.
- Q: Which users does the scheduled run work for? → A: Every user, one after another, each with
  their own settings, sources and resume.
- Q: Gmail and the JSearch budget? → A: Each user connects their own Gmail for their own alert
  emails. The JSearch key and its monthly call budget stay the deployment's, shared by all users.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The owner keeps everything they have (Priority: P1)

After the upgrade, the owner (user 1) signs in and finds everything as it was: every job with its
score, reasons, history and marks, their settings, sources, resume, profile, Gmail connection and
re-score logs.

**Why this priority**: The upgrade must not lose or hide anything the owner already has; it is the
condition the rest builds on.

**Independent Test**: Snapshot what user 1 sees before the upgrade (counts per tab, a sample of
jobs with their scores and marks, settings, sources, Gmail status), upgrade, and compare.

**Acceptance Scenarios**:

1. **Given** a database before 027, **When** the upgrade runs, **Then** every job, verdict, mark,
   setting, source, resume, profile, Gmail connection and re-score log belongs to user 1, and nothing
   is dropped.
2. **Given** the upgraded database, **When** the owner opens Recommended, All jobs, Applied,
   Settings and a job's History, **Then** they show the same jobs, scores, marks and entries as
   before.
3. **Given** the upgrade has run, **When** it runs again (a second start), **Then** nothing changes.

---

### User Story 2 - Each user sees only their own data (Priority: P1)

A second account signs in and sees an empty Recommended, All jobs and Applied, default settings, no
sources, no resume and no Gmail connection. Nothing they do changes the owner's data, and nothing
the owner does changes theirs.

**Why this priority**: It is the point of the feature: accounts become separate users, not shared
logins.

**Independent Test**: With two accounts, each hides, applies, re-scores and changes settings; each
sees only their own results, and neither can reach the other's by any page, action or address.

**Acceptance Scenarios**:

1. **Given** a new account, **When** it signs in, **Then** every tab is empty and every setting is
   its default.
2. **Given** a job both users have, **When** one hides it, applies to it or re-scores it, **Then**
   the other's view of that job is unchanged.
3. **Given** a job only one user has, **When** the other asks for it by its address, its panel, its
   history, its re-score or its log, **Then** they get the same answer as for a job that doesn't
   exist.
4. **Given** an admin, **When** they use the app, **Then** they see only their own data too; the
   admin mark only covers the admin section.

---

### User Story 3 - Runs work for every user (Priority: P1)

The scheduled run fetches and scores for each user who has something to run, one user after
another, with that user's own sources, settings, resume and Gmail. A posting two users' sources
both find is stored once and scored separately for each.

**Why this priority**: Without it, only user 1 ever gets new jobs.

**Independent Test**: Give a second user a source and a resume; after one run, both users have new
jobs scored against their own resumes, and a posting both found has two different scores.

**Acceptance Scenarios**:

1. **Given** two users with sources on and resumes, **When** a run happens, **Then** each gets the
   jobs their own sources found, scored by their own settings and resume.
2. **Given** a user with no source on, or no resume, **When** a run happens, **Then** that user is
   skipped and the run says why, by fixed reason.
3. **Given** a posting found for both users, **When** it is stored, **Then** its description and
   careers lookup are done once, and each user's score is their own.
4. **Given** the run's trace, **When** read, **Then** every user's part is labelled with the user's
   id, never their email or name.
5. **Given** the JSearch budget, **When** several users' JSearch sources run, **Then** together they
   stay within the one monthly budget, and a source refused for budget says so.

---

### User Story 4 - Each user's own Gmail (Priority: P2)

Each user connects their own Gmail on their Settings page; their LinkedIn alert emails become their
own jobs, and no one else's mailbox is read for them.

**Why this priority**: Alerts are the main source for the owner; for others it can follow the
shared parts.

**Independent Test**: A second user connects their own Gmail; a run reads only their mailbox for
them and only the owner's for the owner, each from where it last stopped.

**Acceptance Scenarios**:

1. **Given** the owner's existing connection, **When** the upgrade runs, **Then** it is user 1's,
   with its alert progress kept.
2. **Given** a second user who connects Gmail, **When** a run reads alerts, **Then** each user's
   alerts become only their own jobs.
3. **Given** a user disconnects Gmail, **When** they do, **Then** only their connection is removed.

---

### User Story 5 - Command line and evals act for one user (Priority: P3)

The command-line re-score and the evals act on one user's data, named on the command line, with
user 1 when none is named.

**Why this priority**: These are the owner's tools; naming a user keeps them correct once there are
several.

**Independent Test**: Re-score a job for user 1 and for a second user; capture an eval case from
each; each touches only that user's verdicts.

**Acceptance Scenarios**:

1. **Given** `rescore` with no user named, **When** it runs, **Then** it acts for user 1, as now.
2. **Given** a user named by email, **When** `rescore` or `eval capture` runs, **Then** it reads
   and writes only that user's data, and an unknown email is refused.

---

### Edge Cases

- **A posting no user has any more**: clean-up removes it, as old postings are removed now, but
  never one any user has marked applied, and never a company record (024 and 014 rules).
- **Two users' sources find the same posting at once**: it is stored once; each user gets their
  own link to it.
- **A user's settings filter hides a posting another user sees**: filters are each user's own.
- **A re-score open for one user on a job**: another user may re-score the same job at the same
  time; one open re-score per user per job.
- **A user signed in while their data is being upgraded**: the upgrade runs before the web app
  answers, as every migration does.
- **Copying production into a dev database**: every user's data is copied; nothing new is skipped
  beyond 024's live sign-in tables.
- **An account is never deleted** in this feature, so ownership never has to be reassigned.

## Requirements *(mandatory)*

### Functional Requirements

**Ownership and the upgrade**

- **FR-001**: Every job a user has, with its score, reasons, gaps, verdict history and hidden and
  applied marks, MUST belong to that user.
- **FR-002**: The Gmail connection and its alert progress MUST belong to a user, one connection per
  user at most.
- **FR-003**: Every re-score run and its steps MUST belong to the user who started it.
- **FR-004**: Search settings, sources, the resume and its profile MUST stay per user, as now.
- **FR-005**: Postings, company records, the careers-page lookup audit and the JSearch call count
  MUST stay shared: they describe employers and the deployment, not a person.
- **FR-006**: The upgrade MUST give all existing data to user 1, drop nothing, run once per
  database, and leave a second run with nothing to do.

**Each user sees only their own**

- **FR-007**: Every page, server action, route and stream MUST read and change only the signed-in
  user's data.
- **FR-008**: A job, re-score, log or source the signed-in user doesn't own MUST get the same answer
  as one that doesn't exist.
- **FR-009**: A new account MUST start with no jobs, default search settings, no sources, no resume
  and no Gmail connection; the deployment's resume file (`data/resume.md`) is the owner's and MUST
  be shown to and used for user 1 only.
- **FR-010**: The admin mark MUST NOT give access to other users' data.

**Runs**

- **FR-011**: Each scheduled run MUST work for every user with at least one source on and a resume,
  one after another, each with their own settings, sources, resume and Gmail; a user without them
  MUST be skipped with a fixed reason.
- **FR-012**: A posting MUST be stored once however many users' sources find it; a careers lookup
  or description lookup for it MUST run at most once, whichever user's run gets there first, and
  a later refresh without a description MUST NOT remove the one found; each user who found it MUST
  get their own link to it, their own source label and their own score.
- **FR-013**: A user MUST see a posting only once one of their own sources (or their Gmail) has
  found it.
- **FR-014**: The JSearch monthly budget MUST be shared by all users' JSearch sources together, both
  when a source is turned on (its planned calls are checked against every user's) and when a run
  spends it.
- **FR-015**: The run's trace and logs MUST name a user only by id.
- **FR-016**: Clean-up MUST remove a user's link to a posting under the same rules as today, MUST
  never remove one the user marked applied, and MUST remove a posting only when no user has it.

**Tools**

- **FR-017**: The command-line re-score and the evals MUST act for one user, named by email, user 1
  when none is named; an unknown email MUST be refused.

**Unchanged**

- **FR-018**: For user 1, every page, setting, run result and message MUST be the same as before
  the upgrade, except the run's summary line, which gains a `user <id>:` prefix (contracts/cli.md).
- **FR-019**: 024's security rules MUST still hold: no job data before sign-in, every action
  guarded, fixed messages.

### Key Entities

- **Posting**: what a source said about a job: title, company, location, description and the rest.
  Shared by everyone, stored once.
- **A user's job**: one user's link to a posting: when they first and last saw it, which of their
  sources found it, their score, reasons and gaps, their verdict history, and their hidden and
  applied marks.
- **Gmail connection**: one per user, with its alert progress.
- **Re-score run**: belongs to the user who started it, with its steps.
- **Company record, careers-page audit, JSearch call count**: shared, unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the upgrade, user 1 sees 100% of the jobs, marks, scores, verdict entries,
  settings, sources and logs they saw before; none is lost or changed.
- **SC-002**: A second account sees 0 of user 1's jobs, settings, sources, resume, Gmail connection
  or logs through any page, action, route or address.
- **SC-003**: In one run with two users, each user's new jobs are scored against their own resume,
  and a posting found for both is looked up (careers page or description) at most once.
- **SC-004**: Two users together never exceed the one JSearch monthly budget.
- **SC-005**: For user 1 alone, a run's results and every page look the same as before the
  upgrade, and a run takes no more than 10% longer.
- **SC-006**: The upgrade is safe to start twice: the second start changes nothing.

## Assumptions

- Builds on 024 (accounts) and 025, both merged.
- Accounts are never deleted in this feature, so no ownership is reassigned.
- Admins get no view of other users' data; an admin view is a later feature if wanted.
- Evals stay files on disk, owned by the deployment; only what they read from or replay against
  the database is per user.
- The emailed-at column (unused) is left as it is.
- The run stays one scheduled job; users are worked one after another, not in parallel.
- The owner's production database is upgraded by the normal start-up migration, as every feature
  before.
