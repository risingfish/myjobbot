import type { Job } from "../jobs/job.js";
import { fetchAndIngest } from "../sources/ingest.js";
import { jsearch, searchParams } from "../sources/modules/jsearch.js";
import type { ToolContext } from "./context.js";
import { withoutDescription } from "./jobLog.js";
import { refreshBlocker, requestsThisMonth } from "./searchBudget.js";
import { sourceRef, type FetchOutcome, type Search } from "./sources.js";

const NOT_SET_UP = "not set up: JSEARCH_API_KEY is not set";

/** Refreshes a saved JSearch search through the JSearch module, storing its new jobs and logging what it skipped. */
export async function refreshSearch(context: ToolContext, search: Search): Promise<FetchOutcome> {
    if (context.jsearchApiKey === null) return { seen: null, note: NOT_SET_UP };
    const blocker = await refreshBlocker(context, search.name);
    if (blocker !== null) return { seen: null, note: blocker };
    const now = context.now().toISOString();
    await context.apiCalls.record("jsearch", search.name, now);
    const batch = { source: sourceRef(search), name: search.name, scope: jsearch.scope, seen: now };
    const result = await fetchAndIngest(context, { module: jsearch, params: search, batch });
    await logSearchFetch(context, search, { fresh: result.stored, skipped: result.skippedCopies, skippedPublishers: result.skippedPublishers });
    return { seen: null, note: null };
}

/** Writes a search_fetch entry with the query, budget used and fetched jobs to the run's jobs log. */
async function logSearchFetch(context: ToolContext, search: Search, result: { fresh: Job[]; skipped: number; skippedPublishers: number }): Promise<void> {
    const requestsUsed = await requestsThisMonth(context);
    context.jobLog.write({
        type: "search_fetch",
        source: search.name,
        query: search.query,
        params: searchParams(search, context.config.jsearch),
        requests_this_month: requestsUsed,
        job_count: result.fresh.length,
        skipped_duplicates: result.skipped,
        skipped_publishers: result.skippedPublishers,
        jobs: result.fresh.map(withoutDescription),
    });
}
