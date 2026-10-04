import { normalizeCompany } from "../jobs/company.js";
import type { Job } from "../jobs/job.js";
import { normalizeTitle } from "../jobs/normalize.js";
import { fetchJsearch, searchParams } from "../sources/jsearch.js";
import type { ToolContext } from "./context.js";
import { withoutDescription } from "./jobLog.js";
import { refreshBlocker, requestsThisMonth } from "./searchBudget.js";
import type { FetchOutcome, Search } from "./sources.js";

export async function refreshSearch(context: ToolContext, search: Search): Promise<FetchOutcome> {
  const blocker = refreshBlocker(context, search.name);
  if (blocker) return { seen: null, note: blocker };
  context.apiCalls.record("jsearch", search.name, context.now().toISOString());
  const jobs = await fetchJsearch({ search, settings: context.config.jsearch, apiKey: requireKey(context) }, context.http);
  const fresh = jobs.filter((job) => !hasBoardCopy(context, job));
  context.store.upsertAll(fresh, context.now().toISOString(), search.name);
  logSearchFetch(context, search, { fresh, skipped: jobs.length - fresh.length });
  return { seen: null, note: null };
}

function requireKey(context: ToolContext): string {
  if (!context.jsearchApiKey) throw new Error("JSEARCH_API_KEY is not set");
  return context.jsearchApiKey;
}

function hasBoardCopy(context: ToolContext, job: Job): boolean {
  const company = normalizeCompany(job.company);
  return context.store.boardCompaniesWithTitle(normalizeTitle(job.title)).some((name) => normalizeCompany(name) === company);
}

function logSearchFetch(context: ToolContext, search: Search, result: { fresh: Job[]; skipped: number }): void {
  context.jobLog.write({
    type: "search_fetch", source: search.name, query: search.query, params: searchParams(search, context.config.jsearch),
    requests_this_month: requestsThisMonth(context), job_count: result.fresh.length,
    skipped_duplicates: result.skipped, jobs: result.fresh.map(withoutDescription),
  });
}
