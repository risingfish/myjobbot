import type { SearchResult } from "./searxng.js";

/** Drops search results on hosts the lookup should never open, such as job aggregators, matching each host and its subdomains. */
export function dropSkipped(results: SearchResult[], hosts: string[]): SearchResult[] {
    return results.filter((result) => !hosts.some((host) => onHost(result.url, host)));
}

/** Tells whether an address is on a host or one of its subdomains. */
function onHost(url: string, host: string): boolean {
    const name = new URL(url).hostname.toLowerCase();
    return name === host || name.endsWith(`.${host}`);
}
