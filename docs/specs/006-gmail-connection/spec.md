# Feature Specification: Gmail connection panel

**Feature Branch**: `006-gmail-connection`

**Created**: 2026-10-15

**Status**: Draft (revised 2026-10-15: IMAP with an app password replaces Google sign-in)

**Input**: User description: "We need to setup a gmail connection Panel in the Settings page."

## Clarifications

### Session 2026-10-15

- Q: What is the Gmail connection for? → A: Reading job-alert emails (LinkedIn, Indeed and
  similar) in the owner's inbox, as a future job source. Not for sending mail.
- Q: How does myjobbot connect? → A: **Revised 2026-10-15**: a Gmail app password over IMAP,
  instead of Google sign-in, so no Google Cloud project is needed. The first version used
  Google sign-in; the owner switched once it was clear that needed a Google app.
- Q: Where does the credential live? → A: The owner enters it in the Settings panel; it is kept
  in the database, protected by a key that only the server holds.
- Q: Which IMAP library? → A: imapflow 2.3.0, exact pin (owner-approved after the options were
  presented).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect Gmail from Settings (Priority: P1)

The owner turns on 2-step verification in their Google account and creates an app password for
myjobbot. In Settings, the Gmail panel shows "Not connected". They enter their Gmail address and
the app password and press Connect. myjobbot signs in to Gmail to prove the pair works, keeps
them, and the panel shows "Connected as name@gmail.com" and when.

**Why this priority**: Nothing else in the panel matters until a connection exists.

**Independent Test**: With a fresh database, enter a valid address and app password, connect,
and see the connected address. Restart the web app and see it's still connected.

**Acceptance Scenarios**:

1. **Given** nothing saved, **When** the owner opens Settings, **Then** the Gmail panel shows "Not
   connected" with fields for the Gmail address and app password and a Connect button.
2. **Given** a valid address and app password, **When** the owner presses Connect, **Then** the
   panel shows the connected address and the date and time of connection.
3. **Given** a wrong address or app password, **When** the owner presses Connect, **Then**
   nothing is stored and the panel says Gmail rejected the address or app password.
4. **Given** a connection, **When** the web app or the whole stack restarts, **Then** the panel
   still shows it connected, without asking the owner again.

---

### User Story 2 - Check the connection works (Priority: P2)

After connecting, the owner wants proof that myjobbot can see their job alerts. The panel offers
"Check now", which looks at the mailbox and reports how many job-alert emails from the last 7
days it can see, with the sender and subject of the newest few.

**Why this priority**: Confirms the connection is useful before any job-alert reading is built.

**Independent Test**: Connected to a mailbox with known alert emails, press "Check now" and
compare the count and the newest subjects with Gmail.

**Acceptance Scenarios**:

1. **Given** a connection and 3 job-alert emails in the last 7 days, **When** the owner presses
   "Check now", **Then** the panel reports 3 and lists their senders and subjects, newest first,
   up to 5.
2. **Given** a connection and no alert emails in the last 7 days, **When** the owner checks,
   **Then** the panel reports 0 and says the connection works.
3. **Given** the app password was deleted in the Google account, **When** the owner checks,
   **Then** the panel shows "Needs reconnecting" with the reason and asks for an app password
   again.

---

### User Story 3 - Disconnect (Priority: P3)

The owner wants to remove myjobbot's access. They press "Disconnect" in the panel and confirm.
myjobbot forgets the stored address and app password, and the panel reminds them to delete the
app password in their Google account, since only Google can revoke it.

**Why this priority**: Needed for control and recovery, but used rarely.

**Independent Test**: Connected, press "Disconnect" and confirm. The panel shows "Not connected",
and the database holds no address or app password.

**Acceptance Scenarios**:

1. **Given** a connection, **When** the owner disconnects and confirms, **Then** the stored
   address and app password are deleted, the panel shows "Not connected", and it links to
   Google's app-passwords page so the owner can delete the password there.
2. **Given** a connection, **When** the owner cancels the confirmation, **Then** nothing changes.

---

### Edge Cases

- **Spaces in the app password**: Google shows app passwords as four groups of four letters
  (`abcd efgh ijkl mnop`). Spaces are removed before signing in and storing.
- **Gmail can't be reached when connecting**: nothing is stored, and the panel says Gmail
  couldn't be reached.
