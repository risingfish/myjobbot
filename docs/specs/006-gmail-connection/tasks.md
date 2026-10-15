---
description: "Tasks for feature 006: Gmail connection panel"
---

# Tasks: Gmail connection panel

**Input**: Design documents from `docs/specs/006-gmail-connection/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/gmail-panel.md, quickstart.md

**Tests**: Required (constitution Principle II, test-first). Each test task names its kind.

**Organization**: by user story, planned in sittings.
- **Where the work happens**: a sitting may span turns, and is done in the main checkout on
  `006-gmail-connection` with the Docker stack stopped.
- **How a sitting ends**: with `npm run check` and `npm run check:db` green, then a commit of only
  that sitting's files (owner rule 2026-10-15: commit between sittings).
- **Wiring**: every new module, export and store method is reached from a production entry point
  (a page, a server action or the callback route) within its own sitting.

**Signatures** (eslint `max-params: 3`): every service function in `src/gmail/connection.ts` takes
`deps: GmailDeps = { gmail: GmailStore; key: Buffer; google?: GoogleFactory }` as its first
argument, and bundles any further inputs into one object.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3 from spec.md

---

## Phase 1: Setup

### Sitting S0: stop the stack, repair the baseline (T001–T002)

- [X] T001 Run `docker compose top myjobbot` and confirm no run is in progress, then
  `docker compose stop` (no `docker:watch`). The stack runs production from this checkout, so
  scheduled runs pause until the merge. Create `.specify/sitting-in-progress` naming S0.
- [X] T002 Get a green baseline:
  - The baseline is red at `a9971cd`: `tests/client/settings.test.tsx` expects an empty panel
    title, but the page now has a "Scoring" panel. Update the test to assert one Scoring panel
    titled "Scoring" (still 2 tests).
  - Run `npm run check` and `npm run check:db`, and record the counts in the ledger (expected node
    227, dom 27, integration 20).
  - Delete the marker. Commit only `docs/specs/006-gmail-connection/` and the test fix ("Plan the
    Gmail connection panel (006)"). The owner's uncommitted `web/app/styles.css` and the
    `.claude/skills/speckit-analyze-deep/` folder stay out of the commit.

---

## Phase 2: Foundational, the stored, sealed state behind the panel

### Sitting S1: storage, sealing and the panel's credential states (T003–T014)

Sealing, the store, the loopback check and the panel view all ship in S1, wired through the
Settings page:
- the key states: missing, invalid, changed
- the "No credentials" and "Not connected" states
- Save and Clear credentials

That is the first slice of US1.

#### Tests first

Create `.specify/sitting-in-progress` naming S1 before T003.

- [X] T003 [P] **Unit**: write `tests/seal.test.ts` for `seal(value, field, key)` and
  `openSealed(sealed, field, key)` from `src/gmail/seal.ts` (research R4). 4 tests:
  - a round trip returns the value, and two seals of one value differ (random IV)
  - opening with another key throws `SealError` "key changed or data damaged", and the message
    never contains the value
  - opening under another field name throws (the AAD binds the field)
  - a tampered tag, and a string not starting with `v1.`, both throw
- [X] T004 [P] **Unit**: write `tests/secretKey.test.ts` for `secretKeyStatus(env)` from
  `src/gmail/secretKey.ts`. 1 test with 3 cases:
  - missing gives `{ status: "missing" }`
  - not base64 of 32 bytes gives `{ status: "invalid" }`, with the value nowhere in the result
  - valid gives `{ status: "ok", key }` with a 32-byte `Buffer`
- [X] T005 [P] **Unit**: write `tests/connectRequest.test.ts` with `isLoopbackHost` from
  `src/gmail/connectRequest.ts` (1 test): `localhost:8080` and `127.0.0.1:8080` are true;
  `192.168.1.20:8080`, `localhost.evil.com` and `localhost:8080.evil.com` are false. S2 adds the
  rest of this file's tests.
- [X] T006 [P] **Unit and integration (contract)**: write `tests/helpers/gmailStoreContract.ts`
  (`gmailStoreContract(make)`, with a `CASES` list like `storeContract.ts`). S1 adds only case 1:
  - saving credentials stores the client ID, the sealed secret and the time
  - saving again replaces both
  - clear resets the row to `status: "none"`, with `client_id` and every secret null

  Call it from `tests/storeContract.test.ts` with the memory fake, and from
  `tests/integration/storeContract.test.ts` with MariaDB. Cases 2–4 come in S2 (T015) and case 5
  in S3 (T024).
- [X] T007 [P] **Unit**: write `tests/gmailPanel.test.ts` for
  `gmailPanelView(row, { keyStatus, keyChanged, host })` from `src/web/gmailPanel.ts`. The view
  carries `message` and `offers` (data-model.md), so these rules live in the view and the component
  only renders them. 3 tests:
  - the key is missing or invalid: `offers` is empty, and `message` names `MYJOBBOT_SECRET_KEY`
    and says to restart (the contract's text); a row with no credentials offers only `save`
  - credentials are saved and not connected: from `localhost:8080`, `canConnect` is true with no
    hint; from `192.168.1.20:8080`, `canConnect` is false with the hint "Open Settings at
    http://localhost:8080 to connect"
  - `keyChanged: true`: the state is `key_changed`, `message` is "Server key changed; enter the
    client secret again", `offers` is `["save"]`, and `canConnect` is false

  The view type has no field that can hold a secret.
- [X] T008 [P] **UI**: write `tests/client/gmailPanel.test.tsx`. Build the view with
  `gmailPanelView` from a row whose `client_secret` is a real sealed value (no cast), render
  `GmailPanel`, and check:
  - the client ID and "secret saved" are shown
  - the secret input is empty, `type=password` and `autocomplete=off`
  - neither the sealed value nor the plaintext appears in `container.innerHTML`
  - with the mocked save action returning a field error, the form shows it

  Mock `web/lib/gmailActions.js` once at the top of the file, as `hide.test.tsx` does, so no
  test loads the database driver.

  1 test. S2 and S3 each add one more test to this file (T019, T026). The shared rendering lives
  in a `renderPanel(row, options)` helper so each test stays under 20 lines.
- [X] T009 **UI**: update `tests/client/settings.test.tsx` for the async page. Mock
  `web/lib/uiState.js` (memory stores, a test key) and `next/headers.js` (host `localhost:8080`).
  Render `await SettingsPage({ searchParams: Promise.resolve({}) })` and expect 2 panels:
  Scoring, and Gmail. The test is changed in place.
- [X] T009a **Unit**: write `tests/gmailConnection.test.ts` (2 tests) for S1's services, against
  the memory Gmail store:
  - `saveCredentials(deps, input, now)` stores a `v1.`-sealed secret that `openSealed` turns back
    into the input, and refuses a client ID or secret of length 0 or 256 without storing anything
  - `keyChanged(deps, row)` is true when the row's secret was sealed under another key, and
    false under the same key or when no secret is saved

  S2 (T018) and S3 (T025) add to this file.

#### Implementation

- [X] T010 Create the pure modules:
  - `src/gmail/seal.ts`: AES-256-GCM, stored as `v1.<iv>.<ct>.<tag>` in base64url, with the
    field as the AAD, and `SealError`
  - `src/gmail/secretKey.ts`
  - `src/gmail/connectRequest.ts` with `isLoopbackHost` only

  T003–T005 pass.
- [X] T011 Write the schema step `src/db/migrations/002_gmail.ts` with the raw DDL, every table
  `utf8mb4_bin` like `001_initial`:
  - `gmail_connection`: `id TINYINT PK`, `client_id VARCHAR(255) NULL`, `client_secret TEXT NULL`,
    `credentials_saved_at VARCHAR(32) NULL`, `refresh_token TEXT NULL`, `email VARCHAR(320) NULL`,
    `connected_at VARCHAR(32) NULL`, `status VARCHAR(20) NOT NULL DEFAULT 'none'`,
    `reason VARCHAR(200) NULL`
  - `gmail_connect_requests`: `state CHAR(43) PK`, `code_verifier TEXT NOT NULL`,
    `created_at VARCHAR(32) NOT NULL`

  Then:
  - List it in `src/db/migrations/index.ts`.
  - Add both tables to `src/db/schema.ts`'s `Database`.
  - Add both to `TABLES` in `tests/helpers/testDb.ts`.
  - In `tests/integration/migrate.test.ts`, update both assertions: `ran.flat()` becomes
    `["001_initial", "002_gmail"]`, and the collation list holds all 5 tables in the order the
    query returns them. `information_schema` sorts by `utf8mb3_general_ci`, which puts
    `gmail_connection` before `gmail_connect_requests` (checked on the server), so the order is
    `api_calls`, `gmail_connection`, `gmail_connect_requests`, `jobs`, `verdicts`, each
    `utf8mb4_bin`.
- [X] T012 Add `GmailStore` to `src/db/store.ts` with only S1's methods (`connection`,
  `saveCredentials` and `clearCredentials`), and add `Stores.gmail`.
  - Implement `src/db/kysely/gmailStore.ts`. Row 1 uses `INSERT … ON DUPLICATE KEY UPDATE`.
  - Wire it in `src/db/kysely/stores.ts`.
  - Write `tests/helpers/memoryGmailStore.ts` and add it to `memoryStores()`.
  - In `CLAUDE.md`'s storage paragraph, allow a contract file per store (here
    `tests/helpers/gmailStoreContract.ts`, because `storeContract.ts` is near the 200-line limit).

  T006 passes against both.
- [X] T013 Services, the view and the web layer:
  - **`src/gmail/connection.ts`**: `GmailDeps`, `saveCredentials(deps, { clientId, clientSecret },
    now)` (both 1–255 characters; it seals the secret), `clearCredentials(deps)`, and
    `keyChanged(deps, row)`. `keyChanged` returns true when the stored secret won't open with the
    key; this is `openSealed`'s and `SealError`'s production use.
  - **`src/web/gmailPanel.ts`**: `gmailPanelView`.
  - **`web/lib/uiState.ts`**: it also returns `gmail: stores.gmail` and
    `key: secretKeyStatus(process.env)`. The key is parsed after `await stores()` has run
    `dbSettings()`, which loads the root `.env`; Next.js itself reads only `web/.env`, so parsing
    earlier would always see "missing". It is cached once parsed and never serialised.
  - **`web/lib/gmailActions.ts`**: `saveGmailCredentials` and `clearGmailCredentials`, which
    build `GmailDeps` from uiState and `revalidatePath("/settings")`.
  - **`web/components/settings/GmailPanel.tsx`** (server component; renders `view.message`,
    `view.offers` and the times as `YYYY-MM-DD HH:mm` in the server's `TZ`) and
    **`web/components/settings/CredentialsForm.tsx`** (`"use client"`, `useActionState` over
    `saveGmailCredentials`, showing its field error).
  - Every Gmail action refuses with `{ ok: false, reason: "key not set" }` unless the key status
    is ok, from S1 on.
  - **`web/app/settings/page.tsx`**: async; it renders `<GmailPanel view={…} />` from the request
    host (`await headers()`).
  - **`.env.example`**: adds `# MYJOBBOT_SECRET_KEY=`, with `openssl rand -base64 32` and a note
    that it takes effect after `docker compose up -d` or a dev-server restart.

  T007–T009a pass.
