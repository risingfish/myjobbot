# Research: User accounts (024)

Each item: **Decision**, **Rationale**, **Alternatives considered**. Libraries were presented to the
owner with options and trade-offs and **approved on 2026-11-05** (constitution IV).

## R1. Libraries (approved)

| Job | Decision | Pin | Notes |
|---|---|---|---|
| Mail | nodemailer | `10.3.1` exact (ships its own types, `dist/cjs/nodemailer.d.ts`; no `@types/nodemailer`) | SMTP only; `requireTLS: true` (STARTTLS) or `secure: true` (465); no pooled transport |
| Password digest | `node:crypto` `argon2` (built in, no dependency) | Node ≥ 24.7 (image `node:24.21.0-alpine3.24`, local 24.7.0; checked it runs) | Marked experimental in Node 24: wrapped in one module (`src/accounts/passwordDigest.ts`) with a self-describing stored format, so a Node change touches one file; CLI already silences `ExperimentalWarning`; `next` processes get the same flag |
| Hardware keys | `@simplewebauthn/server` + `@simplewebauthn/browser` | `14.0.3` / `14.0.0` exact | Server checks challenge, origin, RP ID, user presence, counter; browser does `navigator.credentials` calls |
| Authenticator app | otpauth | `9.6.0` exact | `TOTP.validate({ token, window: 1 })` returns the step delta, used to refuse a reused step |
| QR code | qrcode | `1.5.4` exact (+ `@types/qrcode` `1.5.6` exact, dev) | `toDataURL` on the server; shown in an `<img>`; CSP allows `img-src data:` |

All installed through the lockfile with platform entries kept (the lockfile splice in the dev
workflow memory); `docker compose build` after the install, before the first import.

**Alternatives considered**: scrypt (stable, OWASP second choice), `@node-rs/argon2`, `argon2`
(native bindings); `@passwordless-id/webauthn`; built-in TOTP, otplib; uqr, no QR. Owner chose as
above.

## R2. Sessions: own module, stored server-side

**Decision**: a small session module of our own over `node:crypto`, following the shape of the
Lucia/Copenhagen Book guides: identifier = 32 random bytes (base64url), cookie holds the
identifier, `sessions` row keyed by its SHA-256 digest; 30-day sliding expiry, touched at most once
a minute; `verified_at` for step-up (FR-047). Rotation (FR-037) creates a new row and ends the old.

**Rationale**: the spec needs server-side, listable, endable sessions plus step-up and per-purpose
rotation. Auth.js's credentials provider can't use database sessions and its WebAuthn support is
experimental; iron-session is a sealed cookie (not endable server-side); Lucia is now a guide, not a
library. The module is ~100 lines of pure functions plus a store, all unit-testable.

**Alternatives considered**: Auth.js v5, iron-session, Lucia v3 (deprecated).

## R3. Cookies

**Decision**:
- `__Host-myjobbot_session`: `HttpOnly; Secure; Path=/; SameSite=Lax`; no `Domain`. Lax so an
  emailed link (a top-level visit) opens signed in when a session exists (FR-034).
- `__Host-myjobbot_csrf`: `HttpOnly; Secure; Path=/; SameSite=Strict`, a random value; see R4.
- On plain-HTTP local hosts (base URL scheme `http:` and host `localhost`/`127.0.0.1`) the
  `__Host-` prefix and `Secure` are dropped: Chrome and Firefox accept them on `http://localhost`
  but Safari doesn't, and dropping them there costs nothing. Any other `http:` base URL is refused
  (`MYJOBBOT_BASE_URL` must be `https:` or localhost).

**Rationale**: `__Host-` pins the cookie to the exact host over HTTPS with no `Domain`, so a sibling
host can't set or read it.

**Consequence for local dev**: none for the owner, who already opens the dev app at
`http://localhost:8080` (confirmed 2026-11-05). A Docker `web` service opened by a LAN name over
plain HTTP (`MYJOBBOT_HOSTS=myserver.lan:8080`) could not be signed into; `.env.example` and the
README say so.

## R4. Cross-site request forgery (FR-033 to FR-035)

**Decision**, three layers, all in `web/proxy.ts` before any page, action or route runs, plus a
fourth in every action:
1. **Method**: GET/HEAD never change anything (FR-035): every change is a server action or a POST;
   the one route handler (`/api/rescores/[id]`) answers only GET and HEAD and is read-only.
