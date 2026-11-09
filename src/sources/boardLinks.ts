import { BOARD_MODULES } from "./boardModules.js";
import type { BoardLink } from "./module.js";

/** Recognises an address on a job board that publishes its postings as data, naming the board and any posting, by asking each board module to read it. */
export function parseBoardLink(address: string): BoardLink | null {
    if (!URL.canParse(address)) return null;
    const url = new URL(address);
    for (const module of BOARD_MODULES) {
        const link = module.boardLink?.(url) ?? null;
        if (link !== null) return link;
    }
    return null;
}
