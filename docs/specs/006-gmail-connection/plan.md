# Implementation Plan: Gmail connection panel

**Branch**: `006-gmail-connection` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/006-gmail-connection/spec.md`

## Summary

Add a Gmail panel to Settings. The owner saves a Google OAuth client (ID and secret), connects
through Google's consent screen (authorization code + PKCE, `gmail.readonly`), and the panel shows
the connected address. "Check now" counts job-alert emails from the last 7 days, and "Disconnect"
revokes. Secrets are sealed with AES-256-GCM under `MYJOBBOT_SECRET_KEY` from `.env` and stored in
MariaDB through a new `GmailStore`. OAuth runs through **google-auth-library 11.3.0**
(owner-approved 2026-10-15, exact pin). Decisions (sealing, request validation, query building,
message summaries, state transitions, the panel's view) are plain functions with unit tests. The
Google client sits behind a small interface with a fake in tests. The agent and scheduled runs
don't change.

## Technical Context

**Language/Version**: TypeScript 6.0.3, Node 24

**Primary Dependencies**:
- Existing: Next.js 16, React 19, Kysely 0.29.6, mysql2 3.24.6, zod
- **New**: `google-auth-library@11.3.0`, exact pin, in the lockfile. It processes untrusted input
  (Google's responses); we use only `OAuth2Client`.

**Storage**: MariaDB. Migration step `002_gmail` adds `gmail_connection` (one row) and
`gmail_connect_requests`.

**Testing**: vitest. Unit (`node`), UI (`dom`), integration (`integration`, `myjobbot_test`).

**Target Platform**: the web container (Next.js dev server) on the owner's server, reached over
the LAN; connecting is done through `localhost` (an SSH tunnel).

**Project Type**: web UI plus a shared library in `src/`

**Performance Goals**: "Check now" within 5 s for ≤ 500 alert emails in 7 days. The panel
renders with Settings in under 1 s.

**Constraints**:
- No secret reaches the browser, logs, traces or errors (FR-005, SC-003).
- The redirect URI must be loopback.
- Habit-hooks limits.
- `src/` must not import `web/` or `next`.

**Scale/Scope**: one owner, one connection; about 8 new modules, 1 migration, 1 route, 5 server
actions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (constitution v2.2.0)

| Principle | Status |
|---|---|
| I. Habit-hooks clean at every sitting boundary | Pass: decisions split into small pure modules; each sitting wires what it builds (see tasks) |
| II. Test-first; `check` and `check:db` | Pass: split below; the store contract grows by 5 cases and runs against the fake and MariaDB |
| III. Purpose comments only | Pass |
| IV. Bounded, locked dependencies | Pass: `google-auth-library` owner-approved after the options were presented (fetch-only, google-auth-library, googleapis); pinned exactly `11.3.0`, installed via the lockfile with optional platform entries kept |
| V. Specs live in `docs/specs` | Pass |
| Storage rules (CLAUDE.md) | Pass: numbered step `002_gmail.ts`, listed in `migrations/index.ts`, `schema.ts` updated, contract cases added in a new per-store file `tests/helpers/gmailStoreContract.ts` (`storeContract.ts` is at 181 of 200 lines; CLAUDE.md updated in T029 to allow a contract file per store), `utf8mb4_bin` |
| Workflow: sittings, main checkout, Docker stopped | Pass: S0 stops the stack (production; scheduled runs pause until merge) |

Rollback has a catch: reverting the code alone fails at startup, so either keep the `002_gmail`
step file or remove its migration record (research R9).

**New tests' split (Principle II)**, matching the ledger in tasks.md:
- **Unit**: 26.
  - sealing: 4
  - settings key: 1
  - loopback: 1
  - panel view: 3
  - connect request (state and PKCE, redirect, expiry, auth URL options): 4
  - Google error codes: 1
  - connection service: 8 (S1: save, key changed; S2: start, finish, outcomes; S3: check, check
    failures, disconnect)
  - alert query and summaries: 4
- **Contract**: 5 cases, which count once as unit (memory fake) and once as integration
  (MariaDB). The migration test's two assertions are updated in place.
- **UI**: 3 new tests in the panel's file (one per sitting). The settings page test is updated in
  place.

That is 31 unit, 5 integration and 3 UI, ending at 258 / 25 / 30. The mix holds steady rather
than moving toward the target: unit stays at about 82.8%, and integration rises from 7.3% to
8.0%, because each contract case also runs on MariaDB (the project's contract rule).

**Signatures**: each service function takes `GmailDeps` first (data-model.md), which keeps it
within eslint's `max-params: 3`.

Post-design re-check: pass. No Complexity Tracking needed.

## Project Structure

### Documentation (this feature)

```text
docs/specs/006-gmail-connection/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/gmail-panel.md   # panel states, actions, callback route
├── checklists/requirements.md
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
src/gmail/
├── seal.ts          # seal/open with AES-256-GCM, key from MYJOBBOT_SECRET_KEY (pure, node:crypto)
├── secretKey.ts     # key status: missing / invalid / ok; never exposes the value
├── connectRequest.ts# loopback check, state + PKCE, auth URL options, callback validation (pure)
├── googleErrors.ts  # library error → fixed code; GoogleError never carries request data
├── alerts.ts        # Gmail search query from sender list; message header → summary (pure)
├── google.ts        # GoogleApi interface + the google-auth-library implementation
├── check.ts         # Check now: paging the ids, the newest five's headers (S3)
└── connection.ts    # GmailDeps; saveCredentials, clearCredentials, keyChanged, startConnect,
                     # finishConnect, disconnect
src/db/
├── migrations/002_gmail.ts, migrations/index.ts, schema.ts
├── store.ts         # + GmailStore interface, Stores.gmail
└── kysely/gmailStore.ts
src/web/gmailPanel.ts  # connection row + env → panel view (pure)
src/config/schema.ts   # + gmail.alert_senders (defaults: LinkedIn and Indeed alert senders)
web/app/settings/page.tsx                 # renders <GmailPanel>
web/app/settings/gmail/callback/route.ts  # GET: finishes the connection, redirects to /settings
web/components/settings/GmailPanel.tsx    # server component: renders the view's message and offers
web/components/settings/CredentialsForm.tsx  # client ID and secret fields, Save
web/components/settings/CheckNow.tsx      # "use client": Check now with useTransition (S3)
web/components/settings/DisconnectButton.tsx # "use client": window.confirm, then the action (S3)
web/lib/gmailActions.ts                   # server actions
tests/
├── seal.test.ts, secretKey.test.ts, connectRequest.test.ts, googleErrors.test.ts,
│   gmailAlerts.test.ts, gmailConnection.test.ts, gmailPanel.test.ts      (unit)
├── storeContract.test.ts                    (runs the Gmail contract on the fake)
├── helpers/gmailStoreContract.ts, helpers/memoryGmailStore.ts, helpers/fakeGoogle.ts,
│   helpers/memoryStore.ts, helpers/testDb.ts (TABLES)
├── integration/storeContract.test.ts, integration/migrate.test.ts (updated)
├── webBuild.test.ts                         (+ callback route)
└── client/gmailPanel.test.tsx (new), client/settings.test.tsx (async page)   (UI)
knip.json                                    # + web/app/**/route.ts as a Next.js entry
```

**Structure Decision**: Gmail logic gets its own `src/gmail/` folder. It is reused later when
alert reading reaches the agent. The web layer stays thin.
