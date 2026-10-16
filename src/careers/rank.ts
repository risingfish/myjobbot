import { normalizeTitle } from "../jobs/normalize.js";

interface Titled {
    text: string;
}

/** Orders links so those sharing the most words with the sought title come first, keeping page order otherwise. */
export function rankLinks<T extends Titled>(links: T[], soughtTitle: string): T[] {
    const wanted = new Set(words(soughtTitle));
    const scored = links.map((link, index) => ({ link, index, score: words(link.text).filter((word) => wanted.has(word)).length }));
    return scored.sort((left, right) => right.score - left.score || left.index - right.index).map((entry) => entry.link);
}

/** Splits a title into its normalized words. */
function words(title: string): string[] {
    return normalizeTitle(title)
        .split(" ")
        .filter((word) => word !== "");
}
