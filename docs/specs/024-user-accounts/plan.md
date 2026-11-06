# Implementation Plan: User accounts

**Branch**: `024-user-accounts` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/024-user-accounts/spec.md`

## Summary

The web UI gets accounts and a sign-in in front of everything, with security first. The existing
owner (user 1) becomes the first admin from the command line; admins make one-time, 7-day account
creation codes; anyone with one creates an account on a public page. An account signs in with any
one enabled, set-up way: password (Argon2id, built into Node), an emailed link (SMTP through
nodemailer), an authenticator app (otpauth, QR via qrcode) or a hardware key (SimpleWebAuthn), with
ten one-time recovery codes and emailed password resets for recovery. Sign-ins are server-side
sessions in MariaDB (30 days sliding), checked for every request in `web/proxy.ts` (server actions are decided by `guarded`), which also
enforces the CSRF defence (Origin check plus a SameSite=Strict token cookie bound to the session,
rebound on a cross-site arrival), the content policy and the security headers. Signed-in pages sit
in an `(app)` route group with the navigation and footer; the sign-in, account creation and link
pages sit in a `(public)` group that shows neither. Every server action is also wrapped by one
`guarded` helper for the session, admin and step-up checks (the step-up check can also be passed
by an emailed confirmation link). Every decision (password rule, return path, limits, token and
code formats, CSRF and origin checks, client address, TOTP steps, messages) is a plain function,
unit-tested; stores have contracts run on memory and MariaDB. Data stays shared: no existing table
is tied to a user.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node 24 (tsx; image `node:24.21.0-alpine3.24`); Next.js 16.4,
React 19

**Primary Dependencies**: Kysely 0.29, zod 4, Pico; **new, approved by the owner (2026-11-05)**:
nodemailer 10.3.1, @simplewebauthn/server 14.0.3, @simplewebauthn/browser 14.0.0, otpauth 9.6.0,
qrcode 1.5.4 (+ dev `@types/qrcode` 1.5.6; nodemailer ships its own types), all exact pins; password digest from `node:crypto`'s `argon2` (research R1)

**Storage**: MariaDB, migration `018_accounts`: three columns on `users`, nine new tables
(data-model.md); authenticator secrets sealed with `MYJOBBOT_SECRET_KEY`

**Testing**: vitest `node` (unit: every store-contract case on the memory stores, flows on memory
stores and a memory mailer, fixed clock and random source, argon2 digests), `integration` (only the
strict store-contract cases, those that need a real transaction, race or constraint, plus migration
`018` on `myjobbot_test`, nodemailer against a fake STARTTLS SMTP server on `node:net` using a
committed test-only certificate, and `scripts/copy-prod.sh` against fake `mysql`/`mysqldump`
clients), `dom` (Account rows, sign-in, creation form, `/link`, admin section, step-up dialog,
authenticator controls, key controls)

**Target Platform / Project Type**: the owner's server (Docker) and the Kubernetes cluster (Helm,
HTTPS at the ingress); web app plus agent in one project

**Performance Goals**: sign-in under 1 s server time (argon2id at OWASP's 19 MiB / 2 passes / 1 lane
measured at ~56 ms locally); the proxy's session check is one indexed lookup, touched at most once a
minute

**Constraints**: security first (spec "Security model", FR-033–FR-053); no secret stored readable,
logged or printed; fixed messages only; one-time values spent in the checking statement; CSP with a
nonce on every page; the CLI and the scheduled run are untouched by the gate; local use stays on
`http://localhost:8080` (research R3)

**UI**: Pico first on every new page and component (owner, 2026-11-06; research R18): Pico's
elements, roles and classes; custom CSS only when Pico has nothing for it, with `--pico-*` variables
and `em` sizes, never `px`, colour literals or inline styles

**Scale/Scope**: a handful of accounts; ~60–90 files in one PR (owner decision, 2026-11-05)

## Constitution Check

Checked against constitution **v2.5.0**.

