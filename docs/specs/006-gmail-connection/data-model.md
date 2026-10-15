# Data Model: Gmail connection panel

Migration step `src/db/migrations/002_gmail.ts`, rewritten for IMAP before it reached
production (research R7). The table is `utf8mb4_bin`, like `001_initial`.

## `gmail_connection`: at most one row

| Column | Type | Rule |
|---|---|---|
| `id` | `TINYINT` PK | always 1 |
| `email` | `VARCHAR(320)` NULL | the Gmail address, as entered (trimmed) |
| `app_password` | `TEXT` NULL | **sealed** (AAD `app_password`); never leaves the server |
| `connected_at` | `VARCHAR(32)` NULL | ISO time, UTC, when the pair was verified and saved |
| `status` | `VARCHAR(20)` NOT NULL DEFAULT `'none'` | `none`, `connected` or `needs_reconnect` |
| `reason` | `VARCHAR(200)` NULL | a fixed phrase for `needs_reconnect`, never Gmail's raw text |

## `GmailStore` (`src/db/store.ts`)

```text
connection(): Promise<GmailConnectionRow | null>        # GmailConnectionRow is defined in src/db/store.ts
connected({ email, sealedPassword }, at): Promise<void> # upsert row 1: status connected, reason null
needsReconnect(reason): Promise<void>                   # keeps email and password
disconnect(): Promise<void>                             # email, password, connected_at null; status none
```

The store contract (`tests/helpers/gmailStoreContract.ts`) has three cases, run against the
memory fake and MariaDB:
1. connect, then connect again with another address: one row, with the second address
2. needing to reconnect keeps the address and the password, and sets the reason
3. disconnect clears the address, password and time, and sets the status to none

## Panel view (`src/web/gmailPanel.ts`, pure)

```text
GmailPanelView = {
  keyStatus: "missing" | "invalid" | "ok",
  state: "none" | "key_changed" | "connected" | "needs_reconnect",
  message: string | null,    # the contract's fixed text for this state, or null
  offers: Array<"connect" | "check" | "disconnect" | "replace">,
  email: string | null, connectedAt: string | null, reason: string | null,
}
```

It is built from the row, the key status and `keyChanged` (true when the stored password won't
open with the key). It never carries a secret. Times are shown as `YYYY-MM-DD HH:mm` in the
server's `TZ`.

## Service dependencies (`src/gmail/connection.ts`)

`GmailDeps = { gmail: GmailStore; key: Buffer; imap?: ImapFactory }`. It is the first argument of
every service function, which keeps each one within eslint's 3-parameter limit. The web layer
builds it from `getUiState()`.

## Config

`config.json` gains `gmail.alert_senders: string[]`. Each entry is an email address or a domain,
and the default is the list in research R10.
