# Feature Specification: Gmail connection panel

**Feature Branch**: `006-gmail-connection`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "We need to setup a gmail connection Panel in the Settings page."

## Clarifications

### Session 2026-10-15

- Q: What is the Gmail connection for? → A: Reading job-alert emails (LinkedIn, Indeed and
  similar) in the owner's inbox, as a future job source. Not for sending mail.
- Q: How does myjobbot connect? → A: Google sign-in: the owner approves access in Google's own
  consent screen. No mail password is ever given to myjobbot.
- Q: Where does the credential live? → A: The owner enters and connects it in the Settings panel;
  it is kept in the database, protected by a key that only the server holds.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect Gmail from Settings (Priority: P1)

The owner opens Settings and finds a Gmail panel showing "Not connected". They enter the Google app
credentials they created once in their Google account (the client ID and secret), press
"Connect Gmail", approve read-only access on Google's consent screen, and come back to Settings.
The panel now shows "Connected as name@gmail.com" and when the connection was made.

**Why this priority**: Nothing else in the panel matters until a connection exists.

**Independent Test**: With a fresh database, enter valid app credentials, connect, approve, and see
the connected address; restart the web app and see it still connected.

**Acceptance Scenarios**:

1. **Given** no saved app credentials, **When** the owner opens Settings, **Then** the Gmail panel
   shows "Not connected" and fields for the client ID and secret with a Save button. Once they
   are saved, the panel offers "Connect Gmail".
2. **Given** valid app credentials, **When** the owner connects and approves on Google's screen,
   **Then** they return to Settings and the panel shows the connected address and the date and time
   of connection.
3. **Given** a connection, **When** the web app or the whole stack restarts, **Then** the panel
   still shows it connected, without asking the owner again.
4. **Given** the owner cancels or denies on Google's screen, **When** they return, **Then** the
   panel shows "Not connected" and a plain message that access was not granted.
5. **Given** the Settings page is opened from an address Google will not return to (see
   Assumptions), **When** the owner looks at the panel, **Then** the "Connect Gmail" button is
   unavailable and the panel says which address to open Settings from to connect.

---

### User Story 2 - Check the connection works (Priority: P2)

After connecting, the owner wants proof that myjobbot can see their job alerts. The panel offers
"Check now", which looks at the inbox and reports how many job-alert emails from the last 7 days it
can see, with the sender and subject of the newest few.

**Why this priority**: Confirms the connection is useful before any job-alert reading is built.

**Independent Test**: Connected to an inbox with known alert emails, press "Check now" and compare
the count and the newest subjects with the inbox.

**Acceptance Scenarios**:

1. **Given** a connection and 3 job-alert emails in the last 7 days, **When** the owner presses
   "Check now", **Then** the panel reports 3 and lists their senders and subjects, newest first,
   up to 5.
2. **Given** a connection and no alert emails in the last 7 days, **When** the owner checks,
   **Then** the panel reports 0 and says the connection works.
3. **Given** access was revoked from the Google account, or has expired, **When** the owner
   checks, **Then** the panel shows "Needs reconnecting" with the reason and the "Connect Gmail"
   button, and the old connection is no longer used.

---

### User Story 3 - Disconnect (Priority: P3)

The owner wants to remove myjobbot's access. They press "Disconnect" in the panel; myjobbot asks
Google to revoke the access, forgets its stored access and shows "Not connected". The app
credentials stay so they can reconnect later, and can be cleared separately.

**Why this priority**: Needed for control and recovery, but used rarely.

**Independent Test**: Connected, press "Disconnect", confirm; the panel shows "Not connected" and
Google's account page no longer lists myjobbot.

**Acceptance Scenarios**:

1. **Given** a connection, **When** the owner disconnects and confirms, **Then** the stored access
   is deleted, Google is asked to revoke it, and the panel shows "Not connected".
2. **Given** Google cannot be reached during disconnect, **When** the owner disconnects, **Then**
   the stored access is still deleted and the panel says the revoke may need to be done in the
   Google account.
3. **Given** saved app credentials, **When** the owner clears them, **Then** they are deleted and
   the panel asks for new ones.

---

### Edge Cases

- **Two tabs connect at once**: the last approval wins; there is never more than one connection.
- **The client ID or secret is wrong**: the panel shows a fixed plain-language message for
  Google's reason (for example "Google rejected the client ID or secret"), never Google's raw
  text. Nothing is stored except the credentials the owner typed, and those can be edited.
- **The database is unreachable**: the panel shows the same error page as the rest of the UI. No
  secret appears in the error.
- **The protecting key is missing on the server**: the panel says to set it and restart, and offers
  no actions.
- **The key changed on the server**: when Settings opens, the panel says "Server key changed; enter
  the client secret again" and offers only the credential fields. Saving them re-seals the secret
  and clears the old connection, and the owner connects again.
