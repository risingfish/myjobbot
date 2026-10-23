# Contract: descriptions

## Conversion: `htmlToMarkdown(html: string): string | null` (`src/descriptions/toMarkdown.ts`, PR 6)

- Input: raw (unescaped) HTML. Greenhouse callers decode entities once first; no one else decodes.
- Output: Markdown, or null when nothing readable is left.
- **Kept**: paragraphs, line breaks, ATX headings, `-` bullet and numbered lists (nested), block
  quotes, `---` rules, `**bold**`, `*italic*`, inline code and fenced code blocks, and links whose
  address parses as `http:` or `https:` and whose words are not empty, written `[words](address)`
  with `(`, `)` and whitespace in the address percent-encoded.
- **Removed with their contents** (`remove`): `script`, `style`, `noscript`, `noembed`, `noframes`,
  `template`, `iframe`, `frame`, `frameset`, `object`, `embed`, `applet`, `param`, `canvas`, `svg`,
  `math`, `form`, `input`, `button`, `select`, `textarea`, `option`, `picture`, `video`, `audio`,
  `source`, `track`, `head`, `title`, `meta`, `link`, `base`, and comments.
- **By rule** (`addRule`, because a built-in rule would otherwise win): `img` is dropped; links with
  no words are dropped; code blocks (`pre` with a `code` child) are built from the processed content,
  so anything removed inside them is gone too, fenced one backtick longer than any run inside.
- **Unwrapped** (text kept): every other element (`div`, `span`, `table`, `font`, `u`, `aside`, …)
  and links with any other address (`javascript:`, `data:`, `mailto:`, relative).
- **Escaping**: turndown's own Markdown escapes plus `<` → `\<`, `&` → `\&` and a `!` ending a text
  run → `\!` (an `escape` override), so text that reads `<script>` or `<https://…>` stays text. Outside code spans and
  fences the output contains no unescaped `<`.
- **Empty formatting**: paragraphs, items and headings that are blank in the source are dropped; one
  emptied only by removed children may remain as a bare `-` or `#` (accepted, research R1).

`pageToMarkdown(html)` (PR 9): a second service from the same factory, with the same rules plus an
`addRule` filter that drops `nav`, `header`,
`footer` and hidden elements (`hidden`, `aria-hidden="true"`, inline `display:none` or
`visibility:hidden`) with their contents, whatever the element. `aside` is kept, as the page walker
keeps it.

## Length: `capDescription(text, format): string` (`src/descriptions/cap.ts`, PR 6)

At most 20,000 characters; a `'markdown'` text over the limit is cut at the last newline before it.
Used by `makeJob`, `workdayPosting` (PR 7) and the careers download path (PR 9).

## Readable copy: `readableDescription(description: string | null, format): string | null` (PR 2)

- `'markdown'`: every `[words](address)` becomes `words`; everything else unchanged.
- `'text'` or null format: the description unchanged.
- Used for the model (`get_job_details`, before its 6,000-character cut), title boosts, and the
  careers lookup's board-data job pages (PR 3).

## Display (PR 4)

- `web/lib/markdown.ts`: `markdownHref(url)` returns the address when it parses as `http:` or
  `https:`, otherwise `""`; `descriptionHeading(level)` maps 1 and 2 → `h4`, 3 → `h5`, 4–6 → `h6`.
- `MarkdownText` (`web/components/panel/MarkdownText.tsx`): a `<div className="details-markdown">`
  around react-markdown (version 10 takes no `className`), with `skipHtml`,
  `allowedElements` = the kept formatting (`p`, `br`, `h1`–`h6`, `ul`, `ol`, `li`, `blockquote`,
  `hr`, `strong`, `em`, `code`, `pre`, `a`), `unwrapDisallowed`, `urlTransform` = `markdownHref`.
  Links: `target="_blank"`, `rel="noopener noreferrer"`, `referrerPolicy="no-referrer"`; an empty
  address renders the words without a link. Headings render as `descriptionHeading(level)`.
- `DescriptionSection` uses it for `format === "markdown"`; `'text'` and null keep today's
  `<p className="details-text">` with line breaks.