- [X] T014 Close S1: `npm run check` and `npm run check:db` green, and the ledger updated. Delete
  the marker and commit ("Store sealed Gmail credentials behind a Settings panel (006 S1)").

S1 notes (2026-10-15):
- **Results**: node 239 (+12), dom 28 (+1), integration 21 (+1), matching the ledger.
- **Import command**: `src/app/importSqlite.ts` typed its tables as `keyof Database`, so it
  narrowed to the three tables the import copies.
- **Habit-hooks fixes**:
  - `baseView` reads from an empty-row constant (complexity)
  - `GmailPanel` was split into `CredentialChanges` (length)
  - the view's helper types stopped being exported
- **Docs and styles**: `.env.example` and CLAUDE.md's storage line were updated. No styles were
  added; `web/app/styles.css` has the owner's uncommitted edits.

---

## Phase 3: User Story 1, connect Gmail (P1) 🎯 MVP

**Goal**: Connect Gmail → Google consent → back to Settings, connected; survives restarts.

**Independent Test**: unit tests drive start → callback → connected against a fake Google;
manually, the quickstart's Manual steps 1–3, 5 and 6.

### Sitting S2: the connect flow (T015–T022)

Create `.specify/sitting-in-progress` naming S2 before T015.

- [X] T015 [US1] **Unit and integration (contract)**: first add cases 2–4 to
  `tests/helpers/gmailStoreContract.ts` and run them red:
  - case 2: `connected` stores the sealed token, the email and the time, and connecting again
    (a second account) leaves one row with the second email
  - case 3: `takeConnectRequest` returns the request once, then null
  - case 4: `pruneConnectRequests(before)` removes only older requests

  Then add `connected`, `addConnectRequest`, `takeConnectRequest` (`SELECT … FOR UPDATE`, then
  `DELETE`, in one transaction) and `pruneConnectRequests` to `GmailStore`, the Kysely store and
  the memory fake, until the cases pass. T020 wires them in this sitting.
