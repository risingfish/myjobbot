import type { Settings } from "../config/schema.js";
import { isExcludedCompany } from "../jobs/companyFilter.js";
import type { Job } from "../jobs/job.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import { lookupAllowance } from "./alertJobs/budget.js";
import { matchResults, planQuery, type MatchStats } from "./alertJobs/lookup.js";
import type { AlertEmail, AlertJob, ParsedAlert } from "./alertJobs/parse.js";

export interface LookupDeps {
    search: ((query: string) => Promise<Job[]>) | null;
    settings: Settings["jsearch"];
    filters: { titleFilter: Settings["title_filter"]; excludeCompanies: string[] };
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
    if (deps === undefined || deps.search === null) return looked;
    const allowance = lookupAllowance({ cap: deps.settings.monthly_request_cap, usedThisMonth: deps.usedThisMonth, searches: deps.searches, refreshHours: deps.settings.refresh_hours, now: work.now });
    for (const plan of plans(deps, work).slice(0, allowance)) {
        const results = await deps.search(plan.query).catch(failedSearch);
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

/** Treats a failed lookup as finding nothing, so those jobs are scored from the alert alone; programming errors still surface. */
function failedSearch(error: unknown): Job[] {
    if (error instanceof TypeError) throw error;
    return [];
}
