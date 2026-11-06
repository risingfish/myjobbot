# Contract: CLI, environment and mail (024)

## CLI

```text
npm start -- account init <email>     # user 1 → email, admin, password (hidden prompt, asked twice)
npm start -- account reset <email>    # an admin → new password, password sign-in enabled, all sessions ended
```

- Exit 0 with `account <email>: ready` / `account <email>: password reset`.
- Exit 1, one line, nothing changed: `account init: user 1 already has an email`,
  `account reset: no admin with that email`, `password: <password_rule message>`,
  `password: the two entries differ`, `email: not a valid address`.
- Never echoes or logs the password. Not a TTY → refuses (`account: needs a terminal for the
  password`).
- `USAGE` in `src/cli.ts` gains `account <init|reset> <email>`.
- `reset` records `password_reset` with no network address (`address` null) and, with mail set
  up, queues the security notice through a mailer built from the environment.

## Dev copy (`scripts/copy-prod.sh`, research R19)

- Copies no rows of `sessions`, `email_tokens`, `auth_challenges`, `auth_attempts` and
  `account_codes`: the main `mysqldump` passes `--ignore-table=myjobbot.<table>` for each, and a
  second `mysqldump --no-data myjobbot <the five tables>` creates them empty in the target.
- `users`, `sign_in_methods`, `hardware_keys`, `recovery_codes` and `security_events` copy as today.
- The usage line, the refusals and the summary line don't change.

## Environment (`.env.example`, Helm `values.yaml`, Secret)

| Variable | Required | Meaning |
|---|---|---|
| `MYJOBBOT_BASE_URL` | yes for the web UI | full public origin, e.g. `https://jobs.example.com` or `http://localhost:8080`; its `host[:port]` must be in `MYJOBBOT_HOSTS`; `http:` only for localhost. Otherwise `docker/entrypoint.sh serve` refuses to start, and the proxy answers every request 500 with the fixed `base_url` text (logged once) |
| `MYJOBBOT_TRUSTED_PROXIES` | no (default 0) | proxies in front that append to `X-Forwarded-For`; Helm sets 1. With 0, every direct client shares one per-address count (`direct`, research R6) |
| `MYJOBBOT_SMTP_HOST`, `_PORT`, `_USER`, `_PASSWORD` | all or none | mail server; TLS required (465 implicit, else STARTTLS required) |
| `MYJOBBOT_MAIL_FROM` | with SMTP | sender address |
| `MYJOBBOT_SECRET_KEY` | optional (needed for Gmail and for authenticator apps) | now also seals authenticator secrets; without a usable key, authenticator setup answers `secret_key_missing` |

None of these is ever printed (`docker compose config --quiet` only).

## Mail (plain text, `src/mail/messages.ts`)

| Message | To | Contains |
|---|---|---|
| Account created | new account | name, "Your myjobbot account was created", base URL |
| Someone tried your address | existing account | fixed text, base URL |
| Sign-in link | account | name, `<base>/link#p=signin&t=<token>`, "expires in 15 minutes" |
| Password reset | account | name, `<base>/link#p=reset&t=<token>`, 30 minutes |
| Confirm new email | the new address | name, `<base>/link#p=email_change&t=<token>`, 24 hours |
| Confirm it's you | account | name, `<base>/link#p=step_up&t=<token>`, "expires in 15 minutes", "open it in the browser where you asked" |
| Email changed | old address | fixed text, no link |
| Security notice | account | fixed text naming the event (FR-048), time, no link |
| Test | account | fixed text |

Subjects are fixed strings starting `myjobbot:`. Each builder arrives in the sitting of its first
caller: Account created and Someone tried in S2, Security notice in S3, the rest in S4. Sending never blocks a request (queued after the
answer, R9); a failure is logged as `mail_failed <reason-code>` only, the code one of `auth`,
`connect`, `tls`, `refused`, `other`.
