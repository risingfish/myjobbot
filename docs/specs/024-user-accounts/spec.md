# Feature Specification: User accounts

**Feature Branch**: `024-user-accounts`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description (seed): "We need to add a multi-user login system: 1. an Account tab in
the UI (email and name display and change; allowed login types as a list, each row a checkbox to
enable or disable it, its name and its controls: password change; email-me-a-link with a send-test-
email button; hardware keys, listed by name with delete, and an add-key form; authenticator app
wire-up). 2. An account creation page, public, but it can't create an account anyone can use
without an account creation code an admin generates in an admin section of the Settings page. The
form has email address (username), name (first and last as one field), password (at least 10
characters with at least 4 different character types: lower, upper, number, symbol) and the code.
First-time account creators land on the Account page; an email goes to the user when the account is
created. 3. A login page supporting username/password, email me a login link, hardware key (like
YubiKey) and authentication app. 4. Account recovery for each of the types. Out of scope: modifying
existing tables to tie them to a user, anything user-centric beyond these four requirements, tying
existing data to a user."

## Clarifications

### Session 2026-11-05

- Q: What can an account that isn't an admin see? → A: Everything. Until data is tied to users (a
  later feature), every signed-in account sees and changes the same jobs, settings, resume, sources
  and Gmail connection. Only the admin section is limited to admins.
- Q: Where does account data live? → A: The account's email and admin mark are added to the
  existing users record; each way of signing in keeps its details in its own records.
- Q: How is the first admin made? → A: By a command run on the server, which gives the existing
  owner (user 1) an email address, the admin mark and a password typed at a hidden prompt.
- Q: How is email sent? → A: Through a mail server set per deployment (address, login, sender
  address), not through the Gmail connection on the Settings page.
- Q: How does a user recover each way of signing in? → A: A forgotten password is reset by an
  emailed link. A lost hardware key or authenticator app is covered by signing in another enabled
  way or with one of ten one-time recovery codes. A user who has lost their email is helped by an
  admin, who changes the account's email for them.
- Q: How do enabled ways of signing in combine? → A: Any one enabled, set-up way signs the user in
  on its own; there is no second step.
- Q: Can a way be enabled before it is set up? → A: Yes; ticking it opens its setup, and it can't be
  used to sign in until setup is finished.
- Q: How do account creation codes work? → A: Each code works once and expires 7 days after it is
  made. A code always makes a regular account; admins mark others as admins afterwards.
- Q: What happens when a user changes their email? → A: The change waits until a link sent to the
  new address is opened; the old address is told that the email changed.
- Q: Where does the app's public address come from? → A: A per-deployment setting naming the full
  address (scheme and host), which must be one of the hosts the UI already answers to. Production
  serves the UI over HTTPS at its ingress.
- Q: Password rule? → A: 10 to 128 characters, holding a lowercase letter, an uppercase letter, a
  digit and a symbol.
- Q: What else is in scope? → A: Sign out, and sign out everywhere else; limits on repeated failed
  attempts; forms that never reveal whether an email has an account; sign-ins kept on the server so
  they can be ended; a sign-in lasts 30 days from its last use.
- Q: How is it delivered? → A: One spec and one PR (owner decision; an exception to the usual small
  PRs).
- Q: How much weight does security get? → A: It is front and center: the link lifetimes stand, and
  the feature protects against the common web attacks (cross-site request forgery first among
  them), as set out in "Security model" and FR-033 to FR-053.