2. **Origin**: every non-GET/HEAD request must carry `Origin` equal to the origin of
   `MYJOBBOT_BASE_URL` (and `Sec-Fetch-Site`, when present, `same-origin`); otherwise 403. A missing
   `Origin` is refused too (every browser that matters sends it on POST).
3. **Strict-cookie token**: every non-GET/HEAD request must carry the `__Host-myjobbot_csrf` cookie
   (SameSite=Strict, so a request another site starts never has it), and that value's digest must
   equal the session row's `csrf_digest` when there is a session. On sign-in the value is replaced
   and bound to the new session (R2). A GET that lacks the cookie gets a new value: with no valid
   session, just the cookie; with a valid session (a top-level arrival from another site, such as
   an emailed link, where the Lax session cookie is sent but the Strict one isn't), the new value is
   also bound to the session in the same step (`SessionStore.rebindCsrf`). Without the rebind, the
   new cookie would no longer match `csrf_digest` and every later change from that browser would
   be refused. The rebind is safe: the other site can't read the new value, and the browser still
   won't send the Strict cookie on a request that site starts.
4. **Next.js's own action check** stays on (it compares `Origin` with the forwarded host); no
   `serverActions.allowedOrigins` widening.

**Rationale**: the strict cookie gives a per-browser secret no other site can make the browser send,
tied to the session, without threading a hidden token through every server action (which Next's
action calls don't support cleanly). Origin checking alone is OWASP's primary defence; the token is
its recommended second.

**Alternatives considered**: synchronizer token in a hidden field (every action and `useSave` call
would change); `SameSite=Strict` session cookie alone (breaks FR-034's emailed links).

## R5. The gate: proxy plus per-action checks

**Decision**: `web/proxy.ts` (Node runtime in Next 16) does, in order: host check (existing),
security headers and CSP nonce (R7), Origin (R4), then, except for GET/HEAD under `/_next/static/`
(which pass at once, with no session lookup and no CSRF cookie), the CSRF cookie (R4) and the
session: public paths (`/sign-in`, `/create-account`, `/link`, and GET/HEAD under `/_next/`) pass;
a server action (a request with the `Next-Action` header) passes on every path, public or not;
any other path without a valid session redirects to `/sign-in?next=<path>` (pages, in-page
navigation and prefetches; Next's internal `_rsc` query is left out of `next`) or answers 401
(`/api/*`). A valid session is touched; no account header is passed on, since every page and
action reads the session from the cookie itself (`web/lib/session.ts`).

Server actions pass the session step because Next's client can only follow a redirect the action
answers itself (`x-action-redirect`): it turns any other non-RSC answer, a 401 included, into a
thrown error (`next/dist/client/components/router-reducer/reducers/server-action-reducer.js`),
which would leave a signed-out tab on its page instead of taking it to sign-in (FR-053). Action ids
aren't tied to a path either, so `guarded` is the check that decides for every action. Every
server action is wrapped in `guarded(action, { public?, admin?, stepUp? })` (`web/lib/guard.ts`),
which re-reads the session from the cookie. A missing or ended session makes `guarded` call
`redirect()` to `/sign-in?next=<page>` (the page from the same-origin `Referer`, through
`safeReturnPath`) before the action's code runs, for every action that isn't `public` (owner,
2026-11-06, FR-053); `redirect()` throws, so the existing actions' answer types (`PageData`,
`SaveResult`, …) and callers don't change, and Next's router still makes the navigation when a
caller catches the rejection. The admin and step-up refusals of the new actions answer
`{ ok: false, message }` (or `stepUp: true`). Every page's data loader also calls
`requireSession()` before opening the stores, and every non-public response is
`Cache-Control: private, no-store`. Signed-out in-page navigation and prefetches get the proxy's
303 with an empty body; the re-score stream's hook checks for a 401 with one `HEAD` when the stream
fails, and the route answers `HEAD` itself (204, no stores opened), since Next otherwise answers
`HEAD` by running `GET` (`next/dist/server/route-modules/app-route/helpers/auto-implement-methods.js`),
which would start following the run. A test imports every `"use server"` module in `web/lib/` and
fails on a runtime export without the guard's marker (type exports are erased, so `export type`
lines are not counted; like `tests/toolDeclarations.test.ts`).

**Layouts**: the root layout holds only `<html>`, `<body>`, the styles, the metadata and
`dynamic = "force-dynamic"`, so every page, the public ones included, renders per request and gets
the CSP nonce (R7). Signed-in pages move into the `(app)` route group, whose layout shows the
header (navigation, Sign out, the account's name) and the footer (database label); the public
pages sit in `(public)`, whose layout shows the app name only, so nothing about the deployment
reaches a visitor who isn't signed in. URLs don't change. The root `error.tsx` and `not-found.tsx`
stay outside both groups and show no navigation (accepted: the error page shows one fixed message,
the detail going only to the server log, FR-052; the root `page.tsx` only redirects to
`/recommended`).

**Rationale**: layouts don't re-render on client navigation, so a layout check misses RSC fetches;
the proxy sees every request. The per-action wrapper keeps admin and step-up checks next to the
code and is the session check for actions.

## R6. Client network address (FR-025, FR-040, FR-051)

**Decision**: `MYJOBBOT_TRUSTED_PROXIES` (count of proxies in front, default `0`). With `n ≥ 1`,
the n-th address from the right of `X-Forwarded-For` (the left-most when there are fewer entries).
With `0`, the fixed key `direct`: every direct client shares one per-address count, and security
events record `direct`. An entry that isn't an IPv4 or IPv6 address (`node:net` `isIP`) gives the
fixed key `unknown`, so the key always fits `varchar(45)`. Production sets `1` for the ingress (Helm value). The pure function
`clientAddress(headers, hops)` is unit-tested against spoofed headers.

**Rationale**: Next.js gives the proxy and server actions no socket address (`NextRequest` has no
`ip`), and Next fills `X-Forwarded-For` with the socket address only when the request has none
(`next/dist/server/base-server.js`, `x-forwarded-for ??= socket.remoteAddress`), so with no
trusted proxy a client could name any address. A shared `direct` key can't be dodged; it is
coarser, which suits local use. Trusting the leftmost `X-Forwarded-For` lets any client pick its
address and dodge the per-address limits.

## R7. Security headers and content policy (FR-045)

**Decision**: set in the proxy on every response:
- `Content-Security-Policy`: `default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic';
  style-src 'self' 'nonce-<n>'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';
  base-uri 'none'; form-action 'self'; object-src 'none'` (dev adds `'unsafe-eval'` for React's dev
  tools). The proxy puts the same `Content-Security-Policy` on the request headers it passes on
  (`forwardedHeaders`), because Next reads the nonce from the request's CSP header
  (`next/dist/server/route-modules/app-page/parse-request-headers.js`) and applies it to its own
  scripts; the root layout keeps `force-dynamic` (R5), so no page is prerendered without a nonce,
  and `tests/webBuild.test.ts` requires each page route it lists (all but `/_not-found`) to build
  as dynamic (`ƒ`).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`
  (`no-referrer` on `/link`), `Cross-Origin-Opener-Policy: same-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and
  `Strict-Transport-Security: max-age=31536000` when the base URL is `https:`.
- `/link`: `Cache-Control: no-store` (a public page, so the gate's rule doesn't cover it); every
  other non-public answer, the account pages included, gets `private, no-store` from the gate
  (contracts/web.md step 11), so the header has one home per path.

**Checked**: no `style={…}` attributes in `web/` today (0 matches), so a strict `style-src` doesn't
break server-rendered markup; Pico is a stylesheet from `'self'`.

**Risk**: a library injecting inline styles at runtime would be blocked; the UI test and a manual
pass (quickstart §8) check the pages render with the policy on.

## R8. One-time values (FR-024, FR-041, FR-042, FR-043)

**Decision**:
- Account creation codes, email-link, reset and email-change tokens: 32 random bytes, base64url;
  stored as SHA-256 digest. A fast digest is right for high-entropy values (no guessing to slow
  down), and lookup by digest leaks nothing through timing.
- Recovery codes: 10 per set, each 10 characters from a 32-symbol alphabet without look-alikes,
  `A–Z` without `I` and `O`, and `2–9` (24 + 8 = 32 symbols, so 50 bits), shown as `xxxxx-xxxxx`,
  stored as SHA-256 digests of the normalised code (uppercased, spaces and dash removed).
- Spent in the checking statement: `UPDATE … SET used_at = ? WHERE digest = ? AND used_at IS NULL
  AND expires_at > ?` through Kysely's `updateTable`, success only when exactly one row changed, so
  two racing requests can't both use one value.
- A `step_up` token is spent only with the requesting session's digest in the same `WHERE`
  (R17); `TokenStore.emailTokenFor(digest)` reads a token's purpose and session without spending
  it, so a link opened in another browser gets its own message and stays unspent.
- Emailed links put the token in the URL **fragment** (`/link#p=signin&t=…`): the fragment is never
  sent to the server, never in access logs or `Referer`. The `/link` page reads it in the browser,
  clears it from the address bar (`history.replaceState`), and posts it only when the user presses
  the button. Mail scanners that fetch the page get nothing to spend.

## R9. Timing and enumeration (FR-023, FR-040)

**Decision**: every email-keyed answer goes through one function that always does the same work:
for an unknown email the password check runs against a fixed stand-in digest made at start-up, and
mail is sent through a queue that returns before sending (the request never waits on SMTP), so a
"sent" and a "not sent" take the same time. With mail not set up for the deployment, the link and
reset requests answer `mail_off` for every email (owner, 2026-11-06): it is a per-server fact, so
it reveals nothing about any email. Answers come from fixed messages in
`src/accounts/messages.ts`. The account-creation refusal for a taken email is the same message as
an invalid code (spec US2-5), and the existing owner is emailed.

## R10. Rate limits (FR-025, FR-040)

**Decision**: an `auth_attempts` table (kind, scope key, time); the decision is a pure function
`limitFor(kind, recentCount)` with the spec's numbers: sign-in failures 5/email/15 min (then 15 min
locked) and 20/address/15 min; mail requests (sign-in link, reset, test email, step-up link,
email change) 3/email/15 min; creation-code attempts 10/address/hour. "Address" is R6's key (`direct` without a
trusted proxy).
Rows older than a day are deleted by the same statement path on write. Keys for emails are the
normalised email's SHA-256 so the table holds no addresses typed for accounts that don't exist.

## R11. Hardware keys (FR-049)

**Decision**: SimpleWebAuthn with `rpID` = base URL host name, `expectedOrigin` = base URL origin,
`userVerification: "preferred"`, attestation `none`, resident keys `preferred` (so a key can sign in
with the email first or alone through discoverable credentials; the sign-in form still asks for the
email for the same no-enumeration answer). Challenges are stored in `auth_challenges` (digest,
purpose, account, expires 5 min, used); a counter that doesn't increase (when non-zero) is refused
and recorded as `key_counter_error`.

## R12. Authenticator app (FR-021, FR-024, FR-049, FR-050)

**Decision**: otpauth `TOTP` with SHA-1, 6 digits, 30 s (what every authenticator app supports);
`validate({ window: 1 })`. The secret (20 random bytes) is sealed with `MYJOBBOT_SECRET_KEY`
(`seal.ts` gains the field `totp_secret`), and `totp_last_step` stores the last accepted step;
a code at or before it is refused. Setup holds the pending secret sealed in the method row with
`ready = 0` until a code confirms it. `MYJOBBOT_SECRET_KEY` is optional today (Gmail reports it
`missing` or `invalid`): without a usable key, setup answers `secret_key_missing`, and a stored
secret the key can no longer open (`openOrNull` gives null) makes sign-in answer `signin_failed`
like any failure.

## R13. Mail (FR-029, FR-032)

**Decision**: `MYJOBBOT_SMTP_URL`-style split settings: `MYJOBBOT_SMTP_HOST`, `_PORT`, `_USER`,
`_PASSWORD`, `MYJOBBOT_MAIL_FROM`; all-or-none, parsed by zod (`src/mail/settings.ts`), never
printed. A `Mailer` port (`send(message)`); `transportOptions(settings)` (pure: `secure` for 465,
else `requireTLS: true`) and `smtpMailer(transport)` taking a nodemailer transport, built in
production with `nodemailer.createTransport(transportOptions(settings))`; a memory mailer in unit
tests. The integration test builds its transport from the same options plus `tls: { ca }` of a
test-only key and certificate committed under `tests/fixtures/smtp/` (for `localhost`, used by
nothing else), so production code carries no test option. The CLI builds its mailer from the
environment the same way. Message text comes from builders (`src/mail/messages.ts`) taking only the account
name, the base URL and a link; plain text only (no HTML mail, so no markup injection). Names are
already refused if they hold line breaks (FR-046); nodemailer also encodes headers. Send failures
are logged with a fixed reason code only (`auth`, `connect`, `tls`, `refused`, `other`).

## R14. First admin and recovery from the server

**Decision**: `npm start -- account init <email>` and `npm start -- account reset <email>`; the
password is read at a hidden prompt (`node:readline` with output muted), twice, checked by the
password rule. `init` refuses once user 1 has an email; `reset` only works on an admin, sets the
password, enables password sign-in, ends every session and records a security event (with no
network address: `security_events.address` is null for the command line) and, once notices exist
(S3), queues the security notice. In production:
`kubectl exec -it deploy/<release>-web -- npm start -- account init you@example.com`.

## R15. Data scope

**Decision**: `users` gains `email`, `email_key` (normalised, unique) and `is_admin`; every other
account table is new (data-model.md). No existing table gains a user link (spec out of scope). Every
signed-in account reads `OWNER_ID`'s data as today.

## R16. Test split (constitution II)

Planned new tests (ledger in tasks.md): **129 unit** (rules, security layer, flows on memory stores
and a memory mailer, the action-guard listing and its step-up case, every store-contract case on
the memory stores), **9 integration** (migration `018`, nodemailer against a fake SMTP server, the
six strict store-contract cases on MariaDB, and `scripts/copy-prod.sh` run against fake `mysql` and
`mysqldump` clients), **8 UI** (sign-in, create, admin section, Account tab, step-up dialog,
`/link`, authenticator and key controls): 88.4% / 6.2% / 5.5% of 146.

Each store's contract file exports every case (run on memory) and its strict cases (also run on
MariaDB): only the cases that need a real transaction, race or constraint, one per store area and
sitting (the first admin's `initOwner` and `email_key` uniqueness; concurrent account creation
with one code; the last-way rule under concurrent unticks; concurrent email-token spends;
concurrent `acceptStep`; key uniqueness and concurrent challenge spends). Against the baseline
922 / 70 / 64 (87.31% / 6.63% / 6.06%), the suite becomes about 1051 / 79 / 72 (87.44% / 6.57% /
5.99%): every share moves toward 95 / 4 / 1 (owner decision, 2026-11-06).

