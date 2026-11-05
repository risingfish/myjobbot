# Feature Specification: Resume profile

**Feature Branch**: `023-resume-profile`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "I want to be able to upload my resume to the app, have it stored and available to read through the app, and then run it through the LLM to do the following: 1. summarize it for preferences, 2. extract a user's skills, and categorize them as engineering, people, project, 3. use extracted data as a comparison for what the LLM should look for in a job posting."

## Clarifications

### Session 2026-11-05

- Q: Which file types can the owner upload? → A: Markdown, plain text, PDF and Word (.docx); the
  libraries that read PDF and Word files are chosen with the owner's approval (constitution IV).
- Q: How does the extracted summary relate to the owner's preferences? → A: It is only suggested:
  the owner copies it into the Preferences box, edits it there and saves it; nothing changes the
  preferences without the owner saving them.
- Q: Does the model see the profile with the full resume or instead of it? → A: Selectable, as a
  setting: the resume only (today), the resume and the profile, or the profile only; the eval
  harness can run each so the owner can measure them before choosing.

## Background: the resume today

- The resume is a file in the app's data folder (`resume.md`), put there by hand. Every run and every
  re-score reads it and hands it, whole, to the scoring model, which judges "fit with the resume"
  (the base half of a score).
- The owner's preferences are free text kept with the other search settings and edited on the
  Settings page; the model judges "fit with the preferences" (the bonus half) from them.
- Nothing in the app shows the resume, and nothing ties the preferences or the scoring to a
  structured view of what the resume says.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload the resume and read it in the app (Priority: P1)

The owner uploads their resume on the Settings page. The app stores it, shows it back as text, and
uses it for every run and re-score from then on, in place of the file in the data folder. Uploading
a new version replaces the current one.

**Why this priority**: Everything else works from the stored resume; it also removes the need to
put a file on the server by hand, which matters once the app runs in a cluster.

**Independent Test**: Upload a resume, see its text on the Settings page, run a re-score, and check
the model was given the uploaded resume rather than the file's.

**Acceptance Scenarios**:

1. **Given** no uploaded resume, **When** the owner uploads one, **Then** it is stored, shown as
   text on the Settings page with when it was uploaded, and used by the next run and re-score.
2. **Given** an uploaded resume, **When** the owner uploads another, **Then** the new one replaces
   it everywhere, and the page says when.
3. **Given** a file that isn't a resume the app can read (wrong type, empty, too large), **When** the
   owner uploads it, **Then** it is refused with a message saying why, and the current resume stays.
4. **Given** no uploaded resume yet, **When** a run starts, **Then** it uses the resume file in the
   data folder as it does today.
5. **Given** no uploaded resume and no resume file, **When** a run or re-score starts, **Then** it
   stops, saying a resume is needed, and the Settings page says "No resume yet".

---

### User Story 2 - Extract a profile from the resume (Priority: P1)

When a resume is stored, the owner asks the app to read it. The model returns a profile: a short
summary of what the owner is looking for, written as preferences, and the owner's skills, each
placed in one of three groups: engineering, people, or project. The profile is shown on the
Settings page beside the resume, and the owner can correct it: edit the summary, move a skill to
another group, add or remove a skill.

**Why this priority**: It is the analysis the owner asked for, and its output feeds both the
preferences and the scoring.

**Independent Test**: Upload a resume, extract its profile, check every skill sits in one of the
three groups, move one, and reload the page to see the change kept.

**Acceptance Scenarios**:

1. **Given** a stored resume, **When** the owner extracts its profile, **Then** a summary and a
   list of skills, each in exactly one of engineering, people and project, are shown.
2. **Given** an extracted profile, **When** the owner edits the summary or moves, adds or removes a
   skill, **Then** the change is saved and kept across reloads and later runs.
3. **Given** a profile, **When** the owner uploads a new resume, **Then** the profile is marked as
   from the earlier resume until the owner extracts again.
4. **Given** the model can't be reached or returns something unusable, **When** the owner
   extracts, **Then** nothing stored changes and the page says the extraction failed.

---

### User Story 3 - Turn the summary into preferences (Priority: P2)

The owner uses the profile's summary as a starting point for their preferences: one action copies
the summary into the Preferences box on the Settings page, where the owner edits it and saves it as
usual. The summary never changes the preferences by itself.

**Why this priority**: Preferences decide half of every score; a good starting point saves the owner
writing them from scratch, but the owner's own wording must stay in their control.

**Independent Test**: Extract a profile and use its summary for preferences; check the preferences
the next run sends are what the owner chose.

**Acceptance Scenarios**:

1. **Given** a profile summary, **When** the owner copies it into the Preferences box, edits it and
   saves, **Then** the next run and re-score score preferences against what was saved.
2. **Given** the summary copied into the Preferences box, **When** the owner leaves without saving,
   **Then** the stored preferences are unchanged.
3. **Given** preferences the owner has written, **When** a new profile is extracted, **Then** the
   owner's preferences are not changed without the owner choosing to.

---

### User Story 4 - Score jobs against the profile (Priority: P2)

The scoring model is given the profile's skills, by group, as what to look for in a posting, so
its "fit with the resume" judgement compares the job with the owner's engineering, people and
project skills. A scoring setting says what the model reads about the owner: the resume only (as
today), the resume and the profile, or the profile only. The owner measures each with the eval
harness before choosing.

**Why this priority**: It is the point of the extraction; it changes every score, so it must be
measurable before it reaches production.

