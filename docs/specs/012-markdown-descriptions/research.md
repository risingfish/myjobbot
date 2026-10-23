# Research: Markdown job descriptions

Each decision below resolves an open point of the spec or the plan's Technical Context. Findings
about the boards were checked against live public postings on 2026-10-22.

## R1. HTML to Markdown: turndown (owner's choice, 2026-10-22)

- **Decision**: `turndown` 7.2.4, pinned exactly, with `@types/turndown` 5.0.6 (dev). One
  configured `TurndownService` in `src/descriptions/toMarkdown.ts`, used through its own API:
  - `remove([...])` for elements no built-in rule handles and whose contents must go entirely
    (FR-002): `script`, `style`, `noscript`, `noembed`, `noframes`, `template`, `iframe`, `frame`,
    `frameset`, `object`, `embed`, `applet`, `param`, `canvas`, `svg`, `math`, `form`, `input`,
    `button`, `select`, `textarea`, `option`, `picture`, `video`, `audio`, `source`, `track`,
    `head`, `title`, `meta`, `link`, `base`.
  - **Two services from one factory.** A `TurndownService` is mutable, so `toMarkdown.ts` builds
    its services with one factory: `htmlToMarkdown` uses the base service, and `pageToMarkdown`
    (R7) a second one with the chrome-and-hidden rule added, so that rule never reaches board
    descriptions.
  - **Images through `addRule`, not `remove`.** turndown checks its added and built-in rules before
    `remove` filters (`Rules.forNode`; its README says so), and the built-in `image` rule matches
    `img`, so `remove("img")` would do nothing. `addRule("dropImages", { filter: "img",
    replacement: () => "" })` is its documented way to drop an element a built-in rule handles.
  - `addRule` for links: keep a link only when its address is `http:`/`https:` (parsed with
    `URL`) and its words are not empty; write it in one fixed shape, `[words](address)`, with `(`,
    `)` and whitespace in the address percent-encoded, so R4 can strip addresses reliably. Any other
    link becomes its words; a link with no words becomes nothing.
  - Options: `headingStyle: "atx"` (`#`–`######`), `bulletListMarker: "-"`,
    `codeBlockStyle: "fenced"`, `emDelimiter: "*"`, `strongDelimiter: "**"`, `hr: "---"`.
  - **Code blocks through `addRule`.** turndown's built-in fenced-code rule builds the block from the
    code element's raw `textContent`, so a `<script>`, hidden element or `nav` inside
    `<pre><code>` would keep its text. An `addRule` for `pre` with a `code` child (it overrides the
    built-in rule) builds the block from the processed `content`, where removed elements are already
    gone, with a fence one backtick longer than the longest backtick run inside. Tables
    and other unknown wrappers fall through to turndown's default (their text content), which keeps
    readable text (FR-002).
  - **Escaping through an `escape` override.** turndown's default escaping (`markdownEscapes`)
    covers Markdown's own symbols but neither `<`, `&` nor a `!` that ends a text run (which would
    make a following link an image, `![words](…)`, and lose its words on display), so text that reads `<script>` (once
    decoded) would be written as raw HTML, and `<https://…>` would become an autolink that R4's
    pattern misses. The service's `escape` is overridden (documented in turndown's README,
    "Overriding TurndownService.prototype.escape") to apply the default escapes and also `<` → `\<`,
    `&` → `\&` and a trailing `!` → `\!`. Text in code spans and fences never passes through `escape`, and is shown as
    code. Together these keep text that looks like Markdown or HTML as written (FR-007).
  - `keep` is never used, so no raw HTML is ever written (FR-002 "no raw HTML"): outside code, no
    unescaped `<` remains.
  - **Emptied elements.** turndown decides an element is blank from its text before removals, so a
    list item or heading whose only content was removed (an image, a script) can leave a bare `-` or
    `#`. Accepted: it shows as an empty bullet or heading and carries nothing; the link rule's empty
    case above covers the one that would otherwise point somewhere.
