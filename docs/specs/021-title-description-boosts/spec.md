# Feature Specification: Title and description boosts

**Feature Branch**: `021-title-description-boosts`

**Created**: 2026-11-04

**Status**: Draft

## Clarifications

### Session 2026-11-04

- Q: Does "keep track and log what boosts are found" mean showing them live, or storing them per
  job? → A: Showing them live: the table note and the details panel list the boosts that apply
  under the current settings, recomputed on each load, with where each matched and its points.
  Nothing is stored per job.
- Q: How do today's boosts carry over? → A: Every existing entry is copied into both lists with
  its points, so each job's boost is unchanged on the day the feature ships; the owner then prunes
  each list.
- Owner addition: the feature ships as one PR (see Delivery).
- Owner addition (during S2): remove every Settings "Reset to default" button and "(default)"
  marker; every default is to become an empty state until the resume is read in, which, with the
  match threshold defaulting to 0, is a later spec, not this one.

**Input**: User description: "Change how boosts work. Description Boosts: Change Title boost to
Description boosts and use it on the description body. A boost may only be applied once, and any
subsequent findings will be ignored. These boosts should be more skill related, programming
languages, leadership experience, etc. Title Boosts: These will be more role level related. Boost
like 'senior' or 'software engineer' or 'web developer', etc. A user could put specific languages
these boost to really narrow down the search, which is also fine. Both: Keep track and log what
boosts are found to show in the UI. Edge case: Boosts that are found in both the title and
description should only be applied once, and if the two have different score numbers, the higher
one applies. UI: In settings use the same grid layout for boosts that we used in Filters. There
will be a Title boosts section and a Description boosts section."

## Background: how boosts work today

- One search setting, `title_boosts`, maps terms to points. Despite its name, a term counts when it
  is found as a whole word or phrase in the job's title **or** its description (the link-free
  readable copy), matched the way filters match: case-insensitive, punctuation as spaces, optional
  plural "s".
- Each matched term adds its points once, however many times it appears; the total is added to the
  model's score, capped at 100.
- Boosts are applied at display time, never stored: Recommended keeps jobs whose boosted score meets
  `match_threshold`, the table's score note reads "model 62 · +10 typescript", and the details
  panel's Score section shows one "Title boost" fact ("+10 typescript" or "none"). Changing boosts
  re-sorts every job on the next page load. The agent run and the model never see boosts.
- Settings edits them in the Scoring section, in a single "Boosts" card under the threshold, as a
  tag list of term and points; a term listed twice is refused.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Boost jobs by the skills their descriptions ask for (Priority: P1)

The owner wants jobs that ask for their skills to rise: "TypeScript", "React", "team lead",
"mentoring". They list these as description boosts, each with its points. A job whose description
mentions one of them gets those points once, however often the term appears, and a job that only
has the word in its title does not.

**Why this priority**: Skills live in the description, not the title; this is the list the owner
will grow most, and it keeps today's main use of boosts working under a clearer name.

**Independent Test**: Save a description boost, load the job list with one job whose description
mentions the term three times and one whose title alone has it, and check that only the first gets
the points, and only once.

**Acceptance Scenarios**:

1. **Given** a description boost "typescript" worth 10, **When** a job's description mentions
   TypeScript four times, **Then** its score rises by 10, not 40.
2. **Given** the same boost, **When** a job's title is "TypeScript Developer" and its description
   never says TypeScript, **Then** the description boost adds nothing.
3. **Given** a job with no description, **When** boosts are applied, **Then** no description boost
   matches it.

---

### User Story 2 - Boost jobs by the role in their title (Priority: P1)

The owner wants role-level matches to rise: "senior", "software engineer", "web developer". They
list these as title boosts. A job whose title matches gets the points once; a job whose description
merely mentions "senior engineers on the team" does not. The owner may also put a language such as
"Go" in title boosts to favour roles named after it.

**Why this priority**: Equal with Story 1: the two lists together are the feature, and title-only
matching stops descriptions that mention a role in passing from being boosted as that role.

**Independent Test**: Save a title boost, load the list with one job whose title has the term and
one whose description alone has it, and check that only the first is boosted.

**Acceptance Scenarios**:

1. **Given** a title boost "senior" worth 5, **When** a job is titled "Senior Software Engineer",
   **Then** its score rises by 5.
2. **Given** the same boost, **When** a job titled "Software Engineer" says "you will work with
   senior engineers", **Then** the title boost adds nothing.

---

### User Story 3 - A term in both lists counts once, at its higher value (Priority: P2)

