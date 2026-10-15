# UI contract: Settings → Gmail panel

## States

| State | Shows (`view.message` / content) | Actions (`view.offers`) |
|---|---|---|
| Key missing | "Set MYJOBBOT_SECRET_KEY in .env, then recreate the containers (`docker compose up -d`) or restart the dev server, to use Gmail" | none |
| Key invalid | "MYJOBBOT_SECRET_KEY is invalid: it must be 32 bytes in base64 (`openssl rand -base64 32`)", then the same restart note | none |
| Key changed | "Server key changed; enter the client secret again", with the client ID and secret fields | Save |
| No credentials | Client ID and client secret fields | Save |
| Not connected | Client ID, "secret saved", and the connect hint when not on localhost | Connect Gmail (disabled off loopback), Replace credentials, Clear credentials |
| Connected | "Connected as <email> since <time>" | Check now, Disconnect, Replace credentials, Clear credentials |
| Needs reconnecting | the reason | Connect Gmail, Disconnect, Replace credentials, Clear credentials |

"Replace credentials" opens the client ID and secret fields with Save. Saving or clearing
credentials while a token is stored (connected or needing to reconnect) disconnects first, which
asks Google to revoke it, so no grant is left behind. After a key change the token can't be
opened, so the revoke is skipped and only the stored token is deleted.

The panel renders only the view (`src/web/gmailPanel.ts`): `message`, `offers` (a subset of
`save`, `connect`, `check`, `disconnect`, `replace`, `clear`), the email and the times. Times are
stored as ISO UTC and shown as `YYYY-MM-DD HH:mm` in the server's `TZ`.

The client secret field is always empty when rendered (`type=password`, `autocomplete=off`). No
page or action response contains a secret, a token or a verifier.

## Server actions (`web/lib/gmailActions.ts`)

Every action first refuses with `{ ok: false, reason: "key not set" }` unless the key status is
ok, because server actions can be called without the UI.

| Action | Input | Result |
|---|---|---|
| `saveGmailCredentials` | FormData `client_id` (1–255 chars), `client_secret` (1–255) | disconnects first if connected; panel re-renders; invalid input gives a field message |
| `clearGmailCredentials` | none | disconnects first if connected; state none |
| `connectGmail` | none (host taken from request headers) | `redirect(googleUrl)`, or `redirect("/settings?gmail=<code>")` with `key_not_set`, `not_loopback`, `no_credentials` or `key_changed` |
| `checkGmail` | none | `{ ok: true, count, newest: [{from, subject, date}] }`, or `{ ok: false, reason }`. It refuses on the server, without calling Google, unless the state is connected. |
| `disconnectGmail` | none (the confirmation happens client-side) | `{ revoked: boolean }`; the token is deleted either way |

## Route `GET /settings/gmail/callback?state=…&code=…` (or `&error=…`)

- `error` is present: redirect to `/settings?gmail=denied`.
- The state is unknown, used or older than 10 minutes: `/settings?gmail=refused`, with no change.
- Google rejects the client (`invalid_client` / `unauthorized_client`): `/settings?gmail=bad_client`,
  with no change.
- The stored client secret won't open (the key changed): `/settings?gmail=key_changed`, with no
  change.
- Any other token exchange or profile failure: `/settings?gmail=failed`, with no change.
- Success: the token is stored sealed, the email is saved, and the redirect is
  `/settings?gmail=connected`.

The panel maps `?gmail=` (one of `connected`, `denied`, `refused`, `bad_client`, `key_changed`,
`failed`, `key_not_set`, `not_loopback`, `no_credentials`; anything else is ignored) to the fixed phrases in research R8. The query value is never echoed.
Google's own error text never reaches the browser, logs or the database (research R1).
