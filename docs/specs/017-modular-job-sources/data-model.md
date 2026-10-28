# Data Model: Modular job sources

## `user_sources` (migration `012_user_sources`, research R3)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | `int` auto-increment, primary key | no | the saved source's id |
| `user_id` | `int`, foreign key to `users.id` | no | whose source this is (the owner is `1`) |
| `module` | `varchar(32)` | no | the module's id: `greenhouse`, `lever`, `ashby`, `workday`, `jsearch`, `gmail_alerts` |
| `name` | `varchar(255)` | no | the name the owner gave it; its jobs are labelled with it |
| `params` | `json` | no | the module's fields, such as `{"slug":"stripe"}` or `{"query":"…","country":"us"}` |
| `target` | `varchar(512)` | no | what it points at, from the module (`greenhouse:stripe`, `jsearch:<query…>`) |
| `enabled` | `tinyint` | no | 1 when it is fetched on each run |
| `company_id` | `int`, foreign key to `companies.id` | yes | the company record, for company-scoped sources |
| `cursor` | `json` | yes | where the last run stopped; null when the next run starts from the first page |
| `last_fetched_at` | `varchar(32)` | yes | ISO UTC time of the last fetch or save test |
| `last_outcome` | `varchar(16)` | yes | `ok`, `partial` (stopped at the per-run limit) or `failing` |
| `last_jobs` | `int` | yes | how many jobs the last fetch read |
| `last_reason` | `varchar(255)` | yes | why it failed: a fixed reason, never text from the source |
| `created_at`, `updated_at` | `varchar(32)` | no | ISO UTC times |

- **Unique keys**: `(user_id, target)` and `(user_id, name)`. Names that match ignoring case are
  refused by the app as well (`sourceRules`).
- Every table is `utf8mb4_bin`, built with the schema builder.

## `jobs.source_id` (migration `012_user_sources`)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `source_id` | `int`, foreign key to `user_sources.id`, `ON DELETE SET NULL` | yes | the saved source the job came from; null once that source is deleted |

`jobs.source` stays as the job's label: the source's name, updated on a rename.

## The data step (migration `012_user_sources`)

1. For the owner's stored settings document (feature 015), create a saved source per entry:
   - each `companies` entry becomes a source whose module is the entry's own `ats` (`greenhouse`,
     `lever` or `ashby`), named `name`, with `params` `{ slug }` and its `target`;
   - each `searches` entry becomes a `jsearch` source, named `name`, with `params`
     `{ query, remote_only?, country? }`, keeping only the fields it had.
2. Remove `companies` and `searches` from the document.
3. Add one `gmail_alerts` source named `Gmail alerts`, with `params` `{}`, on.
4. Set `jobs.source_id` where `jobs.source` matches a new source's name exactly.

## Types (not stored)

```ts
type ModuleId = "greenhouse" | "lever" | "ashby" | "workday" | "jsearch" | "gmail_alerts";

interface SavedSource {
    id: number;
    module: ModuleId;
    name: string;
    params: unknown;            // parsed with the module's `params` before use
    target: string;
    enabled: boolean;
    companyId: number | null;
    cursor: unknown | null;
    last: FetchOutcome | null;
}

interface FetchOutcome {
    at: string;
    outcome: "ok" | "partial" | "failing";
    jobs: number;
    reason: string | null;      // fixed text only
}

interface FieldSpec {
    name: string;               // a key of the module's params
    label: string;
    input: "text" | "select" | "checkbox";
    options?: readonly string[];
    optional?: boolean;
    placeholder?: string;
}
```

## Store interface (`src/db/sourceStore.ts`)

```ts
interface SourceStore {
    list(userId: number): Promise<SavedSource[]>;
    save(userId: number, source: NewSource | SavedSource, at: string): Promise<SavedSource>;
    setEnabled(userId: number, id: number, enabled: boolean, at: string): Promise<void>;
    remove(userId: number, id: number): Promise<void>;
    recordFetch(id: number, outcome: FetchOutcome, cursor: unknown | null): Promise<void>;
}
```

`Stores` gains `sources: SourceStore`. Editing a source's fields, or turning it off and on, clears
its `cursor`.

## Store contract (`tests/helpers/sourceContract.ts`)

One bundled case, run on memory and on `myjobbot_test`:
1. `list` gives `[]` for a user with none.
2. `save` adds a source and gives it an id. Saving it again with new fields keeps the id, updates it,
   and clears its cursor.
3. A second source with the same `target`, or the same `name`, is refused.
4. `setEnabled` turns a source off and on, and clears its cursor.
5. `recordFetch` stores the outcome and the cursor, and `list` gives them back exactly.
6. `remove` deletes it, and its jobs keep their label with a null `source_id`.

## Removed from feature 015's search settings (research R8)

- `companies` and `searches` leave `fileConfigSchema` and the stored document.
- The rules across sources leave the schema: at least one source, unique names, the reserved name,
  and the JSearch budget. They move to `sourceRules`.