**Independent Test**: Run the eval harness over the same cases with and without the profile in the
prompt and compare the reports.

**Acceptance Scenarios**:

1. **Given** a profile and the setting "resume and profile", **When** a job is scored, **Then** the
   model is given the resume and the profile's skills by group, inside the data markers, as what
   to look for; with "profile only", the profile without the resume.
2. **Given** the setting "resume only", or no profile, **When** a job is scored, **Then** scoring
   works as it does today.
3. **Given** cases in the eval harness, **When** the owner runs them under each setting, **Then** the
   runs can be compared like any runs, a series included.

---

### Edge Cases

- A resume that is only images (a scanned file) has no text to read: it is refused, saying so.
- A very long resume: stored up to a limit; above it, refused with the limit named.
- Text in the resume that tries to give the model instructions: the resume reaches the model only
  as data, inside the data markers, both when the profile is extracted and when jobs are scored.
- A skill the model can't place: it goes to the group the model judged closest; the owner can move
  it. No fourth group exists.
- The same skill listed twice, or in two groups: kept once, in one group.
- The profile is edited and then the resume is replaced: the edited profile is kept, marked as from
  the earlier resume, until the owner extracts again (which replaces it, after confirming).
- The resume and the profile are shown as text only; nothing in them is run or rendered as markup.
- No uploaded resume and no resume file: runs and re-scores stop with a message saying a resume is
  needed; the resume file is optional once a resume is uploaded.
- The profile is from an earlier resume and the scoring setting uses it: it is still used, and the
  Settings page shows it as from an earlier resume.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The owner MUST be able to upload a resume on the Settings page; the app MUST store it
  in its own storage with when it was uploaded, and a new upload MUST replace the current one.
- **FR-002**: The app MUST accept resumes as Markdown, plain text, PDF or Word (.docx), up to a size
  limit, read only their text, and refuse anything else (another type, a file with no readable
  text, one over the limit, one that can't be read) with a reason, keeping the current resume.
- **FR-003**: The stored resume MUST be shown on the Settings page as text, never rendered as markup.
- **FR-004**: Runs and re-scores MUST use the uploaded resume when there is one, the data folder's
  resume file otherwise, and stop with a message saying a resume is needed when there is neither.
- **FR-005**: The owner MUST be able to extract a profile from the stored resume: a summary written
  as preferences, and a list of skills, each in exactly one of the groups engineering, people and
  project.
- **FR-006**: The resume MUST reach the model only inside the data markers when a profile is
  extracted, and the model's answer MUST be checked against the profile's form before anything is
  stored; an unusable answer stores nothing.
- **FR-007**: The owner MUST be able to edit the profile's summary and its skills (add, remove,
  move between groups); edits are kept until the next extraction, which asks before replacing them.
- **FR-008**: A profile MUST record which resume it was extracted from, and show when the stored
  resume is newer.
- **FR-009**: The owner MUST be able to copy the profile's summary into the Preferences box on the
  Settings page; the preferences change only when the owner saves that section, as today.
- **FR-010**: A scoring setting MUST choose what the model reads about the owner: the resume only
  (the default, today's behaviour), the resume and the profile, or the profile only. Runs and re-scores
  MUST follow it (eval runs choose theirs per run, FR-011), giving the profile's skills by group as what to look for
  in a posting, inside the data markers; with no profile, every choice scores from the resume; a profile from an earlier resume is
  still used.
- **FR-011**: The eval harness MUST be able to run cases under each of the three choices, recorded on
  the run, so their effect on scores can be measured and compared (a series included) before one
  is chosen for scheduled runs.
- **FR-012**: The resume and profile MUST never be written to logs or the repository; they appear
  only in the model's conversation (the run traces in the data folder) and the app's database. The
  log of the model's responses keeps only token usage for an extraction.

### Key Entities

- **Resume**: the owner's uploaded resume as text, with when it was uploaded and its original file
  name and type.
- **Profile**: extracted from one resume: a preferences summary and skills, each with its group
  (engineering, people, project); when it was extracted, from which resume, and whether the owner
  has edited it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can upload a resume and see it in the app in under a minute, with no file
  placed on the server by hand.
- **SC-002**: Every extracted skill sits in exactly one of the three groups.
- **SC-003**: Extracting a profile takes under two minutes for a typical resume.
- **SC-004**: The effect of giving the model the profile is measured with the eval harness before
  it is turned on for scheduled runs.
- **SC-005**: No resume or profile text appears in logs, outside the model's conversation, or in
  the repository.

## Assumptions

- One owner, one resume at a time; earlier versions aren't kept.
- The resume is stored in the app's database, so it follows the app into the cluster.
- The data folder's resume file stays as the fallback until an upload replaces it; nothing deletes
  it.
- Extraction is started by the owner, not run automatically on every upload or run.
- The three skill groups are fixed: engineering, people and project.
- Reading PDF and Word files needs libraries; the plan presents the candidates, their trade-offs and
  a recommendation, and the owner approves the choice before any is added (constitution IV). They
  read untrusted files, so they are pinned exactly and kept in the lockfile.
- The scoring setting starts at "resume only", so nothing changes for scheduled runs until the
  owner chooses otherwise.
- The shared rubric's wording is unchanged; with "profile only" the first user message says the
  resume isn't included and to judge fit with it from the profile. Every choice is measured with
  the eval harness (features 020 and 022) before scheduled runs use it.
