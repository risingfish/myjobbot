import { isExcludedCompany } from "../jobs/companyFilter.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import type { ToolContext } from "./context.js";
import type { FetchOutcome } from "./sources.js";

/** Returns a source's jobs that still need scoring, filtered by the title and excluded-company config. */
export async function unscoredJobs(context: ToolContext, sourceName: string, outcome: FetchOutcome) {
    const { store, config } = context;
    const rows = outcome.seen === null ? await store.unscoredForSource(sourceName) : await store.unscoredSince(sourceName, outcome.seen);
    return rows.filter((row) => passesTitleFilter(row.title, config.title_filter) && !isExcludedCompany(row.company, config.exclude_companies));
}
