import { z } from "zod";
import type { JsonGetter } from "../http/client.js";

export interface SearchResult {
    url: string;
    title: string;
    snippet: string;
}

export interface SearchRequest {
    base: string;
    query: string;
    max: number;
    maxChars: number;
}

export const SEARCH_FAILED = "SearXNG search failed; check that search.formats includes json in its settings.yml";

export class SearchUnavailable extends Error {}

const MAX_TITLE = 120;
const MAX_SNIPPET = 200;
const RESULT_OVERHEAD = 40;
const WEB_PROTOCOLS = new Set(["http:", "https:"]);

const responseSchema = z.object({
    results: z.array(z.object({ url: z.string(), title: z.string().nullish(), content: z.string().nullish() })),
});

/** Builds the SearXNG query address for a search, asking for JSON. */
function searchUrl(base: string, query: string): string {
    const url = new URL("search", base.endsWith("/") ? base : `${base}/`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    return url.href;
}

/** Searches SearXNG for a query, reporting any failure to use SearXNG as SearchUnavailable. */
export async function searchWeb(http: JsonGetter, request: SearchRequest): Promise<SearchResult[]> {
    let json: unknown;
    try {
        json = await http.getJson(searchUrl(request.base, request.query));
    } catch (error) {
        throw new SearchUnavailable(SEARCH_FAILED, { cause: error });
    }
    return parseResults(json, request);
}

/** Turns a SearXNG answer into short, unique web results that fit the model's budget. */
function parseResults(json: unknown, limits: Pick<SearchRequest, "max" | "maxChars">): SearchResult[] {
    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) throw new SearchUnavailable(SEARCH_FAILED);
    const seen = new Set<string>();
    const results: SearchResult[] = [];
    let used = 0;
    for (const raw of parsed.data.results) {
        if (!isWeb(raw.url) || seen.has(raw.url)) continue;
        const result = { url: raw.url, title: (raw.title ?? "").slice(0, MAX_TITLE), snippet: (raw.content ?? "").slice(0, MAX_SNIPPET) };
        used += JSON.stringify(result).length + RESULT_OVERHEAD;
        if (results.length >= limits.max || used > limits.maxChars) break;
        seen.add(raw.url);
        results.push(result);
    }
    return results;
}

/** Tells whether an address is an http(s) web address. */
function isWeb(url: string): boolean {
    return URL.canParse(url) && WEB_PROTOCOLS.has(new URL(url).protocol);
}
