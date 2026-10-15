# Data Model: Gmail connection panel

Migration step `src/db/migrations/002_gmail.ts`. Every table is `utf8mb4_bin`, like `001_initial`.

## `gmail_connection`: at most one row

| Column | Type | Rule |
|---|---|---|
| `id` | `TINYINT` PK | always 1 |
| `client_id` | `VARCHAR(255)` NULL | as entered; shown in the panel |
| `client_secret` | `TEXT` NULL | **sealed** (AAD `client_secret`); never leaves the server |
| `credentials_saved_at` | `VARCHAR(32)` NULL | ISO time, UTC |
| `refresh_token` | `TEXT` NULL | **sealed** (AAD `refresh_token`) |
| `email` | `VARCHAR(320)` NULL | from Gmail `users/me/profile` |
| `connected_at` | `VARCHAR(32)` NULL | ISO time |
| `status` | `VARCHAR(20)` NOT NULL | `none`, `connected` or `needs_reconnect`; named `status` so it isn't confused with the OAuth `state` below |
| `reason` | `VARCHAR(200)` NULL | a fixed phrase for `needs_reconnect`, never Google's raw text |

Saving or clearing credentials while a token is stored (connected or needs_reconnect) first disconnects (revoke attempted, skipped if the token won't open; token deleted). `needsReconnect` keeps the sealed token so that a later disconnect can still revoke it. Saving then stores the new credentials; clearing resets the row to `none`. `VARCHAR(32)` times match `001_initial`.

## `gmail_connect_requests`

| Column | Type | Rule |
|---|---|---|
| `state` | `CHAR(43)` PK | 32 random bytes, base64url |
| `code_verifier` | `TEXT` | **sealed** (AAD `code_verifier`) |
| `created_at` | `VARCHAR(32)` | ISO time; requests older than 10 minutes are invalid and pruned |

## `GmailStore` (`src/db/store.ts`)

```text
connection(): Promise<GmailConnectionRow | null>   # GmailConnectionRow is defined in src/db/store.ts
saveCredentials(clientId, sealedSecret, at): Promise<void>
clearCredentials(): Promise<void>                 # row → none, all secrets null
connected(sealedToken, email, at): Promise<void>  # status connected, reason null
needsReconnect(reason): Promise<void>               # status needs_reconnect; keeps email and sealed token
disconnect(): Promise<void>                       # token, email, connected_at null; status none
addConnectRequest(state, sealedVerifier, at): Promise<void>
takeConnectRequest(state): Promise<{ sealedVerifier, createdAt } | null>  # delete + return, single use
pruneConnectRequests(before): Promise<void>
```

The interface grows sitting by sitting, so production reaches every method in the sitting that
adds it:
- **S1**: `connection`, `saveCredentials` and `clearCredentials`
- **S2**: `connected`, `addConnectRequest`, `takeConnectRequest` and `pruneConnectRequests`
- **S3**: `needsReconnect` and `disconnect`

The contract (`tests/helpers/gmailStoreContract.ts`) has five cases, run against the memory fake
and MariaDB:
1. **S1**: save credentials, then clear them.
2. **S2**: connect; connecting again leaves one row with the second email.
3. **S2**: a request is taken once, and the second take is null.
4. **S2**: prune removes only the old requests.
5. **S3**: `needsReconnect` keeps the email; `disconnect` keeps the credentials and nulls the
   token.

## Panel view (`src/web/gmailPanel.ts`, pure)

```text
GmailPanelView = {
  keyStatus: "missing" | "invalid" | "ok",
  clientId: string | null, secretSaved: boolean,
  state: "none" | "key_changed" | "connected" | "needs_reconnect",
  message: string | null,    # the contract's fixed text for this state, or null
  offers: Array<"save" | "connect" | "check" | "disconnect" | "replace" | "clear">,
  email, connectedAt, reason,
  canConnect: boolean,       # key ok, credentials saved, not key_changed, request host loopback
  connectHint: string | null # e.g. "Open Settings at http://localhost:8080 to connect"
}
```

It is built from the row, the key status, `keyChanged` (true when the stored client secret won't open with the key) and the request host. It never carries secrets.

## Config

`config.json` gains `gmail.alert_senders: string[]`. Each entry is an email address or a domain,
with no quotes or spaces, and the default is the list in research R6.

## Service dependencies (`src/gmail/connection.ts`)

`GmailDeps = { gmail: GmailStore; key: Buffer; google?: GoogleFactory }`. It is the first argument
of every service function, which keeps each one within eslint's 3-parameter limit. The web layer
builds it from `getUiState()`, which returns `gmail` and the key status.
