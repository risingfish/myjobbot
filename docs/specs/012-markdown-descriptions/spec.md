# Feature Specification: Markdown job descriptions

**Feature Branch**: `012-markdown-descriptions`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Store job descriptions as basic HTML as well as plain text, so the
details panel can show their structure (paragraphs, lists, headings, emphasis, links). Strip script
tags and any other dangerous markup (event handlers, styles, iframes, forms, javascript: links and
similar) before saving. Today every source stores plain text: Greenhouse and Workday HTML is
converted to text in src/sources/htmlText.ts, Lever and Ashby give plain text though their APIs
also offer HTML, JSearch gives plain text, and careers pages are reduced to text by
src/careers/pageWalker.ts. The job details panel (feature 011) currently shows the description as
plain text. Feature 009's rule still applies: description text reaches the model only inside the
run's data markers." Revised by the owner the same day: "Instead of saving html, lets convert them
to markdown."

## Overview

The details panel (feature 011) shows a job's description as plain text. Most postings were written
with structure: headings such as "What you'll do" and "Requirements", bulleted lists, bold terms
and links. The plain text keeps the line breaks but loses the rest, so a long description reads as
a wall of lines and the owner has to hunt for the requirements.

Most sources already send that structure, as HTML. myjobbot throws it away when it stores the job.
This feature **converts that HTML to Markdown** instead: headings, lists, emphasis and links
written as plain characters (`## Requirements`, `- 5 years of Go`, `**remote**`). The panel shows
the Markdown formatted.

Markdown suits this well:
- **Nothing dangerous is stored.** Markdown is text. Scripts, styles, frames, forms, images and
  event handlers have no Markdown form, so the conversion drops them, and the stored description
  never holds markup that could run.
- **It reads well even unformatted.** The model reads the same Markdown when it scores a job, and
  `## Requirements` and `- item` are as easy for it to follow as for a person.

The description becomes **one Markdown text**, used everywhere: the panel, scoring, title boosts and
what the model reads (still inside the run's data markers, per feature 009). The model's copy leaves
out link addresses, keeping each link's words.

The one place that needs care is **showing** it: Markdown can carry raw HTML and links, so the panel
must display it with raw HTML ignored and only web links allowed (FR-005).

## Delivery

As with feature 011, the owner tests each change before the next, so this ships as **small pull
requests** (aim for about 10 files each, tests included), each leaving the app working and merged
before the next starts. The split (from the plan and tasks; every reader of a description, and the
re-scoring rule, handle Markdown before any source writes it):
1. **The format**: each description records whether it is Markdown or plain text.
2. **The readable copy**: the model and title boosts read descriptions without link addresses.
3. **The careers lookup's board path**: a description read from a job board's own data keeps its
   format.
4. **Display**: the panel shows Markdown safely.
5. **Scoring again once** when a description first becomes Markdown.
6. **Conversion and Ashby**: HTML to Markdown with its rules and hostile-input tests.
7. **Greenhouse and Workday.**
8. **Lever's whole posting.**
9. **Careers pages** downloaded or rendered from company websites.

## Clarifications

### Session 2026-10-22

- Q: Store cleaned HTML, or convert it? → A: Convert to Markdown instead of storing HTML (owner's
  revision of the original request).
- Q: Does the Markdown replace the plain text everywhere, including what scoring and the model read,
  or sit beside it as a display-only copy? → A: Replace it everywhere: one description, in
  Markdown, used for display, scoring and the model.
- Q: Should links in a description work? → A: Yes: working links that open in a new tab, with no
  referrer and no access back to myjobbot; only web (`http`/`https`) addresses.
- Q: Should descriptions the careers lookup reads from company websites be converted too, or only
  job boards? → A: Careers pages too, as the last PR.
- Q: Should a Lever job's description include the whole posting (opening, requirement lists and
  closing section) rather than just the opening? → A: Yes, the whole posting: the opening, each
  list under its own heading, then the closing section.
- Q: When the model reads a description to score a job, should it see the links' web addresses or
  only the links' words? → A: Only the words; the panel still shows working links.
- Q: When an already-scored job comes back with its new Markdown description, should it be scored
  again? → A: Yes, every job, once: the first time its description changes to Markdown.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a description the way it was written (Priority: P1)

The owner opens a job's details panel. The description shows with its headings, paragraphs,
bulleted and numbered lists and bold or italic text, the way the posting presents them, instead of
as plain lines.

**Why this priority**: It's the point of the feature. Requirements, responsibilities and benefits
are usually separate headed lists; seeing them that way is what makes a description quick to read.

**Independent Test**: Open the panel for a job from a board that sends HTML descriptions. Its
headings, lists and emphasis show as formatting, and no Markdown symbols (`##`, `**`, `- `) show as
literal characters.

**Acceptance Scenarios**:

