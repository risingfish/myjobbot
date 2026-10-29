import { isExcludedCompany } from "../jobs/companyFilter.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import type { FileConfig } from "../config/schema.js";
import type { SavedSource } from "../db/sourceStore.js";
import type { JobRow } from "../db/store.js";
import type { ToolContext } from "./context.js";
import { sourceRef } from "./sources.js";

/** Returns a source's jobs that still need scoring, filtered by the title and excluded-company config: those seen in this run's fetch when it read the whole source, and otherwise every unscored one, so nothing waits forever. */
export async function unscoredJobs(context: ToolContext, source: Pick<SavedSource, "id" | "name">) {
    const seen = context.run.sources.get(source.name)?.seen ?? null;
    const ref = sourceRef(source);
    const rows = seen === null ? await context.store.unscoredForSource(ref) : await context.store.unscoredSince(ref, seen);
    return rows.filter((row) => isWanted(row, context.config));
}

/** Tells whether a job passes the configured title filter and isn't at an excluded company. */
export function isWanted(row: Pick<JobRow, "title" | "company">, config: FileConfig): boolean {
    return passesTitleFilter(row.title, config.title_filter) && !isExcludedCompany(row.company, config.exclude_companies);
}
