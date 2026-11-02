# Feature Specification: Re-score terminal

**Feature Branch**: `019-rescore-terminal`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "If I click re-score, I want to see a running status of what is going on. This means creating an audit log as it runs and feeding back to the browser to display. When we display it, I want it to look like a terminal window, and like we're running a script in it. It shouldn't be interactive, but I want to see the steps as they run."

Owner decisions at the start (2026-11-02): it appears in the job panel; it shows steps only, never page or model text; showing sanitized model output is a later iteration, not this feature.

## Clarifications

### Session 2026-11-02

- Q: Is a re-score's terminal log kept only while the panel is open, or saved? → A: Saved, and
  every re-score's log is listed under the job's History, where it can be opened again.
- Q: How do re-scores sit in History beside its score rows? → A: One combined list: a re-score that
  scored the job is its score row with a Log button; filtered, failed and running re-scores get rows
  of their own (outcome, no score) with Log; scores from scheduled runs have no log.
- Q: Reopening a job while its re-score runs, does the terminal pick the run back up live? → A: Yes:
  it opens with the lines so far and keeps following until the run ends.
- Q: What happens on Re-score while that job's re-score is already running (another tab, the CLI)?
  → A: A new re-score cannot start until the current one has finished; pressing Re-score opens and
  follows the running one instead.
- Q: When a re-score finishes, what happens to its terminal in the panel? → A: It stays, showing the
  finished log, with a close (×) button in its title bar; opening another job or closing the panel
  also closes it.
- Q: How long after it started is a re-score still marked running treated as dead? → A: 10 minutes.

## Background: Re-score today (feature 018)

- Pressing **Re-score** in the job panel scores one job again at once. The button reads
  "Re-scoring…" until the re-score ends, then the panel shows the new score, or a fixed note
  ("Not re-scored: hidden by body filter", "Re-score failed; the old score is kept").
- Along the way a re-score checks the filters, may run the careers lookup for a job with no
  description (a search, then pages opened one by one), then has the model read the job and save
  its score. Each step is already written to the re-score's own trace file, and the lookup's
  pages to its audit rows, but nothing of this reaches the browser until the end, which can be
  minutes away.
- The panel never shows text from job pages or from the model; its notes come from a fixed set.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Watch a re-score run (Priority: P1)

The owner presses Re-score. Under the panel's header a terminal window opens: a dark pane in a
fixed-width font with a command line at the top, as if `myjobbot rescore greenhouse 4012345` had
just been typed. As the re-score works, a line appears for each step, the way a script prints its
progress: the filters passed, the careers search ran, a page was opened (its address and size),
the model is reading the job, the score was saved. The pane scrolls to keep the newest line in
view. The last line is the outcome, and the panel then refreshes the score as it does today.

**Why this priority**: It is the feature: the owner sees what a long re-score is doing instead
of a button that only says "Re-scoring…".

**Independent Test**: Re-score a job with no description and watch the lines arrive while it
runs, ending with its outcome; check that the score, history and list row update as before.

**Acceptance Scenarios**:

1. **Given** a scored job, **When** the owner presses Re-score, **Then** the terminal opens at
   once with the command line, and step lines appear while the re-score runs, not all at the end.
2. **Given** a job with no description, **When** it is re-scored, **Then** the terminal shows the
   careers search and each page the lookup opens, with its address and size, before the scoring
   lines.
3. **Given** the re-score finishes, **When** its last line arrives, **Then** that line states
   the outcome (scored with the new score, filtered with the filter that hides it, or failed with
   the old score kept), and the panel's score, history and list row update exactly as today.
4. **Given** more lines than fit, **When** new lines arrive, **Then** the pane keeps the newest in
   view.

---

### User Story 2 - Nothing outside gets into the terminal (Priority: P1)

Every line in the terminal is built by the app from a fixed set of messages, filled only with
values the app itself controls or has checked: the job's key, a step's kind, a page's address and
size, a count, a score, a filter's name. No text from a job page, an email or the model's replies
ever appears in it.

