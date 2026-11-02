import { parseBoardLink } from "../sources/boardLink.js";
import { moduleFor } from "../sources/registry.js";
import type { PageLink } from "./fitPage.js";

const ADDRESS = /https?:\/\/[^\s"'<>\\]+/g;

/** Finds the one job board a careers page fills its job list from, named only in its HTML (a script or a frame), as the board's own address; null when the page links to a board itself or names none or several. */
export function embeddedBoard(html: string, links: PageLink[]): string | null {
    if (links.some((link) => parseBoardLink(link.url) !== null)) return null;
    const boards = new Map<string, string>();
    for (const [address] of html.matchAll(ADDRESS)) {
        const board = boardAddress(address);
        if (board !== null) boards.set(board.toLowerCase(), board);
    }
    return boards.size === 1 ? ([...boards.values()][0] ?? null) : null;
}

/** Gives the address of the board an address belongs to, as its source module names it, or null when it isn't on a known board. */
function boardAddress(address: string): string | null {
    const link = parseBoardLink(address);
    const module = link === null ? null : moduleFor(link.kind);
    const params = module?.fromUrl?.(new URL(address)) ?? null;
    return params === null ? null : (module?.company?.(params, "").careersPage ?? null);
}