1. **Given** a job whose source sent an HTML description, **When** its panel opens, **Then** the
   description shows its headings, paragraphs, lists and emphasis as formatting.
2. **Given** a job whose source sends plain text only (for example, a search source), **When** its
   panel opens, **Then** the description shows as plain text with its line breaks, as it does today.
3. **Given** a job with no description, **When** its panel opens, **Then** it still says "No
   description found."

---

### User Story 2 - Nothing in a description can harm the owner or the app (Priority: P1)

A source description may contain scripts, inline event handlers, styles, embedded frames, forms,
images that track the reader, or links that run code. None of it survives the conversion, and
nothing in a stored description can run, load or submit anything when the owner reads it.

**Why this priority**: It is equal in priority to US1. Formatting is only acceptable if it is safe;
outside HTML shown without care would let any posting run code in the owner's browser.

**Independent Test**: Convert and store a job whose source description contains a script, an
`onclick` handler, a `style` attribute, an iframe, a form, an image and a `javascript:` link. The
stored Markdown contains none of them, and opening its panel runs, loads and submits nothing.

**Acceptance Scenarios**:

1. **Given** a source description containing elements Markdown can't express (FR-002), **When** the
   job is stored, **Then** those elements are gone, and the readable text inside harmless wrappers
   (such as `div` or `span`) is kept.
2. **Given** a description whose script or style element contains text, **When** the job is stored,
   **Then** that text is dropped along with the element, never kept as words.
3. **Given** a link whose address is not a web address (`javascript:`, `data:` and similar),
   **When** the job is stored, **Then** the link is dropped and its words are kept as plain text.
4. **Given** text in a posting that merely looks like Markdown or HTML (a literal `<script>` written
   as words, a literal `[click](javascript:…)`), **When** the panel shows it, **Then** it shows as
   harmless text or a removed link, never as running code or a working unsafe link.

---

### User Story 3 - Links in a description are usable and safe (Priority: P2)

Descriptions often link to a benefits page, an equal-opportunity statement or the application form.

**Why this priority**: Useful, but the description is readable without them.

**Independent Test**: Open the panel for a job whose description had an `https://` link; it behaves
as FR-003 specifies.

**Acceptance Scenarios**:

1. **Given** a description with a web link, **When** the owner uses it, **Then** it behaves as
   FR-003 specifies, and the list and panel stay as they were.

---

### Edge Cases

- **Broken HTML** (unclosed tags, stray closing tags, wrong nesting): the Markdown still comes out
  readable, and no text is lost.
- **HTML sent as escaped text** (Greenhouse sends `&lt;p&gt;`): it is decoded once and then
  converted, never kept as literal tags, and never decoded twice into new markup. Sources that send
  raw HTML (Workday, Ashby, Lever) are never decoded first.
- **Characters that mean something in Markdown** in ordinary text (a line starting with `#` or `-`,
  `*` in "C*", underscores in names): they are escaped so the text shows exactly as written.
- **Layout tables**: their cell text is kept as paragraphs or lines; tables are not reproduced.
- **A description that is almost all markup**: if nothing readable is left, it counts as no
  description.
- **Very long descriptions**: the Markdown follows the same length limit as descriptions today
  (20,000 characters); a description cut at the limit still shows sensibly.
- **Empty formatting** (paragraphs, list items or headings with no text in the source): dropped. One
  emptied only because its contents were removed (a list item holding just an image) may remain as an
  empty bullet or heading, which carries nothing; a link left with no words is dropped.
- **Headings deeper than the panel's own**: description headings show below the panel's section
  headings, so they never outrank "Description" for screen readers.
- **Same posting fetched again**: the description is converted again, so it always matches the
  latest posting; it is marked for scoring again only the first time it changes to Markdown
  (FR-014).
