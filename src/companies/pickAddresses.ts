import type { SearchResult } from "../careers/searxng.js";
import { onHost } from "../careers/skipHosts.js";
import { parseBoardLink } from "../sources/boardLink.js";
import { mainName, storableUrl } from "./hosts.js";

type MissReason = "no_results" | "no_match";

export interface AddressPick {
    url: string | null;
    reason: MissReason | null;
    rejected: string[];
}

interface CareersSearch {
    website: string | null;
    key: string;
    skipHosts: string[];
    rejected: string[];
}

const MAX_TURNED_DOWN = 5;
const MIN_PREFIX = 4;
const MAX_REMEMBERED = 20;
const CAREERS_WORDS = /career|jobs/i;

/** Picks a company's website: the first result whose site name is the company's name, or starts with it for a name of four or more characters, kept as its origin. */
export function pickWebsite(results: SearchResult[], key: string, skipHosts: string[]): AddressPick {
    const wanted = key.replaceAll(" ", "");
    if (wanted === "") return { url: null, reason: "no_match", rejected: [] };
    const pick = firstAccepted(results, skipHosts, (result) => namesCompany(mainName(new URL(result.url).hostname), wanted));
    return pick.url === null ? pick : { ...pick, url: new URL(pick.url).origin };
}

/** Picks a company's careers page: a careers or jobs page on its website, or its page on a job board, never one already turned down. */
export function pickCareers(results: SearchResult[], search: CareersSearch): AddressPick {
    const fresh = results.filter((result) => !search.rejected.includes(result.url));
    const pick = firstAccepted(fresh, search.skipHosts, (result) => onWebsite(result, search.website) || boardFor(result, search.key));
    if (pick.url !== null) return pick;
    const turnedDown = search.website === null ? [] : pick.rejected;
    const remembered = [...search.rejected, ...turnedDown.filter((url) => !search.rejected.includes(url))];
    return { ...pick, reason: results.length === 0 ? "no_results" : "no_match", rejected: remembered.slice(-MAX_REMEMBERED) };
}

/** Takes the first storable result off the skipped hosts that the rule accepts, or says why there was none, with the results turned down. */
function firstAccepted(results: SearchResult[], skipHosts: string[], accepts: (result: SearchResult) => boolean): AddressPick {
    if (results.length === 0) return { url: null, reason: "no_results", rejected: [] };
    const chosen = results.find((result) => storableUrl(result.url) && !skipHosts.some((host) => onHost(result.url, host)) && accepts(result));
    if (chosen !== undefined) return { url: chosen.url, reason: null, rejected: [] };
    return { url: null, reason: "no_match", rejected: results.slice(0, MAX_TURNED_DOWN).map((result) => result.url) };
}

/** Tells whether a result is a careers or jobs page on the company's website or one of its subdomains. */
function onWebsite(result: SearchResult, website: string | null): boolean {
    if (website === null) return false;
    const host = new URL(website).hostname.replace(/^www\./, "");
    return onHost(result.url, host) && CAREERS_WORDS.test(`${result.url} ${result.title}`);
}

/** Tells whether a result is a job board page whose board is the company's own. */
function boardFor(result: SearchResult, key: string): boolean {
    const slug = parseBoardLink(result.url)?.slug;
    const wanted = key.replaceAll(" ", "");
    return wanted !== "" && slug !== undefined && slug.toLowerCase().replace(/[-_]/g, "") === wanted;
}

/** Tells whether a site name is the company's: the same name, or one starting with it when the name is long enough not to match by chance. */
function namesCompany(siteName: string | null, wanted: string): boolean {
    if (siteName === null) return false;
    return siteName === wanted || (wanted.length >= MIN_PREFIX && siteName.startsWith(wanted));
}
