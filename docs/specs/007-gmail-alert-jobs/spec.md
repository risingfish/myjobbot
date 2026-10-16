# Feature Specification: Jobs from Gmail job alerts

**Feature Branch**: `007-gmail-alert-jobs`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description (agreed in conversation after feature 006): "Turn the LinkedIn and Indeed
job-alert emails from the connected Gmail into jobs that myjobbot scores like any other."

## Clarifications

### Session 2026-10-15

- Q: Alert emails carry no job description. How should these jobs be scored? → A: Look the
  postings up through JSearch to get their descriptions, but in batches, not one request per job.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Alert jobs appear in Recommended (Priority: P1)

The owner gets LinkedIn and Indeed job-alert emails. With Gmail connected (feature 006), each
scheduled run reads the alert emails that arrived since the last run, turns every job they list
into a job myjobbot knows, and scores it like jobs from company boards and saved searches. Good
matches appear in Recommended, and every alert job appears in All jobs with "Gmail alerts" as its
source.

**Why this priority**: This is the point of connecting Gmail: alerts the owner already subscribes
to feed the same ranked list instead of a separate inbox.

**Independent Test**: With Gmail connected and a few new alert emails in the mailbox, run the
agent once; every job listed in those emails is in All jobs with source "Gmail alerts", scored,
and the good ones are in Recommended.

**Acceptance Scenarios**:

1. **Given** Gmail is connected and 2 new alert emails list 12 jobs, **When** a run happens,
   **Then** all 12 jobs are stored with their title, company, location and posting link, and the
   ones passing the title filter are scored.
2. **Given** a job was already stored from an earlier alert email, **When** a later email lists
   it again, **Then** it stays one job, keeps its score, and its "last seen" date moves forward.
3. **Given** an alert email was read in an earlier run, **When** the next run happens, **Then** it
   is not read again.
4. **Given** Gmail is not connected, needs reconnecting, or can't be reached, **When** a run
   happens, **Then** the run skips the alerts source, says why in its record, and everything else
   in the run works as before.

---

### User Story 2 - Alert jobs are scored on their full description (Priority: P2)

Scoring on title and company alone is rough. For alert jobs that pass the title filter, myjobbot
finds the same postings through JSearch to get their descriptions, in batches, so the model sees
the description when scoring. Jobs it can't find are still scored, on what the email gave, and
say so.

**Why this priority**: Better scores are the difference between a useful Recommended list and
noise, but alert jobs are still useful without them.

**Independent Test**: With alert jobs pending and JSearch budget left, run once. Most jobs that
JSearch lists are scored with a description, the lookups used far fewer requests than there were
jobs, and the rest are marked as scored from the alert only.

**Acceptance Scenarios**:

1. **Given** 20 new alert jobs pass the title filter, **When** a run looks them up, **Then** it
   uses at most one JSearch request per alert email (never one per job), and each job JSearch
   returns gets its description before scoring.
2. **Given** an alert job JSearch doesn't return, **When** it is scored, **Then** its scoring
   uses the email's details and its reasoning notes that no description was available.
3. **Given** the monthly JSearch budget is nearly spent, **When** a run has alert jobs to look up,
   **Then** saved searches keep the budget they need, lookups stop before the cap, and the
   remaining jobs are scored from the alert only.

---

### User Story 3 - See what the alerts produced (Priority: P3)

The owner wants to know the alerts are working. The Gmail panel (from 006) and the run record say
how many alert emails the last run read, how many jobs they yielded, and how many emails couldn't
be read.

**Why this priority**: Without it, a change in LinkedIn's email layout would silently stop the
flow of jobs.

**Independent Test**: After a run, open Settings; the Gmail panel shows the last run's counts
(emails read, jobs found, emails not understood).

**Acceptance Scenarios**:

1. **Given** a run read 3 alert emails and found 17 jobs, **When** the owner opens Settings,
   **Then** the Gmail panel shows "Last run <date and time>: 3 alert emails, 17 jobs, 0 not
   understood".
2. **Given** an alert email whose layout myjobbot doesn't recognise, **When** a run reads it,
   **Then** it yields no jobs, the run record names the sender and subject, and the panel counts
   it as "not understood". It isn't retried every run.

---

### Edge Cases

- **The same posting from two places**: a job that arrives in an alert and is already stored from
  a company board or a saved search is not stored again from the alert. A board or saved-search
  result arriving later is stored by that source as usual.
- **Busy alerts**: one email can list 25 or more jobs. All of them are stored; lookups are batched
  as in US2.
- **First run after connecting**: only alerts from the last 7 days are read, so years of old
  alerts don't flood the job list.
- **A backlog**: a run reads at most the 50 newest new alert emails. Older unread ones beyond that
  are skipped for good, since the next run continues after the newest.
