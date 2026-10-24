# Data Model: Company records

## `companies` table (migration `009_companies`)

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| `id` | `int` auto-increment, primary key | no | — | the company's id |
| `company_key` | `varchar(255)`, unique | no | — | `normalizeCompany(name)` (research R2) |
| `name` | `varchar(255)` | no | — | the name as first seen |
| `website_url` | `varchar(2048)` | yes | `NULL` | the company's website (an origin, e.g. `https://acme.com`) |
| `careers_url` | `varchar(2048)` | yes | `NULL` | its careers page |
| `careers_source` | `varchar(16)` | yes | `NULL` | `board`, `lookup` or `search`; null exactly when `careers_url` is |
| `created_date` | `varchar(32)` | no | — | ISO UTC time the record was created (backfill: the earliest `first_seen`) |
| `last_found_date` | `varchar(32)` | no | — | ISO UTC time a run last stored a job from it |
| `searched_at` | `varchar(32)` | yes | `NULL` | when its addresses were last searched for |
| `website_reason` | `varchar(32)` | yes | `NULL` | why the last search found no website (below) |
| `website_rejected` | `text` | yes | `NULL` | JSON list of up to 5 addresses the website rule turned down |
| `careers_reason` | `varchar(32)` | yes | `NULL` | why the last search found no careers page |
| `careers_rejected` | `text` | yes | `NULL` | JSON list of up to 5 addresses the careers rule turned down |

Reasons: `search_unavailable`, `no_results`, `no_match`. A reason and its list are null when that
address was found, or wasn't searched for.

The migration uses the schema builder only: `createTable("companies")` with `addColumn`s,
`addUniqueConstraint` on `company_key`, the table's `utf8mb4_bin` collation as every table has, and
an index on `last_found_date`.

## `jobs.company_id` (migration `009_companies`)

`int`, null, indexed, a foreign key to `companies.id`. It is null only before the first run after
the upgrade (research R4), and for a job whose company key is empty. `jobs.company` keeps the name
as the source gave it.

## `careers_pages` (migration `010_fold_careers_pages`)

Each row is copied into `companies` by `company_key`. A new record is inserted when none exists,
with `name = company`, `careers_url = url`, `careers_source = 'lookup'`, and `created_date` and
`last_found_date` set to `found_at`. An existing record gets the URL only when it has no careers
page yet. Then the table is dropped. The data step uses `insertInto ... onDuplicateKeyUpdate`
over `selectFrom("careers_pages")`, typed with `db.withTables<...>()`.

## Store interface (`src/db/companyStore.ts`)

```ts
interface CompanyStore {
    dueForSearch(limit: number, now: string): Promise<CompanyRow[]>;           // R8
    recordSearch(id: number, result: SearchRecord, at: string): Promise<void>; // R8, R9
    markUnavailable(ids: number[], at: string): Promise<void>;                 // R8
    setBoardPage(key: string, name: string, url: string, at: string): Promise<void>; // R6
}
```

- **Recording and linking** happen inside `JobStore.upsertAll` (R1), plus
  `JobStore.linkUnlinkedJobs(): Promise<number>` for the backfill (R4). `JobStore.markSeen` also moves
  the linked companies' `last_found_date` forward (R1).
- **The careers lookup** reads and writes the record through `CareersStore.careersPage(key)`,
  `setLookupPage(...)` and `clearLookupPage(key)` (R5).
- **`Stores`** gains `companies: CompanyStore`.

## State of a company's addresses

```text
recorded (no addresses, never searched) --search--> each address found, or its reason set
not fully found --24 h later, found again--> due again (FR-010)
both addresses found --> never due again
careers_source board --> careers_url never replaced; only the website is searched
careers_source lookup|search --lookup finds another page--> lookup page
careers_source lookup|search --lookup finds the page dead--> careers_url null, due again
```

## Store contract (`tests/helpers/companyContract.ts`)

One bundled case, run on memory and on `myjobbot_test`, whose steps grow with the PRs:

1. **PR 1:** jobs from three sources naming one company in different spellings make one record;
   `last_found_date` moves forward, through `markSeen` too, and `created_date` and `name` stay; an
   empty-key name gets no
   record; excluded companies are recorded; the backfill links unlinked jobs with the earliest and
   latest times; pruning jobs keeps companies.
2. **PR 2:** a lookup page is read back, replaced and cleared; it never replaces a board page.
3. **PR 3:** a board page is set and never replaced.
4. **PR 4:** due-for-search order and the 24-hour rule; a search result stores addresses and
   outcome; `markUnavailable`.
