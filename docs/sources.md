# Job sources

Where jobs come from: the source modules, saving and testing a source, JSearch and its budget, and reading LinkedIn alerts from Gmail.

[← README](../README.md)

## Modules and saved sources

A **source** is somewhere jobs come from. Each kind of source is a **module** shipped with the app
(`src/sources/modules/`); what you save on the Settings page is a **saved source**: a module, a
name, the module's fields, and whether it is on. Saved sources are rows in `user_sources`, and
every job remembers the one it came from (`jobs.source_id`).

| Module | Kind | Fields | Fetched |
|---|---|---|---|
| Greenhouse | company board | board id (`boards.greenhouse.io/<id>`) | every run, the whole board |
| Lever | company board | board id (`jobs.lever.co/<id>`) | every run, the whole board |
| Ashby | company board | board id (`jobs.ashbyhq.com/<id>`) | every run, the whole board |
| Gem | company board | board id (`jobs.gem.com/<id>`) | every run, the whole board |
| Workday | company jobs site | host, tenant, site (`<tenant>.wd<N>.myworkdayjobs.com/<site>`) | every run, at most 100 postings, continuing where the last run stopped |
| JSearch | saved search | search, country, remote only | once per `jsearch.refresh_hours`, within `jsearch.monthly_request_cap`; needs `JSEARCH_API_KEY` |
| Gmail alerts | your mailbox | none | every run, once Gmail is connected (see [Gmail](#gmail-alerts)) |

## Adding a source

In Settings → Sources, paste a jobs page link (a board's page, or one posting
on it; `https://` is optional) and press **Open**: the form of the module it belongs to opens with
its fields filled in and a suggested name. Or pick a module from the list; one that can't be used
yet says why ("Needs JSEARCH_API_KEY in .env"). **Edit** opens a saved source's form. **Save**
refuses, beside the field or at the top of the form:
- a field its module doesn't accept;
- a blank name, "Gmail alerts" (reserved), or a name another source has, ignoring case;
- a second source for the same board or search;
- a search that would take JSearch past its monthly budget, counting each search that is on as
  one request per `jsearch.refresh_hours`.

## Test on save

A saved source is tested at once: the first page a run would read, through the
same address-checked client, with none of its jobs stored. The form says "Saved. Test found N
jobs." or why it failed. A Workday test reads only the listing; a JSearch test spends one request.
A failing test marks the source failing, and a run tries a failing source again even when a search
isn't due. Changing a source's board or search forgets its last fetch, so the next run reads the
new one.

## The source list

Each source's row shows whether it is on, its last fetch ("ok", "stopped at the limit (continues
next run)", or "failing: <reason>"), and a switch and **Delete**. Gmail alerts is added for you,
appears in the list once Gmail is connected, and can be switched off but not edited or deleted.
Scraping web pages that aren't a job board's own data isn't a module yet.

## How sources are fetched

Every run fetches each source that is on before the model starts: company boards first, then
Gmail alerts, then the searches that are due. The model only scores what was fetched. The
[fetch phase](how-it-works.md#the-five-tools) has the details.

## JSearch

JSearch searches Google for Jobs, which includes LinkedIn, Indeed, Glassdoor and company sites,
without scraping LinkedIn. Results are stored and scored like board jobs. A result is skipped when
the same employer and title already came from a company board you list. A result is dropped and never
stored when its publisher (the board it was found on) or its apply link's domain is in
`jsearch.exclude_publishers`; `exclude_companies` can't do this, because an aggregator's results name the real employer as the company.
Domains catch a board however its name is spelled ("JobMesh.io" and "JobMESH" both link to `jobmesh.io`),
and a wildcard like `"*.trabajo.org"` covers regional hosts such as `us.trabajo.org`.
Excluded results still count against the budget. Budget: every request
is recorded in the `api_calls` table; a search refreshes at most once per `refresh_hours` (less 15 minutes, so a
fixed schedule never skips a refresh by a few seconds), and never once the month's count reaches `monthly_request_cap`.
A search whose last fetch failed is tried again on the next run. When a search isn't due, the run
skips it and `next_jobs` serves its stored jobs. Each fetch writes a `source_fetch` line to the
run's jobs log.

Saved searches need `JSEARCH_API_KEY` in `.env` (a free key at openwebninja.com, with the account
subscribed to JSearch). The budget and freshness settings, `jsearch.monthly_request_cap` (190; the
free tier is 200), `jsearch.refresh_hours` and `jsearch.date_posted`, are runtime settings in
`data/config.json`, and `jsearch.exclude_publishers` is a search setting; all are in
[Settings](how-it-works.md#settings).

## Gmail alerts

Settings has a Gmail panel that connects your mailbox over IMAP with an app password. Once it's
connected, every run reads your new LinkedIn job-alert emails and turns their jobs into jobs
myjobbot scores, under the source "Gmail alerts".

How runs use the alerts:
- **What's read**: only new alert mail since the last run (the last 7 days the first time), at
  most the 50 newest per run. The mailbox is opened read-only and only each email's HTML part is
  downloaded, so nothing is marked read, moved or deleted. Email text is never stored, only the
  jobs.
- **Descriptions**: alert emails carry no job description. For new alert jobs that pass the title
  filter, a run makes one JSearch search per alert email (the alert's own keywords) and fills in
  the description for postings it finds. Lookups only use what's left of
  `jsearch.monthly_request_cap` after your saved searches' refreshes for the rest of the month.
  Jobs without a description are still scored, and their gaps say "scored from the alert only".
- **Duplicates**: a posting seen again keeps its score and details. One already stored from a
  company board or saved search isn't added again.
- **Visible results**: the Gmail panel shows the last run's counts ("3 alert emails, 14 jobs, 1 not
  understood"). A rising "not understood" count means LinkedIn changed its email layout.
- **Indeed**: Indeed alerts aren't parsed yet; they're counted separately, as unsupported, in
  the run trace.
- **Careers pages**: alert jobs JSearch couldn't describe get a [careers lookup](how-it-works.md#careers-lookup)
  when a SearXNG server is configured.

One-time setup:
1. **Turn on 2-step verification** for your Google account, if it isn't on already.
2. **Create an app password** at https://myaccount.google.com/apppasswords (call it "myjobbot")
   and keep the 16 letters Google shows.
3. **Set the server key** in `.env`: `MYJOBBOT_SECRET_KEY=` followed by the output of
   `openssl rand -base64 32`. It seals the app password in the database. If it changes, the panel
   asks for the app password again. It takes effect after `docker compose up -d` (not `restart`)
   or restarting `npm run web`.

To connect, open Settings from any address, enter your Gmail address and the app password
(spaces are fine), and press **Connect**. myjobbot signs in to `imap.gmail.com` first, and
saves the pair only if that works. After that:
- **Check now** counts the job-alert emails of the last 7 days in All Mail and lists the newest
  five. It opens the mailbox read-only, so nothing is marked read, moved or deleted.
- **Disconnect** forgets the address and app password. To revoke access, also delete the app
  password at the same Google page.

The senders that count as job alerts are `gmail.alert_senders` in `data/config.json`. An app
password gives full access to the mailbox (Google has no read-only kind), and myjobbot only ever
reads it. Each user connects their own Gmail, and a run reads only that user's alerts. The stored app password can't be read back through the UI.

## Descriptions

How each source's descriptions are stored, as Markdown or plain text, is in
[How descriptions are stored](database.md#how-descriptions-are-stored).
