# Data Model: Edit search settings on the Settings page

No table changes. The search settings stay one raw document per user in `user_settings` (feature
015, migration 011), written only through `SearchSettingsStore.save`. This feature adds types that
live only in memory, between the page, the form and the save.

## Settings view (`src/web/settingsView.ts`, research R1)

```ts
interface FieldView<T> {
    value: T;          // the value in effect: stored (after fallback) or the default
    isDefault: boolean; // true when the setting isn't stored (or fell back whole)
}

interface SettingsView {
    sources: { companies: FieldView<Company[]>; searches: FieldView<Search[]> };
    preferences: { preferences: FieldView<string> };
    scoring: { match_threshold: FieldView<number>; title_boosts: FieldView<Array<[string, number]>> };
    filters: {
        include: FieldView<string[]>;
        exclude: FieldView<string[]>;
        extra_exclude: FieldView<string[]>;
        exclude_companies: FieldView<string[]>;
        exclude_publishers: FieldView<string[]>;
    };
    needsSource: boolean;  // no company and no search in effect
}
```

`title_boosts` is shown as ordered rows of term and points, the stored map's entry order, so a
problem can point at a row.

## Sections (`src/web/settingsSections.ts`, research R2)

| Section | Fields | Stored as |
|---|---|---|
| `sources` | `companies`, `searches` | top-level keys |
| `preferences` | `preferences` | top-level key |
| `scoring` | `match_threshold`, `title_boosts` | top-level keys |
| `filters` | `include`, `exclude`, `extra_exclude` | inside `title_filter` |
| `filters` | `exclude_companies`, `exclude_publishers` | top-level keys |

Each of the eight search keys belongs to exactly one section.

## A save request (from the browser)

```ts
type FieldEdit = { kind: "default" } | { kind: "value"; value: unknown };

interface SaveRequest {
    section: "sources" | "preferences" | "scoring" | "filters";
    edits: Record<string, FieldEdit>;   // exactly the section's fields
}
```

- `"default"` removes the field from the stored document (FR-006).
- `title_boosts` arrives as rows and is turned back into a map in row order.
- The action checks the request's shape with zod before anything else: a known section, and only
  that section's fields.

## A save result

```ts
interface Problem {
    field: string | null;   // null: the whole section (a cross-setting rule)
    entry: number | null;   // the row, for a list field
    message: string;        // zod's message, as feature 015's import gives it
}

type SaveResult = { ok: true } | { ok: false; problems: Problem[] };
```

## applySection (`src/web/settingsSave.ts`, research R3)

Given the stored document (or `null`), a section and its edits:
- **to store**: the stored document with that section's fields replaced, `"default"` fields
  removed, and an empty `title_filter` removed. Other sections are kept exactly as stored;
- **to check**: the other sections after fallback, plus the edits as they are.

A save stores `toStore` only when `fileConfigSchema` accepts `mergeSettings(runtime, toCheck)`.

## Removed (research R8)

- `SearchSettingsStore.importIfAbsent`, the `imported` settings notice and the `settings_imported`
  trace event.
- `src/config/importSettings.ts` and `src/app/settingsCommands.ts`. Their checks move to
  `settingsSave.ts`.
