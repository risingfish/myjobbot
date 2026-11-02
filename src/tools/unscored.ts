import { filterMatch, filterSet } from "../jobs/filterMatch.js";
import type { Settings } from "../config/schema.js";
import type { SavedSource } from "../db/sourceStore.js";
import type { JobRow } from "../db/store.js";
import type { ToolContext } from "./context.js";
import { sourceRef } from "./sources.js";

/** Returns a source's jobs that still need scoring, left out when an excluded company, the title filter or the body filter hides them: those seen in this run's fetch when it read the whole source, and otherwise every unscored one, so nothing waits forever. */
export async function unscoredJobs(context: ToolContext, source: Pick<SavedSource, "id" | "name">) {
    const seen = context.run.sources.get(source.name)?.seen ?? null;
    const ref = sourceRef(source);
    const rows = seen === null ? await context.store.unscoredForSource(ref) : await context.store.unscoredSince(ref, seen);
    return rows.filter((row) => isWanted(row, context.config));
}

/** Tells whether a job is one to score: not at an excluded company, passing the title filter, and passing the body filter. */
export function isWanted(row: Pick<JobRow, "title" | "company" | "description" | "description_format">, config: Settings): boolean {
    return filterMatch(row, filterSet(config)) === null;
}
