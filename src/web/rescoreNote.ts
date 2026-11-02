import type { RescoreEnd } from "../db/rescoreLogStore.js";
import { FILTER_NOTES } from "../jobs/filterMatch.js";

const FAILED_NOTE = "Re-score failed; the old score is kept";

/** Says how a re-score ended, or that it couldn't start, in the panel, from a fixed set of messages that never carries model or page text. */
export function rescoreNote(result: RescoreEnd | { failed: true }): string | null {
    if ("failed" in result || result.outcome === "failed") return FAILED_NOTE;
    if (result.outcome === "scored") return null;
    return `Not re-scored: ${result.filter === null ? "hidden by a filter" : FILTER_NOTES[result.filter]}`;
}
