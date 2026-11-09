# Data model: 028

## Database

### `jobs` (the shared posting)

`emailed_at` is removed by step `024_jobs_without_digest_mark` (research R5). No other column
changes. `src/db/schema/jobs.ts`'s `JobsTable` loses the field. `splitJob` in `importPlan.ts` leaves
it out of the posting it builds from an old SQLite row, through its `RETIRED` set.

- **Validation**: before dropping, the step counts the rows where `emailed_at IS NOT NULL`. With
  any, it fails with the fixed message in [contracts/upgrade-024.md](contracts/upgrade-024.md) and
  changes nothing.

No other table changes. The 027 audit stands: every per-user table has a `user_id` that can't be
empty and points at `users`.

## Eval files

### `data/evals/runs/<id>/run.json`

| Field | Change |
|---|---|
| `userId` | new, optional, integer ≥ 1: the user whose resume, profile and settings the run scored against |

- Set by `executeRun` from the stores the command opened (`--user`, else user 1). Each run of a
  series sets its own.
- A file without it parses as before and is reported as "user not recorded". Nothing rewrites old
  files.

Captured cases already carry `userId` (027). Profiles, prompts, answer keys and results don't
change.

## Interfaces that move or narrow

No change alters a query or a stored shape. Most moves keep their members; the D2 and D3 splits
rename some (`recordEvent` becomes `record`, …). Each finding's **Fix** line in the inventory has
the detail.

| From | To | Finding |
|---|---|---|
| `SessionStore` (sessions + attempt counters) | `SessionStore` (sessions) + `AttemptStore` | D1 |
| `AccountStore` (accounts + security events) | `AccountStore` + `SecurityEventLog` | D2 |
| `TokenStore` (codes + links + recovery codes) | `AccountCodeStore`, `EmailLinkStore`, `RecoveryCodeStore` | D3 |
| `OWNER_ID` and `ensureOwner` in the settings store | `src/db/owner.ts`, `src/db/kysely/owner.ts` | D6 |
| five store interfaces in `src/db/store.ts` | one file each, as 027 did for the others | D9 |
| `ApiCallLog.lastCallAt` | removed | D8 |
| `AccountStore.isAdmin` | removed; callers read `account(id).isAdmin` | D10 |
| `ToolContext` (stores + operations + run state) | `RunStores` & `RunPorts` & `RunIdentity`, intersected; the existing `RunState` (the type of `run`) keeps its name | A2 |
| `SourceContext` with the JSearch key and Gmail access for every module | the part each module declares it needs | S2 |
| `SourceModule` | gains `descriptions` (A3), the optional `jobAts` (D4: the ats a module's jobs carry when it differs from its id), `limits.spends` and `limits.skipWhenBudgetUsed` (S3), `boardLink?` (S5), and an access type parameter (S2) | A3, D4, S2, S3, S5 |
| `SourcePage.alerts`, `Read.alerts` | removed; the alert read travels in the Gmail hook's own access object | S1, S2 |
| the module list | `BOARD_MODULES` (`src/sources/boardModules.ts`), from which `MODULES` is built | S5 |
| `Met` in `src/web/sourceChoices.ts` | moves to `src/sources/module.ts`, beside `OFF_WHILE_UNMET: Record<Requirement, boolean>` | A1 |
| the careers lookup's `CareersStore` | the four-method part it uses | C1 |
| `web/lib/uiState.ts` (stores + two page loaders + config) | one module per job | W1 |

The `Stores` container keeps holding stores only, plus `forUser` and `close`. A guard test checks
it (research R7).

## The memory stores (D7)

`memoryStores` gets one users table (`AuthTables.users`) that the settings, source and resume stores
share. As in MariaDB:
- saving the owner's data creates user 1
- a write for a user that doesn't exist is refused

The store contracts gain three cases, each run on both kinds of store:
- `resumeContract` and `sourceContract` each gain "a write for a user that doesn't exist is refused"
- `searchSettingsContract` gains "an owner write creates user 1"

The test setup creates users as MariaDB holds them: `storesWithSettings` creates user 1, and the
memory `seedUsers` hooks add to the shared users table.
