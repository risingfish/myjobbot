# Research: Gmail connection panel

Revised 2026-10-15: the owner switched from Google sign-in (OAuth) to a Gmail app password over
IMAP, which needs no Google Cloud project. The OAuth version, sittings S1–S4, is in git history
on this branch; R8 lists what the rework removes.

## R1. IMAP client library (owner decision)

- **Decision**: `imapflow@2.3.0`, exact pin, MIT. Its own dependencies are exact pins too (pino,
  libmime, libqp, libbase64, iconv-lite, encoding-japanese, socks, @zone-eu/mailsplit). It needs
  Node ≥ 20 (we run 24).
- **Why 2.3.0**: 2.4.3 was published the same day as the choice, 2.4.1 and 2.4.2 the day before.
  2.3.0 (2026-10-08) is a week old, outside the riskiest window for a compromised release.
- **Alternatives presented**:
  - `imap` / `node-imap`: callback style, last released in 2022, floor-only transitive pins.
  - Our own IMAP over `node:tls`: no dependency, but we'd own a parser for untrusted server
    responses.
- **Logging**: imapflow logs through pino by default, and its debug output can include protocol
  lines. It is always created with `logger: false`, so nothing it sees reaches a log.

## R2. Reading the mailbox

- **Server**: `imap.gmail.com:993`, TLS (`secure: true`), `auth: { user, pass }`.
- **Mailbox**:
  - The folder with the special-use flag `\All` (Gmail's "All Mail", whose name depends on the
    account's language), found with `list()`. Using it means alerts that were archived or
    labelled still count.
  - If no folder has `\All`, `INBOX` is used.
  - It is opened with `getMailboxLock(path, { readOnly: true })` (IMAP `EXAMINE`), so nothing can
    be flagged, moved or deleted.
- **Search**: Gmail's own search through IMAP's `X-GM-RAW` (imapflow's `gmraw` key), with the same
  query as the web search: `from:(a OR b …) newer_than:7d`. The search returns every matching UID
  in one reply, so there is no paging; the count is its length (SC-004).
- **Newest five**: the five highest UIDs, fetched with `envelope: true` (from, subject, date only;
  no bodies), then ordered by date, newest first.
- **Sign-out**: `logout()` in `finally`, so a failed check never leaves a session open.

## R3. Connecting is a verified sign-in

- **Decision**: Connect signs in (connect, then logout) with the typed address and app password.
  Only if that succeeds is the pair stored, sealed, with status `connected`. A failure stores
  nothing.
- **Spaces**: the app password has every space removed first, since Google displays it in groups
  of four.
- **Validation**: the address is 3–320 characters and must contain `@`; the app password, after
  removing spaces, is 1–64 characters.

## R4. Sealing secrets

- **Decision**: unchanged from the OAuth version. AES-256-GCM with `node:crypto`, key
  `MYJOBBOT_SECRET_KEY` (32 bytes, base64), stored as `v1.<iv>.<ct>.<tag>`. The AAD is the field
  name; the only sealed field is now `app_password`. Opening with the wrong key throws `SealError`,
  which never includes the value.

## R5. Errors from Gmail

- **Decision**: every IMAP call goes through `guarded()`, which rethrows `GmailError(code)`. The
  code comes from a pure `imapErrorCode(err)`:
  - `bad_login`: imapflow sets `authenticationFailed`
  - `unreachable`: a network error code (`ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`,
    `ECONNRESET`, `EAI_AGAIN`), or a connection that closed before sign-in
  - `unknown`: anything else
- **Why**: imapflow's errors carry `responseText` and the server's reply, which can echo the
  username. Only the code ever leaves `src/gmail/`.
- **Messages**:
  - `bad_login`: "Gmail rejected the address or app password."
  - `unreachable`: "Gmail couldn't be reached; try again."
  - `unknown`: "Gmail sign-in failed; try again."

## R6. Connection state transitions

| From | Event | To |
|---|---|---|
| none / needs_reconnect | Connect with a working pair | connected (new address and password, `connected_at` now) |
| any | Connect with a pair Gmail rejects or can't check | unchanged (nothing stored) |
| connected | Check now and Gmail rejects the password | needs_reconnect (reason "app password rejected; create a new one") |
| connected | the stored password won't open (checked on every Settings load and on Check now) | key_changed in the view; on Check now, needs_reconnect (reason "server key changed") |
| any | Disconnect | none (address and password deleted) |

## R7. Schema and rollback

- **Rewriting the step**: `002_gmail` never reached production, so it is rewritten in place:
  one table, `gmail_connection`. `myjobbot_test` ran the OAuth version, so S5 resets it by
  dropping `gmail_connection`, `gmail_connect_requests` and the `002_gmail` row in
  `kysely_migration`. The migrate test then recreates it.
- **Rollback after the merge**: as before. A plain revert fails at startup with Kysely's
  "corrupted migrations: previously executed migration 002_gmail is missing". Either keep
  `002_gmail.ts` and its `index.ts` entry, or delete its `kysely_migration` row and run
  `DROP TABLE gmail_connection`.

## R8. What the rework removes

- the `google-auth-library` dependency
- `src/gmail/google.ts`, `src/gmail/googleErrors.ts`, `src/gmail/access.ts` and
  `src/gmail/connectRequest.ts` (PKCE, the loopback check)
- `web/lib/gmailConnect.ts`
- the callback route `web/app/settings/gmail/callback/route.ts` and its `knip.json` entry
- `src/web/gmailOutcomes.ts`, the `?gmail=` codes
- the `gmail_connect_requests` table
- the client-ID fields

The SSH tunnel is no longer needed: IMAP works from any address.

## R9. Web layer

- **Actions** (`web/lib/gmailActions.ts`):
  - `connectGmail(previous, form)`: `useActionState`; verifies, then saves, and returns
    `{ ok, error }`.
  - `checkGmail()`: the count and the newest five, or a reason.
  - `disconnectGmail()`.

  Every action first refuses unless the key status is ok.
- **Panel**: a server component that renders the view's `message` and `offers`, with client
  components for the form (`ConnectForm.tsx`), Check now (`CheckNow.tsx`) and Disconnect
  (`DisconnectButton.tsx`).

## R10. Default alert senders

`jobalerts-noreply@linkedin.com`, `jobs-noreply@linkedin.com`, `alert@indeed.com` and
`donotreply@jobalert.indeed.com`, in `config.json` under `gmail.alert_senders`. Each entry must be
an email address or a domain (no quotes, spaces, brackets or leading `-`), so it can't change the
meaning of the search.