- **Jobs stored before this feature**: they keep their plain text until fetched again (see
  Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a source provides a description as HTML, the system MUST convert it to Markdown
  and store that as the job's description, in place of today's plain text. There is one
  description per job, used for display, scoring, title boosts and what the model reads (with link
  addresses left out of the model's copy, FR-013).
- **FR-002**: The conversion MUST keep only what Markdown expresses plainly: paragraphs, line
  breaks, headings, bulleted and numbered lists (nested ones too), block quotes, horizontal rules,
  bold, italic, inline code, code blocks, and links with a web (`http` or `https`) address. Everything else MUST
  be dropped. Readable text inside dropped wrappers MUST be kept, except scripts, styles, frames,
  forms and their fields, embedded objects, media, images and SVG, whose contents MUST be dropped
  entirely. Comments MUST be dropped. The output MUST contain no raw HTML.
- **FR-003**: Links kept in a description MUST work, opening in a new tab with no referrer sent and
  no access back to myjobbot, and only for `http` or `https` addresses. Using one MUST leave the
  list and the panel as they were.
- **FR-004**: Markdown MUST be produced for Greenhouse, Lever, Ashby and Workday (all send HTML), and
  for descriptions the careers lookup reads from company websites, keeping only the posting's own
  content as the lookup does today (not the site's menus, headers or footers). JSearch sends plain
  text only and Gmail alerts carry no description; their text MUST show exactly as written, with its
  line breaks, and never be misread as formatting.
- **FR-005**: The details panel MUST show a Markdown description formatted, with any raw HTML in it
  shown as text or ignored (never interpreted), images never loaded, and only web links made into
  links. Plain-text descriptions MUST show as today.
- **FR-006**: Description text MUST still reach the model only inside the run's data markers
  (feature 009), whatever its format.
- **FR-007**: Text that merely looks like Markdown in the source (see Edge Cases) MUST be escaped
  during conversion so it shows as written.
- **FR-008**: Markdown descriptions MUST respect the existing description length limit.
- **FR-009**: Showing a description MUST NOT load anything from outside myjobbot (no images, fonts,
  styles or frames) and MUST NOT run anything.
- **FR-010**: Title boosts MUST match on a description's readable words only, never on
  link addresses or Markdown symbols, so a link such as `https://aws.example.com` doesn't count as
  the word "aws".
- **FR-011**: Descriptions stored before this feature (plain text) MUST keep showing as they do
  today, never misread as formatting, until the job is fetched or looked up again.
- **FR-012**: A Lever job's description MUST be its whole posting: the opening description, then
  each of its lists (such as Requirements or Responsibilities) under its own heading with its
  items, then its closing section, in that order.
- **FR-013**: The description the model reads MUST keep the Markdown structure but reduce each link to
  its words, leaving out its address. Only the model's copy changes; the stored description and the
  panel keep the links.
- **FR-014**: The first time an already-scored job's description is stored as Markdown in place of
  plain text or of no recorded format, the job MUST be marked for scoring again, keeping its current score shown until the
  new one arrives. It happens once per job: later fetches of the same Markdown do not mark it again.

### Key Entities

- **Markdown description**: a job's description converted from its source's HTML into Markdown:
  structure, emphasis and web links only, no raw HTML.
- **Kept formatting**: the fixed set of structures the conversion keeps (FR-002); anything else is
  dropped, keeping its readable text where that text is harmless.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every job from a source that sends HTML and fetched after this feature ships, the
  panel shows its description formatted: headings, lists and emphasis visible as formatting, with
  no Markdown symbols or HTML tags showing as literal text.
- **SC-002**: A test set of hostile descriptions (scripts, event handlers, styles, frames, forms,
  images, unsafe links, broken and doubly escaped markup, text that looks like Markdown) produces
  stored Markdown with nothing outside the kept formatting, and opening each in the panel runs,
  loads and submits nothing.
- **SC-003**: Every word a reader could see in the source description is still in the Markdown, in
  the same order (checked on a sample of real postings from each board; for Lever, against the parts
  the old description had).
- **SC-004**: The panel still shows a job's details within 1 second of the click (feature 011's
  SC-002).
- **SC-005**: Title boosts are unaffected by the change of format: on a sample of real postings,
  every boost term a job matched from its old plain text is still matched from its Markdown, and
  any newly matched term comes from content the old text lacked (such as Lever's lists).

## Assumptions

- **Existing jobs fill in as they are fetched again.** Jobs from configured company boards are
  fetched on every run, so they gain Markdown on the next run. Jobs from boards no longer configured
  (today, every stored Lever job: `companies` is empty) are never fetched again, so they keep their
  plain text until retention prunes them; to see a board's conversion, configure a company on it. Nothing is re-fetched or looked up again just to convert older
  rows; jobs not seen again, including careers-page descriptions already found, keep their plain
  text, which shows as it does today (FR-011).
- **Scores may shift.** The model now sees headings and lists, and Lever jobs their full posting, so
  every job is scored once more on its Markdown (FR-014). That's expected and accepted. The extra
  scoring goes through runs' existing limits, so it may spread over several runs.
- **The careers lookup's model keeps reading text.** Pages it downloads or renders reach it as
  today. A job page read from a board's own data, which is Markdown once that board converts,
  reaches it as the readable copy (structure kept, link addresses removed, FR-013). The description
  it stores at the end keeps its format.
- **Lever's and Ashby's HTML versions are read** for the conversion; today only their plain-text
  versions are. For Lever that also brings in its lists and closing section (FR-012), which today's
  description leaves out, so Lever scores may shift more than others.
- **Images are always dropped**, even from trusted boards: they are the usual way to track a
  reader, and Markdown images would load from outside.
- **Tables are not reproduced**: job postings rarely use them for data, and their text is kept.
- **A conversion or display library may be chosen during planning**; per the constitution, the
  options and a recommendation go to the owner for approval first.
- **The trace feature** (the path through the categorizer) is still a later feature and is not
  affected.