- **Rationale**: the standard converter (about 6.3M downloads a week, MIT, one dependency: its
  bundled DOM `@mixmark-io/domino`, so it runs in Node with no browser). Its remove/rule API
  expresses the spec's allow-list directly, and it is easy to unit-test with hostile input.
- **Alternatives considered**: `node-html-markdown` (fewer hooks for removal and links), the unified
  chain (rehype-parse, rehype-sanitize, rehype-remark, remark-stringify: most rigorous but four or
  five packages), our own converter on htmlparser2 (most code to own). Presented to the owner; the
  owner chose turndown.

## R2. Showing Markdown: react-markdown (owner's choice, 2026-10-22)

- **Decision**: `react-markdown` 10.1.0, pinned exactly, in a new client component
  `web/components/panel/MarkdownText.tsx`, used through its own props:
  - `skipHtml` so raw HTML in a description is dropped, never interpreted (FR-005).
  - The decisions live in plain functions in `web/lib/markdown.ts`, unit-tested (Principle II):
    `markdownHref(url)` (the `urlTransform`: the address when `http:`/`https:`, otherwise empty) and
    `descriptionHeading(level)` (the heading map below). The component only wires them in.
  - `allowedElements` limited to the kept formatting (`p`, `br`, `h1`–`h6`, `ul`, `ol`, `li`,
    `blockquote`, `hr`, `strong`, `em`, `code`, `pre`, `a`) and `unwrapDisallowed` so anything else
    (an image, a table) keeps its text but loses its element (FR-005, FR-009).
  - `urlTransform` narrowed to `http:`/`https:` (the default also allows `mailto:` and others);
    any other address becomes empty and the link is shown as words.
  - `components`: `a` renders `target="_blank" rel="noopener noreferrer"` with
    `referrerPolicy="no-referrer"` (FR-003); `h1`–`h6` render as `h4`–`h6` (h1 and h2 as h4, h3 as
    h5, the rest as h6) so a description never outranks the panel's own `h3` "Description".
- **Rationale**: renders to React elements, never to an HTML string, so nothing is injected into the
  page and no sanitizer is needed after it. Safe by default for raw HTML and link schemes.
- **Alternatives considered**: `marked` + DOMPurify, `markdown-it` (both produce HTML strings that
  must be cleaned and injected). Presented to the owner; the owner chose react-markdown.

## R3. Telling Markdown from plain text: a `description_format` column

- **Decision**: migration `007_description_format` adds `jobs.description_format varchar(16)`
  (null when there is no description) through `alterTable().addColumn()`, and a builder data step
  sets `'text'` on every row with a description. Values: `'markdown'` or `'text'`.
- **Rationale**: FR-011 needs old plain-text rows (including careers descriptions that will never be
  looked up again) to keep showing as text, and JSearch keeps sending plain text (FR-004). Without a
  flag, plain text would be rendered as Markdown (`#` lines becoming headings, `_` italics). The
  flag also drives the one-time re-scoring (R6).