## R17. Step-up by emailed link (FR-047)

**Decision**: the "Confirm it's you" dialog offers "Email me a confirmation link" when mail is set up.
`requestStepUpLink({ returnPath })` (session, mail-request limit) makes an `email_tokens` row of
purpose `step_up`, 15 minutes, holding the requesting session's digest and the return path
(through `safeReturnPath`), and mails `<base>/link#p=step_up&t=<token>`. On `/link`, pressing
"Confirm it's you" spends it only from that same session (the session's digest is in the spending
statement's `WHERE`, R8): it sets the session's `verified_at` and answers `{ ok: true, next }`, and
the page goes to `next`; from another browser the spend changes no row, `emailTokenFor` shows the
token belongs to another session, and it answers `step_up_other_browser`, leaving the token
unspent. The change itself is not repeated automatically; the
user repeats it on the page they return to.

**Rationale**: FR-047 accepts any usable way, and an account whose only usable way is the email link
would otherwise never pass step-up. Binding the token to the session keeps a link forwarded or
opened elsewhere from renewing someone else's check.

**Alternatives considered**: signing in again by link to refresh `verified_at` (works, but loses the
page and needs a sign-out); leaving email-link-only accounts unable to make sensitive changes.

## R18. The new pages use Pico first (owner, 2026-11-06)

**Decision**: every new page and component is built from Pico 2.1's own elements, roles and
classes, the way the Settings page already uses them (`<article>` sections, `<fieldset
role="group">`, `<details>`, `<dialog><article>`, `aria-busy`). Custom CSS is the exception: only
when Pico has nothing for the job, added to `web/app/styles.css` in a short block, sized and
coloured only with Pico's variables (`--pico-spacing`, `--pico-form-element-spacing-*`,
`--pico-border-*`, `--pico-muted-*`, `--pico-primary*`, font sizes in `em`), never raw `px`, hand-
picked colours or inline `style` (also refused by the CSP, R7).

