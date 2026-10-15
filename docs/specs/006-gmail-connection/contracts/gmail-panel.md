# UI contract: Settings → Gmail panel

## States

| State | Shows (`view.message` / content) | Actions (`view.offers`) |
|---|---|---|
| Key missing | "Set MYJOBBOT_SECRET_KEY in .env, then recreate the containers (docker compose up -d) or restart the dev server, to use Gmail." | none |
| Key invalid | "MYJOBBOT_SECRET_KEY is invalid: it must be 32 bytes in base64 (openssl rand -base64 32). Fix it, then recreate the containers (docker compose up -d) or restart the dev server." | none |
| Key changed | "Server key changed; enter the app password again", with the fields | connect |
| Not connected | "Not connected", with the address and app password fields | connect |
| Connected | "Connected as <email> since <time>" | check, disconnect, replace |
| Needs reconnecting | "Needs reconnecting: <reason>", with the fields | connect, disconnect |

- **connect**: a Gmail address field and an app password field (`type=password`,
  `autocomplete=off`, always empty when rendered), plus Connect.
- **replace**: the same fields inside a closed `<details>` named "Use a different account or app
  password".

No page or action response contains the app password, sealed or not.

## Server actions (`web/lib/gmailActions.ts`)

Every action first refuses with `{ ok: false, reason: "Set MYJOBBOT_SECRET_KEY first." }` unless
the key status is ok, because server actions can be called without the UI.

| Action | Input | Result |
|---|---|---|
| `connectGmail` | `useActionState`, FormData: `email` (3–320 chars, contains `@`), `app_password` (1–64 chars after removing spaces) | `{ ok: true, error: null }` after a verified sign-in and save, or `{ ok: false, error }` with a fixed message; nothing stored on failure |
| `checkGmail` | none | `{ ok: true, count, newest: [{from, subject, date}] }`, or `{ ok: false, reason }`. It refuses without calling Gmail unless the status is connected. |
| `disconnectGmail` | none (the confirmation happens client-side) | `{ ok: true }`; the address and password are deleted |

The Disconnect confirmation says "Disconnect Gmail? myjobbot will forget the app password. To
revoke it, also delete it at https://myaccount.google.com/apppasswords." Afterwards the
not-connected message links to the same page.
