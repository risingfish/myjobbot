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
| `fields` | yes | How the form shows each field (label, input, options, optional) |
| `fromUrl(url)` | no | The params a pasted link gives, or `null` when it isn't this module's |
| `target(params)` | yes | What the source points at, unique per user (`greenhouse:stripe`) |
| `requires` | yes | What must be set up first: `jsearch_key`, `gmail` |
| `limits.maxPerRun` | yes | Jobs a run reads from one source before stopping and keeping its place |
| `limits.refresh` | yes | `every_run`, or `jsearch_refresh_hours` |
| `fetch(params, ctx, from)` | yes | Yields pages: `{ jobs, cost, next }`, from a cursor or the first page |
| `company(params, name)` | company scope only | The company record's name and careers page |
| `postings` | ATS modules | What the careers lookup reads: `list`, or `search` and `one` |

## Rules every module keeps

- **The context is the only way out.** A module makes requests only through `ctx.http`. That client
  checks every address is public, and checks it again on each redirect. It rate-limits per host.
- **No storing.** A module yields jobs and never writes to a store. The shared pipeline (`ingest`)
  stores them.
- **Fixed reasons on failure.** A thrown error's message is never shown or stored. The fetch phase
  records a fixed reason per kind of failure: "not found", "refused", "unreachable", "unexpected
  answer", "not set up".
- **Outside text stays data.** Every job field a module returns is outside text. It reaches the model
  only through the tools that declare `outsideText: true`, as today.
- **Descriptions** are made through `makeJob` and `capDescription`, as Markdown or text (feature 012).

## The modules in this feature

| Module | Scope | Params | `fromUrl` recognises | Pages | `maxPerRun` | Refresh | Cost a page |
|---|---|---|---|---|---|---|---|
| `greenhouse` | company | `{ slug }` | `boards.greenhouse.io/<slug>`, `job-boards.greenhouse.io/<slug>` | 1 | all | every run | 0 |
| `lever` | company | `{ slug }` | `jobs.lever.co/<slug>` | 1 | all | every run | 0 |
| `ashby` | company | `{ slug }` | `jobs.ashbyhq.com/<slug>` | 1 | all | every run | 0 |
| `workday` | company | `{ host, tenant, site }` | `<tenant>.wd<N>.myworkdayjobs.com/[<locale>/]<site>` | 20 a page | 100 | every run | 0 |
| `jsearch` | query | `{ query, remote_only?, country? }` | — | 1 | 1 request | `jsearch.refresh_hours` | 1 |
| `gmail_alerts` | account | `{}` | — | 1 | all | every run | 0 |

A link to a single posting resolves to its board (`jobs.lever.co/acme/1234` gives `{ slug: "acme" }`).
