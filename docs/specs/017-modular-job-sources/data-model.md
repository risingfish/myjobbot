# Data Model: Modular job sources

## `user_sources` (migration `012_user_sources`, research R3)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | `int` auto-increment, primary key | no | the saved source's id |
| `user_id` | `int`, foreign key to `users.id` | no | whose source this is (the owner is `1`) |
| `module` | `varchar(32)` | no | the module's id. Not a fixed list, so a module later removed still loads, shown as unavailable |
| `name` | `varchar(255)` | no | the name the owner gave it; its jobs are labelled with it |
| `params` | `json` | no | the module's fields, such as `{"slug":"stripe"}` or `{"query":"…","country":"us"}` |
| `target` | `varchar(512)` | no | what it points at, from the module's target rule (contracts/source-module.md) |
| `enabled` | `tinyint` | no | 1 when it is fetched on each run |
| `company_id` | `int`, foreign key to `companies.id` | yes | the company record, for company-scoped sources |
| `cursor` | `json` | yes | where the last run stopped; null when the next run starts from the first page |
| `last_fetched_at` | `varchar(32)` | yes | ISO UTC time of the last fetch or save test; also what JSearch's schedule is checked against |
| `last_outcome` | `varchar(16)` | yes | `ok`, `partial` (stopped at the per-run limit) or `failing` |
| `last_jobs` | `int` | yes | how many jobs the last fetch read |
| `last_cost` | `int` | yes | what the last fetch spent from a budget (JSearch requests) |
| `last_reason` | `varchar(255)` | yes | why it failed: a fixed reason, never text from the source |
| `created_at`, `updated_at` | `varchar(32)` | no | ISO UTC times |

- **Unique keys**: `(user_id, target)` and `(user_id, name)`. The app also refuses names that match
  ignoring case (`sourceRules`).
- Every table is `utf8mb4_bin`, built with the schema builder.

## `jobs.source_id` (migration `012_user_sources`)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `source_id` | `int`, foreign key to `user_sources.id`, `ON DELETE SET NULL` | yes | the saved source the job came from; null for a job from no saved source, or once its source is deleted |

`jobs.source` stays as the job's label: the source's name, updated on a rename.

## The data step (migration `013_move_sources`, S4b)

A migration of its own, because migration 012 lands in S3 and has already run by S4b.

It runs only for users who have a `user_settings` row. On a database with none, such as a fresh
install, it does nothing.

1. Create a saved source per entry in that user's stored settings document:
   - each `companies` entry becomes a source whose module is the entry's own `ats` (`greenhouse`,
     `lever` or `ashby`), named `name`, with `params` `{ slug }`;
   - each `searches` entry becomes a `jsearch` source, named `name`, with `params`
     `{ query, remote_only?, country? }`, keeping only the fields it had.

   Each target comes from the step's own frozen copy of the module target rules. A second entry with
   a target already taken isn't created: its jobs go to the first source, and the step logs the
   merge.
2. Remove `companies` and `searches` from the document.
3. Add one `gmail_alerts` source named `Gmail alerts`, with `params` `{}`, on.
4. Set `jobs.source_id` where `jobs.source` matches a new source's name exactly.

## Types (not stored)

```ts
interface SavedSource {
    id: number;
    module: string;             // looked up in MODULES; unknown ids show as unavailable
    name: string;
    params: unknown;            // parsed with the module's `params` before use
    target: string;
    enabled: boolean;
    companyId: number | null;
    cursor: unknown | null;
    last: SourceOutcome | null;
}

interface SourceOutcome {
    at: string;
    outcome: "ok" | "partial" | "failing";
    jobs: number;
    cost: number;
    reason: string | null;      // fixed text only
}

interface SourceField {
    name: string;               // a key of the module's params
    label: string;
    input: "text" | "select" | "checkbox";
    options?: readonly string[];
    optional?: boolean;
    placeholder?: string;
}

type SourceKey = { userId: number; id: number };
type JobSource = string | { id: number; name: string };   // a plain name: no saved source
```

## Store interface (`src/db/sourceStore.ts`)

```ts
interface SourceStore {
    list(userId: number): Promise<SavedSource[]>;
    save(userId: number, source: NewSource | SavedSource, at: string): Promise<SavedSource>;
    setEnabled(key: SourceKey, enabled: boolean, at: string): Promise<void>;
    remove(key: SourceKey): Promise<void>;
    recordFetch(key: SourceKey, outcome: SourceOutcome, cursor: unknown | null): Promise<void>;
    linkCompany(key: SourceKey, companyId: number): Promise<void>;
    ensureAccountSource(userId: number, module: string, name: string, at: string): Promise<void>;
}
```

- `Stores` gains `sources: SourceStore`.
- Editing a source's fields, or turning it off and on, clears its `cursor`.
- `CompanyStore.setBoardPage` returns the company's id.
- `JobStore.upsertAll(jobs, seen, source: JobSource)`.

## Store contract (`tests/helpers/sourceContract.ts`)

One bundled case, run on memory and on `myjobbot_test`:
1. `list` gives `[]` for a user with none.
2. `save` adds a source and gives it an id. Saving it again with new fields keeps the id, updates it,
   and clears its cursor.
3. A second source with the same `target`, or the same `name`, is refused.
4. `setEnabled` turns a source off and on, and clears its cursor.
5. `recordFetch` stores the outcome and cursor, and `linkCompany` the company. `list` gives them back
   exactly.
6. `ensureAccountSource` creates the Gmail alerts source once; calling it again changes nothing.
7. `remove` deletes a source, and its jobs keep their label with a null `source_id`.

## Removed from feature 015's search settings (research R8)

- `companies` and `searches` leave `fileConfigSchema` and the stored document.
- The rules across sources leave the schema: at least one source, unique names, the reserved name,
  the JSearch budget and `requireSearchKey`. All but the key check come back as `sourceRules`.
