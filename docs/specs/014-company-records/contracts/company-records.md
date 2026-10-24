# Contract: company records

## Config (`data/config.json`)

```json
{ "company_search": { "max_per_run": 50 } }
```

`max_per_run` is an integer ≥ 0, defaulting to 50; `0` turns the search off. Nothing else is
configurable. The search uses the careers lookup's `skip_hosts` and the existing
`MYJOBBOT_SEARXNG_URL`.

## SearXNG queries

| Purpose | Query | When |
|---|---|---|
| Website | `<name>` | the company has no website |
| Careers page | `<name> careers` | the company has no careers page (never for a `board` page) |

At most two requests per company, and `max_per_run` companies per run. A search request failing or
returning malformed JSON means "SearXNG unavailable" (R8).

## Address rules (research R7)

| Rule | Accepts | Example accepted | Example turned down |
|---|---|---|---|
| Website | first result whose main host name contains the key without spaces; not a skip host; storable | `https://www.acme.co.uk/about` → `https://www.acme.co.uk` for "Acme Ltd" | `https://www.linkedin.com/company/acme` |
| Careers | first storable result on the website's host or a subdomain with `career`/`jobs` in its address or title, or a board page whose slug matches the key | `https://careers.acme.com/`, `https://jobs.lever.co/acme` | `https://acme-reviews.example/acme-careers` |

## Trace events (`data/runs/*.jsonl`)

```json
{ "type": "company_search", "company": "Acme", "website": "found", "careers": "no_match" }
{ "type": "company_search_unavailable", "reason": "not_configured", "skipped": 12 }
```

`website` and `careers` are each `found`, `kept` (already set, not searched), `search_unavailable`,
`no_results` or `no_match`. The `reason` of an unavailable search is `not_configured` or `failed`.
Events hold no page text and no result titles.

## Finding the misses (SC-006)

```sql
SELECT name, careers_reason, careers_rejected, searched_at
FROM companies WHERE careers_url IS NULL ORDER BY last_found_date DESC;
```
