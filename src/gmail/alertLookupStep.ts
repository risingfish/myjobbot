import type { FileConfig } from "../config/schema.js";
import type { ApiCallLog } from "../db/store.js";
import type { JsonGetter } from "../http/client.js";
import { isExcludedCompany } from "../jobs/companyFilter.js";
import type { Job } from "../jobs/job.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import { fetchJsearch } from "../sources/modules/jsearch.js";
import { lookupAllowance } from "./alertJobs/budget.js";
import { matchResults, planQuery, type MatchStats } from "./alertJobs/lookup.js";
import type { AlertEmail, AlertJob, ParsedAlert } from "./alertJobs/parse.js";
import { ALERTS_SOURCE } from "./alertJobs/source.js";

export interface LookupDeps {
    http: JsonGetter;
    apiKey: string | null;
    settings: FileConfig["jsearch"];
    apiCalls: ApiCallLog;
    filters: { titleFilter: FileConfig["title_filter"]; excludeCompanies: string[] };
    searches: number;
    usedThisMonth: number;
}

export interface ReadEmail {
    email: AlertEmail;
    alert: ParsedAlert;
}

export interface Looked {
    matches: Map<string, Job>;
    searches: number;
    lookedUp: number;
    stats: MatchStats[];
}

interface Planned {
    query: string;
    pending: AlertJob[];
}

/** Looks up descriptions for new alert jobs with at most one JSearch search per email, within the month's allowance. */
export async function lookUpDescriptions(deps: LookupDeps | undefined, work: { read: ReadEmail[]; fresh: AlertJob[]; now: Date }): Promise<Looked> {
    const looked: Looked = { matches: new Map(), searches: 0, lookedUp: 0, stats: [] };
    if (deps === undefined || deps.apiKey === null) return looked;
    const allowance = lookupAllowance({ cap: deps.settings.monthly_request_cap, usedThisMonth: deps.usedThisMonth, searches: deps.searches, refreshHours: deps.settings.refresh_hours, now: work.now });
    for (const plan of plans(deps, work).slice(0, allowance)) {
        const results = await search(deps, { query: plan.query, apiKey: deps.apiKey, now: work.now });
        const matched = matchResults(plan.pending, results);
        for (const [id, match] of matched.matches) looked.matches.set(id, match);
        looked.stats.push(matched.stats);
        looked.searches += 1;
        looked.lookedUp += plan.pending.length;
    }
    return looked;
}

/** Plans one search per email, newest first, for the new jobs that pass the title and company filters. */
function plans(deps: LookupDeps, work: { read: ReadEmail[]; fresh: AlertJob[] }): Planned[] {
    const fresh = new Set(work.fresh.map((job) => job.linkedinId));
    const wanted = (job: AlertJob) => fresh.has(job.linkedinId) && passesTitleFilter(job.title, deps.filters.titleFilter) && !isExcludedCompany(job.company, deps.filters.excludeCompanies);
    return [...work.read]
        .sort((left, right) => right.email.uid - left.email.uid)
        .flatMap(({ alert }) => {
            const pending = alert.jobs.filter(wanted);
            const query = planQuery({ alert, pending });
            return query === null ? [] : [{ query, pending }];
        });
}

/** Runs one JSearch search for an email, logging the request against the budget; a failed search finds nothing. */
async function search(deps: LookupDeps, request: { query: string; apiKey: string; now: Date }): Promise<Job[]> {
    await deps.apiCalls.record("jsearch", ALERTS_SOURCE, request.now.toISOString());
    const query = { search: { query: request.query, remote_only: false, country: "us" }, settings: { ...deps.settings, date_posted: "7days" as const }, apiKey: request.apiKey };
    return fetchJsearch(query, deps.http).catch((error: unknown) => failedSearch(error));
}

/** Treats a failed lookup as finding nothing, so those jobs are scored from the alert alone; programming errors still surface. */
function failedSearch(error: unknown): Job[] {
    if (error instanceof TypeError) throw error;
    return [];
}
