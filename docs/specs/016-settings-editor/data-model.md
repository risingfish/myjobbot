# Data Model: Edit search settings on the Settings page

No table changes. The search settings stay one raw document per user in `user_settings` (feature
015, migration 011), written only through `SearchSettingsStore.save`. This feature adds types that
live only in memory, between the page, the form and the save.

## Fields and sections (`src/web/settingsSections.ts`, research R2)

Ten fields cover the eight search keys. Each field is named once, and that name is used in
requests, problems and the view.

| Field | Section | Stored path | Check path (`config.json` shape) |
|---|---|---|---|
| `companies` | `sources` | `companies` | `companies` |
| `searches` | `sources` | `searches` | `searches` |
| `preferences` | `preferences` | `preferences` | `preferences` |
| `match_threshold` | `scoring` | `match_threshold` | `match_threshold` |
| `title_boosts` | `scoring` | `title_boosts` | `title_boosts` |
| `include` | `filters` | `title_filter.include` | `title_filter.include` |
| `exclude` | `filters` | `title_filter.exclude` | `title_filter.exclude` |
| `extra_exclude` | `filters` | `title_filter.extra_exclude` | `title_filter.extra_exclude` |
| `exclude_companies` | `filters` | `exclude_companies` | `exclude_companies` |
| `exclude_publishers` | `filters` | `exclude_publishers` | `jsearch.exclude_publishers` |

## Settings view (`src/web/settingsView.ts`, research R1)

```ts
type RawEntry = Record<string, unknown>;   // a board or search as stored: blank fields stay absent

interface FieldView<T> {
    value: T;           // the value in effect: stored (after fallback) or the default
    isDefault: boolean; // true when the field isn't stored (or fell back whole)
}

interface SettingsView {
    fields: {
        companies: FieldView<RawEntry[]>;
        searches: FieldView<RawEntry[]>;
        preferences: FieldView<string>;
        match_threshold: FieldView<number>;
        title_boosts: FieldView<Array<[string, number]>>;   // rows, in the stored order
        include: FieldView<string[]>;
        exclude: FieldView<string[]>;
        extra_exclude: FieldView<string[]>;
        exclude_companies: FieldView<string[]>;
        exclude_publishers: FieldView<string[]>;
    };
    needsSource: boolean;     // no company and no search in effect
    needsSearchKey: boolean;  // searches in effect, JSEARCH_API_KEY not set
}
```

## A save request (from the browser)

```ts
type FieldEdit = { kind: "default" } | { kind: "value"; value: unknown };

interface SaveRequest {
    section: "sources" | "preferences" | "scoring" | "filters";
    edits: Record<string, FieldEdit>;   // exactly the section's fields (by field name)
}
```

- `"default"` removes the field from the stored document (FR-006).
- `sectionRequest` (`src/web/settingsForm.ts`) builds it. A field still marked default goes as
  `"default"`; every other field goes as a value.
- `saveRequest` (zod, same file) checks a request from the browser:
  - a known section, and exactly that section's fields;
  - board, search and boost rows as `z.strictObject`s of their known fields. Their values are left
    to the settings check.
- `title_boosts` arrives as rows and becomes a map in row order. A repeated term is refused on its
  row.

## A save result

```ts
interface Problem {
    field: string | null;   // a field name; null: the top of the saved section
    entry: number | null;   // the row, for a list field
    message: string;        // zod's own message, unprefixed; one problem per reason
}

type SaveResult =
    | { ok: true }
    | { ok: false; problems: Problem[] }   // refused: nothing stored
    | { ok: false; failed: true };          // the save couldn't run: nothing stored
```

## The save decisions (research R3, R4)

- **`applySection(stored, request)`** (`src/web/settingsApply.ts`) returns:
  - **to store**: the stored document, with keys that aren't search settings dropped and the
    section's fields replaced at their stored paths. `"default"` fields and an empty `title_filter`
    are removed;
  - **to check**: the other sections after fallback, plus the edits as they are.
- **`sectionProblems(issues, request)`** (`src/web/settingsProblems.ts`) places each issue by the
  longest matching check path. An issue matching no field of the saved section goes to the section's
  top.
- **`saveSection(stored, runtime, request)`** (`src/web/settingsSave.ts`) returns
  `{ toStore } | { problems }`. A save stores `toStore` only when `fileConfigSchema` accepts
  `mergeSettings(runtime, toCheck)` and no boost term repeats.

## Removed (research R8)

- `SearchSettingsStore.importIfAbsent`, the `imported` settings notice and the `settings_imported`
  trace event.
- `src/config/importSettings.ts` and `src/app/settingsCommands.ts`.
- `resolveSettings`'s `at` parameter.
