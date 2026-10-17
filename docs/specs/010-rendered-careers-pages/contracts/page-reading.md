# Contract: reading a page in the careers lookup (010)

Extends `docs/specs/008-careers-page-lookup/contracts/careers-lookup.md`. Only the changes are
listed; everything else in 008's contract still holds.

## `readPage(deps, { url, kind, sought })` → `PageRead`

Called by `open_link` for every open. Tries, in order:

1. **Board data**, when `parseBoardLink(url)` recognises the address:
   - `careers_page`: the board's postings as links (`"<title> — <location>"`), ranked with the
     sought title first, fitted to `page_chars`; text `"<N> open jobs at <company> on <Board>"`.
     Workday: the board's own search for the sought title, 20 results.
   - `job_page`: the posting's title, location and description text, fitted to `page_chars`. A
     posting not in the board's data: empty text and the note "this posting is no longer listed".
   - Board data is read once per board (and per Workday search) per run.
   - Any failure except an address refusal → `board_failed` is added to `fallback`, and step 2 runs on
     the same url.
   - Board requests never follow a redirect: the board client (`HttpClient.withoutRedirects()`)
     fails on any 3xx, so the board step falls back to the download, which checks every hop
     (found in the S6 review: plain `getJson` follows redirects unchecked).
2. **Plain download**: 008's `fetchPublicPage` + `trimPage`, unchanged.
3. **Rendering**, only when step 2 succeeded and the page is unreadable (job page: no text;
   careers page: no links), and rendering is on:
   - fresh browser context; every request checked by `assertPublic`; images, fonts and media
     aborted; service workers blocked; WebSockets checked the same way; allowed requests are
     fetched without following redirects, so every redirect hop is checked as a request of its
     own, and the page's final address is checked after loading;
   - `domcontentloaded`, then network idle until `render_seconds` is used up; content capped at
     `max_download_kb`; trimmed with `trimPage`;
   - main navigation refused → `FetchRefused`; any other failure → `render_failed` is added to
     `fallback`, rendering is off for the run, and the step-2 page is returned;
   - rendering off or not configured → `render_off` is added to `fallback` and the step-2 page is
     returned.

`fallback` lists every fallback in the order it happened, comma-separated
(`board_failed,render_off`), or is `null`.

Every request in steps 1–3 passes `assertPublic` (http(s), default port, no credentials, every
resolved address public).

## `open_link` changes

- Limit and refusals as 008 (with 9de3535: at most 4 opens, a 5th ends the lookup).
- A page that fails to open (refused, timed out, HTTP error such as 404) is **returned**, not thrown:
  `{ opened: false, reason: "fetch_refused" | "timed_out" | null, note }`. It still writes the
  failed audit row, still sets `lastFailure`, and still counts as an open.
- The audit row of every open adds `page_source`, `fallback` and `board`.

## `search_careers` changes

- Results on `skip_hosts` (host or parent domain) are dropped before caching and numbering.
- A second call in the same lookup returns `{ note: "already searched; use the links above" }`
  without searching and without an audit row.

## Lookup start

- A job with `retry: true` writes `{ step: "retry", outcome: "ok" }` first. Retried jobs may already
  be scored; storing a found description clears `scored_at`, so the agent scores them again.
- A run's first rendering runs the LAN self-test when `lan_probe_url` is set:
  `{ step: "render_check", url: <probe>, outcome: "ok" | "failed", warning }` plus a
  `render_check` trace event; it never blocks rendering.

## Careers summary

`note` may now also say (joined with "; " to an existing note):
- "page rendering not configured" (only when a page needed rendering in that run)
- "page rendering turned off: browser service failed"
- "LAN check not configured"
