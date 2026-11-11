# Database structure

How myjobbot's MariaDB database is set up, what its tables hold, how descriptions are stored, and queries for looking inside.

[← README](../README.md)

## Setting up the database

Jobs, the companies they come from, scores, verdict history, the JSearch request log, your saved
sources and your search settings live in MariaDB (10.11 or later),
reached through [Kysely](https://kysely.dev) typed queries. `data/` keeps only `config.json` (the
runtime settings), `resume.md`, run traces and logs.

1. **Create a database** (any name), `CHARACTER SET utf8mb4` with any collation (the tables set
   their own), and a user with rights on just that database. The full stack
   ([`compose.full.yaml`](deploying.md#the-full-stack-composefullyaml)) does this for you. A test
   database for the integration tests is covered in [Developing](developing.md#tests-and-the-test-database).
2. **Set in `.env`**: `MYJOBBOT_DB_HOST`, `MYJOBBOT_DB_USER`, `MYJOBBOT_DB_PASSWORD`, and
   optionally `MYJOBBOT_DB_PORT` (3306) and `MYJOBBOT_DB_NAME` (`myjobbot`).
3. **Start anything**: the agent and the web UI create or update the tables on first use. Each
   schema change is a numbered step in `src/db/migrations/`, run once per database.

Every table compares text exactly (`utf8mb4_bin`), so job IDs that differ only in letter case
stay distinct, and every connection sets `utf8mb4`, so accents and emoji survive. Backups are the
MariaDB server's job, and a database backup holds your sources, search settings and accounts too
(`users`, `user_sources`, `user_settings` and the sign-in tables).

## Tables

```mermaid
erDiagram
    JOBS {
        text ats PK "greenhouse | lever | ashby | workday | jsearch | linkedin"
        text job_id PK
        text company
        text title
        text normalized_title "for repost matching"
        text url
        text location
        text department
        text team
        text workplace_type
        int is_remote
        text compensation
        text publisher "the site a JSearch or alert job was found on"
        text posted_at "from the board"
        text description "Markdown or plain text, up to 20,000 chars"
        text description_format "markdown or text (null with no description)"
        text description_source "source or careers"
        text description_url "the careers page it was found on"
        text requirements "JSON array (JSearch qualifications)"
        text skills "JSON array (JSearch required technologies)"
        text preferred_skills "JSON array (JSearch preferred technologies)"
        text injection_seen_at "first time its text tried to escape the data markers"
        int company_id FK "the company's record"
    }
    USER_JOBS {
        int user_id PK, FK
        text ats PK, FK
        text job_id PK, FK
        int source_id FK "the user's saved source it came from (null once that is deleted)"
        text source "the name of that source, kept if the source is deleted"
        text first_seen "first time the user's run saw it"
        text last_seen "the user's last run it was still listed in"
        int score "base + bonus, set by record_matches"
        int base_score "0-50, resume fit"
        int bonus_score "0-50, preference fit"
        text reasons "JSON array"
        text gaps "JSON array"
        text scored_at
        int hidden "1 when the user hid it in the web UI"
        int applied "1 when the user marked it applied"
        text applied_on "when they marked it applied (UTC), set with applied"
    }
    JOBS ||--o{ USER_JOBS : "seen by"
    USERS ||--o{ USER_JOBS : "sees"
    COMPANIES {
        int id PK
        text company_key "the normalized name, unique"
        text name "as when the record was created"
        text website_url
        text careers_url
        text careers_source "board, lookup or search"
        text created_date
        text last_found_date
        text searched_at
        text website_reason "why the last search found no website"
        text website_rejected "JSON array of turned-down addresses"
        text careers_reason "why the last search found no careers page"
        text careers_rejected "JSON array of turned-down addresses"
    }
    COMPANIES ||--o{ JOBS : "has"
    USERS {
        int id PK "the owner is 1"
        text name
        text created_at
    }
    USER_SETTINGS {
        int user_id PK, FK
        json settings "the search settings you set on the Settings page (no defaults)"
        text updated_at
    }
    USERS ||--o| USER_SETTINGS : "searches with"
    USER_SOURCES {
        int id PK
        int user_id FK
        text module "greenhouse | lever | ashby | workday | jsearch | gmail_alerts"
        text name "unique per user"
        json params "the module's fields"
        text target "the board or search, unique per user"
        int enabled
        int company_id FK "a company source's company"
        json cursor "where a partial fetch continues"
        text last_fetched_at
        text last_outcome "ok, partial or failing"
        int last_jobs
        int last_cost "JSearch requests"
        text last_reason "a fixed reason, when failing"
    }
    USERS ||--o{ USER_SOURCES : "fetches from"
    USER_SOURCES ||--o{ USER_JOBS : "supplies"
    COMPANIES ||--o{ USER_SOURCES : "has boards"
```

`jobs` holds each posting once, shared by every user who finds it: what the posting says. `user_jobs`
holds each user's view of it: when their runs saw it, which of their sources it came from, their
score and their marks. A user only ever reads their own views, and a posting is pruned only once no
user has a view of it.

Company boards and JSearch save the job description (see below). Alert emails carry none: an alert job takes the description of a matching JSearch result,
or the one the [careers lookup](how-it-works.md#careers-lookup) finds, and otherwise has none
(`description_source` says which). JSearch also supplies requirement bullets and required and
preferred technologies, which are saved when present; the other sources don't have them as lists,
so those columns stay empty. Each scoring decision is also kept in the `verdicts` table (see
[How scoring works](how-it-works.md#how-scoring-works)).

The other tables, each listed in `src/db/schema.ts` with its columns in `src/db/schema/`:

| Tables | Hold |
|---|---|
| `verdicts` | every scoring decision, with its run and user |
| `api_calls` | the JSearch request log, for the monthly budget |
| `careers_audit` | each careers lookup step: addresses and sizes, never page text |
| `gmail_connection`, `gmail_alert_state` | each user's Gmail address and sealed app password, and where reading their alerts left off |
| `rescore_runs`, `rescore_steps` | each re-score, with its user, and its steps, shown as its Log |
| `resumes`, `resume_profiles` | each user's uploaded resume text and its extracted profile |
| `agent_runs`, `run_users` | each run with its heartbeat, outcome and totals, and each user's part of it, kept 90 days ([Monitoring](how-it-works.md#monitoring)) |
| `source_fetches` | each fetch or planned skip of a saved source: module, outcome, fixed reason, counts, duration; kept 90 days, removed with its source |
| `mail_sends` | each mail send's kind, outcome and fixed reason, never its address or text; kept 90 days |
| `users.deactivated_at`, `users.delete_after` | when an account was deactivated, and when its requested deletion is due ([Deactivating and deleting](how-it-works.md#deactivating-and-deleting)); deleting an account clears it from `account_codes` (`created_by`, `used_by` set null), which keep their codes |
| `sign_in_methods`, `hardware_keys`, `recovery_codes`, `sessions`, `account_codes`, `email_tokens`, `auth_challenges`, `auth_attempts`, `security_events` | accounts and signing in (see [Accounts and signing in](how-it-works.md#accounts-and-signing-in)) |

## How descriptions are stored

Sources that send HTML have it converted to **Markdown** before it is stored
([turndown](https://github.com/mixmark-io/turndown), `src/descriptions/toMarkdown.ts`), so the
posting's headings, lists and emphasis survive:

| Source | What is stored |
|---|---|
| Greenhouse | Markdown from its HTML (sent escaped, decoded once) |
| Ashby | Markdown from `descriptionHtml` |
| Gem | Markdown from its HTML (sent raw) |
| Lever | Markdown of the whole posting: the opening, each list ("Requirements"…) under its own heading, then the closing section |
| Careers lookup | Markdown of the job page (a Workday or other board page's own posting, or the downloaded or rendered page without its menus, header, footer or hidden parts) |
| JSearch | Plain text, as JSearch sends it |

`description_format` says which a row holds; rows stored before Markdown, and JSearch's, stay
plain text and always show as plain text.

- **Only safe formatting is kept.** Scripts, styles, frames, forms, media and images are dropped
  with their contents; other wrappers keep their text; links are kept only for `http(s)` addresses;
  text that merely looks like HTML or Markdown is escaped. At most 20,000 characters, cut at a line
  break.
- **It is shown safely.** The panel renders it with
  [react-markdown](https://github.com/remarkjs/react-markdown): raw HTML is never interpreted, no
  images load, and only `http(s)` links become links (new tab, no referrer).
- **The model reads a link-free copy.** `get_job_details` and description boosts see the Markdown with each
  link reduced to its words, so a link to `aws.example.com` doesn't count as "aws".
- **Scored again once.** The first time a scored job's description changes to Markdown, it is marked
  for scoring again, keeping its current score until then.
- **Only saved sources change.** Stored jobs from a source you've deleted or switched off are
  never fetched again, so they keep their plain text.

## Ghost postings and pruning

**Fishing-post detection:** "days open" counts from the oldest date the bot has, either
`posted_at` or `first_seen`, across all rows with the same company and normalized title.
That way a job reposted under a new ID still shows its true age. Over 60 days
(`ghost_threshold_days`) sets `possible_ghost: true`, and the model lowers its score a
little. After each run, once every user has had their turn, a user's views not seen for 90 days
(`job_retention_days`) are pruned, except jobs they've marked applied, which are kept with their
scoring history; a posting goes once no user has a view of it. Company records are never pruned.

## Useful queries

The careers lookup's audit log: why lookups ended without a description, the latest steps, and the
careers pages found:

```sql
SELECT reason, COUNT(*) FROM careers_audit WHERE warning = 1 GROUP BY reason;
SELECT at, company, step, outcome, reason, url FROM careers_audit ORDER BY id DESC LIMIT 50;
SELECT name, careers_url, careers_source FROM companies WHERE careers_url IS NOT NULL;
```

Company records: companies still missing a careers page, and where the pages came from:

```sql
SELECT name, careers_reason, careers_rejected, searched_at FROM companies WHERE careers_url IS NULL ORDER BY last_found_date DESC;
SELECT careers_source, COUNT(*) FROM companies GROUP BY careers_source;
```

## Coming from SQLite

Copy an old SQLite database across once, with the agent stopped:

```bash
sqlite3 data/myjobbot.db ".backup 'data/myjobbot-pre-mariadb.db'"
npm start -- import-sqlite data/myjobbot-pre-mariadb.db
```

The import is all or nothing. It refuses a database that already has rows, and any value too long
for its column, and it checks counts and a sample before committing.
