# Feature Specification: Scoring evals

**Feature Branch**: `020-scoring-evals`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "Let's work on setting up a testing framework for refining the LLM pipeline steps."

Owner decisions at the start (2026-11-03): scoring first, with other model steps (the careers lookup)
later on the same harness; cases are snapshots of real jobs that the owner writes answer keys for, made by a command
from the stored jobs, never captured inside runs; the data lives in files under the app's data
folder, not database tables, for now; answer keys use one fixed scale so they stay consistent; runs are
judged against the answer keys, for consistency across repeats, against an earlier run or production's
own scores, and by cost and time; results are read through commands with saved reports first, and a
web page to browse them comes later; the data schema is defined and built first, before any model
call.

## Background: scoring today

- A run, and a re-score, has the model read each job (its title, company, location, remote terms,
  pay, how long it has been open, whether it looks like a ghost posting, description, requirements
  and skills) and give it two parts: base (0-50, fit with the resume) and bonus (0-50, fit with the
  owner's preferences), with reasons and gaps when the total is 40 or more. Both use one shared
  rubric and the owner's resume and preferences.
- Each score is stored with the job and kept in its history, with the run that gave it.
- The only way to judge a change to the rubric, the prompt or the model today is to run it on live
  jobs and look at Recommended. There is no fixed set of jobs, no record of what the right answer
  is, and no way to compare two versions side by side.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture real jobs as cases (Priority: P1)

The owner picks jobs worth testing on, by board and id, or "the 20 most recently scored", and runs
one command. Each becomes a case: the job frozen exactly as the model reads it, the resume and
preferences it was scored against, and the score production gave it then. A case reads the same
next month as today.

**Why this priority**: Every other part works on cases; without a frozen, faithful set there is
nothing to measure.

**Independent Test**: Capture three jobs, one never scored, one scored a week ago, one whose
description was found after it was scored; open the case files and check each holds the job's
fields, its age as of its score, the observed score, and the flags described below.

**Acceptance Scenarios**:

1. **Given** a scored job, **When** the owner captures it, **Then** its case holds the job's
   fields as the model would read them, a link to the resume and preferences in use, and the
   job's latest score with its parts, reasons, gaps, time and run.
2. **Given** a job first seen 19 days before capture and scored 7 days before capture, **When**
   it is captured, **Then** its case gives it as 12 days open, counted as a run counts days on the
   day of the score, works out the ghost flag from 12 days, and records the 7-day shift.
3. **Given** a job never scored, **When** it is captured, **Then** its case keeps its age at
   capture and has no observed score.
4. **Given** two jobs captured with the same resume and preferences, **When** both are saved,
   **Then** they share one stored copy of the resume and preferences.
5. **Given** a job already captured, **When** it is captured again, **Then** the owner is told it
   exists and nothing is overwritten unless they ask for a fresh capture.

---

### User Story 2 - Write answer keys on one scale (Priority: P1)

For each case the owner records what the right result is: recommend, borderline, reject, or zero
(the preferences say score it 0), optionally with an expected score range, base or bonus range,
words the reasons or gaps should mention, and a note saying why. Rewriting it keeps the old
one in the answer key's history.

**Why this priority**: Answer keys are what a run is judged against; without them a run shows only that answers
changed, not whether they got better.

**Independent Test**: Write a case's answer key, rewrite it, and check the file holds the new
answer key and the old one in its history; write one with a range outside 0-100 and check it is refused.

**Acceptance Scenarios**:

1. **Given** a case, **When** the owner writes its answer key "recommend, 65-85, note: remote US, stack
   matches", **Then** the answer key is saved with the time.
2. **Given** a case with an answer key, **When** the owner rewrites it, **Then** the earlier answer key,
   with its time and note, moves into its history.
3. **Given** an answer key whose range is outside 0-100, whose minimum is above its maximum, or whose
   verdict is not one of the four, **When** it is saved, **Then** it is refused with a message
   naming the problem.

---

### User Story 3 - Run the cases against the model (Priority: P2)

The owner runs the cases, all or those with chosen tags, with the current rubric and model or a
named other model, each case one or more times. Each case is sent to the model the way a re-score
sends one job, and its answer is recorded: the parts, the score, the reasons and gaps, or why it
failed, with tokens and seconds. The exact prompt used is saved with the run.

**Why this priority**: It produces the results the reports judge; it follows the data it reads.

**Independent Test**: Run five cases twice each with a stand-in model; check the run records the
model, the prompt, the repeats and the cases, and holds ten results, each with its parts or a
failure code and its tokens and time.

**Acceptance Scenarios**:

1. **Given** cases with answer keys, **When** the owner runs them with 3 repeats, **Then** each case is
   scored 3 times and every attempt is saved with whether it matched its answer key.
2. **Given** a case whose model answer never saves a score, breaks the tool's rules or takes too
   long, **When** it runs, **Then** that attempt is saved as failed with a fixed reason, and the
   run carries on.
3. **Given** a case, **When** it is sent to the model, **Then** the job's text reaches the model
   only inside the run's data markers, as in a run, and its frozen age is sent, never one worked
   out from today.

---

### User Story 4 - Read a run's report (Priority: P2)

After a run, the owner reads a report: how many cases passed their answer keys, which failed and how,
how much each case's score varied across repeats, and tokens and seconds per case and in total.
Against an earlier run, or against production's own scores, it lists the cases whose verdict or
score moved, and by how much.

**Why this priority**: It turns results into a decision: keep the change, or not.

**Independent Test**: From saved results with known values, produce a report and check its pass
rate, spreads, moved cases and totals by hand.

**Acceptance Scenarios**:

1. **Given** a run, **When** the owner asks for its report, **Then** it shows the pass rate
   against answer keys, each failing case with its expected and actual results, and the spread of each
   repeated case.
2. **Given** two runs over the same cases, **When** the report compares them, **Then** it lists
   each case whose verdict changed or whose score moved, and the change in pass rate, tokens and
   time.
3. **Given** a run and the cases' observed scores, **When** the report compares against observed,
   **Then** cases whose description arrived after their observed score, or whose observed score
   was given from the job's summary rather than its full details, are left out of that
   comparison and counted as left out, but still judged against their answer keys.

---

### Edge Cases

- A case, answer key or run file that can't be read or breaks its format is reported by file name and
  skipped; the rest still load.
- A file in a format version other than the current one is reported as needing an upgrade, by
  name, and skipped.
- The evals folder doesn't exist yet: everything lists as empty.
- A job captured with no description is a valid case (scored from the alert only, as a run does).
- A job whose observed score is newer than the capture (clock skew) keeps its age at capture.
- A shift that would make the age negative stops at 0.
- The resume or preferences changed since a job was scored: the case uses the resume and
  preferences as they are at capture; capture says so once per command when any captured job has
  an observed score, since earlier versions aren't stored.
- A run over a case set that includes cases without answer keys records their results with no pass or fail.
- A report on a run whose cases have since had their answer keys rewritten judges against the answer keys at the time of
  the report, and says so.
- A run stopped partway keeps the results saved so far and is marked unfinished.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The owner MUST be able to make cases from stored jobs by board and id, or from the N
  most recently scored jobs, by one command; nothing is captured during runs.
- **FR-002**: A case MUST hold the job exactly as the scoring model is given it (the same fields
  and the same description limit), its board and id, the time of capture, optional tags, and the
  job's latest score at capture with its parts, reasons, gaps, time and run (or none).
- **FR-003**: Cases MUST point to a stored copy of the resume, preferences, match threshold and
  ghost threshold in use at capture; identical copies MUST be stored once.
- **FR-004**: A case with an observed score MUST give the job's age on the day of that score,
  counted as a run counts it (whole days since the job was first seen), with the ghost flag worked
  out from that age and the stored ghost threshold; the case MUST record its age at capture, its
  age as scored and the difference between them (the shift). A case with no observed score keeps
  its age at capture.
- **FR-005**: When the time a job's description arrived can be determined and it is after the
  observed score, the case MUST be marked as having a description that changed since it was scored.
- **FR-005a**: A case with an observed score MUST record whether that score was given after
  reading the job's full details or from its summary alone (or that this is unknown).
- **FR-006**: Capturing a job that already has a case MUST NOT overwrite it unless the owner asks.
- **FR-007**: An answer key MUST have a verdict from recommend, borderline, reject and zero, and MAY have
  a score range, a base range, a bonus range (each within its 0-100 or 0-50 limits, minimum not
  above maximum), words the reasons or gaps should mention, and a note; it MUST record when it was
  given, and rewriting it MUST keep earlier answer keys in its history.
- **FR-008**: How a result is judged against its answer key MUST be fixed: recommend passes when the
  model's score meets the case's match threshold, reject when it is below it, zero when the score
  is 0, borderline when it is within 10 points of the threshold; any ranges and mention words
  given must also hold. Title boosts are not applied (they are added after the model and aren't
  part of what is being refined).
- **FR-009**: Every stored file, prompts included, MUST carry a format version and be checked
  when read; a file that fails is reported by name and left out, without stopping the rest.
- **FR-010**: A run MUST record the model, the exact prompt for each profile its cases use (each
  stored once and referred to), the repeats, the cases included, the code version when it can be
  read, and its start and end; each attempt MUST record
  the parts, score, reasons and gaps, or a fixed failure reason, with tokens used and time taken,
  and whether it passed its answer key (or none without an answer key).
- **FR-011**: Running cases MUST send each job to the model the way a re-score does, inside the
  data markers, with its frozen age; it MUST NOT change any stored job, score or history.
- **FR-012**: A report MUST show the pass rate against answer keys, each failing case with expected and
  actual results, each repeated case's spread, and tokens and time per case and in total; it MUST
  be able to compare against another run or against the cases' observed scores, listing the cases
  whose verdict or score moved, how many now pass that failed and the reverse, and the change in
  pass rate, tokens and time.
- **FR-013**: Reports MUST print only scores, parts, verdicts, fixed reasons, counts, times and the
  case's title and company, plus reasons and gaps only when the owner asks for them; never the
  job's description or other page text.
- **FR-014**: All eval data MUST stay in the app's data folder, which is never committed; no case,
  answer key, run or prompt file goes into the repository.
- **FR-015**: Evals call the real model and MUST NOT run as part of the project's standard checks.
- **FR-016**: The format and its file handling MUST be delivered and tested first, before any
  command that calls the model.

### Key Entities

- **Profile**: the resume, preferences, match threshold and ghost threshold a set of cases was
  captured with; identified by its content, shared by cases.
- **Case**: one job frozen as the model reads it, its source, its dates (capture, age at capture,
  age as scored, shift), its observed score, tags, and whether its description changed since that
  score.
- **Answer key**: the owner's judgement of a case on the fixed scale, with optional ranges, mention
  words, a note, its time and its history.
- **Prompt**: the exact instructions a run sent, stored once and referred to by runs.
- **Run**: one pass over a set of cases with one model, the prompt for each profile its cases use,
  and a number of repeats.
- **Result**: one attempt at one case in a run: parts, score, reasons, gaps or a failure reason,
  tokens, time, and pass or fail against the answer key.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can capture 20 recent jobs as cases with one command in under a minute.
- **SC-002**: A case captured today gives the same job to the model, field for field, when run a
  month later.
- **SC-003**: Every case's age as scored matches the job's age on the day of its observed score,
  to the day.
- **SC-004**: A report states, for a change to the prompt or model, how many cases with answer keys now pass
  that failed before and the reverse, so the owner can decide in one read.
- **SC-005**: Running the same unchanged case set twice shows each case's spread, so the owner can
  tell a real change from the model's own variation.
- **SC-006**: A damaged file never stops the rest from loading, and is named in the output.
- **SC-007**: No eval file appears in the repository, and no description text appears in a report.

## Assumptions

- One owner; no sharing of cases or answer keys beyond the local data folder.
- Cases use the resume and preferences at capture: earlier versions aren't stored, so a job scored
  before the resume changed is judged against today's resume.
- The careers lookup's records of when it found a description give that description's arrival
  time; for other jobs the description is taken to have arrived with the listing.
- Answer keys are written through a command (or by editing the answer key file, which is checked when read); a
  page for answer keys in the web UI is a later step, with the run browser.
- Pass rules use the model's score against the match threshold, the same threshold Recommended
  uses; title boosts, which Recommended adds on top, are out of scope. The borderline band of 10
  points is a default the owner can change later.
- The first pull request delivers the format, its readers, a command that checks the stored files,
  and tests; each kind of file is first written by the command that needs it (capture, answer keys,
  running) in a later pull request, and reports follow last.
- Other model steps (the careers lookup) and the web page are out of scope for this feature.
