# Feature Specification: Body filters

**Feature Branch**: `018-body-filters`

**Created**: 2026-10-31

**Status**: Draft

## Clarifications

### Session 2026-11-01

- Q: Should a body filter also have a "must include one of" list? → A: Yes (owner, revised the same
  day): an exclude list and a "must include one of" list, like the title filter.
- Q: What happens to jobs already scored when a term is added? → A: They keep their score and stay on
  Recommended, as with title filters today.
- Q: How should terms match descriptions? → A: The same way title filter terms match titles: whole
  words or phrases, case-insensitive, punctuation as spaces, optional plural "s".
- Owner addition: a button to re-score a job from its description (User Story 4).
- Q: When the owner presses Re-score, is the job scored at once or by the next run? → A: At once,
  while the panel is open: the panel shows that it is re-scoring, then the new score.
- Q: If a job has no description, does Re-score look it up first? → A: Yes: it runs the careers
  lookup for the missing description, then scores.

**Input**: User description: "We have title filters, lets add body filters as the next spec. They will be more useful." Body filters are filters on a job's description text, alongside the existing title filters.

## Background: how title filters work today

- The search setting `title_filter` has three lists: `include` (the title must start a word with one
  of these), `exclude` and `extra_exclude` (the title must not contain any of these). Terms are
  matched case-insensitively after punctuation is turned into spaces, as whole words or phrases, with
  an optional plural "s" ("engineer" matches "Engineers", "full stack" matches "Full-Stack").
- The filter runs before the model scores a job, so a filtered job costs no model call, and before
  LinkedIn alert jobs are looked up, so it saves lookups too. It never deletes a job.
- On the All jobs page, a filtered job carries the note "hidden by title filter". Jobs scored before a
  filter changed stay on Recommended.
- The lists are edited in the Settings page's Filters section and stored with the other search
  settings. `title_boosts` already add points when a term appears in the title **or** the
  description, so boosting by description text exists today.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter jobs by what their description says (Priority: P1)

The owner keeps seeing jobs whose titles look right but whose descriptions rule them out: a security
clearance, a language they don't work in, on-site only. They add terms such as "security clearance"
or "PHP" to the body filter's exclude list in Settings, and from the next run on, jobs whose
description contains one of those terms are left out before the model scores them. They can also
list terms a description must mention, such as "TypeScript" or "Go", and jobs whose description
mentions none of them are left out too.

**Why this priority**: This is the feature's purpose: it removes unwanted jobs that title filters
can't catch, and it saves the model calls those jobs would have cost.

**Independent Test**: Save a body filter term, run the agent against jobs where some descriptions
contain the term, and check that those jobs were not scored and the others were.

**Acceptance Scenarios**:

1. **Given** the body filter excludes "security clearance", **When** a run reaches an unscored job
   whose description says "Active Security-Clearance required", **Then** the job is not sent to the
   model and is not scored in that run.
2. **Given** the same filter, **When** a run reaches an unscored job whose description doesn't mention
   a clearance, **Then** the job is scored as before.
3. **Given** the body filter excludes "php", **When** a description mentions "PHPUnit" only, **Then**
   the job is not excluded, because terms match whole words, not parts of words.
4. **Given** a job has no description yet, **When** a run reaches it, **Then** neither body filter
   list leaves it out, and it is scored, or its description is looked up, exactly as today.
5. **Given** the body filter must include one of "typescript" and "golang", **When** a run reaches a
   job whose description mentions only Java, **Then** the job is not sent to the model.
6. **Given** the same include list, **When** a description mentions "Golang" or "TypeScript-first",
   **Then** the job is scored.
7. **Given** the include list is empty, **When** a run reaches any job, **Then** the include list
   leaves nothing out.

---

### User Story 2 - Edit body filters on the Settings page (Priority: P1)

The owner opens Settings, finds the body filter's two lists ("Description must include one of" and
"Description must not include") in the Filters section beside the title filter's lists, adds, edits and removes terms, and saves the section. A bad term (one with no letters or
digits) is refused with a message next to it, as title filter terms are.

**Why this priority**: Search settings change only on the Settings page; without it the filter can't
be used.

