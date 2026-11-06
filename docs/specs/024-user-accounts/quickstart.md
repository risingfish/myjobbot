# Quickstart: validating user accounts (024)

Each section proves part of the spec end to end. Contracts: [web](contracts/web.md),
[CLI, env, mail](contracts/cli-env-mail.md); tables: [data-model](data-model.md).

## 1. Setup

- `.env` gains `MYJOBBOT_BASE_URL=http://localhost:8080` and the SMTP block (a real mail server; a
  Gmail address with an app password works: `smtp.gmail.com`, 587). Never print `.env`.
- Open the UI at **http://localhost:8080**, not a LAN name: sign-in cookies and hardware keys need
  HTTPS or localhost (research R3).
- `npm ci` after the dependency sitting, `docker compose build`, `npm run check`, `npm run check:db`.

## 2. First admin and the gate (US1)

1. `npm start -- account init you@example.com`, type a password twice → `ready`.
2. Run it again → `user 1 already has an email`, exit 1.
3. Open `/recommended` signed out → sent to `/sign-in?next=%2Frecommended`; sign in → back on
   Recommended.
4. `curl -i http://localhost:8080/api/rescores/1` → 401.
5. Wrong password five times, then the right one → refused, same message (SC-007); a security
   notice email arrives (from S3 on, once mail and notices exist).
6. Signed out, `/sign-in` shows no navigation and no database label in the footer.
7. `npm start -- eval check` runs with no sign-in (FR-004).
8. No job data before sign-in (FR-053): signed out, `curl -si http://localhost:8080/recommended`
   → 303 to `/sign-in?next=%2Frecommended` with an empty body; `curl -si -H 'RSC: 1'
   http://localhost:8080/jobs` → the same; `curl -si http://localhost:8080/api/rescores/1` → 401
   `Signed out`. None holds a job title, score, setting or the database name.
9. Signed in, `curl -sI` a page with your session cookie shows `Cache-Control: private, no-store`.
   Sign out, press Back → the sign-in page, no jobs shown.
10. Signed in on Recommended in two tabs, sign out in one, then in the other press Load more, open a
    job's panel and start a re-score → each takes that tab to `/sign-in?next=%2Frecommended` with no
    new rows, panel or log lines.

## 3. CSRF and headers (SC-009, SC-010)

1. From a page on another origin (e.g. `python3 -m http.server 9000` serving a form that posts to
   `http://localhost:8080/account`), submit while signed in → 403, nothing changes.
2. `curl -i -X POST -H 'Origin: http://evil.test' http://localhost:8080/sign-in` → 403.
3. `curl -sI http://localhost:8080/sign-in` shows `Content-Security-Policy` with `frame-ancestors
   'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`;
   `curl -sI http://localhost:8080/link` shows `Referrer-Policy: no-referrer` and
   `Cache-Control: no-store`.
4. An `<iframe src="http://localhost:8080/sign-in">` on another origin stays blank.
5. `/sign-in?next=//evil.test` and `?next=https://evil.test` → land on `/` after sign-in (SC-012).
6. Signed in, open a link to `http://localhost:8080/recommended` from a page on another origin (or
   from your mail), then hide a job → it saves (the CSRF cookie was rebound, research R4).

## 4. Invite and create (US2)

1. Settings → Admin → Make account creation code → copy it (shown once, expiry 7 days).
2. In a private window, `/create-account` with a weak password → rule shown, code still works.
3. Valid form → signed in on `/account`; the account-created email arrives.
4. Same code again → "That account can't be created…"; an existing email + a fresh code → same
   message, code unspent, and that address gets the "someone tried" email.
5. As the new user, Settings has no Admin section. As admin, Make admin on them; as them, Remove
   admin on your own row → done, you stay signed in (this sign-in is replaced). As the first admin,
   now the only admin again, Remove admin on your own row → `last_admin`, refused.

## 5. Account tab, step-up and email (US3, US4)

1. Change name → shown in the header.
2. Wait 10 minutes (or sign in > 10 min ago), change password → "Confirm it's you" first; after,
   the other browser is signed out.
3. Untick Password while it's the only usable way → `last_way` message.
4. Tick Email link → Send test email → arrives. Sign out, request a link → open it: the page shows
   a button and the address bar no longer holds the token; press → signed in. Open it again →
   expired. Have a mail scanner/preview open the link first → still works (SC-011).
5. Change email → confirm link to new address; old address gets the notice. Asking to change to
   another account's address gives the same "on its way" message and sends nothing. Open the confirm
   link from the mail app in the browser that's signed in → it works (no 403).
6. Untick Password so the email link is the only usable way, wait 10 minutes, then tick Password
   again → "Confirm it's you" → "Email me a confirmation link" → open it in this browser → press
   the button → back on Account; tick Password again → it goes through. A second confirmation link
   opened in a private window → "Open this link in the browser where you asked for it."
7. Comment out the SMTP block and restart `npm run web`: on the sign-in page, "Email me a link" and
   "Forgot password" answer "Email isn't set up on this server." for your email and for an unknown
   one alike; restore the block.

## 6. Authenticator and recovery (US5, US7)

1. Tick Authenticator app → scan the QR in a real app → enter a code → ready; ten recovery codes
   shown once.
2. Sign in with email + app code; reuse the same code within its 30 s → refused.
3. Sign in with a recovery code → works once; Account shows 9 left.
4. Forgot password → reset link (30 min) → set the new password → you're not signed in, and every
   other browser is signed out; sign in with the new password → works.

## 7. Hardware key (US6)

On localhost with a YubiKey (or the browser's virtual authenticator in DevTools → WebAuthn):
add "Blue key", sign out, sign in with it, delete it → its sign-in is refused.

## 8. Secrets never stored or shown (SC-008)

`SELECT` from `sign_in_methods`, `recovery_codes`, `email_tokens`, `account_codes`, `sessions`:
only digests and sealed text. `grep` the web logs and `data/runs/*.jsonl` for a password and a code
you used → no match. The pages render with the CSP on and no console CSP errors (research R7).
After `scripts/copy-prod.sh myjobbot_dev` (once production has `018_accounts`), `sessions`,
`email_tokens`, `auth_challenges`, `auth_attempts` and `account_codes` are empty in `myjobbot_dev`,
and the accounts and their ways of signing in are there (research R19).
