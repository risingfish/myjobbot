# Contract: `jsearch.exclude_publishers`

This is the user-facing interface: the config setting and the log field it feeds. Today's
contract is the "Behaviour" section of
`docs/superpowers/specs/2026-10-09-exclude-publishers-design.md`. This document supersedes the
parts it changes.

## Setting

```json
{
  "jsearch": {
    "exclude_publishers": ["dailyremote", "jobmesh.io", "*.trabajo.org"]
  }
}
```

Type: array of strings. Default: `[]`.

### Entry grammar

```text
entry         = name-entry | domain-entry
domain-entry  = [ "*." ] hostname [ "." ]        ; contains "." and no whitespace
hostname      = a valid hostname per tldts, with a registrable domain (not a bare public suffix or IP)
                ; compared case-insensitively; Unicode allowed as written
name-entry    = any string containing whitespace or no "." , with at least one letter or digit
```

### Matching

| Entry | Matches apply-link host | Does not match |
|---|---|---|
| `jobmesh.io` | `jobmesh.io`, `JobMesh.IO.` | `www.jobmesh.io`, `notjobmesh.io`, `jobmesh.io.example.com` |
| `*.trabajo.org` | `trabajo.org`, `us.trabajo.org`, `jobs.eu.trabajo.org` | `nottrabajo.org`, `trabajo.org.example.com` |
| `dailyremote` | (name entry: matches publisher "DailyRemote"; never checks the link) | publisher "Remote Quest Jobs" |

- Domain entries never look at the publisher name, and name entries never look at the apply link.
- A link with no readable host (`garbage`, text with spaces, relative `/jobs/1`) is never dropped by a domain entry.
- A link without a scheme (`jobmesh.io/job/1`) is read by its host.

### Load errors

Config loading fails when a domain entry is malformed. The message contains the entry text. Each
of these must fail:

- Malformed: `trabajo.*`, `*trabajo.org`, `*.`, `a..b`, `-a.com`
- Not a bare host: `https://trabajo.org/`, `trabajo.org:443`
- Public suffix or IP only: `*.com`, `co.uk`, `.com`, `1.2.3.4`

Existing rule, unchanged: an entry with no letter or digit (`--`) fails with "filter terms need at
least one letter or digit".

## Log field (unchanged shape)

The `search_fetch` jobs-log entry keeps `skipped_publishers: number`. It now counts results
dropped by name **or** domain entries, and a result matched by several entries counts once.
