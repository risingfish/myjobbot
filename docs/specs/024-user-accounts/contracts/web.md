# Contract: web pages, actions and the gate (024)

## Gate (`web/proxy.ts`, every request, in order)

1. Host must be in `MYJOBBOT_HOSTS` (existing) → else 421.
2. `MYJOBBOT_BASE_URL` (read after `loadRepoEnv()`) must parse (research R3) → else **500**, body
   the fixed `base_url` text, logged once.
3. Make a CSP nonce; set the security headers (research R7, per path) on the response and the same
   `Content-Security-Policy` on the request headers passed to Next (Next reads the nonce there).
4. Non-GET/HEAD: `Origin` = base origin, `Sec-Fetch-Site` (if sent) = `same-origin`
   (`originDecision`, before any session lookup) → else **403**, body `Forbidden`, nothing runs.
5. GET/HEAD under `/_next/static/` → pass now (no session lookup, no CSRF cookie). Otherwise, look
   up the session only when the session cookie is present.
6. Non-GET/HEAD: the strict CSRF cookie present and (with a session) its digest =
   `sessions.csrf_digest` → else **403**.
7. GET without the CSRF cookie: no valid session → set a new one; a valid session (a cross-site
   arrival, research R4) → set a new one and rebind `sessions.csrf_digest` to it
   (`SessionStore.rebindCsrf`) in the same step.
8. Public paths: `/sign-in`, `/create-account`, `/link`, and GET/HEAD under `/_next/` → pass. A
   server action (a request with the `Next-Action` header) → pass on every path, with or without a
   session: `guarded` decides (below; research R5).
9. Valid session (not ended, `last_used_at` within 30 days) → touch (at most once a minute), pass.
   No account header is set; pages and actions read the session from the cookie
   (`web/lib/session.ts`).
10. No valid session → pages, including the app's in-page navigation and prefetch requests (`RSC`,
    `Next-Router-Prefetch` headers): **303** to `/sign-in?next=<path+query>` (Next's internal `_rsc`
    query left out) with an empty body; `/api/*`: **401** with the fixed body `Signed out`. No page
    or route code runs, so nothing is read (FR-053). Server actions never reach this step (step 8).
11. Every response that isn't a public page or a `/_next/static` file carries
    `Cache-Control: private, no-store` (FR-053).

Behind the proxy, every page's data loader (`getUiState`, `getSettingsState`, the Account page's
loader) calls `requireSession()` (`web/lib/session.ts`) before it opens the stores, redirecting to
`/sign-in?next=…` without one, so a page never reads job data before the sign-in is confirmed even
if the proxy's matcher were wrong.

Server actions pass the gate's session step because Next's client follows only a redirect the
action itself answers, and turns a 401 into a thrown error that leaves the tab on its page; action
ids aren't tied to a path either. `guarded` is the check that decides for every action (below).

`next` is honoured only when `safeReturnPath(next)` accepts it: starts with a single `/`, no `//`,
no `\`, no scheme, no control characters after decoding once, at most 512 characters; else `/`
(FR-044).

## Layouts

- `web/app/layout.tsx`: `<html>`, `<body>`, styles, metadata and `dynamic = "force-dynamic"` only
  (every page renders per request, so every page gets the CSP nonce).
- `web/app/(app)/layout.tsx`: the header (navigation, Sign out, the signed-in account's name) and
  the footer (database label), around every signed-in page (`recommended`, `applied`, `jobs`,
  `reasoning`, `settings`, `account`; URLs unchanged).
- `web/app/(public)/layout.tsx`: the app name only, no navigation, no database label, around
  `sign-in`, `create-account` and `link`.
- `web/app/error.tsx`: the fixed `page_failed` message only; details go to the server log (FR-052).
  It and `web/app/not-found.tsx` stay outside both groups and show no navigation (accepted).

## Pages

| Path | Who | Shows |
|---|---|---|
| `/sign-in` | public | Email, then the ways: Password · Email me a link · Hardware key · Authenticator code · Recovery code; "Forgot password"; link to Create account. Signed in → redirect to `/` |
| `/create-account` | public | Email, Name, Password (with the rule shown), Account creation code |
| `/link` | public | Reads `#p=signin\|reset\|email_change\|step_up&t=…`, clears it, shows one button ("Sign in", "Set new password" form then a "Sign in" link, "Confirm new email", "Confirm it's you"); `Referrer-Policy: no-referrer`, `Cache-Control: no-store` |
| `/account` | signed in | Name; Email (pending change shown); Ways of signing in (four rows); Recovery codes (count, Make new codes); Sign out everywhere else; Recent security events (20); data from `getAccountState()` (`web/lib/accountState.ts`, which calls `requireSession()` first); `Cache-Control: private, no-store` from the gate |
| `/settings` | signed in | as today, plus **Admin** section for admins: Make account creation code; Accounts list (name, email, admin, Make admin / Remove admin, their own row included, Change email) |

Nav gains **Account** (after Settings) and a **Sign out** button (`SignOutButton`, a form POST, so
CSRF applies).

## Server actions

Every action is wrapped by `guarded(fn, { public?, admin?, stepUp? })` (`web/lib/guard.ts`); a
test imports every `"use server"` module in `web/lib/` and fails on a runtime export without the
guard's marker (type exports, such as `sourceActions.ts`'s `SwitchResult`, are erased and not
counted). Inputs of the new actions are zod-checked before anything else; their answers are
`{ ok: true, … } | { ok: false, message }` with `message` from `MESSAGES`
(`src/accounts/messages.ts`). The existing actions (`actions.ts`, `gmailActions.ts`,
`resumeActions.ts`, `settingsActions.ts`, `sourceActions.ts`) are wrapped with `{}`. For every
action that isn't `public`, new or existing, a missing or ended session makes `guarded` call Next's
`redirect()` to `/sign-in?next=<page>` (the page from the same-origin
`Referer`, through `safeReturnPath`) before the action's code runs, so the browser goes to the
sign-in page and the action returns no data; `redirect()` throws, so the existing actions' answer
types and callers don't change. The admin and step-up refusals of the new actions still answer
`{ ok: false, … }`.

