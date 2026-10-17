import { isExcludedCompany } from "../jobs/companyFilter.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import type { FileConfig } from "../config/schema.js";
import type { JobRow } from "../db/store.js";
import type { ToolContext } from "./context.js";
import type { FetchOutcome } from "./sources.js";

/** Returns a source's jobs that still need scoring, filtered by the title and excluded-company config. */
export async function unscoredJobs(context: ToolContext, sourceName: string, outcome: FetchOutcome) {
    const { store } = context;
    const rows = outcome.seen === null ? await store.unscoredForSource(sourceName) : await store.unscoredSince(sourceName, outcome.seen);
    return rows.filter((row) => isWanted(row, context.config));
}

/** Tells whether a job passes the configured title filter and isn't at an excluded company. */
export function isWanted(row: Pick<JobRow, "title" | "company">, config: FileConfig): boolean {
    return passesTitleFilter(row.title, config.title_filter) && !isExcludedCompany(row.company, config.exclude_companies);
}
