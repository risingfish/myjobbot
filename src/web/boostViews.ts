import type { AppliedBoost, Boost } from "../jobs/boosts.js";
import type { BoostDetail } from "./api.js";

const PLACES: Record<AppliedBoost["where"], string> = { title: "title", description: "description", both: "title and description" };

/** Names a boost for the table's score note: the total, then each term with its points and where it was found, or null when no boost applied. */
export function boostText(boost: Boost): string | null {
    return boost.points === 0 ? null : `+${boost.points} ${boostLines(boost).join(", ")}`;
}

/** Gives a boost for the details panel: its total and one line per term, or null when no boost applied. */
export function boostDetail(boost: Boost): BoostDetail | null {
    return boost.points === 0 ? null : { total: boost.points, lines: boostLines(boost) };
}

/** Describes each applied term as "senior +5 (title)". */
function boostLines(boost: Boost): string[] {
    return boost.applied.map((applied) => `${applied.term} +${applied.points} (${PLACES[applied.where]})`);
}