| Action | Guard | Notes |
|---|---|---|
| `signInWithPassword({ email, password, next })` | public, limited | same answer + timing for every failure (R9) |
| `requestSignInLink({ email })` | public, limited | `link_sent` for every email; `mail_off` for every email when mail isn't set up (owner, 2026-11-06) |
| `spendEmailLink({ token, purpose, password? })` | public | `reset` checks the new password against the rule before spending the token, then ends every session and signs no one in; `step_up` spends only with the asking session's digest in the statement and answers `{ ok: true, next }`, and from another browser answers `step_up_other_browser` with the token unspent; spends the token in one statement |
| `startKeySignIn({ email })` / `finishKeySignIn({ email, response })` | public, limited | challenge 5 min, once |
| `signInWithAuthenticator({ email, code })` | public, limited | step reuse refused |
| `signInWithRecoveryCode({ email, code })` | public, limited | spends one code |
| `requestPasswordReset({ email })` | public, limited | same answers as the link request (`link_sent`, or `mail_off` without mail) |
| `createAccount({ email, name, password, code })` | public, limited by address | one message for bad/expired/spent code and taken email |
| `signOut()` | session | ends this session, clears cookies, 303 `/sign-in` |
| `signOutEverywhereElse()` | session, step-up | |
| `saveName({ name })` | session | |
| `requestEmailChange({ email })` | session, step-up, limited | answers `email_change_sent` alike for a free address and one another account uses, and mails the confirmation only to a free one; nothing changes yet; `email_unchanged` for the current address; `mail_off` without mail |
| `changePassword({ current, next })` | session, step-up | ends other sessions, rotates this one |
| `setMethodEnabled({ kind, enabled })` | session, step-up | refuses leaving no usable way; enabling a not-ready way answers `{ ok, setup: kind }` |
| `sendTestEmail()` | session, limited | |
| `requestStepUpLink({ returnPath })` | session, limited | mails a `step_up` link (15 min) bound to this session; `mail_off` without mail |
| `startKeyRegistration({ name })` / `finishKeyRegistration({ name, response })` | session, step-up | name unique per account |
| `removeKey({ id })` | session, step-up | refuses removing the last usable way |
| `startAuthenticatorSetup()` → `{ qr, secret }` / `confirmAuthenticator({ code })` / `removeAuthenticator()` | session, step-up | first key/app setup also returns recovery codes once; `secret_key_missing` without a usable key; removal refuses leaving no usable way |
| `makeRecoveryCodes()` → `{ codes }` | session, step-up | replaces the set |
| `confirmIdentity({ method, … })` | session | step-up: password, app code, key or recovery code; sets `verified_at` (the emailed link is `requestStepUpLink`) |
| `makeAccountCode()` → `{ code, expiresAt }` | admin, step-up | shown once |
| `setAdmin({ userId, admin })` | admin, step-up | any account, the admin's own included; never removes the last admin's mark (`last_admin`); ends the target's sessions, or for the admin's own change rotates this session and ends the others |
| `adminChangeEmail({ userId, email })` | admin, step-up | at once; notice to old address |

A step-up refusal answers `{ ok: false, stepUp: true }`; the page opens the "Confirm it's you"
dialog and repeats the action after `confirmIdentity`. When the user picks "Email me a confirmation
link" instead, the action isn't repeated: after the link's button they return to the page and
repeat it.

## Route handler

`GET /api/rescores/[id]` (existing): behind the gate (401 without a session); read-only. An
`EventSource` can't see the status, so when the stream fails `useRescoreLog` sends one `HEAD` to
the same address; a 401 takes the browser to `/sign-in?next=<this page>`. The route exports its own
`HEAD`, answering 204 without opening the stores, because Next otherwise answers `HEAD` by running
`GET`, which would start following the run.

## Messages (fixed, `MESSAGES` in `src/accounts/messages.ts`)

- `signin_failed` "That didn't work. Check your details and try again."
- `link_sent` "If that address has an account with email links on, a link is on its way."
- `code_refused` "That account can't be created. Check the code and email."
- `password_rule` "Use 10 to 128 characters with a lowercase letter, an uppercase letter, a digit
  and a symbol."
- `email_invalid` "Enter a valid email address."
- `name_invalid` "Enter a name of 1 to 100 characters, with no line breaks."
- `key_name_invalid` "Give the key a name of 1 to 50 characters, with no line breaks."
- `key_name_taken` "Another of your keys has that name."
- `email_unchanged` "That's already your email."
- `email_taken` "That address can't be used."
- `email_change_sent` "If that address can be used, a confirmation link is on its way to it."
- `last_way` "Keep at least one way to sign in turned on and set up."
- `last_admin` "Keep at least one admin."
- `mail_off` "Email isn't set up on this server."
- `secret_key_missing` "Authenticator apps aren't available on this server."
- `step_up` "Confirm it's you to continue."
- `step_up_sent` "A confirmation link is on its way to your email."
- `step_up_other_browser` "Open this link in the browser where you asked for it."
- `link_expired` "That link has expired or was already used."
- `signed_out` "You're signed out. Sign in again."
- `page_failed` "Something went wrong loading this page. Try again."
- `base_url` "myjobbot: MYJOBBOT_BASE_URL is missing or not allowed (see .env.example)."
- `limited`: the same as `signin_failed` on sign-in forms; elsewhere "Too many tries. Wait a few
  minutes and try again."
