import { isRawObject } from "./searchSettings.js";

/** Gives a settings document with its title boosts copied into description boosts, or null when it has no title boosts to copy or already has description boosts. */
export function withDescriptionBoosts(document: Record<string, unknown>): Record<string, unknown> | null {
    if (!isRawObject(document.title_boosts) || "description_boosts" in document) return null;
    return { ...document, description_boosts: { ...document.title_boosts } };
}
