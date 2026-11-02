import { FILTER_NOTES } from "../jobs/filterMatch.js";
import type { RescoreResult } from "./api.js";

const FAILED_NOTE = "Re-score failed; the old score is kept";
const KNOWN_NOTES = new Set(Object.values(FILTER_NOTES));

/** Says what a re-score did in the panel, from a fixed set of messages that never carries model or page text. */
export function rescoreNote(result: RescoreResult): string | null {
    if (result.outcome === "scored") return null;
    if (result.outcome === "failed") return FAILED_NOTE;
    return `Not re-scored: ${KNOWN_NOTES.has(result.note) ? result.note : "hidden by a filter"}`;
}
