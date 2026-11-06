---

description: "Tasks for feature 024: user accounts"
---

# Tasks: User accounts

**Input**: Design documents from `docs/specs/024-user-accounts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/web.md,
contracts/cli-env-mail.md, quickstart.md

**Tests**: required by the constitution (Principle II); each test task names its kind and count.

**Organization**: one phase per user story, in sittings; **one PR for the whole feature** (owner
decision, 2026-11-05), one commit per sitting when the owner asks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: US1 password sign-in and the gate, US2 invite and create, US3 the Account tab,
  US4 email links, US5 authenticator app, US6 hardware keys, US7 recovery

## Sittings

| Sitting | Stories | Stack | Why |
|---|---|---|---|
| S1 schema, sessions, password sign-in, gate, CSRF, headers, layouts, CLI | US1 | stopped | migration `018_accounts`; the proxy gates every request |
| S2 mail, account creation codes, create page, admin section | US2 | stopped | adds nodemailer; new store methods |
| S3 Account tab, method rows, password change, step-up, events, notices | US3 | stopped | new store methods and actions |
| S4 email links, test email, `/link`, password reset, email change, admin email change, step-up link | US4, US7 | stopped | new store methods |
| S5 authenticator app and recovery codes | US5, US7 | stopped | adds otpauth and qrcode; `seal.ts` gains a field |
| S6 hardware keys | US6 | stopped | adds SimpleWebAuthn |
| S7 copy-prod, docs, Helm, env, quickstart | — | stopped until merge, then rebuilt | dev-copy script, deploy files and docs |

- The stack is stopped from T001 until the feature merges (constitution 2.5.0: a migration, and
  the gate in front of every request). It is rebuilt and restarted after the merge (T070).
- Each sitting's first task creates `.specify/sitting-in-progress` naming it; its last task runs
  `npm run check` and `npm run check:db` until green and deletes the marker; commit only when the
  owner asks.
- **Wire as you build**: every pure rule, store, store method and export arrives in the sitting of
  its first production caller (knip's production pass). The migration creates every table in S1
  (tables are not code); each store is created, and gains its methods, in the sitting that uses
  them: `SessionStore`, `AccountStore`, `MethodStore` in S1, `TokenStore` in S2, `KeyStore` in S6.
  `src/accounts/messages.ts` is one `MESSAGES` object constant, so later sittings' messages add
  members, not exports.
- **Store contracts (owner decision, 2026-11-06)**: each store has one contract file in
  `tests/helpers/` (`sessionContract.ts`, `accountContract.ts`, `methodContract.ts`,
  `tokenContract.ts`, `keyContract.ts`) exporting `<name>Contract(make)` (every case) and
  `<name>StrictCases(make)` (the transaction, race and constraint cases only). Every case runs on
  the memory stores (`tests/storeContract.test.ts`, unit); only the strict cases also run on
  MariaDB (`tests/integration/storeContract.test.ts`), six in all.
- **Dependencies** are installed in the sitting of their first import with exact pins through the
  lockfile, keeping optional platform entries (the lockfile splice in the dev-workflow notes), then
  `docker compose build` so the images match, even with the stack stopped.
- **Pico first in every UI task** (owner, 2026-11-06; research R18): build each page and component
  from the Pico pattern R18 names for it (`<article>`, `<fieldset role="group">`, `role="switch"`,
  `<details>`, the `<dialog><article>` modal, `aria-invalid` with `<small>`, `aria-busy`,
  `.secondary`/`.outline`, `<table class="striped">`); add CSS to `web/app/styles.css` only when
  Pico has nothing for it, sized and coloured with `--pico-*` variables and `em`, never `px`, colour
  literals or inline `style`.
- **Security rules apply in every task**: fixed messages only (`MESSAGES` in
  `src/accounts/messages.ts`); no password, code, token, secret or typed email in logs, traces,
  errors or security events; every one-time value spent in the statement that checks it; every
  server action wrapped by `guarded`.

---

## Phase 1: Setup

- [X] T001 Stop the Docker stack (`docker compose stop`, no `docker:watch`), create `.specify/sitting-in-progress` naming S1, and take the baseline counts with `npm run check` and `npm run check:db` on `024-user-accounts`, writing them into the ledger's baseline row

---

## Phase 2: User Story 1 - Sign in with a password (P1) 🎯 MVP

**Goal**: FR-001–FR-007, FR-010, FR-022 (password), FR-023, FR-025, FR-031, FR-033–FR-040,
FR-044–FR-046, FR-051 (sign-in events), FR-052. FR-003's "Sign out everywhere else" and US1-7 land
in S3. **Independent Test**: quickstart §2–§3.

### Sitting S1: schema, sessions, password sign-in, gate, CSRF, headers, layouts, CLI

#### Tests (S1)

- [X] T002 [P] [US1] Write an integration test (1) in `tests/integration/accountsMigration.test.ts`: step `018_accounts` adds to `users` the columns `email` `varchar(254)` null, `email_key` `varchar(254)` null with a unique index, `is_admin` `tinyint` not null default 0, and creates `sign_in_methods`, `hardware_keys`, `recovery_codes`, `sessions`, `account_codes`, `email_tokens`, `auth_challenges`, `auth_attempts`, `security_events` with the columns, keys and indexes of data-model.md (`totp_last_step` and `hardware_keys.counter` as `bigint`), every new table `utf8mb4_bin`, each with an account column holding a foreign key to `users` (all but `auth_attempts`, which has none); add `018_accounts` to the migration-name lists in `tests/integration/migrate.test.ts`, `companyMigrations.test.ts`, `lookupIndexes.test.ts`, `boostMigration.test.ts` and `resumeMigration.test.ts`; add the nine tables to `TABLES` in `tests/helpers/testDb.ts` before `"resume_profiles"` (children first: `"security_events", "auth_attempts", "auth_challenges", "email_tokens", "account_codes", "sessions", "recovery_codes", "hardware_keys", "sign_in_methods"`), and to the collation list in `migrate.test.ts`
- [X] T003 [P] [US1] Add `tests/helpers/sessionContract.ts`, `tests/helpers/accountContract.ts` and `tests/helpers/methodContract.ts` (each `<name>Contract` registered in `tests/storeContract.test.ts`, each `<name>StrictCases` in `tests/integration/storeContract.test.ts`) with 8 cases (8 unit on memory; 1 of them strict, also run on MariaDB: 1 integration). Session (5): `SessionStore.create` then `find(idDigest, now)` returns the session until `last_used_at` is 30 days old or `ended_at` is set, and `touch` moves `last_used_at`; `end`, and `endAllFor(userId, exceptDigest?)` (all of them when `exceptDigest` is left out); `rebindCsrf(idDigest, csrfDigest)` replaces the session's `csrf_digest`; `recordAttempt` and `countAttempts(kind, scope, keyDigest, since)`, with rows older than a day deleted on write; `pruneEnded(now)` deletes ended or expired rows older than 30 days. Account (2): **strict** `AccountStore.initOwner(email, emailKey, passwordDigest, now)` sets user 1's `email`, `email_key`, `is_admin = 1` and a usable `password` row only while user 1 has no email (else `false`), creating user 1 when absent, and a second account can't take the same `email_key` (unique index); `byEmailKey` finds it by `email_key` alone, `account(id)` and `isAdmin(id)`. Method (1): `MethodStore.passwordDigest(userId)` and `setPassword(userId, digest, now)` enable and ready the `password` row
- [X] T004 [P] [US1] Write unit tests (7) in `tests/accountRules.test.ts`: `normalizeEmail` trims and lowercases (`" Owner@Example.com "` → `owner@example.com`); `checkEmail` refuses over 254 characters, line breaks, control characters and anything without one `@` and a dot in the domain, answering `email_invalid`; `passwordRule` accepts 10–128 characters holding a lowercase letter, an uppercase letter, a digit and a symbol, refusing each one missing, 9 and 129 characters, answering the `password_rule` message; `safeReturnPath` keeps `/recommended?x=1` and turns `//evil.test`, `/\evil.test`, `https://evil.test`, `%2F%2Fevil.test`, `/x%0d%0a`, a path over 512 characters and the empty string into `/`
- [X] T005 [P] [US1] Write unit tests (12) for `src/web/security/`, 7 in `tests/webSecurity.test.ts` and 5 in `tests/securityHeaders.test.ts`. `webSecurity`: `checkOrigin` passes a POST whose `Origin` is the base origin and refuses another origin, a missing `Origin`, and `Sec-Fetch-Site: cross-site`; GET and HEAD always pass; `csrfDecision` refuses a POST without the CSRF cookie and one whose digest isn't the session's `csrf_digest`, and passes a POST with no session but the cookie (sign-in, create); `csrfDecision` on a GET without the CSRF cookie answers `issue` with no session and `rebind` with a valid session (a cross-site arrival, research R4); `cookieOptions(baseUrl)` gives `__Host-myjobbot_session` with `HttpOnly; Secure; Path=/; SameSite=Lax` and `__Host-myjobbot_csrf` with `SameSite=Strict` for an `https:` base, drops `__Host-` and `Secure` for `http://localhost:8080`; `parseBaseUrl` refuses `http://myserver.lan:8080`, a base whose host isn't in `MYJOBBOT_HOSTS`, a path or query, and a missing value, with the fixed `base_url` message; `clientAddress(headers, hops)` with 0 trusted proxies answers `direct` whatever `X-Forwarded-For` says, with 1 the right-most entry, with more hops than entries the left-most, and `unknown` for an entry that isn't an IP address. `securityHeaders`: `securityHeaders(nonce, { https, dev, path })` gives the CSP of research R7, with `'unsafe-eval'` only in dev; it gives `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, and `Strict-Transport-Security` only when https; on `/link` `Referrer-Policy: no-referrer` and `Cache-Control: no-store` (the gate gives every other non-public path its `private, no-store`, T008); `forwardedHeaders(incoming, csp)` puts the same `Content-Security-Policy` on the request headers passed to Next (research R7, where Next reads the nonce)
- [X] T006 [P] [US1] Write unit tests (4) in `tests/passwordDigest.test.ts` and `tests/tokens.test.ts`: `digestPassword` gives `argon2id$v=19$m=19456,t=2,p=1$<salt>$<tag>` with a fresh 16-byte salt each time and `verifyPassword` accepts the right password, refuses a wrong one and refuses a malformed stored digest without throwing; `standInDigest()` verifies nothing; `newToken(random)` gives 43 base64url characters (32 bytes) and `tokenDigest` its SHA-256 hex
- [X] T007 [P] [US1] Write unit tests (7) in `tests/signInFlow.test.ts` for `signInWithPassword(ctx, input)` and `signOut(ctx, session)` in `src/accounts/flows/signIn.ts` on memory stores with a fixed clock and random source: right email and password → a new session (digest stored, `verified_at` = now, a new CSRF value bound), the old session cookie value ended (rotation, FR-037), event `signed_in`, and `pruneEnded` run; a wrong password, an unknown email and a disabled `password` row each answer `signin_failed` and record `signin_failed` (the unknown email checked against the stand-in digest, R9, and recording nothing tied to an account); the sixth failure for one email within 15 minutes answers `signin_failed` even with the right password and records `locked` once; 20 failures from one address key within 15 minutes lock that key; `limitFor` gives the four limits of research R10; `signOut` ends the session on the server so `find` no longer returns it (FR-038)
- [X] T008 [P] [US1] Write unit tests (7) in `tests/gate.test.ts` for `originDecision(request)` and `gateDecision(request, session)` in `src/web/security/gate.ts`: a cross-origin POST answers 403 from `originDecision`, which the proxy runs before it looks up any session; a public path (`/sign-in`, `/create-account`, `/link`) and a GET or HEAD of `/_next/webpack-hmr` pass without a session, and a GET of `/_next/static/x.js` passes with neither a session lookup nor a new CSRF cookie, even with a session cookie; a page without a session redirects 303 to `/sign-in?next=%2Frecommended`, and an in-page navigation to `/jobs?_rsc=abc` to `/sign-in?next=%2Fjobs`; `/api/rescores/1` without a session answers 401; a server action (`Next-Action` header) without a session passes the gate on a public and a non-public path alike, after the origin and CSRF checks (it is `guarded` that redirects it, research R5); a valid session passes and is touched only when `last_used_at` is over a minute old; signed out, an in-page navigation (`RSC: 1`) and a prefetch (`Next-Router-Prefetch: 1`) of `/jobs` get the 303 with an empty body, a data request gets 401 with the body `Signed out`, and a signed-in page answer carries `Cache-Control: private, no-store` while `/_next/static/x.js` doesn't (FR-053). Rewrite `tests/proxy.test.ts` (0 new): mock `../web/lib/env.js` so `loadRepoEnv()` does nothing (the checkout's own `.env` sets `MYJOBBOT_HOSTS`, and `process.loadEnvFile` would refill the keys the tests delete), stub `MYJOBBOT_BASE_URL`, request `/sign-in` (no session cookie, so no store lookup) and expect the allowed hosts to get a status other than 421 and the refused ones 421, as today
- [X] T009 [P] [US1] Write unit tests (3) in `tests/accountCli.test.ts` for `accountCommand(env, args, io)` in `src/accounts/cli.ts` with a scripted hidden prompt: `init you@example.com` with matching passwords that meet the rule prints `account you@example.com: ready` and exits 0; a second `init` prints `account init: user 1 already has an email` and exits 1; mismatched entries, a weak password, a bad email, no TTY, and `reset` for a non-admin each exit 1 with their line from contracts/cli-env-mail.md and change nothing; `reset` for the admin ends every session and records `password_reset` with no network address (`address` null); the password never appears in any printed line
- [X] T010 [P] [US1] Write unit tests (3) in `tests/actionGuards.test.ts`: importing every `web/lib/*.ts` module whose file starts with the `"use server"` directive, every runtime export carries the guard's marker (type exports such as `sourceActions.ts`'s `SwitchResult` are erased and not counted; `panelActions.ts`, which has no directive, is not read); `guarded(fn, {})` without a session calls the stubbed `redirect` with `/sign-in?next=%2Fjobs` for a `Referer` of `http://localhost:8080/jobs` (and `/sign-in` for a missing or cross-origin `Referer`) and never calls `fn`, and with a session calls `fn` with the account; a non-admin's `guarded(fn, { admin: true })` answers `{ ok: false, message }` without calling `fn` (FR-053)
- [X] T011 [P] [US1] Write a UI test (1) in `tests/client/signIn.test.tsx` and a unit test (1) in `tests/signedOutRedirect.test.ts`: in the UI test, the sign-in page, inside the `(public)` layout, shows Email and Password and the way choices (only Password active in this sitting), shows `signin_failed` on a refused answer, never shows whether the email exists, and shows neither the navigation nor the footer's database label; update `tests/client/errorPage.test.tsx` (0 new) so the error page shows the fixed `MESSAGES.page_failed` text and never `error.message`; in the unit test, `afterStreamFailure(status, page)` in `src/web/signedOut.ts` gives `/sign-in?next=%2Fjobs%3Fjob%3Dx` for a 401 on `/jobs?job=x` and `null` for any other status, so `useRescoreLog` goes to sign-in only when signed out (FR-053)

#### Implementation (S1)

- [X] T012 [US1] Add `src/db/migrations/018_accounts.ts` with the schema builder: `alterTable("users")` adding `email` `varchar(254)`, `email_key` `varchar(254)` with a unique index `users_email_key`, `is_admin` `` sql`tinyint` `` not null default 0; create the nine tables of data-model.md (`createTable` with `addColumn`, `"bigint"` for `totp_last_step` and `counter` through the builder, `addForeignKeyConstraint` to `users.id`, indexes `sessions (user_id, ended_at)`, `auth_attempts (kind, scope, key_digest, at)`, unique `hardware_keys (user_id, name)` and `credential_id`, unique `recovery_codes.digest`; `.modifyEnd(TABLE_OPTIONS)` for `utf8mb4_bin`; `sql` only for `tinyint` and the table options); list it in `src/db/migrations/index.ts`; add the columns to `src/db/schema/users.ts` and the nine table types to a new `src/db/schema/accounts.ts`, each listed in `src/db/schema.ts`'s `Database`
- [X] T013 [US1] Create the S1 stores, each an interface in `src/db/`, a Kysely class in `src/db/kysely/` (builders only) and a memory version in `tests/helpers/`: `sessionStore.ts` (`SessionStore`: `create`, `find`, `touch`, `end`, `endAllFor`, `rebindCsrf`, `pruneEnded`, `recordAttempt`, `countAttempts`), `accountStore.ts` (`AccountStore`: `initOwner`, `byEmailKey`, `account`, `isAdmin`, `recordEvent`), `methodStore.ts` (`MethodStore`: `passwordDigest`, `setPassword`); memory files `memorySessionStore.ts`, `memoryAccountStore.ts` (exposing its recorded events to tests until `recentEvents` arrives in S3), `memoryMethodStore.ts`; all three in `Stores` (`src/db/store.ts`, `src/db/kysely/stores.ts`, `tests/helpers/memoryStore.ts`); `SECURITY_EVENTS` in `src/accounts/events.ts`
- [X] T014 [US1] Create the rules: `src/accounts/emails.ts`, `src/accounts/passwordRule.ts`, `src/accounts/returnPath.ts`, `src/accounts/messages.ts` (one `MESSAGES` constant holding the fixed messages of contracts/web.md), `src/accounts/limits.ts`, `src/accounts/tokens.ts`, and `src/accounts/passwordDigest.ts` (`crypto.argon2("argon2id", { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 })`, `timingSafeEqual`, the stand-in digest made once at start-up); add `--disable-warning=ExperimentalWarning` to the `web`, `web:start` scripts' `NODE_OPTIONS` in `package.json` as `start` has
- [X] T015 [US1] Create `src/web/security/` (`origin.ts`, `csrf.ts`, `cookies.ts`, `clientAddress.ts`, `baseUrl.ts`, `headers.ts`, `gate.ts`) as plain functions, and `src/accounts/flows/context.ts` (`AuthContext`: stores, clock, random, settings, mailer slot) and `src/accounts/flows/signIn.ts` (`signInWithPassword`, `signOut`); `MYJOBBOT_BASE_URL` and `MYJOBBOT_TRUSTED_PROXIES` parsed by zod in `baseUrl.ts`
- [X] T016 [US1] Rewrite `web/proxy.ts` to run the gate of contracts/web.md in order (host, base URL, nonce and headers with the CSP also on the forwarded request headers, origin, GET/HEAD under `/_next/static/` passed before any session lookup or CSRF cookie, session lookup only when the session cookie is present, CSRF with issue or rebind on GET, public paths and every server action (`Next-Action`) passed on to `guarded`, session check and touch at most once a minute, 303 with an empty body (and `next` without `_rsc`) for pages, in-page navigation and prefetches, 401 `Signed out` for `/api/*`, and `Cache-Control: private, no-store` on every non-public answer, FR-053), keeping its existing host check; a missing or invalid base URL answers every request 500 with the fixed `base_url` text and logs that line once; create `web/lib/env.ts` (`loadRepoEnv()`, the repository `.env` loaded once, moved from `dbSettings` in `web/lib/uiState.ts`, which now calls it) and call it from the proxy before reading the base URL; create `web/lib/session.ts` (reads the cookie through `cookies()`, finds the session, cached per request; `requireSession()` redirects to `/sign-in?next=…` without one) and call `requireSession()` first in `getUiState` and `getSettingsState` (`web/lib/uiState.ts`), before they open the stores; create `web/lib/authDeps.ts` (the `AuthContext` from `getStores()`)
- [X] T017 [US1] Create `web/lib/guard.ts` (`guarded(fn, { public?, admin?, stepUp? })`, the marker the test checks; without a session it calls Next's `redirect()` to `/sign-in?next=<page>` (from the same-origin `Referer`, through `safeReturnPath`) before the action runs, for every action that isn't `public`, FR-053) and wrap every existing action in the `"use server"` files `web/lib/actions.ts`, `gmailActions.ts`, `resumeActions.ts`, `settingsActions.ts`, `sourceActions.ts` as `export const name = guarded(async (…) => …, {})`, keeping their return types (each inner function keeps its doc comment); split the layouts: `web/app/layout.tsx` keeps only `<html>`, `<body>`, the styles, the metadata and `export const dynamic = "force-dynamic"` (so every page gets the nonce); `web/app/error.tsx` and `not-found.tsx` stay at the root, outside both groups; new `web/app/(app)/layout.tsx` renders `Header` and `Footer` and holds the signed-in pages moved into `web/app/(app)/` (`recommended`, `applied`, `jobs`, `reasoning`, `settings`, with their relative imports updated, and the import in `tests/client/settings.test.tsx` changed to `../../web/app/(app)/settings/page.js` (0 new); URLs don't change); new `web/app/(public)/layout.tsx` shows the app name only, no navigation and no database label; `web/app/error.tsx` shows `MESSAGES.page_failed` (the detail stays in the server log); create `web/lib/signInActions.ts` (`signInWithPassword`, `signOut`) and `web/app/(public)/sign-in/page.tsx` with `web/components/account/SignInForm.tsx` (Pico form; signed in → redirect to `/`; the `next` path through `safeReturnPath`); add `web/components/account/SignOutButton.tsx` (a form POST to `signOut`) to `web/components/menus/Nav.tsx`, and mock it in `tests/client/nav.test.tsx` (0 new); create `src/web/signedOut.ts` (`afterStreamFailure`) and, in `web/lib/useRescoreLog.ts`, when the stream fails, send one `HEAD` to its address and go to the address it gives (`window.location.assign`), showing no log lines; stub `fetch` (answering 200) in `tests/client/rescoreTerminal.test.tsx` and `tests/client/detailsPanel.test.tsx`, whose lost-stream paths now send it (0 new); export `HEAD` from `web/app/api/rescores/[id]/route.ts`, answering 204 without opening the stores (Next would otherwise run `GET`); in `tests/webBuild.test.ts` (0 new) add `/applied` and `/sign-in` to `ROUTES` and require each listed page route except `/_not-found` and the API route to build as dynamic (`ƒ`)
- [X] T018 [US1] Create the CLI: `src/accounts/cli.ts` (`account init|reset <email>`, hidden prompt with `node:readline` and muted output, asked twice; refuses without a TTY) and its entry in `COMMANDS` and `USAGE` in `src/cli.ts`; add `MYJOBBOT_BASE_URL=http://localhost:8080` (commented, with the localhost note of research R3) and `MYJOBBOT_TRUSTED_PROXIES` to `.env.example`; make `docker/entrypoint.sh`'s `serve` refuse without `MYJOBBOT_BASE_URL`, as it does without `MYJOBBOT_HOSTS`; update `tests/cli.test.ts` for the new usage line (0 new)
- [X] T019 [US1] Run `npm run check` and `npm run check:db` until green; set your own `.env`'s `MYJOBBOT_BASE_URL`, run `npm start -- account init`, and walk quickstart §2–§3 with `npm run web`, skipping §2.5's notice email (it arrives in S3, T038); check FR-004 with `npm start -- eval check`, which needs no sign-in; delete the marker; commit S1 only when the owner asks

**Checkpoint**: the UI is behind a password sign-in with CSRF, headers and limits on.

---

## Phase 3: User Story 2 - Invite a user with an account creation code (P1)

**Goal**: FR-008, FR-009, FR-011–FR-013, FR-029, FR-030, FR-032, FR-041 (codes), FR-046 (names).
**Independent Test**: quickstart §4.

### Sitting S2: mail, codes, create page, admin section

#### Tests (S2)

- [X] T020 Create `.specify/sitting-in-progress` naming S2; install `nodemailer@10.3.1` exact through the lockfile, keeping platform entries (it ships its own types, so no `@types/nodemailer`); `docker compose build`
- [X] T021 [P] [US2] Add `tests/helpers/tokenContract.ts` (registered like T003) and extend `tests/helpers/accountContract.ts`, 4 cases (4 unit; 1 strict: 1 integration): `TokenStore.makeCode(digest, createdBy, now)` stores a code expiring 7 days later; `AccountStore.createAccount({ email, emailKey, name, passwordDigest }, codeDigest, now)` inserts the user (`is_admin = 0`), a usable `password` row and spends the code in one transaction, answering `created`, a spent, expired or unknown code answers `refused` and inserts nothing, and a taken `email_key` answers `taken` and leaves the code unspent; **strict** two concurrent `createAccount` calls with one code create one account and the other answers `refused`; `accounts()` lists name, email and admin mark, and `setAdmin(userId, admin)` refuses removing the last admin's mark, the acting admin's own included (in one transaction with every admin row locked, `forUpdate()`, so concurrent removals can't leave none; not a strict case)
- [X] T022 [P] [US2] Write unit tests (4) in `tests/mail.test.ts` for `src/mail/`: `parseMailSettings` accepts all of `MYJOBBOT_SMTP_HOST`, `_PORT`, `_USER`, `_PASSWORD`, `MYJOBBOT_MAIL_FROM` or none (mail off) and refuses a partial set with a fixed message naming the missing variable, never a value; `transportOptions(settings)` gives `secure: true` for 465 and `requireTLS: true` otherwise; the S2 message builders of contracts/cli-env-mail.md (Account created, Someone tried; the others arrive with their callers in S3 and S4) give fixed subjects starting `myjobbot:` and plain text holding only the name, fixed text and the base URL; the queue returns before sending and logs `mail_failed <code>` (one of `auth`, `connect`, `tls`, `refused`, `other`) on failure
- [X] T023 [P] [US2] Write an integration test (1) in `tests/integration/mailer.test.ts` with `tests/helpers/fakeSmtp.ts` (a minimal SMTP server on `node:net` that speaks STARTTLS with the test-only key and certificate committed under `tests/fixtures/smtp/`, for `localhost`): `smtpMailer(transport)` with a nodemailer transport built from `transportOptions(settings)` plus `tls: { ca }` of the test certificate sends one message over STARTTLS, the server sees the sender, recipient and subject, and a refused login gives the fixed `auth` reason
- [X] T024 [P] [US2] Write unit tests (6), 5 in `tests/createAccountFlow.test.ts` for `createAccount(ctx, input)` in `src/accounts/flows/createAccount.ts` and `makeAccountCode(ctx, admin)` in `src/accounts/flows/admin.ts` on memory stores and `tests/helpers/memoryMailer.ts`, and 1 in `tests/accountRules.test.ts`: an admin's code is 43 base64url characters, stored only as its digest, shown with `expiresAt` 7 days on; a valid form creates the account, signs it in (session, CSRF digest bound), queues the account-created mail and records `code_made`/`signed_in`; a bad, expired or spent code and a taken email give the same `code_refused` message and timing work, the taken email's owner gets the "someone tried" mail; a weak password answers `password_rule` and leaves the code unspent; 10 code attempts per address key per hour, then `limited`; and in `accountRules.test.ts`, `checkName` refuses empty, over 100 characters and control characters with `name_invalid`
- [X] T025 [P] [US2] Write unit tests (3) in `tests/adminFlow.test.ts` for `src/accounts/flows/admin.ts`: a non-admin's `makeAccountCode`, `setAdmin` are refused; `setAdmin` grants and removes the mark on another account, ending the target's sessions and recording `admin_granted`/`admin_removed`; an admin removes their own mark while another admin remains (this session rotated, their other sessions ended), and removing the last admin's mark, their own included, answers `last_admin`
- [X] T026 [P] [US2] Write UI tests (2) in `tests/client/createAccount.test.tsx` and `tests/client/adminSection.test.tsx`: the create form shows the password rule and the refusal message and keeps the entered email and name; the admin section shows a new code once with its expiry and a copy button, lists accounts with Make admin / Remove admin (Remove admin on the viewer's own row too), shows `last_admin` on refusal, and is absent for a non-admin

#### Implementation (S2)

- [X] T027 [US2] Create `src/mail/settings.ts`, `src/mail/mailer.ts` (the `Mailer` port, `transportOptions`, and `smtpMailer(transport)`, production building the transport with `nodemailer.createTransport(transportOptions(settings))`), `src/mail/messages.ts` (the Account created and Someone tried builders only), `src/mail/queue.ts`, and `tests/helpers/memoryMailer.ts`; give `AuthContext` its mailer from `web/lib/authDeps.ts` and the CLI's from the environment in `src/accounts/cli.ts`; add the SMTP block (commented, never real values) to `.env.example`
- [X] T028 [US2] Create `TokenStore` (`src/db/tokenStore.ts`, `src/db/kysely/tokenStore.ts`, `tests/helpers/memoryTokenStore.ts`, in `Stores`) with `makeCode`, and add `createAccount`, `accounts`, `setAdmin` (admin rows locked with `forUpdate()` in its transaction) to `AccountStore` (Kysely and memory); create `src/accounts/names.ts` (`checkName`), `src/accounts/flows/createAccount.ts` (`createAccount`) and `src/accounts/flows/admin.ts` (`makeAccountCode`, `setAdmin`)
- [X] T029 [US2] Create `web/app/(public)/create-account/page.tsx` with `web/components/account/CreateAccountForm.tsx` (email, name, password with the rule, code; success → `/account`); `web/lib/adminActions.ts` (`makeAccountCode`, `setAdmin`, both `guarded({ admin: true, stepUp: true })`, step-up enforced from S3) and `createAccount` in `signInActions.ts` (`guarded({ public: true })`); `web/components/settings/AdminSection.tsx` on the Settings page for admins (`getSettingsState` gains `admin` and `accounts`); a placeholder `web/app/(app)/account/page.tsx` showing the name and email from `getAccountState()` in a new `web/lib/accountState.ts` (which calls `requireSession()` first) so new accounts land somewhere real (filled in S3); `Account` in `web/lib/pages.ts`; update `tests/client/settings.test.tsx`'s `uiState` mock for the admin flag (0 new); add `/create-account` and `/account` to `ROUTES` in `tests/webBuild.test.ts` (0 new)
- [X] T030 [US2] Run `npm run check` and `npm run check:db` until green; quickstart §4 with a real SMTP server (2026-11-06: walked without mail, since .env has no SMTP settings; the mailer is covered by the STARTTLS integration test, and real mail is to be checked once the owner adds SMTP settings); delete the marker; commit S2 only when the owner asks

---

## Phase 4: User Story 3 - Manage the account (P1)

**Goal**: FR-003 (sign out everywhere else), FR-014 (name), FR-015–FR-018, FR-038, FR-047,
FR-048, FR-051. **Independent Test**: quickstart §2.5 (notice), §5.1–§5.3.

### Sitting S3: Account tab, method rows, password change, step-up, events, notices

#### Tests (S3)

- [X] T031 Create `.specify/sitting-in-progress` naming S3
- [X] T032 [P] [US3] Extend `tests/helpers/methodContract.ts`, `accountContract.ts` and `sessionContract.ts` with 5 cases (5 unit; 1 strict: 1 integration): `MethodStore.methods(userId)` lists the four kinds with `enabled`/`ready` (absent rows as off and not ready); **strict** `setEnabled(userId, { kind, enabled, mailOn }, now)` refuses, in one transaction with the user row locked, a change that leaves no row usable (`email_link` counted only when `mailOn`), and two concurrent unticks of an account's two usable ways leave one; `AccountStore.saveName`; `recordEvent` stores a `SECURITY_EVENTS` name, address (or null) and method, and `recentEvents(userId, 20)` returns newest first; `SessionStore.setVerified(idDigest, now)`, and `endAllFor` with the current digest leaves it
- [X] T033 [P] [US3] Write unit tests (7) in `tests/accountMethods.test.ts`, `tests/stepUp.test.ts` and `tests/actionGuards.test.ts`: `usable(row, { mailOn })` only when enabled and ready, and for `email_link` also only with mail on; `lastWayRule` refuses unticking the last usable way and allows unticking one of two; ticking a not-ready way answers `{ ok: true, setup: kind }` and the way stays unusable; `needsStepUp(session, now)` is false within 10 minutes of `verified_at` and true after; `confirmIdentity` (`src/accounts/flows/confirmIdentity.ts`) with the right password sets `verified_at` and a wrong one records `signin_failed` and counts toward the limit; and in `actionGuards.test.ts` (1), `guarded(fn, { stepUp: true })` past 10 minutes of `verified_at` answers `{ ok: false, stepUp: true }` without calling `fn`, and every FR-047 action (`changePassword`, `requestEmailChange`, `setMethodEnabled`, `signOutEverywhereElse`, `makeRecoveryCodes`, the key and authenticator setup and removal actions, `makeAccountCode`, `setAdmin`, `adminChangeEmail`) present in `web/lib/` carries `stepUp: true` in its marker
- [X] T034 [P] [US3] Write unit tests (5) in `tests/accountChanges.test.ts` for `src/accounts/flows/accountChanges.ts`: `saveName` refuses an empty, long or control-character name with `name_invalid`; `changePassword` needs the current password and a rule-passing new one, ends every other session, rotates this one, records `password_changed` and queues the security notice; `signOutEverywhereElse` (step-up, FR-047) ends the others and records `signed_out_elsewhere`; `recordSecurityEvent(ctx, …)` (`src/accounts/flows/securityEvents.ts`) stores the event and queues the security notice (`src/mail/messages.ts`) whenever `noticeFor` gives one, so a sign-in lock (`locked`, from S1's `signInWithPassword`) queues its notice; `noticeFor(event)` gives a notice for every FR-048 event (`locked` and the CLI's `password_reset` included) and none for `signed_in`
- [X] T035 [P] [US3] Write UI tests (2) in `tests/client/accountPage.test.tsx` and `tests/client/stepUpDialog.test.tsx`: the Account tab shows name and email, the four rows with checkbox, name, ready state and controls (Password: change form; others "Set up" until later sittings), the last-way message on refusal, the last 20 events as text, and `Header` shows the signed-in account's name; a `stepUp` answer opens the "Confirm it's you" dialog, and after confirming the action is repeated

#### Implementation (S3)

- [X] T036 [US3] Add the store methods of T032 (`src/db/kysely/methodStore.ts`, `accountStore.ts`, `sessionStore.ts` and the memory stores); create `src/accounts/methods.ts`, `src/accounts/stepUp.ts`, `src/accounts/flows/accountChanges.ts` with `noticeFor` in `src/accounts/events.ts`, the Security notice builder in `src/mail/messages.ts`, `src/accounts/flows/securityEvents.ts` (`recordSecurityEvent`, which every flow from now on uses instead of `recordEvent` directly: `signIn.ts`, `createAccount.ts` and `admin.ts` switch to it), and `src/accounts/flows/confirmIdentity.ts` (password only in this sitting; later sittings add their ways); the CLI's `reset` records and queues its notice through `recordSecurityEvent`
- [X] T037 [US3] Enforce `stepUp` in `web/lib/guard.ts` (answering `{ ok: false, stepUp: true }`); create `web/lib/accountActions.ts` (`saveName`, `changePassword`, `setMethodEnabled`, `signOutEverywhereElse`, `confirmIdentity`); fill `web/app/(app)/account/page.tsx` with `web/components/account/MethodRow.tsx`, `PasswordControls.tsx`, `SecurityEvents.tsx`, `StepUpDialog.tsx` (Pico `dialog`), Email and Name fields (email change arrives in S4); `web/app/(app)/layout.tsx` passes the signed-in account's name to `Header`, which shows it
- [X] T071 [US3] (owner, 2026-11-06) Account tab in the Settings layout (Panels: User Profile with a Details card, Ways of signing in as two Pico `.grid` rows of two cards, Sign-ins, Recent activity); migration `019_session_details` (`sessions.ip`, `os`, `location`); install `geoip-lite@2.0.3` and `@types/geoip-lite@1.4.4` (dev) exact; `src/accounts/device.ts` (`osFrom`, `roundedPosition`, `locationLabel`), `src/accounts/geo.ts` (geoip-lite, MaxMind noted), `displayIp`; the browser position asked on sign-in and create-account (`web/lib/position.ts`), `Permissions-Policy: geolocation=(self)`; `SessionStore.activeFor`; `signOutDevice` flow and action; tests: `tests/device.test.ts` (4 unit), a session contract case (1 unit), a `signOutDevice` case (1 unit), the Account page UI test extended (0 new)
- [X] T038 [US3] Run `npm run check` and `npm run check:db` until green; quickstart §2.5 (the lockout notice) and §5.1–§5.3 (2026-11-06: walked in the browser with the owner; the lockout notice is queued but not sent while .env has no SMTP settings); delete the marker; commit S3 only when the owner asks

---

## Phase 5: User Story 4 - Sign in with an emailed link, and User Story 7 - password reset (P2)

**Goal**: FR-012 (admin email change), FR-014 (email change), FR-019, FR-024 (links), FR-026,
FR-041–FR-043, FR-047 (step-up by emailed link). **Independent Test**: quickstart §5.4–§5.7, §6.4.

### Sitting S4: email links, test email, `/link`, reset, email change, step-up link

#### Tests (S4)

- [ ] T039 Create `.specify/sitting-in-progress` naming S4
- [ ] T040 [P] [US4] Extend `tests/helpers/tokenContract.ts` and `accountContract.ts` with 4 cases (4 unit; 1 strict: 1 integration): `TokenStore.makeEmailToken(userId, { purpose, digest, newEmail?, sessionDigest?, returnPath? }, now)` stores it with `expires_at` 15 minutes (`signin`, `step_up`), 30 minutes (`reset`) or 24 hours (`email_change`) on and ends that account's unused tokens of the purpose; `spendEmailToken(digest, purpose, now, { sessionDigest? })` returns the account (with `new_email`, `return_path`) once, within its time, and `null` for a second use, an expired one, the wrong purpose, or a `step_up` token whose `session_digest` isn't the one given (that token stays unspent); `emailTokenFor(digest)` gives a token's purpose and `session_digest` without spending it; **strict** two concurrent spends give one success; `AccountStore.changeEmail(userId, email, emailKey)` refuses a key another account holds
- [ ] T041 [P] [US4] Write unit tests (9), 7 in `tests/emailLinkFlow.test.ts` for `src/accounts/flows/emailLinks.ts` and 2 in `tests/stepUpLinkFlow.test.ts`: `requestSignInLink` answers `link_sent` for every email and queues a link only for an account with `email_link` usable, at most 3 per email per 15 minutes, and with mail off answers `mail_off` for an account's email and an unknown one alike; `spendEmailLink(signin)` signs in once and records `signed_in` with method `email_link`, refusing a reused or expired link with `link_expired`; `sendTestEmail` queues the test mail or answers `mail_off`; with mail off `email_link` can't be made usable; `requestEmailChange` (step-up, limited) queues the confirm mail to a free new address and changes nothing, answers `email_change_sent` alike for an address another account uses and queues nothing to it, and answers `email_unchanged` for the current address; `spendEmailLink(email_change)` changes the email, queues the notice to the old address and records `email_changed`; an address another account took meanwhile answers `email_taken` and changes nothing. Step-up link: `requestStepUpLink(ctx, session, returnPath)` queues a `step_up` link (15 minutes, bound to this session's digest, `returnPath` through `safeReturnPath`) only with mail on, else `mail_off`, at most 3 per email per 15 minutes; `spendEmailLink(step_up)` from the requesting session sets its `verified_at` and answers `{ ok: true, next: returnPath }`, while from another session it answers `step_up_other_browser` and spends nothing (the spend carries the session digest; `emailTokenFor` tells it apart from an expired link)
- [ ] T042 [P] [US7] Write unit tests (3) in `tests/recoveryFlow.test.ts` for `requestPasswordReset`, `spendEmailLink(reset)` and `adminChangeEmail`: the request answers `link_sent` for every email, or `mail_off` for every email with mail off; the reset checks the new password against the rule before spending the token (a weak one answers `password_rule` and the link still works), then sets the password, enables password sign-in, ends every session (this browser's included), signs no one in, records `password_reset`, and a second use answers `link_expired`; `adminChangeEmail` (admin, step-up) changes at once, notifies the old address, keeps the user's sessions and records `admin_email_change`
- [ ] T043 [P] [US4] Write a UI test (1) in `tests/client/linkPage.test.tsx`: `/link` reads `#p=signin&t=…`, clears the fragment from the address bar before anything else, shows one button and posts the token only when it is pressed; `p=reset` shows the new-password form with the rule and, after it, a "Sign in" link; `p=step_up` shows "Confirm it's you" and goes to the answered `next` path; an expired answer shows `link_expired` with "Send a new link"; the step-up dialog offers "Email me a confirmation link" and shows the sent message

#### Implementation (S4)

- [ ] T044 [US4] Add the store methods of T040 (`makeEmailToken`, `spendEmailToken` with its session digest, `emailTokenFor`, `changeEmail`; `src/db/kysely/tokenStore.ts`, `accountStore.ts` and the memory stores); add the Sign-in link, Password reset, Confirm new email, Confirm it's you, Email changed and Test builders to `src/mail/messages.ts` and `email_change_sent` to `MESSAGES`; create `src/accounts/flows/emailLinks.ts` (sign-in link, test email, email change, reset, step-up link; `mail_off` from the link and reset requests when mail is off) and `adminChangeEmail` in `src/accounts/flows/admin.ts`; enabling `email_link` with mail on stores `ready = 1`, and `usable` counts it only while mail is on
- [ ] T045 [US4] Create `web/app/(public)/link/page.tsx` with `web/components/account/LinkButton.tsx`; add `requestSignInLink`, `requestPasswordReset`, `spendEmailLink` to `signInActions.ts`, `sendTestEmail`, `requestEmailChange`, `requestStepUpLink` to `accountActions.ts`, `adminChangeEmail` to `adminActions.ts`; the sign-in form gains "Email me a link" and "Forgot password"; the Account tab gains `EmailLinkControls.tsx` (Send test email) and the pending email change; the step-up dialog gains "Email me a confirmation link"; the admin section gains Change email; add `/link` to `ROUTES` in `tests/webBuild.test.ts` (0 new)
- [ ] T046 [US4] Run `npm run check` and `npm run check:db` until green; quickstart §5.4–§5.7 and §6.4; delete the marker; commit S4 only when the owner asks

---

## Phase 6: User Story 5 - Authenticator app, and User Story 7 - recovery codes (P2)

**Goal**: FR-021, FR-022 (app, recovery code), FR-024 (app codes), FR-027, FR-028, FR-049 (TOTP
window), FR-050. **Independent Test**: quickstart §6.1–§6.3.

### Sitting S5: authenticator app and recovery codes

#### Tests (S5)

- [ ] T047 Create `.specify/sitting-in-progress` naming S5; install `otpauth@9.6.0`, `qrcode@1.5.4` exact and `@types/qrcode@1.5.6` exact (dev) through the lockfile, keeping platform entries; `docker compose build`
- [ ] T048 [P] [US5] Extend `tests/seal.test.ts` (1 unit): a value sealed for `totp_secret` opens only as `totp_secret`, not as `app_password`
- [ ] T049 [P] [US5] Extend `tests/helpers/methodContract.ts` and `tokenContract.ts` with 3 cases (3 unit; 1 strict: 1 integration): `MethodStore.saveAuthenticator(userId, sealedSecret, ready, now)` and `removeAuthenticator(userId, { mailOn }, now)`, which refuses removing the last usable way; **strict** `acceptStep(userId, step)` succeeds only when `step > totp_last_step` in one statement, and two concurrent calls with one step give one success; `TokenStore.replaceRecoveryCodes(userId, digests, now)` deletes the old set in the same transaction, `spendRecoveryCode(userId, digest, now)` succeeds once, and `recoveryCodesLeft`
- [ ] T050 [P] [US5] Write unit tests (6) in `tests/totp.test.ts` and `tests/recoveryCodes.test.ts`: `newAuthenticator(random)` gives a 20-byte secret and an `otpauth://totp/myjobbot:<email>?…&issuer=myjobbot` URI; `checkCode(secret, code, now)` gives the step for the current step and one either side and `null` beyond (otpauth `validate({ window: 1 })`, checked against the last 6 digits of RFC 6238's SHA-1 vectors); a code whose step is at or before `totp_last_step` is refused; recovery codes: 10 per set, each 10 characters from the 32-symbol alphabet `A–Z` without `I` and `O`, and `2–9`, shown `xxxxx-xxxxx`, normalised (case, spaces, dash) before digesting
- [ ] T051 [P] [US5] Write unit tests (7), 5 in `tests/authenticatorFlow.test.ts` and 2 in `tests/recoveryCodesFlow.test.ts`: `startAuthenticatorSetup` (step-up) stores the sealed pending secret with `ready = 0` and returns the QR data URL and the secret once; `confirmAuthenticator` with a right code readies it and, the first time a key or app is set up, returns ten recovery codes and records `app_added` and `recovery_codes_made`; `signInWithAuthenticator` with email and current code signs in, while a reused step and a disabled app answer `signin_failed`; with `MYJOBBOT_SECRET_KEY` missing or invalid, setup answers `secret_key_missing`, and a secret the key can no longer open makes sign-in answer `signin_failed`; `removeAuthenticator` (step-up) clears it and records `app_removed`, refusing with `last_way` when it is the last usable way. Recovery codes: `signInWithRecoveryCode` spends one code and records `recovery_code_used` (with its notice), and still signs in after the authenticator is removed while another way stays usable (spec edge case); `makeRecoveryCodes` (step-up) replaces the set, and `confirmIdentity` accepts an app code and a recovery code
- [ ] T052 [P] [US5] Write a UI test (1) in `tests/client/authenticatorControls.test.tsx`: setup shows the QR image and the secret as text, refuses a wrong code, then shows the ten recovery codes once with a "I've saved them" button; the Account tab shows the codes left and "Make new codes"

#### Implementation (S5)

- [ ] T053 [US5] Add `"totp_secret"` to `SealedField` in `src/gmail/seal.ts`; create `src/accounts/totp.ts` (otpauth `TOTP` SHA-1, 6 digits, 30 s), recovery-code functions in `src/accounts/tokens.ts`, and the store methods of T049 (`src/db/kysely/methodStore.ts`, `src/db/kysely/tokenStore.ts`, memory stores)
- [ ] T054 [US5] Create `src/accounts/flows/authenticator.ts` and `src/accounts/flows/recoveryCodes.ts`; QR as `QRCode.toDataURL(uri)` on the server; add `startAuthenticatorSetup`, `confirmAuthenticator`, `removeAuthenticator`, `makeRecoveryCodes` to `accountActions.ts` and `signInWithAuthenticator`, `signInWithRecoveryCode` to `signInActions.ts`; `web/components/account/AuthenticatorControls.tsx` and `RecoveryCodes.tsx`; the sign-in form gains Authenticator code and Recovery code; the step-up dialog gains both ways (`confirmIdentity.ts` accepts an app code and a recovery code)
- [ ] T055 [US5] Run `npm run check` and `npm run check:db` until green; quickstart §6.1–§6.3 with a real authenticator app; delete the marker; commit S5 only when the owner asks

---

## Phase 7: User Story 6 - Sign in with a hardware key (P3)

**Goal**: FR-020, FR-022 (key), FR-046 (key names), FR-049 (keys). **Independent Test**:
quickstart §7.

### Sitting S6: hardware keys

#### Tests (S6)

- [ ] T056 Create `.specify/sitting-in-progress` naming S6; install `@simplewebauthn/server@14.0.3` and `@simplewebauthn/browser@14.0.0` exact through the lockfile, keeping platform entries; `docker compose build`
- [ ] T057 [P] [US6] Add `tests/helpers/keyContract.ts` (registered like T003) with 4 cases (4 unit; 1 strict: 1 integration): **strict** `KeyStore.addKey(userId, { name, credentialId, publicKey, counter, transports }, now)` refuses a name the account already uses and a `credential_id` any account uses (unique indexes), and two concurrent `spendChallenge` calls give one success; `keys(userId)` lists names only for display, `keyByCredential`, `updateCounter`; `removeKey(userId, id, { mailOn })` readies `hardware_key` off when the last goes and refuses removing the last usable way; `makeChallenge(digest, purpose, userId, now)` expires 5 minutes on and `spendChallenge` works once within it
- [ ] T058 [P] [US6] Write unit tests (6), 5 in `tests/keysFlow.test.ts` for `src/accounts/keys.ts` and `src/accounts/flows/keys.ts`, with SimpleWebAuthn's `verify*` replaced by a scripted fake in `tests/helpers/fakeWebAuthn.ts`, and 1 in `tests/accountRules.test.ts`: registration options name `rpID` = the base URL's host and `expectedOrigin` = its origin, attestation `none`, the account's existing keys excluded; a verified registration stores the key under its name and, if it is the first key or app, returns ten recovery codes; sign-in options use a fresh challenge spent once within 5 minutes; a verified answer for an added key signs in and updates the counter; a counter that doesn't increase (non-zero) is refused and records `key_counter_error`, and an unknown key, a disabled `hardware_key` row, an expired or reused challenge and a failed verification answer `signin_failed`; and in `accountRules.test.ts`, `checkKeyName` refuses empty, over 50 characters and control characters with `key_name_invalid`
- [ ] T059 [P] [US6] Write a UI test (1) in `tests/client/keyControls.test.tsx` with `@simplewebauthn/browser` mocked (`startRegistration`, `startAuthentication`, `browserSupportsWebAuthn`): the add-key form needs a name, shows `key_name_taken` for a repeated name, lists keys by name with Delete; the sign-in form's Hardware key choice starts and finishes a key sign-in

#### Implementation (S6)

- [ ] T060 [US6] Create `KeyStore` (`src/db/keyStore.ts`, `src/db/kysely/keyStore.ts`, `tests/helpers/memoryKeyStore.ts`, in `Stores`) with the methods of T057; add `checkKeyName` to `src/accounts/names.ts`; create `src/accounts/keys.ts` (SimpleWebAuthn `generateRegistrationOptions`, `verifyRegistrationResponse`, `generateAuthenticationOptions`, `verifyAuthenticationResponse`) and `src/accounts/flows/keys.ts`; `confirmIdentity.ts` accepts a key
- [ ] T061 [US6] Create `web/lib/keyActions.ts` (`startKeyRegistration`, `finishKeyRegistration`, `removeKey` with step-up; `startKeySignIn`, `finishKeySignIn` public) and `web/components/account/KeyControls.tsx` using `@simplewebauthn/browser` (`startRegistration`, `startAuthentication`); the sign-in form and the step-up dialog gain Hardware key
- [ ] T062 [US6] Run `npm run check` and `npm run check:db` until green; quickstart §7 with a YubiKey or the browser's virtual authenticator; delete the marker; commit S6 only when the owner asks

---

## Phase 8: Polish & cross-cutting

### Sitting S7: copy-prod, docs, Helm, env, quickstart

- [ ] T063 Create `.specify/sitting-in-progress` naming S7
- [ ] T064 Write an integration test (1) in `tests/integration/copyProd.test.ts`: copy `scripts/copy-prod.sh` into a scratch directory's `scripts/` with a fake `.env` (made-up values for `MYJOBBOT_DB_HOST`, `_USER`, `_PASSWORD`, `MYJOBBOT_COPY_DB_USER`, `_PASSWORD`) and put fake `mysql` and `mysqldump` scripts first on `PATH` that append their arguments to a log and print what the script reads back (a table list, the summary counts); run it with `myjobbot_dev --yes` and check that the main `mysqldump` of `myjobbot` passes `--ignore-table=myjobbot.<table>` for each of `sessions`, `email_tokens`, `auth_challenges`, `auth_attempts`, `account_codes` and no other table, that a second `mysqldump --no-data myjobbot` names exactly those five, and that no password reaches any argument (research R19)
- [ ] T065 Make `scripts/copy-prod.sh` skip those five tables' rows: one list of them, `--ignore-table=myjobbot.<table>` for each on the main dump, then `mysqldump --no-data` of the five into the target so their empty tables exist, naming only those of the five that production has (read from `information_schema` with the read-only login), so a copy taken before production has `018_accounts` still works; the summary line and refusals don't change
- [ ] T066 [P] Add `MYJOBBOT_BASE_URL`, `MYJOBBOT_TRUSTED_PROXIES` (1) and the SMTP and mail-from variables to `deploy/helm/myjobbot/values.yaml` (documented, values from the Secret) and `templates/web.yaml`; note in `NOTES.txt` the `kubectl exec … -- npm start -- account init <email>` step; check with `helm template` (never printing secrets)
- [ ] T067 [P] Update `README.md`: accounts and sign-in, the first-admin command and reset, creation codes, mail settings (and that without them "Email me a link" and "Forgot password" say mail isn't set up), `localhost` vs LAN hosts over HTTP (research R3), one shared per-address limit without a trusted proxy (research R6), the error page's fixed message (details in the server log), the security model in brief; and under Develop, that `scripts/copy-prod.sh` copies the accounts and their ways of signing in but no sessions, links, challenges, attempt counts or creation codes (research R19)
- [ ] T068 [P] Update `CLAUDE.md` with a feature 024 entry (accounts in `src/accounts/`, the five stores, the gate in `web/proxy.ts` and `src/web/security/`, server actions decided by `guarded`, the `(app)`/`(public)` layouts, every action through `guarded`, fixed messages, one-time values spent in the checking statement, authenticator secrets sealed, never logging secrets, the CSP, strict-only store contract cases on MariaDB), the `account init|reset` command under Commands, and the `scripts/copy-prod.sh` line noting the skipped tables; check `.specify/memory/constitution.md` still agrees (no change expected)
- [ ] T069 Walk the whole of quickstart.md §1–§8, including the cross-site form, `curl` header checks, the framing test, the `?next=` checks and the database check that only digests and sealed text are stored; fill the ledger's last row; review every new component against research R18's Pico table and grep `git diff main -- web/app/styles.css` for `px` and colour literals, replacing any hit with a Pico variable
- [ ] T070 Run `npm run check` and `npm run check:db` until green; delete the marker; commit S7 and open the PR only when the owner asks; after the merge, `docker compose build` and start the stack (`myjobbot_dev`'s admin already exists from T019)

---

## Dependencies & Execution Order

- S1 → S2 → S3 → S4 → S5 → S6 → S7, in one branch and one PR; each sitting ends green.
- S1 is the base of everything (schema, sessions, gate, CSRF, layouts, password, `guarded`). S2
  needs S1's session creation; S3 needs S1's sessions for step-up and S2's mail for notices; S4
  needs mail (S2) and step-up (S3); S5 and S6 need step-up (S3) and share recovery codes (S5 first,
  so S6's first-key codes reuse them). S7's copy-prod change needs S1's tables.
- Within a sitting, its tests come first and fail first.
- First production callers:
  - S1: the migration; `SessionStore`, `AccountStore` (`initOwner`, `byEmailKey`, `account`,
    `isAdmin`, `recordEvent`), `MethodStore` (`passwordDigest`, `setPassword`); `emails`,
    `passwordRule`, `returnPath`, `messages`, `limits`, `tokens`, `passwordDigest`, `events`; the
    security layer, `signIn`, the gate, the layouts, `guarded`, `signedOut`, the route's `HEAD`,
    the CLI.
  - S2: mail (settings, mailer, queue, and the Account created and Someone tried builders),
    `TokenStore` (`makeCode`), `createAccount`/`accounts`/`setAdmin`, `names` (`checkName`), the
    create and admin flows (`makeAccountCode` in `admin.ts`), `accountState`.
  - S3: `methods`/`setEnabled`, `saveName`, `recentEvents`, `setVerified`, `methods.ts`,
    `stepUp.ts` (through `guarded`'s `stepUp`), account changes, `noticeFor`,
    `recordSecurityEvent`, `confirmIdentity`, the Security notice builder.
  - S4: email tokens (`makeEmailToken`, `spendEmailToken`, `emailTokenFor`), `changeEmail`, the
    email-link flows and the step-up link, the Sign-in link, Password reset, Confirm new email,
    Confirm it's you, Email changed and Test builders.
  - S5: the seal field, the authenticator methods, recovery codes, TOTP.
  - S6: `KeyStore`, `checkKeyName`, keys.
  - S7: no new TypeScript (the copy-prod change is a shell script, tested from `tests/integration/`).

## Parallel examples

- S1 tests T002–T011 are separate files: all `[P]`.
- S2: T021–T026 in parallel after the install (T020); T024 and T058 both add one case to
  `tests/accountRules.test.ts`, in different sittings.
- S3: T033 and T034 touch different files (T033 extends `tests/actionGuards.test.ts`, which T010
  created in S1).
- S5: T048–T052 in parallel after the install (T047).
- S7: T066–T068 in parallel after T064 and T065.

## Implementation strategy

- **MVP** = S1: the UI behind a password sign-in, with every security layer on. It could ship alone
  if the owner ever wants to stop there.
- Then S2 (other people), S3 (self-service), S4 (mail-based ways, resets and the step-up link),
  S5, S6, S7.

## Test ledger (constitution II: target 95 / 4 / 1 by count)

| Point | Unit | Integration | UI |
|---|---|---|---|
| Baseline (T001, 2026-11-06) | 961 | 75 (1 failing before this feature: `migrate.test.ts` read the dev database through the test login, which can't see it since the per-checkout logins; rewritten in S1 to check the test database's own utf8mb4 / utf8mb4_general_ci, owner decision 2026-11-06) | 67 |
| S1 | +52 | +2 | +2 |
| S2 | +17 | +2 | +2 |
| S3 | +23 | +1 | +3 |
| S4 | +16 | +1 | +1 |
| S5 | +17 | +1 | +1 |
| S6 | +10 | +1 | +1 |
| S7 | +0 | +1 | +0 |
| Planned after (S7) | +135 | +9 | +10 |

New tests: 129 / 9 / 8 (88.4% / 6.2% / 5.5% of 146). Against 023's baseline of
922 / 70 / 64 (87.31% / 6.63% / 6.06%), every share moves toward 95 / 4 / 1: the suite becomes
about 1051 / 79 / 72 (87.44% / 6.57% / 5.99%). Only the six strict store-contract cases, the
migration test and the mailer test touch MariaDB or the network, and the copy-prod case runs a
child process against fake clients (owner decision, 2026-11-06); every other contract case runs on
the memory stores only. T001 re-takes the baseline and records the suite's mix after this feature.
