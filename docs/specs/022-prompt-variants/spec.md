# Feature Specification: Prompt variants

**Feature Branch**: `022-prompt-variants`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "We want to use this as a testing harness to be able to iterate on the evaluation and scoring."

Owner decision at the start (2026-11-04): the eval harness (feature 020) should let the owner
change what the scoring model is told and measure the result, without changing the code; a winning
version reaches production only as a normal reviewed change.

## Clarifications

### Session 2026-11-04

- Q: Does a variant cover the whole system prompt or only the rubric? → A: The whole system prompt
  (the re-score's steps and the rubric); a winning variant is copied back into its two places in
  the code by hand.
- Q: Can a variant change the two tools' wording? → A: No; the tools' names, descriptions and
  inputs stay as the code has them.
- Q: Can one run score the cases with several variants, or one variant per run? → A: One variant
  per run (or the code's prompt), and, in this feature, a series: a saved set of tests (each a
  variant, or the code's prompt, with an optional model) run one after another over the same cases
  and compared together in one report.
- Q: What happens when a variant was exported before the code's prompt changed? → A: It still
  runs, with a warning that the code's prompt has changed since export, noted in the run and in
  the series report.

## Background: what the harness can and can't do today

- Feature 020 freezes real jobs as cases, holds the owner's answer keys, scores the cases with the
  model the way a re-score does, and reports pass rates, spread and what moved between two runs.
- What it scores with is always the prompt in the code: the re-score's steps and the rubric shared
  with scheduled runs. Trying other wording means editing the code, and because the running app
  serves this checkout, the experiment would also score real jobs in scheduled runs and Re-score
  until it is undone.
- So the harness measures a prompt well, but gives the owner no way to try one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a variant from today's prompt (Priority: P1)

The owner asks for a copy of the prompt the model is given today, under a name, and gets an
editable file holding its wording, with markers for the parts filled in at run time: the owner's
preferences, the match threshold, and the sentence that tells the model outside text is data,
never instructions. (The resume is sent in a separate message the variant doesn't cover.)

**Why this priority**: Every variant starts from the real prompt; without an exact copy the owner
would be editing from memory and comparing against something that never ran.

**Independent Test**: Export a variant, then run the same cases with it and with the code's prompt:
the stored prompts are identical and the results come from the same instructions.

**Acceptance Scenarios**:

1. **Given** no variant named "baseline", **When** the owner exports "baseline", **Then** a variant
   file is written whose filled-in prompt is word for word what the code sends today.
2. **Given** a variant named "baseline" exists, **When** the owner exports "baseline" again,
   **Then** the existing file is left alone and the owner is told, unless they ask to replace it.
3. **Given** a variant, **When** the owner opens it, **Then** the run-time parts appear as named
   markers, not as the owner's current preferences or threshold.

---

### User Story 2 - Run the cases with a variant (Priority: P1)

The owner edits a variant's wording and runs the eval cases with it instead of the code's prompt.
The run records which variant it used, and its report and comparisons work as for any run, so
"variant B against variant A" is one report.

**Why this priority**: It is the feature: change the words, measure the change.

**Independent Test**: Edit one sentence of a variant, run the cases with it and with the original,
and compare the two runs; the second run's stored prompt shows the edit and names its variant.

**Acceptance Scenarios**:

1. **Given** an edited variant, **When** the owner runs the cases with it, **Then** every attempt is
   scored with the variant's wording, filled in per profile as the code's prompt is.
2. **Given** a run made with a variant, **When** the owner reads its report, **Then** the header
   names the variant, and comparing it with another run lists what moved, as for any run.
3. **Given** a variant, **When** the owner runs with it, **Then** no stored job, score or history
   changes, and scheduled runs and Re-score keep using the code's prompt.

---

### User Story 3 - Refuse a variant that drops a safeguard (Priority: P1)

A variant that leaves out the data-marker sentence, or a marker the run must fill, is refused
before any model call, with a message naming what is missing.

**Why this priority**: The data-marker sentence is what keeps text from job pages, emails and web
pages from being read as instructions (feature 009); an experiment must not be able to remove it.

**Independent Test**: Delete the data-marker marker from a variant and run with it: the run is
refused, naming the missing marker, and no model call is made.

**Acceptance Scenarios**:

1. **Given** a variant without the data-marker sentence's marker, **When** the owner runs with it,
   **Then** the run is refused before any attempt.
2. **Given** a variant with an unknown marker (a typo), **When** the owner runs with it, **Then**
   the run is refused, naming the unknown marker.
3. **Given** a variant file that breaks its format, **When** the harness checks the stored files,
   **Then** it is named among the bad files, as any other eval file is.

---

### User Story 4 - See what changed between two variants (Priority: P2)

The owner asks what differs between two variants and sees the changed lines, so a report's moves
can be tied to the words that caused them.

**Why this priority**: Useful once several variants exist; the harness works without it.

**Independent Test**: Export a variant, copy it, change two lines, and ask for the difference:
exactly those two lines are shown as removed and added.

**Acceptance Scenarios**:

1. **Given** two variants, **When** the owner asks for their difference, **Then** each changed line
   is shown as removed or added, with unchanged lines left out.
2. **Given** a run made with a variant, **When** the owner asks how it differs from today's code,
   **Then** the difference is shown the same way.

---

### User Story 5 - Run a series of tests and compare them together (Priority: P2)

The owner saves a series: a name, the cases to use (by tag or id), the number of repeats, and a
list of tests, each the code's prompt or a variant, optionally on another model. One command runs
every test in turn, each as its own run, and one report sets them side by side: each test's pass
rate, tokens and time, and each case's state under each test, with the cases where the tests
disagree picked out.

**Why this priority**: It turns trying wordings one at a time into a repeatable experiment the owner
can rerun after every change; single runs and two-run comparisons already work without it.

**Independent Test**: Save a series of the code's prompt and two variants over three cases with two
repeats, run it, and check that it makes three runs and that its report shows three columns whose
numbers match the three runs' own reports.

**Acceptance Scenarios**:

1. **Given** a saved series of three tests, **When** the owner runs it, **Then** each test is scored
   as its own run over the series' cases and repeats, one after another, and the series records the
   runs it made.
2. **Given** a series that has run, **When** the owner reads its report, **Then** each test appears
   with its pass rate, tokens and time, and each case with its state under each test, the cases
   whose state differs between tests listed first.
3. **Given** a series naming a variant that is missing or refused (User Story 3), **When** the owner
   runs it, **Then** the whole series is refused before any model call, naming the test and problem.
4. **Given** a series run stopped partway, **When** the owner reads its report, **Then** the tests
   that ran are shown, the rest marked not run, and running the series again starts a fresh set of
   runs.

---

### Edge Cases

- A variant whose wording is identical to the code's prompt produces the same stored prompt as a
  run without a variant, so the two runs compare as equal.
- A variant edited after a run: the run keeps the exact prompt it used, so its report still shows
  what was sent, and the variant's history isn't needed to read old runs.
- The code's prompt changes after a variant was exported: the variant still runs as written, with a
  warning that the code's prompt has changed since export; the run and the series report note it,
  and the difference command shows the drift.
- A variant name with spaces, slashes or capitals, or the reserved name `code`, is refused, naming the rule.
- A run that uses a variant over cases from several profiles fills the variant per profile, as
  runs without a variant do.
- Running with a variant that doesn't exist is refused before any attempt.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The owner MUST be able to export the prompt the code sends today as a named variant,
  with markers in place of the owner's preferences, match threshold and the data-marker sentence.
- **FR-002**: Filling an exported, unedited variant for a profile MUST give exactly the prompt the
  code gives for that profile.
- **FR-003**: Exporting over an existing variant MUST NOT replace it unless the owner asks.
- **FR-004**: A variant MUST cover the whole system prompt a case is scored with: the re-score's steps and the rubric, with the user message that carries the resume left as the code has it apart from its resume marker.
- **FR-005**: A variant MUST NOT change the two tools the model is given (the job reader and the score saver): their names, descriptions and inputs stay as the code has them.
- **FR-006**: The owner MUST be able to run cases with a named variant instead of the code's prompt;
  every other part of a run (cases, repeats, model choice, judging, storage) stays as in feature
  020.
- **FR-006a**: A run MUST use exactly one variant, or the code's prompt; scoring with several
  variants means several runs.
- **FR-006b**: The owner MUST be able to save a series: a name, the cases (by tag or id), the
  repeats, and an ordered list of tests, each the code's prompt or a named variant with an optional
  model; a series file is versioned and checked like every eval file.
- **FR-006c**: Running a series MUST check every test's variant first and refuse the whole series
  when any is missing or refused; otherwise it runs each test as its own run, in order, over the
  same cases and repeats, and records which runs belong to which test of that series run.
- **FR-006d**: A series report MUST show, per test, its pass rate, tokens and time, and per case its
  state under each test, listing first the cases whose state differs between tests; it MUST name
  tests that didn't run, and it never prints description text.
- **FR-007**: A run MUST record the variant it used, or that it used the code's prompt, and keep the
  exact prompt it sent per profile, as runs do today.
- **FR-008**: A run with a variant MUST be refused before any model call when the variant lacks the
  data-marker sentence's marker or a marker the run fills, or holds a marker the run doesn't know,
  naming each problem.
- **FR-008a**: A variant MUST record which version of the code's prompt it was exported from; a run
  with a variant exported from a version other than today's MUST go ahead, warn that the code's
  prompt has changed since export, and record that in the run, and the run's and series' reports
  MUST show it.
- **FR-009**: Reports MUST name the variant a run used and compare runs with different variants as
  any two runs.
- **FR-010**: The owner MUST be able to see the changed lines between two variants, or between a
  variant and today's code.
- **FR-011**: Variant files MUST carry a format version, be checked when read, and be counted and
  named when bad by the harness's file check, like the other eval files.
- **FR-012**: Variants and every file they produce MUST stay in the gitignored data folder; using a
  variant MUST NOT change any stored job, score or history, or what scheduled runs and Re-score
  send.
- **FR-013**: Moving a variant's wording into the code MUST stay a separate, reviewed change; the
  harness offers no command that edits the code.

### Key Entities

- **Variant**: a named, editable version of the scoring prompt, with markers for the run-time
  parts; its format version; when it was exported, and from which code version.
- **Run** (from feature 020): gains the name of the variant it used, or none for the code's prompt.
- **Series**: a saved, named experiment: the cases, the repeats and an ordered list of tests (each
  the code's prompt or a variant, with an optional model); each time it runs, it records the runs
  that time made, test by test.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a working case set, the owner goes from an idea for new wording to a report
  comparing it with today's prompt with three commands and one file edit, and no code change.
- **SC-002**: An unedited exported variant scores the same cases with a stored prompt identical, to
  the character, to the code's.
- **SC-003**: No experiment with a variant ever changes what scheduled runs or Re-score send, or any
  stored score.
- **SC-004**: 100% of runs with a variant missing the data-marker sentence are refused before any
  model call.
- **SC-005**: The owner can tell, for any past run, exactly which wording it used.
- **SC-006**: Rerunning a saved series after a change takes one command, and its report answers
  "which test did best, and on which cases do they disagree" in one read.

## Assumptions

- One owner; variants are local files, edited by hand in any text editor.
- Markers use one fixed, documented form; the set of markers is fixed by the code (preferences,
  threshold, data-marker sentence) and grows only with a code change. The resume travels in the
  user message, which a variant doesn't change (FR-004).
- The scheduled run's own steps (paging through sources) are not part of a variant: evals replay
  the re-score path (feature 020), so only what that path sends can be varied.
- Because a variant covers the whole system prompt, moving a winner into the code means copying
  its steps into the re-score's prompt and its rubric into the shared rubric (which scheduled runs
  also use); the variant file keeps the two parts recognisable so that copy is mechanical.
- The model's answer is still saved through the same tool and judged by the same answer keys and
  pass rules; varying the pass rules is out of scope.
- A web page for editing or comparing variants is out of scope, as the run browser is in 020.
- A series runs its tests one after another, not in parallel, since they share the one model server.