The owner lists "react" as a title boost worth 5 and a description boost worth 10. A job titled
"React Developer" whose description also mentions React gets 10, not 15. If the job only matches
one place, it gets that list's points.

**Why this priority**: The owner's stated edge case; without it, overlapping lists would
double-count and push such jobs over the threshold unfairly.

**Independent Test**: Save the same term in both lists with different points and check the boost on
jobs that match it in the title only, the description only, and both.

**Acceptance Scenarios**:

1. **Given** "react" as title boost 5 and description boost 10, **When** a job matches it in both
   places, **Then** it gets 10 points for "react".
2. **Given** the same lists, **When** a job matches "react" only in its title, **Then** it gets 5.
3. **Given** the same lists, **When** a job matches "react" only in its description, **Then** it
   gets 10.
4. **Given** "react" as title boost 10 and description boost 5, **When** a job matches both,
   **Then** it gets 10.

---

### User Story 4 - See which boosts a job earned, and where (Priority: P2)

Looking at a job, the owner wants to know why its score was raised: which terms matched, whether in
the title or the description, and what each added. The table's score note and the details panel
name every applied boost; a term that matched in both places is shown once, with the points that
were applied.

**Why this priority**: Without it, two lists make a boosted score harder to explain than today.

**Independent Test**: Boost a job through both lists and check that the table note and the panel
list each term with where it matched and its points, and that the totals add up.

**Acceptance Scenarios**:

1. **Given** a job boosted by title "senior" (+5) and description "typescript" (+10), **When** the
   owner opens its details, **Then** the Score section lists both, each marked title or
   description, with its points, and the total boost +15.
2. **Given** a job matching "react" in both places (Story 3), **When** the owner opens its details,
   **Then** "react" appears once, marked as found in both, with the points applied.
3. **Given** a job no boost matched, **When** the owner opens its details, **Then** the Score
   section says no boosts applied.
4. **Given** boosts that would take a job past 100, **When** it is shown, **Then** the score is
   capped at 100 and the boosts are still listed with their points.

---

### User Story 5 - Edit both lists in Settings, laid out like Filters (Priority: P3)

In Settings, the owner finds a Boosts area laid out as a grid of cards like the Filters section: a
"Title boosts" card and a "Description boosts" card, each with its tag list of term and points,
saved as soon as it changes, with its own problems shown under it.

**Why this priority**: The lists can't be used without an editor, but the layout itself is
presentation; it follows the pattern already in place.

**Independent Test**: Open Settings, add a term to each card, reload, and check both persisted in
the right list; add a term twice to one card and check it is refused on that card.

**Acceptance Scenarios**:

1. **Given** the Settings page, **When** it loads, **Then** boosts show as two cards side by side on
   a wide screen (stacked on a narrow one), Title boosts and Description boosts, the same grid as
   Filters.
2. **Given** a term already in Title boosts, **When** the owner adds it to Description boosts,
   **Then** it is accepted (the overlap is allowed; Story 3 decides its points).
3. **Given** a term already in one card, **When** the owner adds it again to the same card,
   **Then** that card refuses it with the existing "already boosted" message.
4. **Given** a saved change to either card, **When** the page reloads, **Then** both lists show as
   saved, and Recommended reflects them on its next load.

### Edge Cases

- A term in the same list twice is refused on save, as today; the same term in both lists is
  allowed. "The same term" means the same once matched: case and punctuation are ignored
  (`React` = `react`, `c++` = `c#`), so such a pair is refused within one list, and one already
  stored counts once at its higher value.
- A term found many times in one place, or in both places, still adds points once (FR-003, FR-004).
- A job with no description can only be boosted by title boosts.
- Matching is on the description's readable, link-free copy, as today, so link addresses never
  match.
- A stored boost list that fails validation falls back to its default with a notice that never
  holds the value, per list, as other search settings do; a bad description list does not discard
  a good title list.
- The total boost is still capped so no score shows above 100, and Recommended still keeps every
  job that some combination of boosts could lift to the threshold.
- A filtered job (title, body or company filter) is left out of Recommended whatever its boosts.
- Points of 0 or below are rejected as today's boost points rules require.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The search settings MUST hold two boost lists, **title boosts** and **description
  boosts**, each mapping a term to points with today's term and points rules.
- **FR-002**: A title boost MUST match only the job's title, and a description boost only the job's
  readable description, using the same whole-word-or-phrase matching boosts use today.
- **FR-003**: Each term MUST add its points at most once per job, however many times it is found.
- **FR-004**: A term listed in both lists and found in both places MUST add points once, at the
  higher of its two values; found in one place only, it adds that list's value.
