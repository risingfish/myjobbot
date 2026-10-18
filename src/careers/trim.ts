import { fitPage, type PageLink } from "./fitPage.js";
import { walkPage, type RawLink } from "./pageWalker.js";

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

const MAX_LINK_TEXT = 120;
const NEXT_TEXT = /^(next|›|»|more jobs)$/i;
const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/** Cuts a fetched page down to its readable text and job links, within a character budget the model can afford. */
export function trimPage(html: string, options: TrimOptions): TrimmedPage {
    const walked = walkPage(html);
    const links = options.links === false ? [] : resolveLinks(walked.links, options.baseUrl);
    const fitted = fitPage({ text: walked.lines.join("\n"), links }, options);
    return { url: options.baseUrl, ...fitted, morePages: walked.links.some(isNextLink) };
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

/** Tells whether a link points to a further page of the listing. */
function isNextLink(link: RawLink): boolean {
    return link.next || NEXT_TEXT.test(link.text.trim());
}