| Principle | Check |
|---|---|
| I. Habit-hooks clean | Every sitting ends green; each new module, store and export reached from a production entry point (proxy, CLI, a page or action) in the sitting that creates it (tasks.md "First production callers"); files ≤ 200 lines, so five stores (`SessionStore`, `AccountStore`, `MethodStore`, `TokenStore`, `KeyStore`), each with its own Kysely, memory and contract file, and actions split by page (`accountActions.ts`, `signInActions.ts`, `adminActions.ts`, `keyActions.ts`); ≤ 3 parameters by passing one context object (`AuthContext`: stores, clock, random, mailer, settings) |
| II. Test-first, mix | Tests before code in every task; 129 unit / 9 integration / 8 UI (88.4% / 6.2% / 5.5%), every share moving toward 95/4/1 from the baseline 87.31% / 6.63% / 6.06% to about 87.44% / 6.57% / 5.99%: store-contract cases run on MariaDB only when they need a real transaction, race or constraint (owner decision, 2026-11-06; research R16, ledger in tasks.md) |
| III. Purpose comments | One-line doc comment per function, component, hook and action |
| IV. Dependencies | Options and recommendations presented, **all approved 2026-11-05**; exact pins, lockfile with platform entries kept; libraries used through their own APIs (SimpleWebAuthn's `generate*/verify*`, otpauth's `TOTP`, nodemailer's transport, Kysely builders in `018`, `"bigint"` through the builder, `sql` only for the `tinyint` fragment and the table options) |
| V. docs/specs | This directory |
| Workflow (2.5.0) | S1 adds a migration and every sitting changes the web gate or stores: **the stack is stopped** (`docker compose stop`, no `docker:watch`) from the first code change until the feature merges; dependencies installed in the sitting of their first import, images rebuilt then |

**Owner exception**: one PR for the whole feature (owner decision, 2026-11-05) instead of the usual
small PRs; sittings still end green so review can go sitting by sitting (one commit each when the
owner asks).

Gate: passes.

## Project Structure

### Documentation (this feature)

```text
docs/specs/024-user-accounts/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/web.md, contracts/cli-env-mail.md
├── checklists/requirements.md
└── tasks.md                    (/speckit-tasks)
```

### Source Code (repository root)

```text
src/accounts/                    pure rules, no Next.js
  emails.ts                      normalizeEmail, isEmail, length/control-character checks (FR-007, FR-046)
  names.ts                       checkName (S2) and checkKeyName (S6) (FR-046)
  passwordRule.ts                10–128, four classes (FR-010)
  passwordDigest.ts              argon2id digest/verify, stand-in digest (R1, R9)
  tokens.ts                      random values, SHA-256 digests, recovery code format (R8)
  limits.ts                      attempt limits (R10)
  returnPath.ts                  safeReturnPath (FR-044)
  methods.ts                     usable, last-way rule, method states (FR-016, FR-017)
  stepUp.ts                      10-minute verification rule (FR-047), used by guard.ts
  totp.ts                        otpauth wrapper, step reuse (R12)
  keys.ts                        SimpleWebAuthn option/verify wrappers (R11)
  messages.ts                    one MESSAGES constant of fixed answers
  events.ts                      SECURITY_EVENTS and notice choices (FR-048, FR-051)
  flows/                         context.ts (AuthContext), signIn, createAccount, admin (makeAccountCode, setAdmin,
                                 adminChangeEmail), accountChanges, securityEvents (recordSecurityEvent: the event
                                 and its notice), confirmIdentity, emailLinks (with the step-up link),
                                 authenticator, recoveryCodes, keys: each a function over AuthContext,
                                 unit-tested on memory stores
  cli.ts                         account init/reset
src/web/security/                origin.ts, csrf.ts, cookies.ts, clientAddress.ts, headers.ts (CSP), baseUrl.ts, gate.ts
src/web/signedOut.ts             afterStreamFailure (the re-score stream's signed-out check)
src/mail/                        settings.ts, mailer.ts (port, transportOptions, smtpMailer), messages.ts, queue.ts
src/gmail/seal.ts                + field "totp_secret"
src/db/migrations/018_accounts.ts, src/db/schema/accounts.ts, src/db/schema/users.ts (+3 columns)
src/db/{session,account,method,token,key}Store.ts   interfaces
src/db/kysely/{session,account,method,token,key}Store.ts   Kysely classes (builders only)
src/cli.ts                       + account command
web/proxy.ts                     gate (contracts/web.md)
web/lib/guard.ts, web/lib/session.ts, web/lib/authDeps.ts, web/lib/env.ts, web/lib/accountState.ts (getAccountState)
web/lib/{signIn,account,key,admin}Actions.ts
web/app/layout.tsx               html, body, styles, metadata, force-dynamic only
web/app/api/rescores/[id]/route.ts + HEAD (204, no stores)
web/app/(app)/layout.tsx         Header (Nav, Sign out, account name) and Footer; recommended, applied, jobs,
                                 reasoning, settings and account pages moved in (URLs unchanged)
web/app/(public)/layout.tsx      app name only; sign-in, create-account, link pages
web/app/error.tsx                fixed message (FR-052)
web/components/account/          MethodRow, PasswordControls, EmailLinkControls, KeyControls, AuthenticatorControls,
                                 RecoveryCodes, SecurityEvents, StepUpDialog, SignInForm, CreateAccountForm, LinkButton,
                                 SignOutButton
web/components/settings/AdminSection.tsx
web/lib/pages.ts                 + Account; Nav + SignOutButton
docker/entrypoint.sh             serve refuses without MYJOBBOT_BASE_URL
scripts/copy-prod.sh             skips the rows of sessions and one-time tables (research R19)
.env.example, deploy/helm/myjobbot/values.yaml + templates/web.yaml (new env, TRUSTED_PROXIES=1)
tests/…                          unit per module; helpers memory{Session,Account,Method,Token,Key}Store, memoryMailer,
                                 fakeSmtp, fakeWebAuthn, {session,account,method,token,key}Contract;
                                 fixtures/smtp/ (test-only key and certificate); integration/accountsMigration,
                                 integration/mailer, integration/copyProd (+1 case); tests/actionGuards.test.ts
README.md, CLAUDE.md, constitution (no change expected)
```

**Structure Decision**: rules and flows in `src/accounts/` (no Next.js, like `src/rescore/`), the
HTTP security layer in `src/web/security/` as plain functions the proxy calls, Next wiring in
`web/`.

### Sittings (detail in tasks.md)

| # | Sitting | Stack |
|---|---|---|
| S1 | Schema `018` and types; `SessionStore`, `AccountStore`, `MethodStore` (their S1 methods) and contracts; the rules with S1 callers (emails, password rule, tokens, limits, return path, events, messages, argon2 digest); the security layer and the proxy gate; password sign-in, sign out; the `(app)`/`(public)` layouts and the error page; `guarded` wrapping every action; `account init/reset` CLI | stopped |
| S2 | Mail (nodemailer); `TokenStore` with codes; account creation, `/create-account`, names, the admin section (own mark included) | stopped |
| S3 | Account tab: name (also in the header), method rows and the last-way rule, password change, step-up dialog, sign out everywhere else, security events and notices | stopped |
| S4 | Email links: sign-in link, test email, `/link`, password reset, email change, admin email change, the step-up confirmation link | stopped |
| S5 | Authenticator app (otpauth, qrcode) and recovery codes | stopped |
| S6 | Hardware keys (SimpleWebAuthn), `KeyStore`, key names | stopped |
| S7 | copy-prod skipping session and one-time tables; Helm, env, README, CLAUDE.md; quickstart run-through | stopped until merge |

## Complexity Tracking

| Exception | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| One PR for ~60–90 files | Owner decision (2026-11-05) | Four slice PRs offered and declined |
| Built-in `crypto.argon2` is marked experimental in Node 24 | Owner chose Argon2id without a native dependency | Isolated in `passwordDigest.ts` with a self-describing stored format, so a Node API change touches one file |
