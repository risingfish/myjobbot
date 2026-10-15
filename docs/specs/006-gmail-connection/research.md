# Research: Gmail connection panel

## R1. OAuth and Gmail client library (owner decision)

- **Decision**: `google-auth-library@11.3.0`, exact pin. It is installed with the lockfile splice
  (npm/cli#4828), keeping the 15 `@rolldown/binding-*` entries. We use only `OAuth2Client`:
  - `generateAuthUrl` (`access_type: "offline"`, `prompt: "consent"`, PKCE S256)
  - `getToken({ code, codeVerifier, redirect_uri })`
  - `setCredentials({ refresh_token })`
  - `request()` for Gmail REST calls, which refreshes the access token itself
  - `revokeToken()`
- **Rationale**: the owner chose it on 2026-10-15 from three options. It is Google's maintained
  client, handles refresh and PKCE, and is much smaller than `googleapis`.
- **Alternatives**:
  - Plain `fetch` (recommended, not chosen): no dependency, about 150 lines of our own.
  - `googleapis`: about 100 MB, far more than needed.
- **Risk, dependencies**: it pulls in `gaxios`, `gcp-metadata` and `jws`. We never call the
  metadata server (no ADC). The Next.js bundling of this package is checked in sitting S2 (as
  mysql2 was in 004).
- **Risk, error contents**: the library's HTTP errors (`GaxiosError`) carry the request config,
  and for the token exchange that includes `client_secret`, `code` and `code_verifier`.
  - Every call in `src/gmail/google.ts` therefore catches and rethrows `GoogleError(code)`. A
    pure `googleErrorCode(err)` takes only the response body's string `error` field
    (`invalid_grant`, `invalid_client`, `access_denied`, …). An HTTP 401 without one (Gmail's
    `{ error: { code: 401 } }`) maps to `invalid_grant`, a network failure to `network`, and
    anything else to `unknown`.
  - Neither the original error nor its message is logged or rethrown.

## R2. OAuth client type and redirect

- **Decision**: the owner creates a **Desktop app** OAuth client. The redirect URI is
  `http://localhost:<port>/settings/gmail/callback` (or `127.0.0.1`), taken from the request's
  host, and connecting is allowed only when that host is loopback.
- **Rationale**: Google accepts loopback redirects on any port for Desktop clients without
  registering them. Private LAN addresses are never accepted, so the panel must tell the owner to
  connect through `localhost` (SSH tunnel `-L 8080:localhost:8080`).
- **Note**: the loopback check is a usability guard, not a security control. It reads the `Host`
  header, which a LAN client can set to `localhost:8080` (when `MYJOBBOT_HOSTS` lists it, as it must for the tunnel). Doing so
  only connects whichever Google account *they* approve, which falls under the LAN risk the owner
  accepted in the spec.
- **Alternatives**:
  - A "Web application" client: also works with a registered `http://localhost:8080/...`, but must
    be registered exactly.
  - The device flow: Gmail scopes aren't allowed in it.

## R3. Scope

- **Decision**: `https://www.googleapis.com/auth/gmail.readonly` only.
- **Where it lives**: in `authUrlOptions()` in `src/gmail/connectRequest.ts`, which is
  unit-tested (FR-003). `authUrlOptions` returns the plain string `"S256"`. `google.ts` passes the result to
  `generateAuthUrl`, swapping in the library's `CodeChallengeMethod.S256` enum, which is what its
  types require; `connectRequest.ts` stays free of library imports.
- **Rationale**: the narrowest scope that allows the `q` search. `gmail.metadata` forbids `q`. The
  address comes from `users/me/profile` under the same scope, so `openid`/`email` aren't needed.
- **Note**: `gmail.readonly` is a restricted scope. An unverified personal app works, with a
  warning. In "Testing" status, refresh tokens expire after 7 days (spec assumption).

## R4. Sealing secrets

- **Decision**: AES-256-GCM with `node:crypto`.
  - The key comes from `MYJOBBOT_SECRET_KEY`: 32 bytes, base64. Generate it with
    `openssl rand -base64 32`.
  - The stored form is `v1.<base64url(iv 12 bytes)>.<base64url(ciphertext)>.<base64url(tag)>`.
  - The AAD is the field's name (`client_secret`, `refresh_token`, `code_verifier`), so a sealed
    value can't be moved to another field.
  - If opening fails, it is reported as "key changed or data damaged", never with any part of the
    value.
- **Rationale**: built-in, authenticated, no dependency. GCM detects a wrong key.
- **Alternatives**: libsodium (a new dependency); MariaDB `AES_ENCRYPT` (the key would travel in
  SQL and could appear in the server's logs).

## R5. Connect request (state + PKCE)

- **Decision**:
  - `startConnect` creates `state` (32 random bytes, base64url) and a PKCE verifier. It stores
    `{ state, sealed verifier, created_at }` and returns Google's URL.
  - The callback route calls `takeConnectRequest(state)`, which reads it with `SELECT … FOR UPDATE`
    and deletes it, in one transaction. A missing request, or one older than 10 minutes, is
    refused.
  - Requests older than 10 minutes are pruned on every start.
- **Rationale**: single-use and time-boxed (FR-006). It works across tabs. The verifier never
  leaves the server.

## R6. "Check now" counting

- **Decision**:
  - The query is `from:(a OR b OR …) newer_than:7d`, built from `gmail.alert_senders`. Senders are
    validated as email addresses or domains, and quotes are refused.
  - The count comes from paging `users/me/messages?q=…&maxResults=500` (ids only) until there is
    no `nextPageToken`. `resultSizeEstimate` isn't used, because it's an estimate (SC-004).
  - The newest 5 are fetched with `format=metadata&metadataHeaders=From,Subject,Date`.
- **Default senders**: `jobalerts-noreply@linkedin.com`, `jobs-noreply@linkedin.com`,
  `alert@indeed.com`, `donotreply@jobalert.indeed.com`.

## R7. Connection state transitions

| From | Event | To |
|---|---|---|
| none / needs_reconnect | callback succeeds | connected |
| connected | Google returns `invalid_grant` (including a 401) | needs_reconnect (reason: revoked or expired; the sealed token is kept so a later disconnect can still try to revoke) |
| connected / needs_reconnect | key can't open the sealed token | needs_reconnect (reason: server key changed) |
| any | disconnect | none (token deleted; revoke attempted, and skipped when the token won't open) |
| any | clear credentials | none (disconnect first whenever a token is stored, then credentials deleted) |
| any | replace credentials | none (disconnect first whenever a token is stored, then the new credentials saved) |
| any (key set) | the stored client secret won't open (checked on every Settings load) | key_changed in the view; the owner enters the secret again |

## R8. Where the web layer calls it

- **Decision**:
  - Server actions in `web/lib/gmailActions.ts` call `src/gmail/connection.ts` with the cached
    stores from `uiState`.
  - `startConnect` returns the URL, and the action calls `redirect(url)`.
  - The callback is a route handler (`GET /settings/gmail/callback`) that redirects to
    `/settings?gmail=<outcome>`. The outcome is one of `connected`, `denied`, `refused`,
    `bad_client`, `key_changed` or `failed`; it is a code, never a message from Google.
- **Plain messages**: the panel maps each code to a fixed phrase:
  - `connected`: "Connected."
  - `denied`: "Access was not granted."
  - `refused`: "That sign-in link expired or was already used; try again."
  - `bad_client`: "Google rejected the client ID or secret."
  - `failed`: "Google sign-in failed; try again."
  - `key_changed`: "Server key changed; enter the client secret again."
  - `key_not_set`: "Set MYJOBBOT_SECRET_KEY first."
  - `not_loopback`: "Open Settings at http://localhost:8080 to connect."
  - `no_credentials`: "Save the client ID and secret first."

  The last three come from `connectGmail` refusing before Google is involved. It's a plain form
  action with no return value to show, so it redirects with a code like the callback does.

  `bad_client` comes from `invalid_client` / `unauthorized_client`.
- **Rationale**: matches the existing actions pattern; no client JavaScript holds secrets.

## R9. Rollback and the schema step

- **Finding** (checked in `node_modules/kysely/dist/migration/migrator.js`): the migrator throws
  `corrupted migrations: previously executed migration 002_gmail is missing` when the database
  records a step the code doesn't have. Reverting the merge alone would therefore stop both the
  agent and the web app from starting.
- **Decision**: there are two ways to roll back:
  - Revert the code but keep `src/db/migrations/002_gmail.ts` and its `index.ts` entry. The
    tables are harmless.
  - Or revert everything, then run `DELETE FROM kysely_migration WHERE name = '002_gmail'` and
    `DROP TABLE gmail_connect_requests, gmail_connection` on `myjobbot`.