- Q: Are the defaults chosen in this spec (link lifetimes, attempt limits, ten recovery codes,
  password-only new accounts, the first-admin reset option, admin email change, the "someone tried
  your address" notice) accepted? → A: Yes, all of them.
- Q: What about the Gmail connection? → A: It stays shared for now; tying a Gmail connection to an
  account is the next piece of work after this feature.

### Session 2026-11-06

- Q: How does an account whose only usable way is an emailed link prove its identity again for a
  sensitive change? → A: The "Confirm it's you" check also offers "Email me a confirmation link": a
  one-time link, valid 15 minutes, that renews the check for the browser that asked for it and
  returns to the page it was asked from.
- Q: Can an admin remove their own admin mark? → A: Yes, as long as another admin remains; the
  last admin can't lose the mark, their own removal included.
- Q: Does a password reset link sign the user in? → A: No. It sets the new password and ends every
  sign-in, this browser's included; the user then signs in with the new password. Gaining or
  losing the admin mark ends the account's other sign-ins too.
- Q: What does someone who isn't signed in get? → A: They are taken to the sign-in page, and no job
  data is sent to them at all, not even a page's first draw or a background answer, until the
  sign-in is confirmed (FR-053).
- Q: What do "Email me a link" and "Forgot password" on the sign-in page answer when mail isn't set
  up for the deployment? → A: "Email isn't set up on this server.", for every email. Mail is a
  per-server setting, so this reveals nothing about any email (FR-023, FR-029).

## Background: access today

- The web UI has no sign-in. Anyone who reaches it on an allowed host name sees and changes
  everything. The only check is that the request names one of the UI's configured hosts.
- There is one user, the owner (user 1), with a name and nothing else. Every setting, source, resume
  and Gmail connection belongs to that user.
- The app reads email (the Gmail connection, read-only) but never sends any.
- The command line (runs, re-scores, evals) and the scheduled agent run don't go through the web UI
  and are unaffected by this feature.

## Security model

Security is the first concern of this feature: a sign-in guards every job, setting, resume and the
Gmail connection, so every account is effectively the owner's. Where convenience and safety pull
apart, safety wins. The attacks it defends against, and how:

| Attack | Protection |
|--------|------------|
| Cross-site request forgery (another site makes the browser act while signed in) | Every request that changes anything, sign-out included, is checked to come from the UI's own public address and carries proof it came from a UI page; the sign-in cookie isn't sent on requests started by other sites; nothing changes on a plain page load (FR-033 to FR-035) |
| Stolen or guessed sign-in | Sign-in identifiers are long and random, kept on the server only as a one-way digest, carried in a cookie scripts can't read and sent only over HTTPS; a new one is issued at every sign-in and whenever the account's access changes (FR-036 to FR-038) |
| Session fixation | Any identifier the browser held before signing in is discarded and replaced at sign-in (FR-037) |
| Password guessing and credential stuffing | Limits per email and per network address; a slow, salted, memory-hard password digest; the same timing whether or not the email exists (FR-025, FR-039, FR-040) |
| Account discovery (finding out who has an account) | Identical answers and timing for every email (FR-023, FR-040) |
| One-time link and code abuse | Long random values, stored only as digests, used once, short-lived; links open a page with a button rather than acting on load, so mail scanners that open links don't use them up (FR-024, FR-041, FR-042) |
| Leaking a one-time link | Pages that links land on tell the browser to send no referrer and not to cache them (FR-043) |
| Data seen before sign-in (opening a page, a background request or the browser's cache while signed out) | The sign-in is checked before any job data is read; a signed-out request gets only the sign-in page or a fixed refusal; signed-in pages are never cached by the browser (FR-001, FR-053) |
| Open redirect (sending a user to another site after sign-in) | The page to return to after sign-in is only ever a path within the UI (FR-044) |
| Clickjacking (the UI framed by another site) | The UI refuses to be shown inside another site's frame (FR-045) |
| Script injection | A strict content policy for the UI's pages; names, emails and key names shown as text only (FR-045, FR-046) |
| Host header and email header injection | Links built only from the configured public address; names and emails checked for line breaks and length before they reach a mail (FR-030, FR-046) |
| A sign-in left open on a shared or stolen browser | Sensitive changes ask for the password or another way again if the last sign-in check is older than 10 minutes; the owner of the account is emailed about every security change (FR-047, FR-048) |
| Copied hardware key or replayed authenticator code | Key answers are checked against the UI's own address and the key's counter; an authenticator code works once (FR-024, FR-049) |
| Database leak | No secret is stored readable: passwords, codes and tokens as digests, authenticator secrets sealed with the app's secret key (FR-031, FR-050) |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with a password (Priority: P1)

The owner turns their existing user into the first admin from the server's command line, giving it
an email address and a password. From then on, the web UI asks for a sign-in before showing any
page, and the owner signs in with that email and password. A sign-in lasts until it goes unused for
30 days or the owner signs out.

**Why this priority**: Without it nothing else in the feature can be reached, and the UI stays open
to anyone who can reach it.

**Independent Test**: Run the first-admin command, open any page and get sent to the sign-in page,
sign in, land on the page first asked for, sign out and get sent back.

**Acceptance Scenarios**:

1. **Given** user 1 has no email, **When** the owner runs the first-admin command with an email and
   a password that meets the rule, **Then** user 1 gets that email, the admin mark and the password,
   with password sign-in enabled.
2. **Given** user 1 already has an email, **When** the first-admin command runs without its reset
   option, **Then** it refuses and changes nothing.
3. **Given** no sign-in, **When** anyone opens any page or data address of the UI other than the
   sign-in, account creation and link-landing pages, **Then** they are sent to the sign-in page (or,
   for data, refused), and after signing in they land on the page they asked for. Nothing in the
   response they get holds job data (no jobs, scores, settings, resume, sources or Gmail details).
4. **Given** the right email and password, **When** the user signs in, **Then** they are signed in
   for 30 days from their last use.
5. **Given** a wrong email or a wrong password, **When** the user signs in, **Then** the same
   message appears either way, never saying which was wrong or whether the email has an account.
6. **Given** a signed-in user, **When** they sign out, **Then** that sign-in ends at once and the
   next page asks them to sign in.
7. **Given** a user signed in on two browsers, **When** they choose "Sign out everywhere else" on
   one, **Then** the other is signed out at its next request and the first stays signed in.

---

### User Story 2 - Invite a user with an account creation code (Priority: P1)

An admin makes an account creation code in the admin section of the Settings page and gives it to
someone. That person opens the public account creation page, enters their email, name, a password
and the code, and gets an account. They are signed in and land on the Account page, and an email
tells them the account was made.

**Why this priority**: This is the only way new users exist; it is the "multi-user" half of the
feature.

**Independent Test**: As an admin, make a code; in another browser create an account with it; land
signed in on the Account page; receive the account-created email; try the same code again and see
it refused.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they make a code, **Then** it is shown once, with the time it
   expires (7 days later), and can be copied.
2. **Given** a valid unused code, **When** someone submits the form with an unused email, a name and
   a password that meets the rule, **Then** an account is made with password sign-in enabled, the
   code is spent, they are signed in on the Account page, and an account-created email goes to them.
3. **Given** a code that is spent, expired or never existed, **When** it is submitted, **Then** the
   form is refused with one message for all three cases, and no account is made.
4. **Given** a password that is shorter than 10 characters, longer than 128, or missing a lowercase
   letter, uppercase letter, digit or symbol, **When** the form is submitted, **Then** it is refused
   with the rule shown, and the code is not spent.
5. **Given** an email that already has an account, **When** the form is submitted with a valid
   code, **Then** no second account is made and the code is not spent, and the message doesn't say
   the email is taken any differently from other refusals (the existing account's owner is emailed
   that someone tried to make an account with their address).
6. **Given** a user who is not an admin, **When** they open the Settings page, **Then** the admin
   section is not shown, and its actions are refused if called directly.
7. **Given** an admin, **When** they open the admin section, **Then** they see every account (name,
   email, admin or not) and can mark another account as an admin or remove the mark, their own
   included, except that the last admin can't lose it.

---

### User Story 3 - Manage the account (Priority: P1)

A signed-in user opens the Account tab and sees their email and name, each changeable, and the list
of ways to sign in: password, email link, hardware keys and authenticator app. Each row starts with
a checkbox to enable or disable it, then its name and its own controls.

**Why this priority**: It is where every other way of signing in is set up, and where new users
land.

**Independent Test**: Change the name; change the password and check the old one no longer works;
tick and untick a way; try to untick the last usable way and see it refused.

**Acceptance Scenarios**:

1. **Given** the Account tab, **When** the user saves a new name, **Then** it is shown everywhere
   the account's name appears.
2. **Given** the Account tab, **When** the user enters a new email, **Then** nothing changes yet; a
   confirmation link goes to the new address, and once it is opened the email changes and a notice
   goes to the old address. An address another account already uses is refused when the link is
   opened, and the link expires after 24 hours.
3. **Given** password sign-in, **When** the user changes the password (entering the current one and
   a new one that meets the rule), **Then** the new one works, the old one doesn't, and every other
   sign-in of that account ends.
4. **Given** a way that isn't set up, **When** the user ticks it, **Then** its setup opens; until
   setup is finished the row says it isn't ready and it can't be used to sign in.
5. **Given** exactly one enabled, set-up way, **When** the user tries to untick it, **Then** it is
   refused with a message saying at least one way must stay usable.
6. **Given** a disabled way that is set up, **When** it is ticked again, **Then** it works again
   without being set up again.
7. **Given** a sensitive change asked for more than 10 minutes after the last identity check,
   **When** the user chooses "Email me a confirmation link" in the "Confirm it's you" check, opens
   the link in the same browser within 15 minutes and presses its button, **Then** the check is
   renewed and they return to the page they were on; a link opened in another browser, used twice,
   or opened after 15 minutes is refused.

---

### User Story 4 - Sign in with an emailed link (Priority: P2)

With email-link sign-in enabled, the user asks the sign-in page to email them a link, opens it and
is signed in. On the Account tab, a "Send test email" button checks that mail reaches them.

**Why this priority**: The first way to sign in without a password, and the mail it needs also
carries account creation, email changes and password resets.

**Independent Test**: Enable the email link, send a test email and receive it; sign out; request a
link, open it, be signed in; open the same link again and see it refused.

**Acceptance Scenarios**:

1. **Given** the Account tab, **When** the user presses "Send test email", **Then** a test message
   goes to their address and the page says it was sent, or says, in a fixed message, that it
   couldn't be sent.
2. **Given** any email, **When** someone asks the sign-in page for a link, **Then** the page shows
   the same "if that address has an account with email links on, a link is on its way" message, and
   a link is sent only when the account exists and has email links enabled.
3. **Given** a link, **When** it is opened within 15 minutes and hasn't been used, **Then** the user
   is signed in; a second use, or a use after 15 minutes, is refused and offers to send a new one.
4. **Given** mail isn't set up for the deployment, **When** a user ticks email-link sign-in or
   presses "Send test email", or anyone asks the sign-in page for a link or a password reset,
   **Then** the page says mail isn't set up (the same for every email), and email-link sign-in
   can't be made usable.

---

### User Story 5 - Sign in with an authenticator app (Priority: P2)

The user ticks the authenticator app row, scans the code shown (or types the secret) into an app
on their phone, and enters the six-digit code the app shows to finish setup. From then on they can
sign in with their email and a current code from the app.

**Why this priority**: A common way to sign in without the password or email; it also brings the
recovery codes that cover a lost device.

**Independent Test**: Set up the app with a real authenticator, sign out, sign in with email and a
code, try an old code and see it refused.

**Acceptance Scenarios**:

1. **Given** the app row being set up, **When** the user enters a code the app shows, **Then** setup
   finishes; a wrong code leaves it unfinished.
2. **Given** a set-up, enabled app, **When** the user signs in with their email and a current code,
   **Then** they are signed in; a code already used for that account is refused.
3. **Given** setup finished, **When** the user removes the app, **Then** it is no longer set up and
   must be set up again (with a new secret) to be used.

---

### User Story 6 - Sign in with a hardware key (Priority: P3)

The user adds a hardware key (such as a YubiKey) under the hardware keys row by giving it a name and
touching it. The row lists keys by name with a delete button. At sign-in, the user chooses the
hardware key and touches any added key.

**Why this priority**: The strongest way to sign in, but it needs a key and HTTPS, so it comes last.

**Independent Test**: Add a key named "Blue key", see it listed, sign out, sign in by touching it,
delete it and see that sign-in with it is refused.

**Acceptance Scenarios**:

1. **Given** the add-key form, **When** the user names a key and touches it, **Then** it is listed
   by that name; a name already used by another of their keys is refused.
2. **Given** at least one key, **When** the user signs in with a key, **Then** touching any of their
   added keys signs them in, and a key that isn't added is refused.
3. **Given** a listed key, **When** the user deletes it, **Then** it no longer signs them in; if it
   was the last key, the hardware keys row is no longer set up.

---

### User Story 7 - Recover access (Priority: P2)

A user who has lost a way to sign in gets back in: a forgotten password is reset by an emailed link,
a lost key or app is covered by another enabled way or by a recovery code, and a user who lost their
email asks an admin.

**Why this priority**: Without recovery, a lost password or device locks a user out for good, and
the seed asks for recovery for every way.

**Independent Test**: Reset a forgotten password by link; sign in with a recovery code and see it
refused the second time; as an admin, change a user's email so they can reset their password.

**Acceptance Scenarios**:

1. **Given** any email, **When** someone uses "Forgot password" on the sign-in page, **Then** the
   same message appears whether or not it has an account, and a reset link goes only to an account
   that has one.
2. **Given** a reset link opened within 30 minutes and not used, **When** the user sets a new
   password that meets the rule, **Then** it works, password sign-in is enabled, and every sign-in
   of that account ends, this browser's included; the user then signs in with the new password. An
   old or used link is refused.
3. **Given** the first time a user finishes setting up an authenticator app or a hardware key,
   **When** setup finishes, **Then** ten one-time recovery codes are shown once, with a prompt to
   keep them; the user can make a new set later, which replaces the old one.
4. **Given** recovery codes, **When** the user signs in with their email and one unused code,
   **Then** they are signed in, that code is spent, and the Account tab says how many are left.
5. **Given** a user who has lost access to their email, **When** an admin changes that account's
   email in the admin section, **Then** the change takes effect at once, a notice goes to the old
   address, and the user can then reset their password through the new address.

---

### Edge Cases

- **The only admin loses every way in**: the first-admin command has a reset option that sets a new
  password for an existing admin by email and enables password sign-in, run on the server.
- **Many failed attempts**: after 5 failed sign-ins for one email within 15 minutes, sign-in for that
  email (by any way) is refused for 15 minutes, with the same message as a wrong password. Link,
  reset and test-email requests are limited to 3 per email per 15 minutes, and account creation code
  attempts to 10 per network address per hour.
- **Mail fails while making an account**: the account is still made and the user still lands on the
  Account page; the failure is logged with a fixed reason and the user isn't told the email failed.
- **A signed-in user's account changes**: when a password is reset, every sign-in ends; when the
  admin mark is given or removed, the account's other sign-ins end (the admin's own current one is
  replaced when they remove their own mark); when an admin changes a user's email, the user's
  sign-ins stay.
- **Email letter case**: emails are compared without regard to letter case and surrounding spaces;
  `Owner@Example.com` and `owner@example.com` are one account.
- **A link opened in another browser**: email links and reset links work in whatever browser opens
  them; the sign-in is made in that browser. A "Confirm it's you" link works only in the browser
  that asked for it.
- **Mail turned off for the deployment**: email-link sign-in stops being usable at once, and an
  account whose only usable way was the email link can't sign in until mail is set up again (an
  admin can still use the server command's reset option for their own account).
- **Changing email to the current one**: refused as no change.
- **Disabled way at sign-in**: a disabled or unfinished way is refused at sign-in with the same
  message as a wrong credential.
- **Recovery codes when the key and app are both removed**: the codes stay valid as long as the user
  has any other usable way, and can still be used to sign in.
- **Mail scanners opening links**: a scanner that opens an emailed link only sees the page with the
  button, so the link still works for the user (FR-042).
- **A form posted from another site** (a hidden form or script on a page the user visits while
  signed in): refused, and nothing changes (FR-033).
- **A sign-in link used twice at once**: only one of the two requests signs in (FR-041).
- **A stolen session used for a sensitive change**: asked to prove identity again when the last
  check is older than 10 minutes (FR-047).
- **Background requests while signed out** (the re-score log's live stream, Load more, opening a
  job's panel, any server action), for example when the sign-in ended in another tab or expired:
  refused without data, and the browser is taken to the sign-in page, returning to the same page
  after signing in (FR-053).
- **Back button after signing out**: the browser shows no cached signed-in page; going back loads
  the address again and lands on the sign-in page (FR-053).
- **Moving between pages while signed out** (the app's in-page navigation, not a full load): taken
  to the sign-in page the same way, with no job data in the answer.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: Every page, data address and action of the web UI MUST require a signed-in account,
  except the sign-in page, the account creation page and the pages that emailed links land on. A
  signed-out visit to any other page MUST take the browser to the sign-in page (FR-053).
- **FR-002**: A signed-in account MUST see and change everything the UI offers today; only the admin
  section MUST be limited to admins (feature scope: data is not yet tied to users).
- **FR-003**: A sign-in MUST be kept on the server, last 30 days from its last use, end at once on
  sign out, and be endable by "Sign out everywhere else" on the Account tab.
- **FR-004**: The command line and the scheduled agent run MUST keep working without a sign-in.

**First admin**

- **FR-005**: A server command MUST give user 1 an email, the admin mark and a password typed at a
  hidden prompt, with password sign-in enabled; it MUST refuse when user 1 already has an email.
- **FR-006**: The same command's reset option MUST set a new password for an existing admin, found
  by email, and enable password sign-in.

**Accounts and creation codes**

- **FR-007**: An account MUST have a unique email (compared without case or surrounding spaces), a
  name (one field), an admin mark and its ways of signing in.
- **FR-008**: An admin MUST be able to make an account creation code in the Settings page's admin
  section; the code MUST be shown once, work for one account, and expire 7 days after it is made.
- **FR-009**: The public account creation page MUST make an account only with a valid, unused,
  unexpired code, an email with no account, a name and a password that meets the rule; any refusal
  MUST leave the code unspent.
- **FR-010**: A password MUST be 10 to 128 characters and hold at least one lowercase letter,
  uppercase letter, digit and symbol, everywhere a password is set.
- **FR-011**: A new account MUST be signed in and land on the Account page, and MUST be sent an
  account-created email.
- **FR-012**: The admin section MUST list every account (name, email, admin mark) and let an admin
  add or remove the admin mark on any account, their own included, never leaving no admin, and
  change an account's email at once for recovery (notifying the old address).
- **FR-013**: Codes MUST always make regular accounts.

**Account tab**

- **FR-014**: The Account tab MUST show and change the account's name and email; a new email MUST
  take effect only when a link sent to it is opened within 24 hours, and the old address MUST be
  notified.
- **FR-015**: The Account tab MUST list the four ways of signing in (password, email link, hardware
  keys, authenticator app), each row with an enable checkbox, its name, whether it is ready, and its
  controls.
- **FR-016**: Ticking a way that isn't set up MUST open its setup; a way MUST NOT sign anyone in
  until it is both enabled and set up.
- **FR-017**: The user MUST NOT be able to leave the account with no way that is enabled and set up.
- **FR-018**: Password controls MUST change the password given the current one, and end every other
  sign-in of the account.
- **FR-019**: Email-link controls MUST include "Send test email", reporting sent or a fixed failure
  message.
- **FR-020**: Hardware-key controls MUST list keys by name only, each with delete, and an add-key
  form taking a name unique among the account's keys.
- **FR-021**: Authenticator-app controls MUST set the app up from a scannable code or a typed secret,
  confirmed by a current code from the app, and remove it.

**Sign-in**

- **FR-022**: The sign-in page MUST offer password, email link, hardware key, authenticator app
  (email plus current code) and recovery code (email plus unused code); any one enabled, set-up way
  MUST sign the user in on its own.
- **FR-023**: Every refusal on the sign-in, link request, password reset and account creation forms
  MUST read the same whether or not the email has an account or the way is enabled. With mail not
  set up, the link request and password reset forms answer that mail isn't set up, for every email
  alike (FR-029).
- **FR-024**: Email sign-in links MUST work once, within 15 minutes; an authenticator code MUST work
  at most once per account.
- **FR-025**: Repeated failures MUST be limited as in Edge Cases (5 sign-in failures per email per 15
  minutes, then 15 minutes refused; 3 email-sending requests per email per 15 minutes; 10 code
  attempts per network address per hour).

**Recovery**

- **FR-026**: "Forgot password" MUST send a reset link to an account that exists, valid once within
  30 minutes; using it MUST set a new password, enable password sign-in and end every sign-in,
  signing no one in.
- **FR-027**: Finishing the first hardware key or authenticator app setup MUST show ten one-time
  recovery codes once; the user MUST be able to replace them with a new set and see how many are
  left.
- **FR-028**: A recovery code MUST sign the user in once, with their email.

**Email and secrets**

- **FR-029**: The app MUST send mail through a mail server and sender address set per deployment; when
  they aren't set, every mail-needing control MUST say mail isn't set up, and nothing else breaks.
  This includes the sign-in page's "Email me a link" and "Forgot password", which say so for every
  email: mail is a per-server setting, so the answer reveals nothing about any email (owner,
  2026-11-06).
- **FR-030**: Links in emails MUST be built from a per-deployment public address (scheme and host)
  that is one of the hosts the UI answers to, never from the request.
- **FR-031**: Passwords, codes, recovery codes, link tokens and authenticator secrets MUST never be
  stored as they are typed or sent, and never logged, printed or shown after the one time the
  feature says.
- **FR-032**: Emails MUST hold only the account's name, a fixed message and, where needed, the
  one-time link; never a password or code.

**Security**

- **FR-033**: Every request that changes anything (every form, action and admin control, sign-in and
  sign-out included) MUST be refused unless its origin is the configured public address, and MUST
  carry an anti-forgery proof tied to the browser's session that a page of the UI gave it.
- **FR-034**: The sign-in cookie MUST NOT be sent on requests other sites start (except a top-level
  visit, so emailed links still open signed in where a sign-in exists).
- **FR-035**: Loading a page MUST never change anything; changes happen only through submitted
  requests.
- **FR-036**: A sign-in identifier MUST be at least 128 bits of secure randomness, stored on the
  server only as a one-way digest, and held in a cookie that scripts can't read, sent only over
  HTTPS (except on localhost), limited to the UI's own host and path.
- **FR-037**: Signing in MUST discard any identifier the browser held and issue a new one; changing
  the password MUST do so too; gaining or losing the admin mark MUST end the account's other
  sign-ins (and replace the current one when the change is the admin's own); using a reset link MUST
  end every sign-in (FR-026).
- **FR-038**: Signing out, a password change or reset, and "Sign out everywhere else" MUST end the
  affected sign-ins on the server, not only in the browser.
- **FR-039**: Passwords MUST be stored with a slow, salted, memory-hard one-way digest, at settings
  current guidance recommends, and compared in constant time.
- **FR-040**: Sign-in, link, reset and account creation answers MUST take about the same time
  whether or not the email exists (a password check is done against a stand-in when it doesn't).
  Sign-in MUST also be limited per network address (20 failures per 15 minutes) so many emails can't
  be tried from one place.
- **FR-041**: Every one-time value (creation code, email link, reset link, email-change link,
  identity-confirmation link, recovery code) MUST hold at least 128 bits of secure randomness, except recovery codes (at least
  50 bits each, being typed), be stored only as a digest, be compared in constant time, and be spent
  in the same step that checks it, so two requests can't both use it.
- **FR-042**: An emailed link MUST open a page that does nothing until the user presses its button;
  only that press uses the link.
- **FR-043**: Pages emailed links land on MUST tell the browser to send no referrer and store
  nothing in its cache, and the link value MUST be dropped from the address bar once the page
  loads.
- **FR-044**: The page returned to after sign-in MUST be a path on the UI itself; anything else
  (another host, a protocol-relative address, an encoded one) MUST fall back to the home page.
- **FR-045**: Every page MUST refuse to be framed by other sites and carry a content policy that
  allows only the UI's own scripts, styles and connections; responses MUST tell the browser not to
  guess content types and, in production, to use HTTPS only.
- **FR-046**: Names (at most 100 characters), emails (at most 254) and key names (at most 50) MUST
  be refused if they hold line breaks or control characters, and MUST be shown only as text.
- **FR-047**: Changing the email or password, enabling, disabling, adding or removing a way of
  signing in, making recovery codes, signing out everywhere else, and every admin action MUST require the user to have proved
  their identity within the last 10 minutes, asking again otherwise. The check MUST accept any
  usable way: the password, an authenticator code, a hardware key, a recovery code, or a
  confirmation link emailed to the account (once, within 15 minutes, in the browser that asked for
  it, returning to the page it was asked from).
- **FR-048**: The account's email MUST be told (with no link that undoes anything) when its password
  changes or is reset, a way of signing in is added, removed, enabled or disabled, recovery codes are
  made or one is used, the admin mark changes, or sign-in is locked by the limits.
- **FR-049**: Hardware-key sign-in MUST check that the key's answer was made for the UI's public
  address and a fresh challenge that works once within 5 minutes, and MUST refuse a key whose
  counter goes backwards; authenticator codes MUST be accepted only for the current 30-second step
  and the one before or after.
- **FR-050**: Authenticator secrets MUST be stored sealed with the app's secret key (as the Gmail
  app password is) and shown only during setup.
- **FR-051**: Security events (sign-ins, failures, lockouts, every change in FR-048, admin actions)
  MUST be recorded with the account, time, network address and a fixed event name, never a password,
  code, token or secret; the Account tab MUST show the account's last 20.
- **FR-052**: Error pages and messages MUST never show internal details (stack traces, query text,
  library messages); failures are reported by fixed messages.
- **FR-053**: No job data (jobs, scores, verdicts, settings, the resume and profile, sources, the
  Gmail connection, the database's name or host) MUST be read for, or sent to, a request that
  isn't signed in:
  - the sign-in MUST be confirmed before any page, data address or action reads any of it;
  - a signed-out page request (a full load or the app's in-page navigation) MUST get only a redirect
    to the sign-in page, a signed-out data request only a fixed refusal, and a signed-out action
    only a redirect to the sign-in page made before the action runs, none of them holding any job
    data;
  - the public pages (sign-in, account creation, link landing) MUST show none of it;
  - a background request that finds the browser signed out MUST take it to the sign-in page,
    returning to the same page after signing in;
  - every signed-in page and data answer MUST tell the browser not to store it (`no-store`), so Back
    or a shared browser shows nothing after signing out.

### Key Entities

- **Account** (the existing user, extended): email, name, admin mark, created time.
- **Sign-in method**: one per way per account: which way, enabled or not, set up or not, and its own
  details (a password's hash, an authenticator secret, its last used code).
- **Hardware key**: belongs to an account: a name and what the key needs to be recognised.
- **Recovery code**: belongs to an account; one-time, spent or not.
- **Session**: one sign-in on one browser: account, created, last used, ended.
- **Account creation code**: made by an admin; made, expires, spent by which account.
- **Email token**: a one-time link for signing in, resetting a password, confirming a new email or
  confirming it's you: account, purpose, expires, used (and, for confirming it's you, the sign-in
  that asked and the page to return to).
- **Attempt record**: failed sign-ins and email requests per email and per network address, for the
  limits.
- **Security event**: account, time, network address and a fixed event name (FR-051).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the feature on, no page or data of the UI is reachable without signing in (every
  address except the three public pages is refused when signed out), and no answer to a signed-out
  request, on any address, holds any job data.
- **SC-002**: An invited user goes from opening the account creation page to the Account page in
  under 2 minutes.
- **SC-003**: A user signs in with each of the four ways, and with a recovery code, in under 30
  seconds once it is set up.
- **SC-004**: A user who forgot their password is signed in again within 5 minutes of asking, using
  only their email.
- **SC-005**: Every one-time item (creation code, email link, reset link, identity-confirmation
  link, recovery code, authenticator code) is refused on its second use, 100% of the time.
- **SC-006**: Sign-in, link, reset and account creation answers are identical for an email with an
  account and one without.
- **SC-007**: After 5 wrong passwords in 15 minutes, the sixth attempt is refused even with the right
  password.
- **SC-008**: No password, code, secret or link token appears in the database as typed, in logs or
  in traces.
- **SC-009**: Every state-changing request sent from another site, or without the anti-forgery
  proof, is refused and changes nothing (each form and action of the UI checked).
- **SC-010**: No page of the UI can be shown in another site's frame, and every response carries
  the security headers of FR-045.
- **SC-011**: No sign-in, reset, email-change or identity-confirmation link is used up by merely
  opening it.
- **SC-012**: No address other than a path on the UI is ever reached by the after-sign-in return.
- **SC-013**: Every security change to an account produces a notice email and a security event.

## Assumptions

- A new account starts with password sign-in enabled and set up; the other three ways start off.
- The account-created email is a notice, not a confirmation step: the address is trusted as typed
  when the account is made, and email-link sign-in can be turned on right away.
- The account-created, email-change and admin-change emails go out without a test step; "Send test
  email" exists only on the email-link row, as the seed asks.
- Signing in by authenticator app or recovery code also asks for the email, so codes are checked
  against one account.
- Any signed-in account can change the shared Gmail connection, resume and settings (FR-002); this
  is accepted until data is tied to users.
- Hardware keys need the UI served over HTTPS or on localhost; production terminates HTTPS at its
  ingress, and local development uses localhost.
- Users are few (the owner and a handful of invitees); no account deletion, self-service admin
  removal or bulk management is in scope.
- The proxy in front of production (the ingress) passes the client's network address in a
  forwarded header the app is set to trust. Where no proxy is trusted (local use), the client's
  address can't be read reliably, so every direct client shares one per-address count and events
  record the address as `direct`.
- Libraries for the mail server, password hashing, hardware keys and authenticator codes are chosen
  with the owner's approval at planning (constitution IV).
- Not in scope: tying jobs, settings, sources, the resume or Gmail to a user (the Gmail connection
  is tied to an account in the feature that follows this one); account deletion;
  per-user data or permissions beyond the admin section.