**Why this priority**: The panel's rule that outside text is never shown (features 009 and 018)
must hold for the new view too; the next iteration will add sanitized model output deliberately.

**Independent Test**: Re-score a job whose page and model reply contain marker look-alikes and
HTML; the terminal shows only the fixed lines.

**Acceptance Scenarios**:

1. **Given** any re-score, **When** its lines are shown, **Then** each line matches one of the
   fixed messages, with only the allowed values in it.
2. **Given** a step the app has no message for, **When** it happens, **Then** no line is shown for
   it (it is still in the trace file).

---

### User Story 3 - The run is not lost by looking away (Priority: P2)

The terminal is a view of the re-score, not its owner. Closing the panel, opening another job or
reloading the page during a re-score doesn't stop it: it finishes on the server and its result is
stored as today.

**Why this priority**: A re-score with a lookup can take minutes; the owner may move on.

**Independent Test**: Start a re-score, close the panel, and later reopen the job: its new score
or outcome is there.

**Acceptance Scenarios**:

1. **Given** a re-score is running, **When** the owner closes the panel, **Then** the re-score
   still finishes and stores its result.
2. **Given** the browser loses the live feed (the connection drops), **When** the re-score ends,
   **Then** its result is still stored; the terminal says the live view was lost, and reopening the
   job's log from History picks the run up again (or shows it finished).

### User Story 4 - Read an earlier re-score's log (Priority: P2)

Under the job's History, each re-score is listed with its time and outcome, whether it scored the
job, found it filtered, or failed. Opening one shows its log in the same terminal view, all lines
at once, ending with its outcome.

**Why this priority**: The owner wants to look back at what a re-score did, including ones that
didn't change the score, after the panel has closed.

**Independent Test**: Re-score a job twice (one scored, one after adding a filter term), close
the panel, reopen the job, and open each re-score's log from History.

**Acceptance Scenarios**:

1. **Given** a job re-scored earlier, **When** the owner opens its panel, **Then** History is one
   list, newest first: each re-score that scored the job is its score row with a Log action, and
   scores from scheduled runs have none.
2. **Given** a listed re-score, **When** the owner opens its log, **Then** the terminal view shows
   that run's command line and every line it showed live, in order, with their times, ending with
   its outcome.
3. **Given** a re-score that was filtered or failed, **When** History is shown, **Then** it is
   listed too, though it saved no score.
4. **Given** a re-score still running (the panel was closed, the page reloaded, or another tab),
   **When** the owner opens the job, **Then** History lists it as running, and opening its log shows
   the lines so far and keeps adding new ones live until it ends.

---

### Edge Cases

- Pressing Re-score while that job's re-score runs (in this panel, another tab or the CLI) starts
  nothing new; it opens the running one's terminal and follows it (FR-014).
- A re-score that ended abnormally (the server stopped mid-run) must not block the job forever: a
  run still marked running 10 minutes after it started counts as finished (failed), and a new
  re-score may start.
