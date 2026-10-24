# Quickstart: Company records

How to check each PR once it is merged and the stack is rebuilt (`npm run docker:up`). Every PR also
passes `npm run check` and `npm run check:db` before it is opened. Queries run against the
`myjobbot` database. Storage is in [data-model.md](data-model.md), and the queries and trace events
in [contracts/company-records.md](contracts/company-records.md).

## PR 1a: the table

`SHOW CREATE TABLE companies;` shows the table, and every job's `company_id` is null. Nothing else
changes.

## PR 1b: records and links

1. Before the next run, `SELECT COUNT(*) FROM companies;` is `0`.
2. After one run (`npm start -- run`):
   - `SELECT company, COUNT(*) FROM jobs WHERE company_id IS NULL GROUP BY company;` lists only names
     with no letters or digits, which can't have a record (SC-001);
   - `SELECT company_key, COUNT(*) FROM companies GROUP BY company_key HAVING COUNT(*) > 1;`
     returns nothing.
3. A company on `exclude_companies` has a record, and its jobs are still missing from Recommended
   (SC-002).
4. `created_date` of an old company is its earliest job's `first_seen`, and its `name` is that job's
   company name.

## PR 2: the careers lookup's pages folded in

1. The `careers_pages` table is gone. Each company it held has that page as `careers_url`, with
   `careers_source = 'lookup'`.
2. A run's careers lookups still start from the remembered page (`remembered` steps in
   `careers_audit`), and a page that led to a found job shows on the company.

## PR 3: board addresses

`data/config.json` has `"companies": []` today, so add one board first, for example `{ "name":
"Ashby", "ats": "ashby", "slug": "ashby" }`. After one run, that company's `careers_url` is its
board's public address, with `careers_source = 'board'`.

## PR 4: the search

1. After a run, up to 50 companies have `searched_at` set. The trace has one `company_search` event
   per company searched.
2. A second run the same day searches none of them again.
3. **SC-005**: pick 20 well-known companies from the records. At least 16 have their own website,
   at most 2 hold a wrong one, and none holds a job aggregator.
4. **SC-006**: the query in the contract lists every company without a careers page, with a reason
   and, for `no_match`, the turned-down addresses.
5. **SC-004**: stop the SearXNG container and run. The run completes, every company found is
   recorded, the companies due are marked `search_unavailable`, and the trace says why.

## PR 5: docs

README and CLAUDE.md describe the records, the search and how to list the misses.
