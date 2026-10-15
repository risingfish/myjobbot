# Implementation Plan: Gmail connection panel

**Branch**: `006-gmail-connection` | **Date**: 2026-10-15 (revised the same day for IMAP) | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/006-gmail-connection/spec.md`

## Summary

Settings gets a Gmail panel. The owner enters their Gmail address and an app password and
presses Connect; myjobbot signs in to `imap.gmail.com` over TLS to prove the pair works, then
stores it with the password sealed (AES-256-GCM under `MYJOBBOT_SECRET_KEY`) in MariaDB.

- **Check now**: opens All Mail read-only, runs Gmail's own search (`X-GM-RAW`) for the
  configured alert senders over 7 days, and reports the count and the newest five envelopes.
- **Disconnect**: forgets the pair and points the owner to Google's app-passwords page.
- **IMAP library**: imapflow 2.3.0 (owner-approved, exact pin, `logger: false`).
- **Shape of the code**: decisions live in plain functions with unit tests, and IMAP sits behind
  a small interface with a fake.
- **Agent**: unchanged.

This revision replaces the Google sign-in version built in S1–S4 (research R8 lists what goes).
The encryption, the store pattern, the panel view, the alert senders and the Check now design
carry over.

## Technical Context

**Language/Version**: TypeScript 6.0.3, Node 24

**Primary Dependencies**:
- Existing: Next.js 16, React 19, Kysely 0.29.6, mysql2 3.24.6, zod
- **New**: `imapflow@2.3.0`, exact pin, in the lockfile. It processes untrusted input (IMAP
  server replies).
- **Removed**: `google-auth-library`.

**Storage**: MariaDB. Migration step `002_gmail` (rewritten, never applied to production) creates
`gmail_connection`.

**Testing**: vitest. Unit (`node`), UI (`dom`), integration (`integration`, `myjobbot_test`).

**Target Platform**: the web container (Next.js dev server) on the owner's server. IMAP is
reached from the server, so Settings works from any LAN address.

**Project Type**: web UI plus a shared library in `src/`

**Performance Goals**: Connect (one sign-in) and Check now each within 5 s on the owner's mailbox.

**Constraints**:
- The app password never reaches the browser, logs, traces or errors (FR-005, SC-003).
- Mail is opened read-only (FR-003).
- Habit-hooks limits.
- `src/` must not import `web/` or `next`.

**Scale/Scope**: one owner, one connection. About 6 modules change, 4 are removed, and there are
3 server actions and no route.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (constitution v2.2.0)

| Principle | Status |
|---|---|
| I. Habit-hooks clean at every sitting boundary | Pass: each sitting wires what it builds; removed modules leave with their last caller |
| II. Test-first; `check` and `check:db` | Pass: split below; the Gmail store contract is rewritten for the new methods |
| III. Purpose comments only | Pass |
| IV. Bounded, locked dependencies | Pass: imapflow owner-approved after the options were presented (imapflow, imap/node-imap, no library); pinned exactly to `2.3.0`, a week old rather than the day-old 2.4.3; installed via the lockfile with the optional platform entries kept. google-auth-library is uninstalled |
| V. Specs live in `docs/specs` | Pass |
| Storage rules (CLAUDE.md) | Pass: step `002_gmail.ts` rewritten before reaching production (research R7), `schema.ts` updated, contract cases in `tests/helpers/gmailStoreContract.ts`, `utf8mb4_bin` |
| Workflow: sittings, main checkout, Docker stopped | Pass: the stack stays stopped until the merge |

**Tests after the rework (Principle II)**, measured in each sitting against the S4 counts (node
258, dom 31, integration 25):
- **Removed**: the OAuth tests. That is connect request (5), Google errors (1), the
  start/finish connection tests (3) and contract cases for requests (2). The OAuth UI assertions
  are rewritten in place.
- **Added (unit)**:
  - IMAP error codes: 1
  - connect, verify then save: 2
  - check with the fake IMAP: 2
  - disconnect: 1
  - panel view, rewritten in place: 0 net
- **Contract**: 3 cases instead of 5, each run on the memory fake (unit) and on MariaDB
  (integration).
- **UI**: the panel file keeps one test per story, rewritten in place.

The ledger in tasks.md records the actual counts.

Post-design re-check: pass. No Complexity Tracking needed.

## Project Structure

### Documentation (this feature)

```text
docs/specs/006-gmail-connection/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/gmail-panel.md   # panel states and actions
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/gmail/
├── seal.ts          # AES-256-GCM seal/open, field app_password (kept)
├── secretKey.ts     # key status: missing / invalid / ok (kept)
├── imapErrors.ts    # imapflow error → fixed code; GmailError; guarded() (new)
├── imap.ts          # ImapApi interface + the imapflow implementation (logger off, read-only) (new)
├── alerts.ts        # Gmail query from the sender list; envelope → summary; newest first (kept)
├── check.ts         # Check now (rewritten for ImapApi)
└── connection.ts    # GmailDeps; connect (verify, then save), keyChanged, disconnect (rewritten)
   removed: google.ts, googleErrors.ts, access.ts, connectRequest.ts
src/db/
├── migrations/002_gmail.ts (rewritten), schema.ts
├── store.ts         # GmailStore: connection, connected, needsReconnect, disconnect
└── kysely/gmailStore.ts
src/web/gmailPanel.ts          # row + key → panel view (rewritten); gmailOutcomes.ts removed
src/config/schema.ts           # gmail.alert_senders (kept)
web/app/settings/page.tsx      # renders <GmailPanel>; no searchParams
web/components/settings/GmailPanel.tsx, ConnectForm.tsx (was CredentialsForm.tsx), CheckNow.tsx,
                        DisconnectButton.tsx
web/lib/gmailActions.ts, gmailDeps.ts, uiState.ts
   removed: web/lib/gmailConnect.ts, web/app/settings/gmail/callback/route.ts
tests/
├── seal.test.ts, secretKey.test.ts, gmailAlerts.test.ts, imapErrors.test.ts (new),
│   gmailConnection.test.ts (rewritten), gmailPanel.test.ts (rewritten)          (unit)
├── helpers/fakeImap.ts (replaces fakeGoogle.ts), gmailStoreContract.ts, memoryGmailStore.ts,
│   gmailRows.ts, testDb.ts (TABLES)
├── integration/storeContract.test.ts, integration/migrate.test.ts (updated)
├── webBuild.test.ts                         (callback route removed from ROUTES)
└── client/gmailPanel.test.tsx, client/settings.test.tsx  (UI, rewritten)
knip.json                                    # route.ts entry removed again
```

**Structure Decision**: Gmail logic stays in `src/gmail/`, to be reused when the agent reads
alerts. The web layer stays thin.