- A re-score that can't start (its settings can't be read, or the job is gone) records no run: the
  panel shows the existing failure note and no terminal. A re-score that started and then fails
  (the model can't be reached) shows its lines so far and a failed outcome line.
- A filtered job shows the settings line, the filter line and the outcome, with no model lines; a
  job with no description is looked up first, unless a company or title filter already hides it,
  so its lookup lines come before the filter line.
- Very long runs: the terminal keeps every line of the run; it is not trimmed.
- A re-score whose browser feed was lost still has its full log in History.
- A job pruned by the cleanup takes its re-score logs with it; a job marked applied is never
  pruned, so its logs stay.
- Two browser tabs: both can follow the same running re-score's log; only one re-score of a job
  runs at a time from a panel, as Re-score stays disabled while one runs in that panel.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Pressing Re-score MUST open a terminal-style view in the job panel, under its
  header, showing a command line naming the job's key before the first step.
- **FR-002**: While the re-score runs, each step MUST be shown as one line as it happens, not
  only at the end. The steps shown are: settings resolved; each filter outcome; the careers
  lookup starting; its search; each page it opens (address, characters read, how it was read:
  download, board data or browser); its result; the model reading the job; the score saved
  (total); a look-alike marker removed; the outcome.
- **FR-003**: Every line MUST come from a fixed set of messages, filled only with app-controlled
  or checked values (keys, step kinds, http(s) addresses the lookup tried, sizes, counts, scores,
  filter names). Page, email and model text MUST NOT appear.
- **FR-004**: The last line MUST state the outcome, matching the existing outcomes and notes
  (scored, filtered, failed); the panel's refresh, notes and list update MUST stay as they are.
- **FR-005**: The view MUST look like a terminal: a title bar, dark background, fixed-width font, a
  prompt-style command line, lines appended in order, newest kept in view, a cursor shown while
  running. It MUST NOT accept input. When the run ends it MUST stay open showing the finished log
  until the owner closes it with the close (×) button in its title bar, opens another job, or
  closes the panel.
- **FR-006**: The re-score MUST keep running and store its result if the browser stops watching.
- **FR-007**: If the live feed is lost, the view MUST say so and the result MUST still be stored.
- **FR-008**: Each line MUST carry the time since the run started.
- **FR-009**: The steps MUST still be written to the re-score's trace file as today, so the trace
  stays the full record.
- **FR-010**: Every re-score's log (its command line, its lines with their times, and its
  outcome) MUST be saved as it runs, holding only the same fixed lines the terminal shows.
- **FR-011**: The job's History MUST be one list, newest first, in which each re-score appears
  exactly once: a re-score that scored the job is that score's row, with a Log action; a filtered,
  failed or still-running re-score is a row of its own showing its outcome instead of a score, with
  a Log action. Score rows from scheduled runs stay as they are, with no Log.
- **FR-012**: Opening a listed re-score MUST show its saved log in the same terminal view, not
  interactive: a finished run's lines all at once; a running one's lines so far, then each new
  line as it happens until the run ends, the same as the view that started it.
- **FR-013**: A job's re-score logs MUST be removed when the job itself is pruned, and kept
  otherwise.
- **FR-014**: Only one re-score of a job MAY run at a time. While one is running, from any panel,
  tab or the CLI, a new one MUST NOT start: pressing Re-score opens and follows the running one, and
  the CLI says one is already running and exits without re-scoring. A run still marked running 10
  minutes after it started is treated as failed and no longer blocks a new one.

### Key Entities

- **Re-score step**: one thing a re-score did, with its kind, the values allowed in its line,
  and its time since the start. A run's steps, in order, are its terminal log.
- **Re-score run**: one press of Re-score (or one CLI re-score) for a job: its id, the job, when
  it started and ended, its outcome, and its steps. Kept with the job.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The terminal opens, with its command line, within 1 second of pressing Re-score.
- **SC-002**: Each step's line appears within 1 second of the step happening.
- **SC-003**: 100% of lines match the fixed messages; 0 lines contain page, email or model text.
- **SC-004**: Re-score's outcomes and stored scores are unchanged: the existing re-score flow's test
  cases pass with only the new `log` and `fallbacks` dependencies added; the panel's tests change only for the split
  into starting a run and following it.
- **SC-005**: Every re-score that started, including filtered and failed ones, appears in its
  job's History, and its log reopens with 100% of the lines it showed live, in order.

## Assumptions

- One owner, one re-score at a time per panel, as today.
- The CLI command (`npm start -- rescore`) prints the same lines to the console, since the
  messages are shared, and its re-scores are saved and listed in History like the panel's.
- Times are shown as seconds since the start (for example `[ 2.4s]`), not clock times.
- The terminal is styled with Pico's monospace font and colour variables, in both themes.
- The existing "server action runs one at a time" limit no longer has to hold the page's other
  actions while a re-score runs, if the live feed travels separately; the plan decides.
- Showing sanitized model output is out of scope here (the owner's next iteration).