- **Gmail changes its message numbering for the mailbox** (rare, e.g. after a mailbox reset): the
  run falls back to the last 7 days, and duplicates are already handled.
- **Mail is never changed**: reading alerts never marks them read, moves or deletes them (as in
  006).
- **A non-alert email from an alert sender** (a newsletter, a promotion): it yields no jobs and
  counts as not understood.
- **An alert job with no posting link or no recognisable ID**: that job is skipped, not stored
  with a guessed identity. Its email counts as "not understood" only if it yields no jobs at all.
- **The same job twice**: a job that appears in both a digest and a saved-search alert, or again
  in a later email, is one job. A later sighting never erases its description, salary or score.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each run MUST, when Gmail is connected, read the alert emails (from the configured
  alert senders) that arrived since the last run's read, or in the last 7 days when there was no
  earlier read.
- **FR-002**: Each job listed in an alert email MUST become a stored job with its title, company,
  location, posting link and, when present, salary, identified by its posting's own ID on
  LinkedIn (Indeed later, see Assumptions), with source "Gmail alerts".
- **FR-003**: Jobs from alerts MUST be scored by the same agent, with the same title filter,
  excluded companies and boosts as other jobs, and appear in Recommended and All jobs like them.
- **FR-004**: A posting already stored (from an earlier alert, a company board or a saved search)
  MUST NOT be stored a second time from an alert, and seeing it again MUST NOT erase details it
  already has. (A board or saved-search posting that arrives after an alert job of the same role
  is stored by its own source as before. That direction keeps the description its source
  provides.)
- **FR-005**: An alert email that has been read MUST NOT be read again in a later run, whether or
  not it yielded jobs.
- **FR-006**: For new alert jobs that pass the title filter, myjobbot MUST look up their
  descriptions through JSearch in batches, using at most one request per alert email read in the
  run.
- **FR-007**: Lookups MUST count against the existing monthly JSearch budget, MUST leave saved
  searches the requests their schedule needs, and MUST stop before the cap.
- **FR-008**: A job scored without a description MUST say so in its stored reasoning.
- **FR-009**: When Gmail is not connected, needs reconnecting or can't be reached, the run MUST
  skip the alerts source, record why, and otherwise run as before.
- **FR-010**: Reading alerts MUST NOT change any mail (as 006 FR-003), and MUST store only the
  extracted job details, never email text.
- **FR-011**: The run record and the Gmail panel MUST show, for the last run, how many alert emails
  were read, how many jobs they yielded, and how many emails were not understood (with sender and
  subject in the run record only).

### Key Entities

- **Alert email**: an email from a configured alert sender. Identified within the mailbox so it is
  read once. Never stored; only its jobs are.
- **Alert job**: a job listed in an alert email: title, company, location, posting link, the
  posting's LinkedIn or Indeed ID, and salary when shown. Stored as a job with source "Gmail
  alerts".
- **Alert read marker**: where the last run stopped reading the mailbox, so the next run continues
  from there.
- **Alert run summary**: per run, emails read, jobs found and emails not understood.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For alert emails in a recognised layout, 100% of the jobs they list are stored after
  the next run, with no duplicates of postings already stored.
- **SC-002**: Description lookups use at most one JSearch request per alert email read, and over
  a week of runs at least 2 times fewer requests than there are alert jobs looked up.
- **SC-003**: At least 70% of the alert jobs that are looked up are scored with a description,
  measured as counts on the live run.
- **SC-004**: A run with Gmail unavailable completes the rest of its work exactly as a run without
  the alerts feature would.
- **SC-005**: An alert email layout change is visible to the owner after one run, in the Gmail
  panel's "not understood" count, rather than as silently missing jobs. Mail from senders with
  no layout yet (Indeed) is counted separately as "unsupported", so it can't mask a LinkedIn
  break.

## Assumptions

- **Gmail is connected through 006.** The agent uses the same stored app password and server key
  (`MYJOBBOT_SECRET_KEY`), which both containers already read from `.env`.
- **Senders**: the alert senders are the existing `gmail.alert_senders` setting, LinkedIn and
  Indeed by default. This feature recognises LinkedIn's two layouts (saved-search alerts and
  recommendation digests). The owner had no Indeed alerts to design from (2026-10-15), so Indeed
  mail, and any other unrecognised layout, is counted as "not understood" until a layout for it
  is added.
- **No logging in to LinkedIn or Indeed**: job pages there need a login or block automated access,
  so descriptions come only from JSearch.
- **Budget priority**: saved searches are planned first; alert lookups use what remains of the
  monthly JSearch cap. The 7-day first-run window and the read-once rule keep the lookup volume
  bounded.
- **One source**: all alert jobs share one source, "Gmail alerts", in list_sources and the job
  tables.
- **Scope**: other mail providers, sending mail, and alert senders beyond the configured list are
  out of scope.
