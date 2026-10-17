import { describeError } from "../errors.js";
import type { JsonGetter, JsonPoster } from "../http/client.js";
import { normalizeCompany } from "../jobs/company.js";
import { auditSkipped } from "./audit.js";
import { lookUpJob, type LookupDeps } from "./lookUpJob.js";
import type { LookupOutcome } from "./outcome.js";
import { SEARCH_FAILED, searchCareers, SearchUnavailable, type SearchResult } from "./searxng.js";
import type { SoughtJob } from "./session.js";

export interface CareersDeps extends Omit<LookupDeps, "search" | "boards"> {
    http: JsonGetter;
    boardHttp: JsonGetter & JsonPoster;
    searxngUrl: string | null;
}

export interface CareersSummary {
    looked_up: number;
    found: number;
    failed: Record<string, number>;
    skipped_for_limit: number;
    note?: string;
}

const NOT_CONFIGURED = "careers search not configured";
const MS_PER_MINUTE = 60_000;

/** Looks up the given jobs one at a time on their companies' careers pages, within the run's caps, and reports what happened. */
export async function lookUpCareers(deps: CareersDeps, sought: SoughtJob[]): Promise<CareersSummary> {
    const summary: CareersSummary = { looked_up: 0, found: 0, failed: {}, skipped_for_limit: 0 };
    if (deps.searxngUrl === null) return skipAll(deps, { ...summary, note: NOT_CONFIGURED });
    const lookup = { ...deps, search: cachedSearch(deps, deps.searxngUrl), boards: { http: deps.boardHttp, cache: new Map() } };
    const started = deps.now().getTime();
    for (const [index, job] of sought.entries()) {
        if (outOfBudget(deps, { index, started })) {
            summary.skipped_for_limit = sought.length - index;
            break;
        }
        const outcome = await safeLookUp(lookup, job);
        if (outcome === null) return skipAll(deps, { ...summary, note: SEARCH_FAILED });
        tally(summary, outcome);
    }
    return report(deps, summary);
}

/** Tells whether the run's lookup caps are used up: the number of lookups or the total minutes. */
function outOfBudget(deps: CareersDeps, progress: { index: number; started: number }): boolean {
    const elapsed = deps.now().getTime() - progress.started;
    return progress.index >= deps.settings.max_per_run || elapsed >= deps.settings.max_total_minutes * MS_PER_MINUTE;
}

/** Searches each company at most once per run, sharing the results between its jobs. */
function cachedSearch(deps: CareersDeps, base: string): (company: string) => Promise<SearchResult[]> {
    const cache = new Map<string, Promise<SearchResult[]>>();
    return (company) => {
        const key = normalizeCompany(company);
        const cached = cache.get(key) ?? searchCareers(deps.http, { base, company, max: deps.settings.search_results, maxChars: deps.settings.page_chars });
        cache.set(key, cached);
        return cached;
    };
}

/** Runs one lookup, returning null when SearXNG became unusable and turning any other failure into lookup_error. */
async function safeLookUp(deps: LookupDeps, job: SoughtJob): Promise<LookupOutcome | null> {
    try {
        return await lookUpJob(deps, job);
    } catch (error) {
        if (error instanceof SearchUnavailable) return null;
        deps.trace.write({ type: "careers_error", lookup: `${job.ats}:${job.jobId}`, error: describeError(error) });
        await recordError(deps, job);
        return { found: false, reason: "lookup_error" };
    }
}

/** Writes the finish row of a lookup that failed unexpectedly, tracing instead when the audit itself fails. */
async function recordError(deps: LookupDeps, job: SoughtJob): Promise<void> {
    try {
        await deps.careers.audit({ runId: deps.runId, at: deps.now().toISOString(), ats: job.ats, jobId: job.jobId, company: job.company, step: "finish", url: null, outcome: "failed", reason: "lookup_error", warning: true });
    } catch (error) {
        deps.trace.write({ type: "careers_audit_failed", lookup: `${job.ats}:${job.jobId}`, error: describeError(error) });
    }
}

/** Counts one lookup's outcome into the run summary. */
function tally(summary: CareersSummary, outcome: LookupOutcome): void {
    summary.looked_up += 1;
    if (outcome.found) summary.found += 1;
    else summary.failed[outcome.reason] = (summary.failed[outcome.reason] ?? 0) + 1;
}

/** Logs once that search can't be used, then reports the summary carrying the note why. */
async function skipAll(deps: CareersDeps, summary: CareersSummary & { note: string }): Promise<CareersSummary> {
    await auditSkipped(deps, summary.note);
    return report(deps, summary);
}

/** Writes the run's careers summary to the trace and returns it. */
function report(deps: CareersDeps, summary: CareersSummary): CareersSummary {
    deps.trace.write({ type: "careers", ...summary });
    return summary;
}
