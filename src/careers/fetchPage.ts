import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { TextGetter, TextPage, TextResult } from "../http/client.js";
import { allowedUrl, isPublicAddress } from "./addresses.js";

export type HostLookup = (host: string) => Promise<string[]>;

export interface PageFetchDeps {
    pages: TextGetter;
    lookup: HostLookup;
    maxBytes: number;
}

export class FetchRefused extends Error {}

export class FetchTimedOut extends Error {}

const MAX_REDIRECTS = 5;

/** Resolves a host name to every address it has, using the system resolver. */
export const systemLookup: HostLookup = async (host) => (await lookup(host, { all: true })).map((entry) => entry.address);

/** Fetches a page only from public web addresses, checking the address again on every redirect. */
export async function fetchPublicPage(deps: PageFetchDeps, url: string): Promise<TextPage> {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        await checkPublic(deps, current);
        const result = await fetchOnce(deps, current);
        if (!("redirect" in result)) return result;
        current = result.redirect;
    }
    throw new FetchRefused(`refused: more than ${MAX_REDIRECTS} redirects`);
}

/** Refuses an address that isn't plain public http(s), resolving its host to check every address it points at. */
async function checkPublic(deps: PageFetchDeps, url: string): Promise<void> {
    if (!allowedUrl(url)) throw new FetchRefused("refused: only http(s) addresses on the default port can be opened");
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) === 0 ? await resolve(deps, host) : [host];
    if (addresses.length === 0 || !addresses.every(isPublicAddress)) throw new FetchRefused("refused: the address is not on the public internet");
}

/** Resolves a host, treating a name that doesn't resolve as a refused fetch. */
async function resolve(deps: PageFetchDeps, host: string): Promise<string[]> {
    try {
        return await deps.lookup(host);
    } catch {
        throw new FetchRefused("refused: the host name could not be resolved");
    }
}

/** Fetches one hop, turning a timeout into FetchTimedOut so the lookup can report it. */
async function fetchOnce(deps: PageFetchDeps, url: string): Promise<TextResult> {
    try {
        return await deps.pages.getText(url, { maxBytes: deps.maxBytes });
    } catch (error) {
        if (isTimeout(error)) throw new FetchTimedOut("the page took too long to load", { cause: error });
        throw error;
    }
}

/** Tells whether an error, or the error that caused it, is a request timeout. */
function isTimeout(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.name === "TimeoutError" || isTimeout(error.cause);
}
