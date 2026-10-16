import { walkPage, type RawLink } from "./pageWalker.js";
import { rankLinks } from "./rank.js";

interface PageLink {
    text: string;
    url: string;
}

export interface TrimmedPage {
    url: string;
    text: string;
    links: PageLink[];
    cut: boolean;
    morePages: boolean;
    chars: number;
}

export interface TrimOptions {
    baseUrl: string;
    maxChars: number;
    sought?: string;
    links?: boolean;
}

const LINK_OVERHEAD = 20;
const MAX_LINK_TEXT = 120;
const LINK_SHARE = 0.5;
const NEXT_TEXT = /^(next|›|»|more jobs)$/i;
const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/** Cuts a fetched page down to its readable text and job links, within a character budget the model can afford. */
export function trimPage(html: string, options: TrimOptions): TrimmedPage {
    const walked = walkPage(html);
    const resolved = resolveLinks(walked.links, options.baseUrl);
    const ranked = options.sought === undefined ? resolved : rankLinks(resolved, options.sought);
    const offered = options.links === false ? [] : ranked;
    const text = walked.lines.join("\n");
    const textBudget = Math.min(text.length, options.maxChars - Math.min(linkCost(offered), Math.floor(options.maxChars * LINK_SHARE)));
    const links = fitLinks(offered, options.maxChars - textBudget);
    const chars = textBudget + linkCost(links);
    const cut = textBudget < text.length || links.length < offered.length;
    return { url: options.baseUrl, text: text.slice(0, textBudget), links, cut, morePages: walked.links.some(isNextLink), chars };
}

/** Resolves raw links against the page address, keeping named http(s) links once each, without fragments. */
function resolveLinks(raw: RawLink[], baseUrl: string): PageLink[] {
    const seen = new Set<string>();
    const links: PageLink[] = [];
    for (const link of raw) {
        const url = webUrl(link.href, baseUrl);
        const text = (link.text.replace(/\s+/g, " ").trim() || link.label.trim()).slice(0, MAX_LINK_TEXT);
        if (url === null || text === "" || seen.has(url)) continue;
        seen.add(url);
        links.push({ text, url });
    }
    return links;
}

/** Resolves one link address, returning null unless it is a web address. */
function webUrl(href: string, baseUrl: string): string | null {
    if (!URL.canParse(href, baseUrl)) return null;
    const url = new URL(href, baseUrl);
    if (!WEB_PROTOCOLS.has(url.protocol)) return null;
    url.hash = "";
    return url.href;
}

/** Keeps links in order while they fit the remaining budget. */
function fitLinks(links: PageLink[], budget: number): PageLink[] {
    const kept: PageLink[] = [];
    let used = 0;
    for (const link of links) {
        used += link.text.length + LINK_OVERHEAD;
        if (used > budget) break;
        kept.push(link);
    }
    return kept;
}

/** Counts what a list of links costs the model, text plus a fixed per-link overhead. */
function linkCost(links: PageLink[]): number {
    return links.reduce((sum, link) => sum + link.text.length + LINK_OVERHEAD, 0);
}

/** Tells whether a link points to a further page of the listing. */
function isNextLink(link: RawLink): boolean {
    return link.next || NEXT_TEXT.test(link.text.trim());
}