| Screen / part | Pico pattern |
|---|---|
| Public layout (`(public)`) | `<header class="container"><nav>` with the app name in `<strong>`; `<main class="container">` |
| Sign-in, Create account, `/link` | one `<article>` with `<header>` (title) and `<footer>` (secondary links); `<form>` with `<label>`-wrapped `<input>`s; a refused field `aria-invalid="true"` with its message in `<small>` under it (Pico's validation styling); the submit `<button>` `aria-busy="true"` while sending |
| Way choice on sign-in | `<fieldset>` + `<legend>` with `<input type="radio">` per way; only the chosen way's fields shown |
| Password rule | `<small>` under the password input (Pico helper text) |
| Account tab | one `<article>` per section (Profile, Ways of signing in, Recovery codes, Sessions, Recent activity), as the Settings sections |
| Way rows | `<input type="checkbox" role="switch">` (Pico switch) with the way's name as its `<label>`; ready state in `<small>`; the way's controls in `<details>` (Pico accordion), opened when ticked and not set up |
| Change email / name / password | `<fieldset role="group">` joining the input and its button, as `AddSource` and `ResumeSection` do |
| Hardware keys | `<table>` of names with a `.secondary.outline` Delete button per row; Add key as `<fieldset role="group">` (name + Add) |
| Authenticator setup | `<figure>` with the QR `<img>` and the secret in `<figcaption><code>`; the code input in `<fieldset role="group">` |
| Recovery codes | `<pre><code>`, one code per line; Copy and "I've saved them" buttons; Make new codes `.secondary` |
| Step-up ("Confirm it's you") | Pico modal: `<dialog open><article>` with `<header>` (`<button rel="prev" aria-label="Close">`), the way choice and fields, `<footer>` with `.secondary` Cancel and the primary Confirm (`ProfileEditor`'s dialog has the same `<dialog><article>` and footer, without the header) |
| Security events | `<table class="striped">` with `<time>` cells |
| Admin section (Settings) | `<article>` like the other Settings sections; accounts in a `<table>`; Make admin / Remove admin `.outline` buttons; the new code in `<pre><code>` with Copy and its expiry in `<small>` |
| Notes and refusals | `role="alert"` with the fixed message (the existing `Problems`/`SaveFailedNote` patterns); muted text in `<small>` |
| Sign out (Nav) | a `<form>` with a `.secondary.outline` `<button>`, inside the existing `<nav>` |

**Rationale**: the owner's standing rule (UI moved to Pico in #76): consistent look and theme
(light and dark) without hand-tuned CSS, and the same patterns a reader already knows from the
Settings page.

**Check**: T069 reviews every new component against this table and greps the CSS added on the
branch (`git diff main -- web/app/styles.css`) for `px` and colour literals; any hit is replaced by a
Pico variable or removed.

## R19. Dev copies leave out sessions and one-time values (owner, 2026-11-06)

**Decision**: `scripts/copy-prod.sh` copies no rows of `sessions`, `email_tokens`,
`auth_challenges`, `auth_attempts` and `account_codes`: the main dump passes
`--ignore-table=myjobbot.<table>` for each, and a second dump of those five with `--no-data` gives
the target their empty tables, so the copied migration record still matches the schema. Only the
skipped tables production actually has are named, so a copy taken before production has
`018_accounts` still works. Accounts
(`users`), `sign_in_methods`, `hardware_keys`, `recovery_codes` and `security_events` still copy,
so a dev database signs in with the same accounts. The skipped tables are one list in the script.

**Rationale**: a live sign-in, a pending link, a creation code or attempt counts from production
have no use in a dev database, and leaving them out keeps production's live one-time values off the
dev server.

**Test**: one integration case in `tests/integration/copyProd.test.ts` runs a copy of the script in
a scratch directory with a fake `.env` and fake `mysql` and `mysqldump` clients on `PATH` that
record their arguments, and checks both dumps' flags (T064).

## R20. Device details and location (owner, 2026-11-06)

**Decision**: every sign-in stores `ip`, `os` and `location` (migration `019_session_details`).
The OS comes from `Sec-CH-UA-Platform` (sent by Chromium-based browsers) or the User-Agent, through
the pure `osFrom`, giving a fixed name. Location: the browser's Geolocation API when the user
shares it (asked on submit of sign-in and create-account, 5 s timeout; `Permissions-Policy`
changes from `geolocation=()` to `geolocation=(self)`), rounded to one decimal; else **geoip-lite
2.0.3** (exact pin, owner choice, bundled data, ~115 MB, kept out of the Next bundle with
`serverExternalPackages`) from the IP, with private and loopback ranges shown as Local network.
**Alternative kept in mind**: a MaxMind GeoLite2-City file read with the `maxmind` package
(fresher data, needs a free licence key and a monthly download); `src/accounts/geo.ts` says so.
The Sign-ins list names each sign-in by the first 16 hex characters of its digest, never the whole
digest, and Sign out for a device ends only another of the signed-in account's own sign-ins.

