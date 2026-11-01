# Contract: the body filter

## Settings page, Filters section

- Two more lists, **"Description must include one of"** (field `body_include`) and **"Description
  must not include"** (field `body_exclude`), sit after the title filter's lists in the section's
  two columns, making seven. They work like the other lists: Add, Remove, and a Reset that brings
  back the default, which is empty.
- It is saved with the section's other lists, through `saveSettingsSection` with section
  `"filters"`:
  - A term with no letter or digit refuses the whole save, with the message on its row
    (`Problems field="body_include" entry={i}` or `field="body_exclude"`).
  - After a reload, the saved terms are shown in the order they were entered.

## Runs

- `isWanted(row, config)` is true only when:
  - the title passes the title filter;
  - the company isn't excluded;
  - `passesBodyFilter(row.description, row.description_format, config.body_filter)` holds.
- So a job the body filter leaves out (an exclude term matches, or the include list has terms and
  none matches):
  - is not in `next_jobs`' page or in its `total_unscored`;
  - doesn't count in `list_sources`' `total_unscored`;
  - doesn't keep `finish` from ending the run;
  - is not deleted, and keeps any score it already has.

## All jobs page

- `filterNote` gives, in this order of precedence:
  1. `"hidden: excluded company"`
  2. `"hidden by title filter"`
  3. `"hidden by body filter"`
  4. `null`
- Recommended is unchanged: it doesn't apply the title or body filter (it still drops excluded
  companies), so jobs scored before a term was added stay (FR-008).
- The note comes from `filterMatch` and `FILTER_NOTES` (`src/jobs/filterMatch.ts`), the same check
  `isWanted` and Re-score use.

## Examples (unit tests)

| Include | Exclude | Description | Passes |
|---|---|---|---|
| `[]` | `["security clearance"]` | "Active Security-Clearance required" | no |
| `[]` | `["php"]` | "We use PHPUnit" | yes |
| `[]` | `["php"]` | "PHP and Go" | no |
| `[]` | `["clearance"]` | `null` | yes |
| `[]` | `["clearance"]` | Markdown `[clearance info](https://x.test/clearance)` | no (the link's words remain) |
| `[]` | `["example"]` | Markdown `[apply](https://example.com/jobs)` | yes (the address is gone) |
| `[]` | `[]` | anything | yes |
| `["typescript", "golang"]` | `[]` | "We write Java" | no |
| `["typescript", "golang"]` | `[]` | "TypeScript-first team" | yes |
| `["go"]` | `[]` | "A good team" | no (whole words only) |
| `["typescript"]` | `[]` | `null` | yes |
| `["typescript"]` | `["clearance"]` | "TypeScript; clearance required" | no (exclusion wins) |
