# Data Model: Search settings in the database

## `users` (migration `011_user_settings`)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | `int` auto-increment, primary key | no | the user's id; the owner is `1` |
| `name` | `varchar(255)` | no | a display name; the owner's is `owner` |
| `created_at` | `varchar(32)` | no | ISO UTC time the user was created |

In this feature, the row with `id = 1` is created only by the store, inserted with that explicit
id, when it first saves search settings (the upgrade import or `import-settings`). The store
creates no other user.

## `user_settings` (migration `011_user_settings`)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `user_id` | `int`, primary key, foreign key to `users.id` | no | whose settings these are |
| `settings` | `json` (the builder's type; `longtext` utf8mb4_bin with a `json_valid` check on MariaDB) | no | the raw search settings as JSON: only keys the user set (research R2) |
| `updated_at` | `varchar(32)` | no | ISO UTC time of the last save |

Both tables are `utf8mb4_bin`, built with Kysely's schema builder (`createTable`, `modifyEnd` for
the table options, `addForeignKeyConstraint`). The table options are the migration's one `sql`
fragment.

**The stored document** contains only search keys, and only the ones set:

```json
{
  "companies": [{ "name": "Stripe", "ats": "greenhouse", "slug": "stripe" }],
  "searches": [{ "name": "Remote TypeScript", "query": "typescript backend engineer" }],
  "preferences": "Remote US, senior backend…",
  "match_threshold": 60,
  "title_filter": { "extra_exclude": ["staff"] },
  "title_boosts": { "typescript": 10 },
  "exclude_companies": ["acme"],
  "exclude_publishers": ["jobmesh.io"]
}
```

`exclude_publishers` is stored at the top level of the document, and goes back inside `jsearch`
when merged (`mergeSettings`). On export it is written back inside `jsearch` too
(`{ "jsearch": { "exclude_publishers": [...] } }`), so the exported file has `config.json`'s shape.

## Store interface (`src/db/searchSettingsStore.ts`)

```ts
type RawSearchSettings = Record<string, unknown>;   // the stored document: only keys the user set

interface SearchSettingsStore {
    load(userId: number): Promise<RawSearchSettings | null>;          // null: nothing stored
    importIfAbsent(settings: RawSearchSettings, at: string): Promise<boolean>;   // the owner's only
    save(userId: number, settings: RawSearchSettings, at: string): Promise<void>;  // PR 3; replace whole
}
```

- Both writes run in one transaction that first ensures the owner row when the user is the owner
  (`insertInto("users")` with `id: OWNER_ID`, `name: "owner"`, a no-op `onDuplicateKeyUpdate`).
  `save` for any other id creates no user, and fails on the foreign key when there is none.
- `importIfAbsent` writes the owner's row with `insertInto("user_settings").values(...).ignore()`
  and returns `numInsertedOrUpdatedRows === 1n`: `true` when it stored, `false` when a row already
  existed. Two processes importing at once store exactly one. It runs inside `withRetry` (two
  tries), since two first writes of the owner row can deadlock. It takes no user id, because
  `INSERT IGNORE` would turn a foreign-key error into a silent `false`.
- `save` (added in PR 3, with the import command that is its only caller) writes with
  `onDuplicateKeyUpdate`, replacing `settings` and `updated_at`.
- `Stores` gains `searchSettings: SearchSettingsStore` (two lines in `src/db/store.ts`: the import
  and the field). It is named for what it holds, not `settings`, which `src/db/settings.ts` (the
  database connection settings) already means.

## Notices (not stored, defined in `src/config/resolve.ts`)

```ts
type SettingsNotice =
    | { kind: "imported"; keys: string[] }                    // FR-009, traced only
    | { kind: "fallback"; setting: string; reason: string }   // FR-005a, PR 2
    | { kind: "file_ignored"; keys: string[] };               // FR-010
```

- `keys` name settings as `config.json` does (`jsearch.exclude_publishers`).
- `setting` is a path: the key, plus the entry's position for a list or map entry (`companies[1]`,
  `title_boosts[3]`, `title_filter.extra_exclude[0]`, `jsearch.exclude_publishers[2]`). It never
  holds a value (research R5).
- Notices are computed on every read and never stored. The read that imports gives `imported` and
  no `file_ignored`.

## Store contract (`tests/helpers/searchSettingsContract.ts`)

One bundled case, run on memory and on `myjobbot_test`:
1. `load` gives `null` before anything is stored.
2. `importIfAbsent` stores and returns `true`. A second call with different settings returns
   `false` and changes nothing.
3. *(PR 3)* `save` replaces the whole document. A key absent from the new one is gone. `save` for a
   user id with no `users` row is refused and stores nothing. After a `seedUser(2)` hook adds a
   second user, `save(2, …)` stores that user's own document and `load(1)` is unchanged (SC-008).
4. The stored document round-trips exactly, including list order, the preferences text and keys
   with accents and emoji.
5. The owner row exists after the first write, with id 1, and only one.
