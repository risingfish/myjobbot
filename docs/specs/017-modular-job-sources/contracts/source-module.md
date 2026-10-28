# Contract: a source module

Every module the app ships implements `SourceModule<P>` (`src/sources/module.ts`) and is listed in
`MODULES` (`src/sources/registry.ts`). A new platform is added by writing a module and listing it,
with no change to the run, the job pipeline, the saved sources or the Settings page (SC-006).

## What a module states

| Member | Required | Meaning |
|---|---|---|
| `id` | yes | Stable key stored on saved sources; never changes once shipped |
| `name`, `description` | yes | Shown in the Settings page's module picker |
| `kind` | yes | `ats`, `api`, `email`; `web` reserved for scraping |
| `scope` | yes | `company`, `query` or `account` |
| `params` | yes | zod schema: a saved source's fields and their rules |
| `fields` | yes | `SourceField[]`: how the form shows each field (label, input, options, optional) |
| `fromUrl(url)` | no | The params a pasted link gives, or `null` when it isn't this module's |
| `suggestName(params)` | no | The name offered for a new source |
| `target(params)` | yes | What the source points at, unique per user |
| `requires` | yes | What must be set up first: `jsearch_key`, `gmail` |
| `limits.maxJobsPerRun` | yes | Jobs a run reads from one source before stopping and keeping its place; `null` for no limit |
| `limits.refresh` | yes | `every_run`, or `jsearch_refresh_hours` |
| `fetch(params, ctx, from)` | yes | Yields pages: `{ jobs, cost, next }`, from a cursor or the first page |
| `company(params, name)` | company scope only | The company record's name and careers page |
| `postings` | ATS modules | What the careers lookup reads: `list(params, http)`, `search(params, text, http)`, `one(params, id, http)` |

## Rules every module keeps

- **The context is the only way out.** A module makes requests only through `ctx.http`, built by
  `sourceHttp`. That client checks every address is public (`assertPublic`), follows no redirects,
  and is rate-limited per host. It offers `getJson` and `postJson`. A request to a non-public
  address is refused.
- **No storing.** A module yields jobs and never writes to a store. The fetch phase stores them
  through `ingest`, and writes anything else a module reports. For Gmail, that's the mail state
  carried in its page's `next`.
- **Fixed reasons on failure.** `failureReason(error)` maps a failure to "not found", "refused",
  "unreachable", "unexpected answer" or "not set up". A thrown message is never shown or stored.
- **Outside text stays data.** Every job field a module returns is outside text. It reaches the model
  only through tools that declare `outsideText: true`.
- **Descriptions** are made through `makeJob` and `capDescription`, as Markdown or text (feature 012).

## The modules in this feature

| Module | Scope | Params | `fromUrl` recognises | Target | Pages | `maxJobsPerRun` | Refresh | Cost a page |
|---|---|---|---|---|---|---|---|---|
| `greenhouse` | company | `{ slug }` | `boards.greenhouse.io/<slug>`, `job-boards.greenhouse.io/<slug>` | `greenhouse:<slug>` | 1 | none | every run | 0 |
| `lever` | company | `{ slug }` | `jobs.lever.co/<slug>` | `lever:<slug>` | 1 | none | every run | 0 |
| `ashby` | company | `{ slug }` | `jobs.ashbyhq.com/<slug>` | `ashby:<slug>` | 1 | none | every run | 0 |
| `workday` | company | `{ host, tenant, site }` | `<tenant>.wd<N>.myworkdayjobs.com/[<locale>/]<site>` | `workday:<host>/<site>` | 20 a page | 100 | every run | 0 |
| `jsearch` | query | `{ query, remote_only?, country? }` | — | `jsearch:<query>\|<country or us>\|<remote_only or false>` | 1 | none | `jsearch.refresh_hours` | 1 |
| `gmail_alerts` | account | `{}` | — | `gmail_alerts` | 1 | none | every run | its lookups' JSearch requests |

Targets are lowercased. A link to a single posting resolves to its board
(`jobs.lever.co/acme/1234` gives `{ slug: "acme" }`). A suggested name is the slug or Workday
tenant, with its first letter capitalised, or the JSearch query.

**Workday job ids** are `<tenant>/<site>/<posting id>`, so they're unique across companies. One over
255 characters is replaced by its SHA-256 hex digest; the posting's address stays in its `url`.
