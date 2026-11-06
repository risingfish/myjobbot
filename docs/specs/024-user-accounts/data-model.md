# Data model: User accounts (024)

One migration, `018_accounts`, through Kysely's schema builder (constitution IV); every new table
`utf8mb4_bin`, InnoDB, times as ISO `varchar(32)` like the rest of the schema; `bigint` through
the builder, `sql` only for `tinyint` and the table options. Types go in a new
area file `src/db/schema/accounts.ts` (and `users.ts` for the new columns), each table listed in
`src/db/schema.ts`'s `Database`. Digests are lowercase hex SHA-256 (`char(64)`) unless noted.

## users (existing, extended)

| Column | Type | Rule |
|---|---|---|
| `email` | `varchar(254)` null | as typed (trimmed); null only for user 1 before `account init` |
| `email_key` | `varchar(254)` null, **unique** | `normalizeEmail(email)`: trimmed, lowercased (FR-007) |
| `is_admin` | `tinyint` not null default 0 | at least one admin once any account has an email (FR-012): `AccountStore.setAdmin` refuses the change that would leave none, in one transaction with every admin row locked (`forUpdate()`), so two admins removing each other's marks at once can't both succeed |

`name` (existing) holds the full name, 1–100 characters, no control characters (FR-046).

## sign_in_methods

One row per account per way (`kind`), created when the way is first ticked or set up.

| Column | Type | Rule |
|---|---|---|
| `user_id` | `integer` FK users | PK with `kind` |
| `kind` | `varchar(16)` | `password` \| `email_link` \| `hardware_key` \| `authenticator` |
| `enabled` | `tinyint` | the checkbox |
| `ready` | `tinyint` | set up (password stored; email link: set to 1 when enabled while mail is configured; key: ≥ 1 key; app: confirmed) |
| `password_digest` | `varchar(255)` null | `password` only: `argon2id$v=19$m=…,t=…,p=…$<salt>$<tag>` (R1) |
| `totp_secret` | `varchar(255)` null | `authenticator` only: sealed (`seal.ts`, field `totp_secret`) |
| `totp_last_step` | `bigint` null | last accepted 30 s step; codes at or before it are refused |
| `updated_at` | `varchar(32)` | |

**Usable** = `enabled = 1 AND ready = 1`, and for `email_link` also mail configured for the
deployment (`usable(row, { mailOn })` in `src/accounts/methods.ts`; the database can't see the
environment, so the flows pass `mailOn` down). Invariant (FR-017): every account with an email has
at least one usable row; enforced in `MethodStore.setEnabled`, `MethodStore.removeAuthenticator`
and `KeyStore.removeKey` by refusing the change that would break it, in the same transaction (row
lock on the user), counting `email_link` only when `mailOn`.

State: `absent → enabled, not ready (setup open) → usable ⇄ disabled-but-ready`; removing an app or
the last key sets `ready = 0` and clears its details.

## hardware_keys

| Column | Type | Rule |
|---|---|---|
| `id` | `integer` auto PK | |
| `user_id` | `integer` FK users | |
| `name` | `varchar(50)` | unique per user (unique index `user_id, name`), no control characters |
| `credential_id` | `varchar(512)` **unique** | base64url |
| `public_key` | `text` | base64url COSE key |
| `counter` | `bigint` | refused when a non-zero counter doesn't increase (R11) |
| `transports` | `varchar(100)` null | JSON list from the browser |
| `created_at`, `last_used_at` | `varchar(32)` / null | |

## recovery_codes

| Column | Type | Rule |
|---|---|---|
| `id` | auto PK | |
| `user_id` | FK users | |
| `digest` | `char(64)` | SHA-256 of the normalised code (R8); unique |
| `created_at` | `varchar(32)` | a new set deletes the old rows in the same transaction |
| `used_at` | `varchar(32)` null | spent in the checking statement |

## sessions

| Column | Type | Rule |
|---|---|---|
| `id_digest` | `char(64)` PK | SHA-256 of the cookie value |
| `user_id` | FK users | |
| `csrf_digest` | `char(64)` | SHA-256 of the strict CSRF cookie bound at sign-in (R4) |
| `created_at`, `last_used_at` | `varchar(32)` | expires when `last_used_at` is 30 days old (FR-003) |
| `verified_at` | `varchar(32)` | last proof of identity; step-up when older than 10 min (FR-047) |
| `ended_at` | `varchar(32)` null | set by sign-out, rotation, "sign out everywhere else", password change/reset, admin mark change |
| `address` | `varchar(45)` | client address key at sign-in (R6: an IP address, `direct` without a trusted proxy, or `unknown`) |

Index `(user_id, ended_at)`. Ended or expired rows older than 30 days are deleted on sign-in
(`SessionStore.pruneEnded`). `csrf_digest` is replaced by `SessionStore.rebindCsrf` when a
signed-in browser arrives from another site without the Strict cookie (R4).

## account_codes

| Column | Type | Rule |
|---|---|---|
| `digest` | `char(64)` PK | SHA-256 of the 32-byte code |
| `created_by` | FK users | an admin |
| `created_at`, `expires_at` | `varchar(32)` | expires 7 days after creation (FR-008) |
| `used_by` | FK users null | |
| `used_at` | `varchar(32)` null | spent in the same transaction that inserts the account |

