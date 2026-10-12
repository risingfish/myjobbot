# Data Model: Exclude Publishers by Domain

No storage changes: there are no new tables, columns or migrations. The model is the config
entry and the two job fields it is matched against.

## Publisher exclusion entry

One string in `jsearch.exclude_publishers`. Its kind comes from its text (research R4).

| Kind | Recognised by | Matched against | Rule |
|---|---|---|---|
| Name | no `.`, or contains whitespace | `Job.publisher` | Unchanged: whole words, any case, punctuation ignored (`normalizeTitle` + `hasWord`). A `null` publisher never matches. |
| Plain domain | contains `.`, no whitespace, does not start with `*.` | host of `Job.url` | `host === domain` |
| Wildcard domain | contains `.`, no whitespace, starts with `*.` | host of `Job.url` | `host === domain` or `host` ends with `"." + domain` |

**Normalised domain**: drop any leading `*.`, then take tldts `parse(rest).hostname`. That value
is lowercase, has no trailing dot, and keeps Unicode as written (research R3).

**Validation** (on config load):
- Every entry: at least one letter or digit. This is the existing `filterTerm` rule.
- Every domain entry: tldts must return a hostname equal to the entry text (lowercased, trailing
  dot removed). This rejects URLs, ports and malformed labels. It must also return a non-`null`
  registrable `domain`, which rejects bare public suffixes like `*.com` and IP addresses.
- On failure, loading stops with a message naming the entry.

## Job fields used (existing, unchanged)

| Field | Source (JSearch) | Use |
|---|---|---|
| `publisher: string \| null` | `job_publisher` | Name entries |
| `url: string` | `job_apply_link` | Domain entries, via its host |

**Apply link host**: tldts `parse(url).hostname`. An unreadable link gives `null`, or a bare
word with no dot. A valid domain entry never matches either, so the link is never dropped by a
domain entry.

## Flow (unchanged except the match)

```text
JSearch results ─► drop if isExcludedPublisher(job, entries)   ← name OR domain match
                 ─► drop if a company board already has the job
                 ─► upsertAll(fresh)
                 ─► search_fetch log: skipped_publishers = results dropped in step 1 (each counted once)
```
