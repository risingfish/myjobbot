import { normalizeCompany } from "../jobs/company.js";
import { isExcludedPublisher } from "../jobs/companyFilter.js";
import type { Job } from "../jobs/job.js";
import { normalizeTitle } from "../jobs/normalize.js";
import { fetchJsearch, searchParams } from "../sources/jsearch.js";
import type { ToolContext } from "./context.js";
import { withoutDescription } from "./jobLog.js";
import { refreshBlocker, requestsThisMonth } from "./searchBudget.js";
import { sourceRef, type FetchOutcome, type Search } from "./sources.js";

const NOT_SET_UP = "not set up: JSEARCH_API_KEY is not set";

/** Refreshes a saved JSearch search against the API, storing new jobs and skipping excluded publishers and board duplicates. */
export async function refreshSearch(context: ToolContext, search: Search): Promise<FetchOutcome> {
    const apiKey = context.jsearchApiKey;
    if (apiKey === null) return { seen: null, note: NOT_SET_UP };
    const blocker = await refreshBlocker(context, search.name);
    if (blocker !== null) return { seen: null, note: blocker };
    await context.apiCalls.record("jsearch", search.name, context.now().toISOString());
    const jobs = await fetchJsearch({ search, settings: context.config.jsearch, apiKey }, context.http);
    const wanted = jobs.filter((job) => !isExcludedPublisher(job, context.config.jsearch.exclude_publishers));
    const fresh = await withoutBoardCopies(context, wanted);
    await context.store.upsertAll(fresh, context.now().toISOString(), sourceRef(search));
    await logSearchFetch(context, search, { fresh, skipped: wanted.length - fresh.length, skippedPublishers: jobs.length - wanted.length });
    return { seen: null, note: null };
}

/** Returns the jobs no company board already supplied, so JSearch duplicates are skipped. */
async function withoutBoardCopies(context: ToolContext, jobs: Job[]): Promise<Job[]> {
    const copies = await Promise.all(jobs.map((job) => hasBoardCopy(context, job)));
    return jobs.filter((_, index) => !copies[index]);
}

/** Reports whether a company board already supplied this job. */
async function hasBoardCopy(context: ToolContext, job: Job): Promise<boolean> {
    const company = normalizeCompany(job.company);
    const boardCompanies = await context.store.boardCompaniesWithTitle(normalizeTitle(job.title));
    return boardCompanies.some((name) => normalizeCompany(name) === company);
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