- **In both cases**, stored secrets are never shown or sent to the browser in any form.
- **The owner replaces the credentials or clears them while connected**: the connection is
  disconnected first (Google is asked to revoke it), so no grant is left behind.
- **A different Google account approves than before**: the panel shows the new address. The
  connection belongs to whichever account approved last.
- **The return link from Google is replayed or forged**: it is refused, and nothing changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Settings MUST show a Gmail panel whose connection is in one of three states: Not
  connected, Connected (address and connected-at time), or Needs reconnecting (with the reason).
  Before any connection, the panel MUST also say when the server key is missing (no actions
  offered) and when no app credentials are saved (only the credential fields offered).
- **FR-002**: The owner MUST be able to enter, replace and clear the Google app credentials (client
  ID and client secret) in the panel. After saving, the secret MUST NOT be shown again; the panel
  shows only that one is saved.
- **FR-003**: Connecting MUST use Google's own consent screen and request read-only access to mail,
  nothing broader.
- **FR-004**: The connection MUST survive restarts of the web app, the agent and the server,
  without the owner signing in again, until it is revoked, disconnected or expires.
- **FR-005**: The client secret and the stored access MUST be kept in the database only in a form
  unreadable without a key held in the server's environment. They MUST never be sent to the
  browser, written to logs or traces, or included in error messages.
- **FR-006**: The return from Google's consent screen MUST be accepted only when it matches a
  connect request started from this panel in the last 10 minutes; anything else is refused.
- **FR-007**: "Check now" MUST report how many job-alert emails arrived in the last 7 days and list
  up to 5 of the newest (sender, subject, date). Job-alert emails are mail from senders on a
  configurable list, defaulting to LinkedIn and Indeed job-alert senders.
- **FR-008**: When Google rejects the stored access (revoked or expired), the panel MUST move to
  Needs reconnecting and say why.
- **FR-009**: "Disconnect" MUST ask for confirmation, delete the stored access, and ask Google to
  revoke it. A failed revoke MUST still delete the stored access and say so.
- **FR-010**: The panel MUST NOT change any other setting, and the scheduled agent runs MUST behave
  exactly as today. Reading alerts into jobs is a later feature. The one shared change is the new
  sender list in the config file: an invalid entry there is reported like any other config error.

### Key Entities

- **Google app credentials**: the owner's client ID (shown) and client secret (never shown again),
  with when they were saved.
- **Gmail connection**: the connected address, when it was made, the protected long-lived access,
  and its state (connected or needs reconnecting, with the reason). At most one exists.
- **Connect request**: a short-lived, single-use marker tying Google's return to a connect started
  from the panel; it expires after 10 minutes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From "Not connected" with app credentials already created in Google, the owner can
  connect in under 2 minutes, with at most 2 clicks in myjobbot itself (Save, Connect Gmail).
  Google's own screens (account choice, the unverified-app notice, consent) add their clicks on
  top.
- **SC-002**: After a full stack restart, the panel shows the connection, and "Check now" succeeds
  with no sign-in, 100% of the time while the access is valid.
- **SC-003**: A search of the database contents, logs, traces and every page the browser receives
  finds the client secret and the access in readable form 0 times.
- **SC-004**: "Check now" reports the same count of job-alert emails as a manual inbox search for
  the same senders and 7 days.
- **SC-005**: After "Disconnect", the panel shows "Not connected" within 2 seconds, and a "Check
  now" attempt is impossible until the owner reconnects.

## Assumptions

- **One owner, one account**: one owner, one Gmail account, one connection. The web UI still has no
  login, so anyone on the LAN who can open Settings could connect or disconnect. The owner accepted
  this when choosing to keep the credential in the database. Secrets can still never be read back
  through the UI.
- **Credentials created once by hand**: the owner creates the Google app credentials themselves,
  once, in their Google account (a "Desktop app" OAuth client with the Gmail read-only
  permission). The quickstart will walk through it. The app may stay unverified for personal use;
  Google shows an "unverified app" warning the owner clicks through.
- **Where Google returns to**: Google only sends the owner back to an address on the same machine
  (localhost) or a public HTTPS address. The LAN address does not qualify, so connecting is done
  with Settings opened at a localhost address, for example through an SSH tunnel from the laptop.
  Once connected, the panel works from any address.
- **Expiry in testing mode**: if the owner leaves the Google app in "testing" mode, Google expires
  the access after 7 days. The panel then shows Needs reconnecting. Publishing the app for
  personal use avoids this.
- **Server key**: the key that protects stored secrets is a new setting in the server's `.env`,
  next to the database settings. It is never stored in the database.
- **Scope**: turning alert emails into jobs, sending any mail, and handling other mail providers are
  out of scope.
