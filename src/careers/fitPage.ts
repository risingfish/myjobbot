import { rankLinks } from "./rank.js";

export interface PageLink {
    text: string;
    url: string;
}

interface PageParts {
    text: string;
    links: PageLink[];
}

interface FitOptions {
    maxChars: number;
    sought?: string;
}

const LINK_OVERHEAD = 20;
const LINK_SHARE = 0.5;

/** Fits a page's text and links into the model's character budget, the sought job's link first and links capped at half. */
export function fitPage(page: PageParts, options: FitOptions): PageParts & { cut: boolean; chars: number } {
    const offered = options.sought === undefined ? page.links : rankLinks(page.links, options.sought);
    const textBudget = Math.min(page.text.length, options.maxChars - Math.min(linkCost(offered), Math.floor(options.maxChars * LINK_SHARE)));
    const links = fitLinks(offered, options.maxChars - textBudget);
    const cut = textBudget < page.text.length || links.length < offered.length;
    return { text: page.text.slice(0, textBudget), links, cut, chars: textBudget + linkCost(links) };
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