- **Alternatives considered**: escaping plain text into Markdown on store (cannot fix rows already
  stored, and would turn JSearch's plain text into Markdown for no gain in structure); guessing the
  format from the text (unreliable).

## R4. The model's copy and boost text: addresses removed from our own link shape

- **Decision**: `src/descriptions/readable.ts` exports `readableDescription(description, format)`:
  for `'markdown'` it replaces every `[words](address)` written by R1's link rule with `words`; for
  `'text'` (or null) it returns the text unchanged. Used by:
  - `get_job_details` before its 6,000-character cut (FR-013), still inside the run's data markers
    (FR-006; the tool already declares `outsideText: true`);
  - title boosts in `rowViews.ts` and `pageData.ts` (FR-010; `normalizeTitle` already strips
    Markdown symbols, so only addresses needed removing);
  - the careers lookup's model, when a job page is read from a board's own data (R7).
- **Autolinks**: none are ever written, since R1's escape turns `<` into `\<`; so `[words](address)`
  is the only link form in stored Markdown.
- **Rationale**: the stored Markdown is written by our own link rule in one fixed shape with
  brackets in the words escaped by turndown, so a single pattern finds every link. No third Markdown
  library is needed.
- **Alternatives considered**: parsing with remark (would add `unified`, `remark-parse` and
  `remark-stringify` as direct dependencies for one transformation); storing a second, link-free copy
  (contradicts Q1: one description).

## R5. Each source's HTML

| Source | Field read | Escaped? | Change |
|---|---|---|---|
| Greenhouse | `content` | Yes (`&lt;p&gt;`, confirmed live) | Decode entities once, then convert |
| Workday | `jobPostingInfo.jobDescription` | No (raw `<p>`, confirmed live) | Convert as is; **stop decoding first** (today's `escapedHtmlToText` decodes it, which would turn text showing a tag into real markup). Workday is not a stored source (`ATS_NAMES` has no workday): its postings are read only by the careers lookup, so its Markdown reaches jobs through R7 |
| Ashby | `descriptionHtml` (new) | No | Convert; `descriptionPlain` no longer read |
| Lever | `description`, `lists[]` (`text`, `content` of `<li>` items), `additional` (new) | No | Build one HTML posting: description, then each list as `<h3>text</h3><ul>content</ul>`, then additional; convert (FR-012) |
| JSearch | `job_description` | Plain text | Unchanged, format `'text'` |
| Gmail alerts | copy of a JSearch match | Plain text | Copy the match's format with its description |

- `escapedHtmlToText` in `src/sources/htmlText.ts` is replaced by `decodeEntities` (exported) for
  Greenhouse; the text conversion goes away once both callers move.
- An empty result (nothing readable) stores no description, as today.

## R6. Scoring again once, on the first change to Markdown (FR-014)

- **Decision**: in `KyselyJobStore.upsertAll`'s `onDuplicateKeyUpdate`, `scored_at` gets a
  `CASE WHEN (description_format = 'text' OR description_format IS NULL) AND
  VALUES(description_format) = 'markdown' THEN NULL ELSE scored_at END` (a null format covers rows
  copied by `import-sqlite` and jobs that had no description), written with Kysely's `eb.case()` and placed **before** `description_format` in the
  update object, because MariaDB applies the assignments left to right and must compare the old
  format. The memory store mirrors it. Score, reasons and gaps stay, so the current score keeps
  showing until the new one arrives (FR-014). Later fetches find `'markdown'` already and do nothing.
- **Rationale**: one statement, no extra read, and it only fires on the text-to-Markdown change.
- **Volume**: only jobs from configured boards are fetched again. `data/config.json` has no
  companies today, so the 319 stored Lever jobs won't change unless a Lever company is configured
  again; whatever is configured is re-scored through the normal unscored queue, under the run's
  existing limits.
- **Its own PR**: the rule ships before any source writes Markdown (research R9), so it can be
  tested alone.
- **Lever ordering**: Lever moves to Markdown only in the PR that also brings its lists (FR-012), so
  it is re-scored once, on its full posting.

## R7. Careers pages (FR-004)

The careers lookup reads a job page in one of three ways (`readPage`): a board's own data, a
download, or a rendering. Each now yields the description to store with its format, while the
lookup's model keeps reading text.

- **A board's own data (PR 3, before any board sends Markdown).** `boardPages` builds a job page
  from a board reader's `Job`. From PR 6 that description may be Markdown, so:
  - the model's page text uses `readableDescription(description, format)` (no link addresses),
    keeping today's title and location header;
  - the read carries `description: { text, format }`: the posting's own description in its own
    format (not the page text with its header);
  - `session.jobPage` keeps it, `outcome` returns it, and `lookUpJob` stores it with its format.

  Until PR 6 every board description is `'text'`, so this changes nothing visible; tests use a
  board job with a Markdown description. Without this step, boards switching to Markdown in PR 6
  would put link addresses in front of the lookup's model and store Markdown marked `'text'` (shown
  with literal `##` until the downloads moved).
- **A download or a rendering (PR 9).** `pageToMarkdown(html)`: a second service from the same factory (R1),
  with a rule (an `addRule` with a filter function, since built-in rules win over `remove`, R1)
  that drops the chrome the walker drops (`nav`, `header`, `footer`) and hidden elements (`hidden`,
  `aria-hidden="true"`, inline `display:none` or `visibility:hidden`) with their contents, whatever
  the element (`<p hidden>`, `<li aria-hidden>`, `<h2 style="display:none">`). `aside` is kept, as
  the walker keeps it (FR-004 "as the lookup does today"). The read carries
  `description: { text: markdown, format: "markdown" }`; the model's page text is unchanged.
- **Cap (FR-008).** Careers descriptions go through `setDescription`, not `makeJob`, and Workday
  postings never become a `Job`, so the 20,000-character cut is a shared helper,
  `capDescription(text, format)` in `src/descriptions/`, used by `makeJob`, `workdayPosting` and the
  careers download path (R8). A blank Workday description counts as none.
- When nothing readable is converted, the read falls back to today's page text as `'text'`.

## R8. Length and truncation (FR-008)

- **Decision**: `capDescription(text, format)` in `src/descriptions/cap.ts` keeps the 20,000-character
  limit; for Markdown it cuts at the last newline before the limit, so no line (and no link) is cut in
  half. `makeJob` (PR 6), `workdayPosting` (PR 7) and the careers download path (PR 9) use it. `get_job_details` keeps its 6,000
  characters on the readable copy (R4).

## R9. Delivery: a docs PR, then nine code PRs and a docs PR

Every PR leaves the app working and can be tested; each is one sitting of about 10 files, merged and
tested before the next. The order makes sure every reader of a description, and the re-scoring rule,
handle Markdown before any source writes it:
1. **The format**: `description_format` (all rows `'text'`).
2. **The readable copy**: the model's copy and title boosts without link addresses.
3. **The careers lookup's board path**: a board posting's description keeps its format (R7).
4. **Display**: react-markdown in the panel.
5. **Scoring again once** (R6).
6. **Conversion and Ashby**: turndown with its rules and the hostile tests, `capDescription`, Ashby.
7. **Greenhouse and Workday** (Workday through the careers lookup).
8. **Lever's whole posting.**
9. **Careers pages downloaded or rendered.**
10. **Docs**: README, CLAUDE.md and the test ledger.

A board's conversion shows only for companies configured in `data/config.json`; each quickstart
step that needs one says so.

## R10. Tests (constitution Principle II)

The decisions sit in plain functions so nearly all tests are unit tests:
- **Unit (~50)**: the conversion rules over a hostile set (each removed element, images, event
  handlers, styles, `javascript:`/`data:`/relative links, empty links, literal `<script>` and
  `<https://…>` text, broken and doubly escaped markup, Markdown-looking text), `pageToMarkdown`'s
  chrome and hidden elements, `capDescription`, `readableDescription`, `markdownHref` and
  `descriptionHeading` (including `data:`, `javascript:` and relative addresses), each source's
  mapping, Lever assembly, the careers board path and downloads, boosts ignoring addresses, and the
  re-scoring rule on the memory store.
- **Integration (~5)**: migration 007 on `myjobbot_test`; the format round-trip, the views'
  format, `setDescription`'s format and the re-scoring rule as store-contract cases on MariaDB (the
  same contract cases also run on memory, counted as unit).
- **UI (2)**: one test that a Markdown description renders formatted (heading below `h3`, list,
  emphasis, a working new-tab link); one that hostile Markdown (raw `<script>`, `<form>`, an image,
  `javascript:` and `data:` links, an autolink) renders nothing harmful and loads nothing.

About 50 / 5 / 2 moves the suite toward 95 / 4 / 1: it stands at 473 / 45 / 52 (83 / 8 / 9) after
feature 011.