## email_tokens

| Column | Type | Rule |
|---|---|---|
| `digest` | `char(64)` PK | |
| `user_id` | FK users | |
| `purpose` | `varchar(16)` | `signin` (15 min) \| `reset` (30 min) \| `email_change` (24 h) \| `step_up` (15 min) |
| `new_email` | `varchar(254)` null | `email_change` only |
| `session_digest` | `char(64)` null | `step_up` only: the session that asked; the spending statement's `WHERE` holds it, so only that session can spend it (R8, R17) |
| `return_path` | `varchar(512)` null | `step_up` only: the page to return to, through `safeReturnPath` (which gives `/` for anything over 512 characters) |
| `created_at`, `expires_at` | `varchar(32)` | |
| `used_at` | `varchar(32)` null | |

A new token of a purpose ends the account's unused tokens of that purpose.

## auth_challenges

| Column | Type | Rule |
|---|---|---|
| `digest` | `char(64)` PK | SHA-256 of the WebAuthn challenge |
| `purpose` | `varchar(16)` | `register` \| `signin` |
| `user_id` | FK users null | null for a sign-in challenge before the key answers |
| `expires_at`, `used_at` | `varchar(32)` / null | 5 minutes, once (FR-049) |

## auth_attempts

| Column | Type | Rule |
|---|---|---|
| `id` | auto PK | |
| `kind` | `varchar(16)` | `signin_fail` \| `mail_request` \| `code_attempt` |
| `scope` | `varchar(8)` | `email` \| `address` |
| `key_digest` | `char(64)` | SHA-256 of the normalised email or the address |
| `at` | `varchar(32)` | index `(kind, scope, key_digest, at)`; rows older than 1 day are deleted |

## security_events

| Column | Type | Rule |
|---|---|---|
| `id` | auto PK | |
| `user_id` | FK users | |
| `at` | `varchar(32)` | |
| `address` | `varchar(45)` null | R6's key (an IP address, `direct` or `unknown`); null for events from the command line (`account reset`) |
| `event` | `varchar(32)` | a fixed name from `SECURITY_EVENTS` (e.g. `signed_in`, `signin_failed`, `locked`, `password_changed`, `password_reset`, `method_enabled`, `method_disabled`, `key_added`, `key_removed`, `app_added`, `app_removed`, `recovery_codes_made`, `recovery_code_used`, `email_changed`, `admin_granted`, `admin_removed`, `admin_email_change`, `code_made`, `signed_out_elsewhere`, `key_counter_error`) |
| `method` | `varchar(16)` null | the `kind`, where it applies |

Never a password, code, token, secret or typed email (FR-051). The Account tab shows the last 20.

## Stores

Five stores, each an interface in `src/db/<name>Store.ts`, a Kysely class in
`src/db/kysely/<name>Store.ts` (builders only), a memory version in
`tests/helpers/memory<Name>Store.ts` and a contract in `tests/helpers/<name>Contract.ts`. Each joins
`Stores` in the sitting of its first caller (tasks.md).

| Store | Tables | Methods | Arrives |
|---|---|---|---|
| `SessionStore` | `sessions`, `auth_attempts` (the per-request hot path) | `create`, `find`, `touch`, `end`, `endAllFor`, `rebindCsrf`, `pruneEnded`, `recordAttempt`, `countAttempts` (S1); `setVerified` (S3) | S1 |
| `AccountStore` | `users`, `security_events` (and, inside `createAccount`'s transaction, `account_codes` and `sign_in_methods`) | `initOwner`, `byEmailKey`, `account`, `isAdmin`, `recordEvent` (S1); `createAccount`, `accounts`, `setAdmin` (S2); `saveName`, `recentEvents` (S3); `changeEmail` (S4) | S1 |
| `MethodStore` | `sign_in_methods` | `passwordDigest`, `setPassword` (S1); `methods`, `setEnabled` (S3); `saveAuthenticator`, `acceptStep`, `removeAuthenticator` (S5) | S1 |
| `TokenStore` | `account_codes`, `email_tokens`, `recovery_codes` | `makeCode` (S2); `makeEmailToken`, `spendEmailToken` (with the session digest for `step_up`), `emailTokenFor` (S4); `replaceRecoveryCodes`, `spendRecoveryCode`, `recoveryCodesLeft` (S5) | S2 |
| `KeyStore` | `hardware_keys`, `auth_challenges` | `addKey`, `keys`, `keyByCredential`, `updateCounter`, `removeKey`, `makeChallenge`, `spendChallenge` | S6 |

Each contract exports `<name>Contract(make)` (every case, run on the memory stores in
`tests/storeContract.test.ts`) and `<name>StrictCases(make)` (the transaction, race and constraint
cases, also run on MariaDB in `tests/integration/storeContract.test.ts`; owner decision,
2026-11-06).

`scripts/copy-prod.sh` copies no rows of `sessions`, `email_tokens`, `auth_challenges`,
`auth_attempts` and `account_codes` into a dev database, only their empty tables (research R19).