- [X] T016 Install `google-auth-library@11.3.0` with an exact pin, keeping the lockfile's optional
  platform entries (npm/cli#4828):
  1. Note `grep -c '"node_modules/@rolldown/binding-' package-lock.json` (15).
  2. Run `npm install --save-exact google-auth-library@11.3.0`.
  3. Copy `package-lock.json` aside, then `git checkout package-lock.json`.
  4. Splice in the root `dependencies` change and every new `node_modules/<pkg>` entry from the
     copy.
  5. Run `npm ci` and confirm the binding count is still 15.

  Then spike it: a scratch server action builds `new OAuth2Client(...)` and calls
  `generateAuthUrl` under `MYJOBBOT_DB_NAME=myjobbot_test npm run web`. Never run plain
  `npm run web` before T034: any page load migrates the configured database, and production must
  not get `002_gmail` before the merge (research R9). If Next.js fails to bundle it, add
  `serverExternalPackages: ["google-auth-library"]` to `web/next.config.ts`. Record the outcome in
  Notes and delete the scratch code. `tests/webBuild.test.ts` (part of `npm test`) covers the
  production build.
- [X] T017 [P] [US1] **Unit**: add 4 tests to `tests/connectRequest.test.ts`:
  - `newConnectRequest(random)` gives a 43-character base64url `state` and a verifier, and its
    challenge is the S256 of the verifier
  - `redirectUri(host)` is `http://<host>/settings/gmail/callback`
  - `checkTaken(request, now)` refuses null and anything older than 10 minutes, and accepts one
    9 minutes old
  - `authUrlOptions({ state, challenge })` equals `{ access_type: "offline", prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"], state, code_challenge,
    code_challenge_method: "S256" }`, with exactly one scope (FR-003)
- [X] T018 [P] [US1] **Unit**: write `tests/googleErrors.test.ts` (1 test) for the pure
  `googleErrorCode(err)` from `src/gmail/googleErrors.ts`:
  - a `GaxiosError`-shaped object whose config body contains `client_secret=SECRET123` and whose
    response is `{ error: "invalid_client" }` gives `invalid_client`
  - an error with HTTP status 401 (Gmail's `{ error: { code: 401 } }` body) gives
    `invalid_grant`
  - a network error gives `network`, and anything else gives `unknown`
  - `String(new GoogleError(code))` never contains `SECRET123`

  Also write `tests/helpers/fakeGoogle.ts`, which implements S2's `GoogleApi` (`authUrl`,
  `exchange`, `profileEmail`) with scripted results; S3 (T025) adds `listMessageIds`,
  `messageHeaders` and `revoke`. Add 3 tests to `tests/gmailConnection.test.ts`:
  - `startConnect(deps, host, now)` stores a request with a sealed verifier, prunes old requests,
    and returns the fake's URL, built from `authUrlOptions`
  - `finishConnect(deps, { state, code, error, host }, now)` with a valid state stores the sealed
    refresh token and the email as connected, and the request is gone
  - the outcomes:
    - `error=access_denied` gives `denied`
    - an unknown state gives `refused`
    - an `invalid_client` exchange gives `bad_client`
    - any other failure gives `failed`
    - a client secret that won't open gives `key_changed`, the sixth outcome code (research R8)

    None of them changes the row.
- [X] T019 [US1] **UI**: add 1 test to `tests/client/gmailPanel.test.tsx`. The "connected" view
  shows the email and time, and the outcome `refused` shows its fixed text, never the query
  value.
  Extend `tests/client/settings.test.tsx` in place so `searchParams: { gmail: "denied" }` shows
  "Access was not granted." and an unknown code shows nothing.
- [X] T020 [US1] Create the connect flow:
  - **`src/gmail/connectRequest.ts`**: add `newConnectRequest`, `redirectUri`, `checkTaken`, and
    `authUrlOptions`, which owns the scope constant.
  - **`src/gmail/googleErrors.ts`**.
  - **`src/gmail/google.ts`**: the `GoogleApi` interface, the `GoogleFactory` type, and
    `googleApi(clientId, clientSecret, redirectUri)` over `OAuth2Client`:
    - `generateAuthUrl({ ...authUrlOptions(...), code_challenge_method: CodeChallengeMethod.S256 })`.
      The library types the method as its own enum, so `google.ts` maps it, and
      `connectRequest.ts` stays free of library imports.
    - `getToken({ code, codeVerifier, redirect_uri })`
    - `request()` to `users/me/profile`

    `revokeToken`, the message listing and the headers come in S3 (T027), with their callers.

    Every call is wrapped to rethrow `GoogleError(googleErrorCode(err))`, never logging. Gmail
    URLs stay module-private, unexported.
  - **`src/gmail/connection.ts`**: add `startConnect` and `finishConnect`. Each returns only the
    fixed outcome codes; a `SealError` becomes `key_changed`.

  T017 and T018 pass.
- [X] T021 [US1] Web, following `contracts/gmail-panel.md`:
  - **`connectGmail` action**: it's a plain form action, so it has no return value to show.
    Every refusal redirects to `/settings?gmail=<code>` instead: `key_not_set`, `not_loopback`,
    `no_credentials` or `key_changed`. Otherwise it calls `redirect(url)` to Google.
  - **Route `web/app/settings/gmail/callback/route.ts`** (GET): calls `finishConnect`, then
    redirects to `/settings?gmail=<code>`.
  - **`GmailPanel`**: the Connect button (a server-action form, disabled with the hint off
    loopback), the "Connected as … since …" state, and the nine fixed outcome messages.
  - **Settings page**: passes `searchParams.gmail`, validated against the nine codes in
    research R8.
  - **`knip.json`**: add `web/app/**/route.ts` to `next.entry`. Route handlers are Next.js entry
    points, like pages. Note it in `CLAUDE.md`'s knip paragraph in the same task.
  - **`tests/webBuild.test.ts`**: add `/settings/gmail/callback` to `ROUTES`.

  T019 passes.
- [X] T022 Close S2: both checks green, the ledger updated. Delete the marker and commit ("Connect
  Gmail through Google sign-in (006 S2)").

S2 notes (2026-10-15):
- **Results**: node 250 (+11), dom 30 (+2), integration 24 (+3). The settings page's outcome
  check became its own test rather than folding into the structure test, so UI is +2, one over
  the ledger.
- **Lockfile (T016)**: `npm install --save-exact google-auth-library@11.3.0` kept all 15
  `@rolldown/binding-*` entries, 12 `lightningcss` entries and 189 optional entries. It added 21
  packages, and `debug` and `ms` moved from dev to runtime. No splice was needed.
- **Bundling spike**: done with `MYJOBBOT_DB_NAME=myjobbot_test npm run web` on port 8097, with
  a throwaway key.
  - Settings rendered both panels.
  - The callback route redirected `?state=nope&code=x` to `?gmail=refused` and
    `?error=access_denied` to `?gmail=denied`.
  - The outcome message rendered.
  - google-auth-library bundles without `serverExternalPackages`, and `webBuild.test.ts`
    covers the production build.
- **Consent link**: the real library, run offline with a dummy client, builds
  `accounts.google.com/o/oauth2/v2/auth` with `access_type=offline`, `prompt=consent`, the
  `gmail.readonly` scope only, a 43-character state and challenge, `S256`, and the localhost
  callback.
- **Design changes**:
  - `GoogleApi.exchange` returns both the refresh token and the address, replacing the
    separate `profileEmail`.
  - `GmailStore.connected` takes `{ sealedToken, email }`.
  - `googleErrorCode` is private and tested through `guarded()`, so nothing is test-only.
  - `connectGmail` redirects every refusal with a code (U1).
  - The helpers live in `web/lib/gmailDeps.ts` and `web/lib/gmailConnect.ts`.

**Checkpoint**: US1 is complete. The live connection is checked in S4 with the owner.

---

## Phase 4: User Stories 2 and 3, check and disconnect (P2, P3)

**Goal**: "Check now" gives the count of alert emails from the last 7 days and the newest 5;
"Disconnect" revokes and forgets. Replacing or clearing credentials while connected disconnects
first.

**Independent Test**: unit tests with the fake Google; manually, the quickstart's Manual steps 4,
8 and 9.

### Sitting S3: alerts check and disconnect (T023–T028)

Create `.specify/sitting-in-progress` naming S3 before T023.

- [X] T023 [P] [US2] **Unit**: write `tests/gmailAlerts.test.ts` for `src/gmail/alerts.ts`. 4 tests:
  - `alertQuery(["a@x.com", "y.org"])` is `from:(a@x.com OR y.org) newer_than:7d`
  - the config schema accepts an email (`^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$`) or
    a domain (`^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$`), case-insensitive. It
    refuses quotes, spaces, `(`, `)`, a leading `-` and the empty string.
  - `summarize(headers)` picks From, Subject and Date, with "(no subject)" for a missing subject
  - `newestFirst` orders by the Date header, falling back to Gmail's order for an unparsable date
- [X] T024 [US2] [US3] **Unit and integration (contract)**: first add case 5 to
  `tests/helpers/gmailStoreContract.ts` and run it red:
  - `needsReconnect(reason)` keeps the email **and the sealed token** (so a later disconnect can
    still revoke), and sets the status and reason
  - `disconnect` keeps the credentials, and nulls the token, the email and `connected_at`

  Then add `needsReconnect` and `disconnect` to `GmailStore`, the Kysely store and the memory
  fake, until it passes. T027 wires them in this sitting.
- [X] T025 [US2] [US3] **Unit**: add `listMessageIds`, `messageHeaders` and `revoke` to
  `tests/helpers/fakeGoogle.ts`, and add 3 tests to `tests/gmailConnection.test.ts`:
  - **`check(deps, senders)`**:
    - pages through ids until there is no next page token: 3 pages with 1,200 ids give 1,200,
      and only the newest 5 get headers
    - 0 ids gives `{ ok: true, count: 0, newest: [] }`
    - with no connection, or in `needs_reconnect`, it gives `{ ok: false, reason: "not
      connected" }` without calling Google
  - **Failures during `check`**: the fake's `invalid_grant` puts the row into `needs_reconnect`
    with the reason "access revoked or expired", and an unopenable token gives "server key
    changed".
  - **`disconnect(deps)`**: deletes the token and returns `{ revoked: true }`. When the fake's
    revoke throws, or the token won't open (`SealError`, the key changed), it still deletes and
    returns `{ revoked: false }`. Whenever a token is stored, whether connected or needing to
    reconnect, `saveCredentials` and `clearCredentials` call `disconnect` first; after a key
    change that means the old connection is cleared even though the revoke can't run.
- [X] T026 [US2] [US3] **UI**: add 1 test to `tests/client/gmailPanel.test.tsx`, mocking
  `web/lib/gmailActions.js` as `loadMore.test.tsx` does and using `renderPanel`:
  - the connected view offers Check now, Disconnect and "Replace credentials"
  - Check now shows the count and the newest subjects from the mocked action
  - Disconnect with `window.confirm` stubbed to false doesn't call the action; with true it does,
    and `{ revoked: false }` shows "the revoke may need to be done in your Google account"
  - the needs-reconnecting view shows the reason and Connect
- [X] T027 [US2] [US3] Implement:
  - **`src/config/schema.ts`**: `gmail: { alert_senders }`, defaulting to research R6's four
    senders, with T023's patterns.
  - **`src/gmail/alerts.ts`**.
  - **`src/gmail/google.ts`**: `listMessageIds` (paging, `maxResults=500`), `messageHeaders`
    (`format=metadata`, `metadataHeaders=From,Subject,Date`) and `revoke` (`revokeToken`).
  - **`src/gmail/check.ts`**: `check` and its paging and summary helpers, kept out of
    `connection.ts` so neither file nears 200 lines.
  - **`src/gmail/connection.ts`**: `disconnect`, and the disconnect-first rule in
    `saveCredentials` and `clearCredentials`.
  - **`web/lib/gmailActions.ts`**: `checkGmail` and `disconnectGmail`.
  - **`web/components/settings/CheckNow.tsx`** (`"use client"`, `useTransition`) and
    **`web/components/settings/DisconnectButton.tsx`** (`"use client"`, `window.confirm`), used
    by `GmailPanel`, which also gains a "Replace credentials" `<details>` wrapping
    `CredentialsForm` in every saved state.
  - The `checkGmail` and `disconnectGmail` actions have the same key guard as the others.

  T023–T026 pass.
- [X] T028 Close S3: both checks green, the ledger updated. Delete the marker and commit ("Check
  and disconnect Gmail (006 S3)").

S3 notes (2026-10-15):
- **Results**: node 258 (+8), dom 31 (+1), integration 25 (+1).
- **Paging moved**: the paging loop lives in `src/gmail/check.ts`, so the fake can drive it, with
  a 20-page safety limit. `GoogleApi` exposes a one-page `messagePage`.
- **Shared helpers**: `openOrNull` and `clientFor` moved to `src/gmail/access.ts`, shared by
  `connection.ts` and `check.ts`.
- **Disconnect**: Disconnect without a stored token reports `revoked: true`, since there was
  nothing to revoke.
- **Test environment**: happy-dom has no `window.confirm`, so the UI test defines it.

---

## Phase 5: Polish, with the owner

### Sitting S4: docs, review and live check (T029–T033)

Create `.specify/sitting-in-progress` naming S4 before T029.

- [X] T029 [P] Docs:
  - **`README.md`**:
    - Add a "Gmail" subsection under Settings: the one-time Google setup (the quickstart's setup
      steps), `MYJOBBOT_SECRET_KEY`, the SSH-tunnel connect, the testing-mode 7-day expiry, and
      that there is no login on the web UI.
    - Note that `MYJOBBOT_HOSTS` must include `localhost:8080` when it is set.
    - Refresh three stale lines: "(for now empty) Settings", "Hiding is the UI's only write" and
      "Only scrolling and Hide run in the browser".
    - Note that an invalid `gmail.alert_senders` in `config.json` stops the agent from loading
      its config, like any other config error.
  - **`CLAUDE.md`**: `src/gmail/` holds Gmail access; secrets are sealed with
    `MYJOBBOT_SECRET_KEY`; never print `.env` or sealed columns. (The contract-file and knip
    notes were added in T012 and T021.)
  - **`docs/react-walkthrough.md`**: S1 already does Exercise 3 (Settings calling `getUiState`,
    mocked in `settings.test.tsx`), so replace it with a new exercise. Name the settings
    components where the doc lists components. If a **Where:** line names `useTransition`, add it
    to `PLATFORM` in `tests/walkthrough.test.ts`.
- [X] T030 Run a read-only review agent over `git diff main`. It checks:
  - no secret, token or verifier in any page payload, server-action response, log, trace or
    error
  - FR-006 state handling (single use, 10 minutes, loopback only)
  - the AAD per field
  - `src/` never imports `web/` or `next`
  - the dependency is pinned exactly, with all 15 `@rolldown/binding-*` lockfile entries
  - `GOOGLE_SDK_NODE_LOGGING` (google-logging-utils' switch) is unset in `.env`, the compose file
    and the Dockerfile, so the library can't log request bodies

  Fix confirmed findings test-first.
  Done 2026-10-15: all 9 checks were clean, with no findings. Every network call to Google goes
  through `guarded()`, and only the synchronous `generateAuthUrl` doesn't. The `reason` column
  only ever holds the two fixed phrases. The lockfile still has its 15 bindings. No logging
  switch is set anywhere.
- [ ] ~~T031~~ (superseded by the IMAP rework; see R009) Live check with the owner, against `myjobbot_test`, so production isn't migrated before
  the merge. Production's `main` stack fails to start once `002_gmail` is applied without the new
  code (research R9).
  - **Setup**: the owner adds `MYJOBBOT_SECRET_KEY` to `.env`, checks that `MYJOBBOT_HOSTS`
    lists `localhost:8080`, creates the Desktop OAuth client, and opens the SSH tunnel. Run after
    the final `npm run check:db`, which empties the test tables, with
    `MYJOBBOT_DB_NAME=myjobbot_test npm run web`.
  - **Quickstart**: the setup steps 1–5 and Manual steps 1–9; Manual step 5 restarts
    `npm run web`.
  - **SC-001**: time Save → Connected (≤ 2 minutes) and count myjobbot's own clicks (Save,
    Connect: ≤ 2), noting Google's screens separately.
  - **Timings**: Check now (≤ 5 s) and Disconnect (SC-005: ≤ 2 s), in the network tab.
  - **Google's redirect**: confirm Google accepts `http://localhost:8080/settings/gmail/callback`
    for a Desktop client. If it doesn't, try `127.0.0.1:8080` (add it to `MYJOBBOT_HOSTS`).
  - **SC-003 leak search**: one-off read-only `grep` / SQL `LIKE` lookups for the secret's first 8
    characters, which the owner types themselves, and for `1//` (the usual start of a Google
    refresh token, whose plaintext no one sees). Nothing prints a secret.
  - **SC-004**: compare Check now's count with Gmail's search with conversation view off, since
    the API counts messages and conversation view counts threads.
  - Record everything in Notes.
  Deferred 2026-10-15: the owner asked to commit and open the PR first. The live check needs the
  owner's Google app, `MYJOBBOT_SECRET_KEY` in `.env` and the SSH tunnel; run it on the PR branch
  before merging, or as T034 on production after merging.
- [ ] ~~T032~~ (superseded; see R010) Fix anything T031 finds (test-first), or record it as follow-up.
- [X] T033 Close S4: both checks green; delete the marker; commit ("Document and verify the Gmail
  panel (006 S4)"); with the owner's OK, push and open the PR.
- [ ] ~~T034~~ (superseded; see R012) After the owner merges:
  1. Update `main` (pull before switching), then run `npm run docker:up`, which rebuilds for the
     new dependency and migrates production to `002_gmail`.
  2. Save the credentials and connect once on production through the tunnel; production's
     `gmail_connection` starts empty.
  3. **SC-002**: run `docker compose up -d --force-recreate`, and the panel still shows
     Connected; then run Check now.
  4. Record the result in Notes.

---

## Phase 6: Rework, IMAP with an app password (revised 2026-10-15)

The owner switched from Google sign-in to a Gmail app password over IMAP (spec Clarifications,
research R1–R10), on the same branch and PR #11. The OAuth tasks above stay as history.

### Sitting S5: replace OAuth with IMAP (R001–R008)

- [X] R001 Create `.specify/sitting-in-progress` naming S5. Confirm the stack is still stopped.
  Reset `myjobbot_test` for the rewritten step (research R7): with a one-off script using
  `tests/helpers/testDb.ts`, drop `gmail_connect_requests` and `gmail_connection`, and delete the
  `002_gmail` row from `kysely_migration`. It never touches `myjobbot`.
- [X] R002 Swap the dependency, keeping the lockfile's optional platform entries:
  - Uninstall `google-auth-library` and install `imapflow@2.3.0` with `--save-exact`.
  - Compare the 15 `@rolldown/binding-*` entries, the `lightningcss` entries and the 189
    optional entries before and after, and splice them back if npm dropped any (npm/cli#4828).
- [X] R003 **Tests first** (rewritten, red until R004–R007):
  - **Unit**, `tests/imapErrors.test.ts` (1 test): through `guarded()`:
    - an error with `authenticationFailed: true` and a `responseText` naming the user gives
      `bad_login`
    - `ECONNREFUSED` gives `unreachable`
    - anything else gives `unknown`
    - the `GmailError`'s string, JSON and stack never contain the username or the password
  - **Unit and integration**, `tests/helpers/gmailStoreContract.ts`, 3 cases (data-model.md):
    - connecting twice leaves one row with the second address
    - `needsReconnect` keeps the address and password
    - `disconnect` clears them
  - **Unit**, `tests/gmailConnection.test.ts`, with `tests/helpers/fakeImap.ts` (scripted
    `verify`, `search`, `envelopes`):
    1. Connect verifies, then stores a sealed password with spaces removed. A rejected or
       unreachable sign-in stores nothing and returns the fixed message. Bad lengths are
       refused before any sign-in.
    2. `keyChanged` (kept).
    3. Check counts every match and summarises the 5 highest UIDs, gives 0 for no match, and
       refuses when not connected.
    4. `bad_login` during Check gives needs_reconnect "app password rejected; create a new
       one"; an unopenable password gives "server key changed".
    5. Disconnect clears the row.
  - **Unit**, `tests/gmailPanel.test.ts` (3 tests, rewritten): the offers for each key state;
    not connected offers only `connect`; connected offers `check`, `disconnect` and `replace`;
    a key change asks for the password again.
  - **UI**, `tests/client/gmailPanel.test.tsx` (3 tests, rewritten):
    - the form's password field is empty, the sealed and plain password never appear, and a
      refused connect shows its message
    - connected shows the address and time
    - Check now and Disconnect (the confirm stubbed both ways, plus the app-passwords reminder)
  - **UI**, `tests/client/settings.test.tsx`: no `searchParams`; drop the outcome test.
- [X] R004 Storage:
  - Rewrite `src/db/migrations/002_gmail.ts` for one table: `gmail_connection` with `id TINYINT
    PK`, `email VARCHAR(320) NULL`, `app_password TEXT NULL`, `connected_at VARCHAR(32) NULL`,
    `status VARCHAR(20) NOT NULL DEFAULT 'none'` and `reason VARCHAR(200) NULL`, `utf8mb4_bin`.
  - Update `src/db/schema.ts`, `GmailStore` in `src/db/store.ts`
    (`connection`, `connected`, `needsReconnect`, `disconnect`),
    `src/db/kysely/gmailStore.ts` and `tests/helpers/memoryGmailStore.ts`.
  - Update `TABLES` in `tests/helpers/testDb.ts`, and the migrate test's collation list (4
    tables).
- [X] R005 IMAP:
  - **`src/gmail/imapErrors.ts`**: `imapErrorCode` (private), `GmailError` and `guarded`.
  - **`src/gmail/imap.ts`**: `ImapApi` (`verify()`, `search(query)` returning UIDs,
    `envelopes(uids)`), `ImapFactory`, and `imapApi({ email, password })` over `ImapFlow`:
    - created with `{ host: "imap.gmail.com", port: 993, secure: true, logger: false }`
    - each call connects, opens the `\All` folder (else `INBOX`) with `readOnly: true`, and
      searches with `gmraw`
    - each call logs out in `finally`, and is wrapped in `guarded()`
  - **`src/gmail/check.ts`**: rewritten over `ImapApi`.
  - **`src/gmail/connection.ts`**: rewritten, with `GmailDeps`, `connect(deps, { email,
    appPassword }, now)`, `keyChanged`, `disconnect`.
  - Delete `google.ts`, `googleErrors.ts`, `access.ts` and `connectRequest.ts`.
- [X] R006 View and web:
  - Rewrite `src/web/gmailPanel.ts` and delete `src/web/gmailOutcomes.ts`.
  - **`web/lib/gmailActions.ts`**: `connectGmail(previous, form)` (`useActionState`),
    `checkGmail` and `disconnectGmail`, each with the key guard.
  - Delete `web/lib/gmailConnect.ts` and `web/app/settings/gmail/callback/route.ts`.
  - **`web/components/settings/`**: rename `CredentialsForm.tsx` to `ConnectForm.tsx` (address
    and app password), and update `GmailPanel.tsx` and `DisconnectButton.tsx` (it shows the
    app-passwords reminder).
  - **`web/app/settings/page.tsx`**: drop `searchParams`.
  - **`knip.json`**: drop the `route.ts` entry. **`tests/webBuild.test.ts`**: drop the callback
    route.
  - **`CLAUDE.md`**: restore the knip paragraph, and reword the Gmail note for IMAP.
  - **`.env.example`**: the key's comment names the app password.
- [X] R007 Run `npm run check` and `npm run check:db`. Fix findings, and update the ledger below.
- [X] R008 Close S5: delete the marker and commit ("Switch the Gmail panel to IMAP with an app
  password (006 S5)").

S5 notes (2026-10-15):
- **Results**: node 248, dom 30, integration 23 (from 258 / 31 / 25 at S4).
- **Test database**: `myjobbot_test` was reset first (old tables and the `002_gmail` row
  removed).
- **Dependencies**: removing google-auth-library and adding imapflow 2.3.0 kept 15 rolldown,
  12 lightningcss and 189 optional lockfile entries, so no splice was needed.
- **Live probe**: one sign-in to `imap.gmail.com` with a made-up address returned `GmailError
  bad_login` in 374 ms, with nothing logged.
- **Design notes**:
  - Each IMAP call is one session: connect, read-only lock on the `\All` folder, `gmraw`
    search, envelope fetch for the picked UIDs, logout, and `close()` in `finally`.
  - `ImapApi.lookup(query, pick)` takes `newestUids` from `alerts.ts`, so choosing the newest
    five stays a tested pure function.
  - `openSealed` and `SealError` became private, with production and tests using `openOrNull`.
    With one sealed field the AAD-across-fields test no longer applies and was dropped.
  - The reminder to delete the app password is in the Disconnect confirmation and in the
    not-connected message, since the panel re-renders without the button after a disconnect.
- **Generated types**: Next.js's stale types for the removed callback route (in `web/.next*`,
  gitignored) were deleted.

Production repair (2026-10-15, owner-approved): the Docker stack, which runs this checkout, had
applied the OAuth `002_gmail` to production `myjobbot` at 19:45 UTC, so the rewritten step never
ran there ("Unknown column 'app_password'"). After a guarded check that both tables were
OAuth-shaped and empty, `gmail_connect_requests` and `gmail_connection` were dropped and the
`002_gmail` row deleted. `docker compose restart web` then applied the IMAP step (21:19 UTC).

### Sitting S6: docs, review, live check, PR (R009–R012)

- [X] R009 Docs:
  - **`README.md`** "Gmail" section: 2-step verification, the app password,
    `MYJOBBOT_SECRET_KEY`, no tunnel, read-only use, deleting the app password to revoke, and
    no login.
  - **`docs/react-walkthrough.md`**: if it names the renamed components.

  Then run a read-only review agent over `git diff main`. It checks:
  - no app password in any page, action result, log, trace or error
  - imapflow created with `logger: false`
  - the mailbox opened read-only
  - `gmraw` built only from validated senders
  - `src/` never imports `web/` or `next`
  - imapflow pinned exactly, with the lockfile intact

  Fix confirmed findings test-first.
  Done 2026-10-15: README rewritten for IMAP. The review was clean on all 8 checks. It confirmed
  in imapflow's source:
  - `readOnly` sends `EXAMINE`
  - envelope fetches never set `\Seen`
  - `logger: false` silences even errors
  - `close()` and a failed `logout()` never throw
  - `guarded()` never forwards `executedCommand`, `responseText` or `response`
- [ ] R010 Live check with the owner, against `myjobbot_test`
  (`MYJOBBOT_DB_NAME=myjobbot_test npm run web`, after the last `npm run check:db`):
  - the quickstart's setup steps 1–3 and Manual steps 1–8
  - time Connect and Check now (each ≤ 5 s)
  - record the results in Notes, fixing anything found test-first
  2026-10-15, owner on production (the stack runs this branch): Connect worked, and Check now
  worked, showing the 3 latest LinkedIn alerts. The remaining steps are not yet run: restart
  persistence, the wrong-password refusal, the count against Gmail's search, the leak search and
  Disconnect.
- [ ] R011 Close S6: both checks green; delete the marker; commit; push to update PR #11, and
  rewrite its description for IMAP.
- [ ] R012 After the owner merges:
  1. Update `main` (pull before switching), then run `npm run docker:up`, which rebuilds for
     imapflow and migrates production to `002_gmail`.
  2. Add `MYJOBBOT_SECRET_KEY` to `.env` and run `docker compose up -d`.
  3. Connect on production.
  4. **SC-002**: run `docker compose up -d --force-recreate`; the panel is still connected, and
     Check now works.
  5. Record the result in Notes.

## Dependencies & Execution Order

- **Sittings**: S0 → S1 → S2 → S3 → S4 → T034 (after the merge).
- **Within S1**:
  - Tests first: T003–T009a, where T003–T008 are [P].
  - Then T010 → T011 → T012 → T013 → T014.
- **Within S2**:
  - T015, then T016.
  - Then tests T017 and T018 [P], plus T019.
  - Then T020 → T021 → T022.
- **Within S3**:
  - Tests first: T023 [P], then T024 → T025 → T026. T024's and T025's store and fake changes
    are made within those tasks.
  - Then T027 → T028.
- **Story dependencies**: S1 is foundational. US2 and US3 need a connection only for the live
  check; their code depends on S1's store and S2's `GoogleApi`.

## Parallel Example: Sitting S1

```text
Task: "Unit tests for seal in tests/seal.test.ts"                     (T003)
Task: "Unit test for secretKeyStatus in tests/secretKey.test.ts"      (T004)
Task: "Unit test for isLoopbackHost in tests/connectRequest.test.ts"  (T005)
Task: "Gmail store contract case 1 in tests/helpers/gmailStoreContract.ts" (T006)
Task: "Unit tests for gmailPanelView in tests/gmailPanel.test.ts"     (T007)
Task: "UI test for GmailPanel in tests/client/gmailPanel.test.tsx"    (T008)
```

## Implementation Strategy

- **MVP**: S1 + S2. Credentials are saved and Gmail can be connected.
- **Then S3**: check and disconnect.
- **Then S4**: docs, review, and the live check on the test database.
- **After the merge**: T034 brings production up.
- **Rollback** (research R9): a plain revert fails at startup with Kysely's "corrupted
  migrations: previously executed migration 002_gmail is missing". Either revert while keeping
  `src/db/migrations/002_gmail.ts` and its `index.ts` entry, or after reverting run
  `DELETE FROM kysely_migration WHERE name = '002_gmail'` and
  `DROP TABLE gmail_connect_requests, gmail_connection` on `myjobbot`.

## Test mix ledger (constitution Principle II, 95/4/1)

| | Unit (node) | Integration | UI (dom) |
|---|---|---|---|
| Baseline (T002) | 227 | 20 | 27 |
| S1 | +12 (seal 4, key 1, loopback 1, contract case 1 on the fake, panel view 3, connection 2) | +1 (contract case 1) | +1 (GmailPanel; settings test changed in place) |
| S2 | +11 (contract cases 2–4 on the fake 3, connect request 4, googleErrors 1, connection 3) | +3 (contract cases 2–4) | +1 (connected view and outcomes) |
| S3 | +8 (alerts 4, contract case 5 on the fake 1, connection 3) | +1 (contract case 5) | +1 (check and disconnect) |
| Expected end | 258 | 25 | 30 |

The mix holds steady rather than improving: unit goes from 82.8% to 82.4% (227/274 → 258/313),
integration rises from 7.3% to 8.0%, and UI moves from 9.9% to 9.6%. The integration share rises
because each store contract case runs on MariaDB too, which is the project's contract rule.

## Notes

- **Credentials**: never print `.env`, sealed columns or Google tokens. The live check uses
  prefixes the owner types.
- **Production**: the stack stays stopped from S0 until T034. Production is migrated to
  `002_gmail` only at T034's `docker:up`.
- **Test database only**: every `npm run web` before T034 runs with
  `MYJOBBOT_DB_NAME=myjobbot_test`.
