# Data Model: Search settings in the database

## `users` (migration `011_user_settings`)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | `int` auto-increment, primary key | no | the user's id; the owner is `1` |
| `name` | `varchar(255)` | no | a display name; the owner's is `owner` |
| `created_at` | `varchar(32)` | no | ISO UTC time the user was created |

In this feature, the row with `id = 1` is created only by the store, when it first saves search
settings (the upgrade import or `import-settings`).

## `user_settings` (migration `011_user_settings`)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `user_id` | `int`, primary key, foreign key to `users.id` | no | whose settings these are |
| `settings` | `longtext` | no | the raw search settings as JSON: only keys the user set (research R2) |
| `updated_at` | `varchar(32)` | no | ISO UTC time of the last save |

Both tables are `utf8mb4_bin`, built with Kysely's schema builder (`createTable`, `modifyEnd` for
the table options, `addForeignKeyConstraint`).

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

## Store interface (`src/db/settingsStore.ts`)

```ts
interface SettingsStore {
    load(userId: number): Promise<RawSearchSettings | null>;          // null: nothing stored
    save(userId: number, settings: RawSearchSettings, at: string): Promise<void>;  // replace whole
    importIfAbsent(userId: number, settings: RawSearchSettings, at: string): Promise<boolean>;
}
```

- `save` and `importIfAbsent` create the owner row first when it's missing (`INSERT ... ON
  DUPLICATE KEY UPDATE id = id`).
- `importIfAbsent` returns whether it stored anything. It is a no-op when a row exists, so two
  processes importing at once store exactly one.
- `Stores` gains `settings: SettingsStore`.

## Notices (not stored)

```ts
type SettingsNotice =
    | { kind: "fallback"; setting: string; reason: string }   // FR-005a
    | { kind: "file_ignored"; keys: string[] };               // FR-010
```

Notices are computed on every read and never stored.

## Store contract (`tests/helpers/settingsContract.ts`)

One bundled case, run on memory and on `myjobbot_test`:
1. `load` gives `null` before anything is stored.
2. `importIfAbsent` stores and returns `true`. A second call with different settings returns
   `false` and changes nothing.
3. `save` replaces the whole document. A key absent from the new one is gone.
4. The stored document round-trips exactly, including list order, the preferences text and keys
   with accents and emoji.
5. The owner row exists after the first save, and only one.