**Independent Test**: Add a term, save, reload the page and see it kept; add a term made only of
punctuation and see the save refused with a message on that row.

**Acceptance Scenarios**:

1. **Given** the Filters section, **When** the owner adds "clearance" to the body filter and saves,
   **Then** the term is stored and shown after a reload.
2. **Given** a body filter term "---", **When** the owner saves, **Then** nothing in the section is
   saved and the row shows that a term needs at least one letter or digit.
3. **Given** a saved body filter list, **When** the owner resets it, **Then** it returns to its
   default, which is empty, for both lists.

---

### User Story 3 - See which jobs a body filter hides (Priority: P2)

On the All jobs page, a job the body filter leaves out (its description matches an exclude term, or
mentions none of the include terms) carries a note saying it is
hidden by the body filter, as title-filtered jobs carry "hidden by title filter", so the owner can see
what the filter catches and loosen a term that catches too much.

**Why this priority**: Without it, a too-broad term silently drops good jobs.

**Independent Test**: With a body filter term saved, open All jobs and check the note on a job whose
description contains the term and its absence on one that doesn't.

**Acceptance Scenarios**:

1. **Given** the body filter excludes "clearance", **When** the owner views All jobs, **Then** a job
   whose description contains "clearance" shows a note that it is hidden by the body filter.
2. **Given** a job is hidden by both its title and its description, **When** it is shown, **Then** it
   carries one note, naming the title filter first.

---

### User Story 4 - Re-score a job (Priority: P2)

A job's score can go stale: the owner changed their preferences or resume, added a body filter term
that old jobs don't feel (FR-008), or the job's description arrived after it was scored from an alert
alone. In the job panel, the owner presses **Re-score**, and the job is scored again from its current
description against the current resume, preferences and filters, replacing its old score, reasons and
gaps.

**Why this priority**: Because new filter terms leave scored jobs alone (FR-008), re-scoring is how the
owner applies today's settings to a job they are looking at.

**Independent Test**: Note a scored job's score, change a preference, press Re-score on it, and check
that the job's score, reasons and gaps are replaced and its scored time moves forward.

**Acceptance Scenarios**:

1. **Given** a scored job, **When** the owner presses Re-score, **Then** the job is scored at once,
   without waiting for a run: the panel shows that it is re-scoring, then the new score, reasons and
   gaps, without a page reload.
2. **Given** the body or title filter now matches the job, **When** it is re-scored, **Then** it is not
   sent to the model; it loses its score and leaves Recommended, and All jobs notes which filter hides
   it.