- **The database is unreachable**: the panel shows the same error page as the rest of the UI. No
  secret appears in the error.
- **The protecting key is missing or invalid on the server**: the panel says to set it and
  restart, and offers no actions.
- **The key changed on the server**: when Settings opens, the panel says "Server key changed;
  enter the app password again" and offers only the fields.
- **In every key case**, stored secrets are never shown or sent to the browser in any form.
- **Connecting with a different address**: it replaces the earlier connection; there is only ever
  one.
- **Mail is never changed**: myjobbot opens the mailbox read-only, so checking never marks mail as
  read, moves it or deletes it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Settings MUST show a Gmail panel whose connection is in one of three states: Not
  connected, Connected (address and connected-at time), or Needs reconnecting (with the reason).
  The panel MUST also say when the server key is missing or invalid (no actions offered) or
  changed (only the fields offered).
- **FR-002**: The owner MUST be able to enter and replace the Gmail address and app password in
  the panel. After saving, the app password MUST NOT be shown again.
- **FR-003**: Connecting MUST sign in to Gmail over IMAP with TLS using the app password, and MUST
  store the pair only after that sign-in succeeds. myjobbot MUST open mail read-only and never
  change, move or delete it.
- **FR-004**: The connection MUST survive restarts of the web app, the agent and the server,
  without the owner entering the app password again, until it is disconnected or Google rejects
  it.
- **FR-005**: The app password MUST be kept in the database only in a form unreadable without a
  key held in the server's environment. It MUST never be sent to the browser, written to logs or
  traces, or included in error messages.
- **FR-006**: Errors from Gmail MUST reach the panel only as fixed plain-language messages, never
  as the server's raw text.
- **FR-007**: "Check now" MUST report how many job-alert emails arrived in the last 7 days and list
  up to 5 of the newest (sender, subject, date). Job-alert emails are mail from senders on a
  configurable list, defaulting to LinkedIn and Indeed job-alert senders.
- **FR-008**: When Gmail rejects the stored app password, the panel MUST move to Needs
  reconnecting and say why.
- **FR-009**: "Disconnect" MUST ask for confirmation, delete the stored address and app password,
  and point the owner to Google's app-passwords page to delete the password there.
- **FR-010**: The panel MUST NOT change any other setting, and the scheduled agent runs MUST behave
  exactly as today. Reading alerts into jobs is a later feature. The one shared change is the new
  sender list in the config file: an invalid entry there is reported like any other config error.

### Key Entities

- **Gmail connection**: the Gmail address, the protected app password, when it was connected,
  and its state (connected or needs reconnecting, with the reason). At most one exists.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With an app password already created, the owner can connect in under 1 minute and
  1 click (Connect) after typing the address and password.
- **SC-002**: After a full stack restart, the panel shows the connection, and "Check now" succeeds
  without re-entering anything, 100% of the time while the app password is valid.
- **SC-003**: A search of the database contents, logs, traces and every page the browser receives
  finds the app password in readable form 0 times.
- **SC-004**: "Check now" reports the same count of job-alert emails as a Gmail search for the same
  senders and 7 days (conversation view off).
- **SC-005**: After "Disconnect", the panel shows "Not connected" within 2 seconds.

## Assumptions

- **One owner, one account**: one owner, one Gmail account, one connection. The web UI still has no
  login, so anyone on the LAN who can open Settings could connect or disconnect. The owner accepted
  this when choosing to keep the credential in the database. Secrets can still never be read back
  through the UI.
- **Access is full, use is read-only**: an app password grants full access to the mailbox; Google
  offers no read-only app password. myjobbot limits itself to read-only use (FR-003). The owner
  accepted this trade for not needing a Google Cloud project.
- **Revoking is Google's job**: Google can't be asked to revoke an app password from outside, so
  Disconnect only forgets it. The owner deletes it at myaccount.google.com/apppasswords.
- **Google requirements**: app passwords need 2-step verification on the Google account. IMAP is
  always on for personal Gmail accounts.
- **Server key**: the key that protects the stored app password is `MYJOBBOT_SECRET_KEY` in the
  server's `.env`, next to the database settings. It is never stored in the database.
- **Scope**: turning alert emails into jobs, sending any mail, and handling other mail providers are
  out of scope.
