import type { FileConfig } from "../config/schema.js";
import { readableDescription } from "../descriptions/readable.js";
import type { DescriptionFormat } from "./job.js";
import { hasWord, normalizeTitle } from "./normalize.js";

/** Reports whether a job's description mentions an included term, when any are set, and no excluded term; a job with no description passes. */
export function passesBodyFilter(description: string | null, format: DescriptionFormat | null, filter: FileConfig["body_filter"]): boolean {
    if (filter.include.length === 0 && filter.exclude.length === 0) return true;
    const readable = readableDescription(description, format);
    if (readable === null || readable === "") return true;
    const text = normalizeTitle(readable);
    /** Reports whether the description holds the term as a whole word or phrase. */
    const has = (term: string): boolean => hasWord(text, term);
    return (filter.include.length === 0 || filter.include.some(has)) && !filter.exclude.some(has);
}