3. **Given** a hidden or applied job, **When** it is re-scored, **Then** it stays hidden or applied.
4. **Given** a re-score fails (the model can't be reached or answers badly), **When** the owner looks
   at the job, **Then** it keeps its old score and the panel says the re-score failed.
5. **Given** a job with no description, **When** the owner presses Re-score, **Then** the careers
   lookup tries to find its description first, storing it as a run's lookup would; the job is then
   scored from the description if one was found, or from its title and alert fields if not.

---

### Edge Cases

- A description in Markdown is matched on the text the model reads, with links reduced to their
  words, so a term doesn't match an address inside a link.
- A term that appears only in the title, not the description, does not trigger the body filter.
- A job with an empty or missing description is never left out by either body filter list.
- A short or cut-off description may miss every include term; the All jobs note shows the owner
  which jobs that hides.
- A description that matches an include term and an exclude term is left out: exclusion wins, as in
  the title filter.
- LinkedIn alert jobs have no description until they are looked up, so the body filter can't save
  their lookups; it applies once the description arrives, before scoring.
- A bad stored value for the body filter falls back to the default with a notice that does not show
  the value, like every other search setting.
- Re-score on a job with no description looks the description up first (FR-011); if the lookup finds
  nothing or fails, the job is scored from what it has, and a lookup failure alone is not a re-score
  failure.
- Changing the body filter after jobs are scored leaves those jobs as they are (FR-008); the owner
  re-scores a job to apply the new filter to it (User Story 4).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The search settings MUST include a body filter with two lists of terms, both empty by
  default: an exclude list, which leaves a job out when its description contains any of them, and an
  include list, which, when it has terms, leaves a job out when its description contains none of
  them.
- **FR-002**: Body filter terms, in both lists, MUST match the description the same way title filter
  exclude terms match the title (the owner's Q3 answer). Unlike title include terms, which match the
  start of a word, a body include term matches only whole words, so "go" never matches "good".
  Matching is case-insensitive, with punctuation treated as spaces, as a whole word or phrase, with
  an optional plural "s"; never as part of a longer word ("java" never matches "javascript").
- **FR-003**: Terms MUST be matched against the description's readable text, the same text the model
  reads, never the title.
- **FR-004**: A job that matches the body filter MUST NOT be sent to the model for scoring, in the same
  place and the same way as a job the title filter drops; it MUST NOT be deleted.
- **FR-005**: A job with no description MUST pass both body filter lists.
- **FR-006**: The body filter MUST be stored with the other search settings, validated with them, and
  edited only in the Settings page's Filters section, saved with that section's other lists.
- **FR-007**: A body filter term with no letter or digit MUST be refused on save, with the message
  shown on that term's row.
- **FR-008**: Jobs already scored when a body filter term is added MUST keep their score and stay on
  Recommended, as title-filtered jobs do today; the filter applies to jobs scored after it is saved, and
  to a job the owner re-scores (FR-011).
- **FR-009**: On the All jobs page, a job the body filter matches MUST carry a note saying it is hidden
  by the body filter, unless the company or title filter already notes it.
- **FR-010**: Description boosts (`title_boosts`) MUST keep working unchanged.
- **FR-011**: The job panel MUST offer a Re-score action for any job, which scores the job again at
  once, while the panel is open and showing that it is in progress, from its current description
  against the current resume, preferences, filters and boosts, replacing its score, reasons, gaps and
  scored time; it MUST NOT change the job's hidden or applied marks. For a job with no description it
  MUST first run the careers lookup, with the same address checks and audit as a run's lookup, store
  any description found, and apply the body filter to it before scoring.
- **FR-012**: A re-scored job that the title, company or body filter now matches MUST NOT be sent to the
  model; it MUST lose its score and carry that filter's note on All jobs.
- **FR-013**: A failed re-score MUST leave the job's old score in place and say so in the panel, with a
  fixed message that never contains model or page text.
- **FR-014**: A re-score MUST send the job's text to the model only inside the data markers, as runs do,
  and MUST be recorded in the run traces or cost log the way a run's scoring is.

### Key Entities

- **Body filter**: a search setting holding an include list and an exclude list of terms that decide from a job's description whether the job is scored. Belongs to the owner's search
  settings, like the title filter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After an exclude term is saved, 100% of newly fetched jobs whose description contains it
  are left unscored in the next run, and 0 jobs whose description lacks it are left out because of
  it. Likewise, after include terms are saved, 100% of newly fetched jobs whose description contains
  none of them are left unscored, and 0 jobs whose description contains one are left out because of
  them.
- **SC-002**: Each job the body filter leaves out saves one model scoring call.
- **SC-003**: The owner can add a body filter term and see it take effect in the All jobs notes in
  under a minute, without editing any file.
- **SC-004**: Every existing title filter, company filter and boost behaviour is unchanged (its tests
  still pass untouched).
- **SC-005**: A re-scored job shows its new score in the open panel, without a reload, normally within 30
  seconds, or within 2 minutes when its description has to be looked up first, without the owner editing any file or starting
  a run.

## Assumptions

- Only the owner uses the app; body filters are one more search setting for that one user.
- The default body filter is empty, so nothing changes until the owner adds a term.
- Body filters reuse the title filter's term rules (a term needs a letter or digit), so no new
  validation rules are invented.
- No new library is needed; matching reuses the project's existing text normalization.
- Boosting by description text already exists (`title_boosts`), so a separate body boost is out of
  scope.
- The careers lookup for jobs missing a description runs as today in runs, and also from Re-score
  (FR-011); the body filter applies once a description exists.
- While a re-score runs (its lookup is limited to 2 minutes and its scoring to 3), the page's other actions (Hide,
  Applied, Load more, opening another job) wait for it to finish. That is acceptable for one owner.
- A re-score that overlaps a run on the same job needs no locking: whichever scoring finishes last is
  kept, as both score from the same settings.
