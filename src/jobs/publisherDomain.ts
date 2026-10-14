import { parse } from "tldts";

/** Reports whether a publisher exclusion entry names a domain rather than a board name. */
export function isDomainEntry(entry: string): boolean {
    return entry.includes(".") && !/\s/.test(entry);
}

/** Reports whether a domain entry is a bare host with a registrable domain, optionally behind a leading `*.`. */
export function isValidDomainEntry(entry: string): boolean {
    const rest = (wildcardBase(entry) ?? entry).toLowerCase();
    const { hostname, domain } = parse(rest);
    return hostname !== null && domain !== null && hostname === rest.replace(/\.$/, "");
}

/** Reports whether an apply link's host matches any of the excluded domain entries. */
export function linkMatchesDomains(url: string, entries: string[]): boolean {
    const host = hostOf(url);
    return host !== null && entries.some((entry) => hostMatches(host, entry));
}

/** Reports whether a host is the one a domain entry names, or a subdomain of a wildcard entry's domain. */
function hostMatches(host: string, entry: string): boolean {
    const base = wildcardBase(entry);
    if (base === null) return host === hostOf(entry);
    const domain = hostOf(base);
    return domain !== null && (host === domain || host.endsWith(`.${domain}`));
}

/** Returns the lowercase host of a link or domain, or null when it has none. */
function hostOf(text: string): string | null {
    // tldts lowercases only ASCII letters, so non-ASCII capitals ("Öko-jobs.de") must be folded first.
    return parse(text.toLowerCase()).hostname;
}

/** Returns a wildcard entry's domain without its leading `*.`, or null for a plain entry. */
function wildcardBase(entry: string): string | null {
    return entry.startsWith("*.") ? entry.slice(2) : null;
}