- **FR-005**: A job's total boost MUST be the sum of its applied terms, added to the model's score
  and capped at 100, applied at display time as today, so a boost change takes effect on the next
  page load without re-scoring.
- **FR-006**: Recommended MUST keep exactly the jobs whose boosted score under the current two lists
  meets the match threshold, with no job wrongly left out by the database pre-filter.
- **FR-007**: For each job shown, the system MUST work out the list of applied boosts: each term,
  where it matched (title, description, or both), and the points applied.
- **FR-008**: The table's score note and the details panel's Score section MUST show the applied
  boosts from FR-007 and their total; the panel MUST say so when none applied.
- **FR-009**: The record of boosts found MUST be the live one from FR-007 and FR-008, worked out
  from the current settings on every load; no boost result is stored per job, in History or in the
  run trace.
- **FR-010**: The Settings page MUST show Title boosts and Description boosts as two cards in the
  same grid layout the Filters section uses, each with its tag editor and problems, saving as soon
  as either changes. No setting on the Settings page offers a reset to default or a "(default)"
  marker (owner decision, 2026-11-04: the Settings page has no Reset buttons or "(default)" markers; empty defaults come with the resume-import spec).
- **FR-011**: Each list MUST refuse a term listed twice within it, on the repeated row; the same
  term in both lists MUST be accepted.
- **FR-012**: Each list MUST validate and fall back independently when stored data is bad, with a
  notice that never holds the stored value.
- **FR-013**: When the feature ships, every entry in today's single boost list MUST be copied
  into both title boosts and description boosts with its points, once, so that every job's boost
  is the same as before (a term found in the title, the description or both still adds its points
  once). After that, the two lists change only through Settings; removing a term from one list
  never touches the other.
- **FR-014**: Boosts MUST stay out of the agent run, the model's prompt and re-score, as today.
- **FR-015**: The README, CLAUDE.md and any notes naming `title_boosts` as matching descriptions
  MUST be updated to describe the two lists.

### Key Entities

- **Title boosts**: a search setting; terms (role level, role name, optionally a language) with
  points, matched against job titles.
- **Description boosts**: a search setting; terms (skills, languages, experience) with points,
  matched against readable job descriptions.
- **Applied boost**: for one job, a term that matched, where it matched (title, description, both)
  and the points it added; the list of these explains the boosted score.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every job shown, the total boost equals the sum of the points listed beside its
  applied boosts, and no term is listed or counted twice.
- **SC-002**: A term mentioned any number of times adds the same points as one mention, in 100% of
  tested cases.
- **SC-003**: A term found only in a description never adds title-boost points, and one found only
  in a title never adds description-boost points.
- **SC-004**: Recommended shows the same set of jobs whether computed with or without the
  database pre-filter, under any two lists tested.
- **SC-005**: The owner can add a term to either list and see Recommended reflect it on the next
  page load, in under a minute from opening Settings.
- **SC-006**: Right after the feature ships, every job shows the same boosted score as just
  before it, and both lists hold all of the owner's existing boosts. Exception: terms that differ
  only in punctuation (`c++` and `c#`, which both match as `c`) now count once, at the higher
  value; the owner's list on 2026-11-04 (8 terms) holds no such pair.

## Delivery

- **One PR** (owner decision, 2026-11-04): this feature ships as a single pull request on one
  branch, `021-title-description-boosts`, not as a series of small PRs. The plan and tasks still
  group the work into sittings, worked in order, each ending with `npm run check` and
  `npm run check:db` green (constitution Principles I and II still apply); only the PR count
  changes. This is for 021 alone; later features go back to small PRs.

## Assumptions

- Matching rules (whole words or phrases, case-insensitive, punctuation as spaces, optional plural
  "s") and points rules stay as they are today; only where each list looks changes.
- "Applied only once" means once per term per job; different terms that overlap (e.g. "engineer"
  and "software engineer") each count, as today.
- The two cards replace today's single "Boosts" card in the Scoring section; the match threshold
  stays where it is. Whether the boost cards sit inside Scoring or in their own Boosts section is a
  layout choice for the plan, so long as they use the Filters grid.
- The details panel's "Title boost" fact is renamed to cover both lists.
- Evals keep ignoring boosts.
- Nothing new is stored per job (FR-009). The one data change is the copy of the owner's stored
  boosts into the two lists (FR-013); the plan decides whether that is a migration step or done by
  the settings store, and if it changes stored data it falls under the constitution's rule for
  stopping the stack.
- The rest is UI and settings work with no change to the agent run. The Docker stack is stopped
  (owner, 2026-11-04: production moves to the Kubernetes cluster).
