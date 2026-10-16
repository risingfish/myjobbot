import { normalizeCompany } from "../../jobs/company.js";
import type { Job } from "../../jobs/job.js";
import { normalizeTitle } from "../../jobs/normalize.js";
import type { AlertJob, ParsedAlert } from "./parse.js";

const LINKEDIN_ID = /linkedin\.com\/(?:comm\/)?jobs\/view\/(?:[^/?#]*-)?(\d+)/;

/** Builds the one JSearch query for an alert email's pending jobs, or null when there is nothing to look up. */
export function planQuery(request: { alert: ParsedAlert; pending: AlertJob[] }): string | null {
    if (request.pending.length === 0) return null;
    const subject = request.alert.keywords ?? mostCommonTitle(request.pending);
    const location = sharedLocation(request.pending);
    return location === null ? subject : `${subject} in ${location}`;
}

export interface MatchStats {
    results: number;
    linkedin_links: number;
    by_id: number;
    by_title: number;
    hosts: Record<string, number>;
}

/** Pairs JSearch results with alert jobs, by LinkedIn id first and then by company and title, each result used once, and counts how. */
export function matchResults(jobs: AlertJob[], results: Job[]): { matches: Map<string, Job>; stats: MatchStats } {
    const matches = new Map<string, Job>();
    const unused = [...results];
    const [byId, byTitle] = [byLinkedinId, byCompanyAndTitle].map((pass) => matchPass(jobs, { unused, matches, pass }));
    const stats = { results: results.length, linkedin_links: results.filter((result) => LINKEDIN_ID.test(result.url)).length, by_id: byId ?? 0, by_title: byTitle ?? 0, hosts: hostCounts(results) };
    return { matches, stats };
}

/** Matches still-unmatched jobs with one rule, taking each matched result out of the pool, and returns how many matched. */
function matchPass(jobs: AlertJob[], state: { unused: Job[]; matches: Map<string, Job>; pass: (job: AlertJob, result: Job) => boolean }): number {
    let matched = 0;
    for (const job of jobs.filter((candidate) => !state.matches.has(candidate.linkedinId))) {
        const index = state.unused.findIndex((result) => state.pass(job, result));
        const [found] = index >= 0 ? state.unused.splice(index, 1) : [];
        if (found === undefined) continue;
        state.matches.set(job.linkedinId, found);
        matched += 1;
    }
    return matched;
}

/** Counts the results' link hosts, so a run's trace shows where JSearch sends applicants without naming any job. */
function hostCounts(results: Job[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const result of results) {
        const host = URL.canParse(result.url) ? new URL(result.url).host : "(no link)";
        counts[host] = (counts[host] ?? 0) + 1;
    }
    return counts;
}

/** Tells whether a result's link carries the alert job's LinkedIn id, with or without a slug before it. */
function byLinkedinId(job: AlertJob, result: Job): boolean {
    return LINKEDIN_ID.exec(result.url)?.[1] === job.linkedinId;
}

/** Tells whether a result names the same company and the same normalised title as the alert job. */
function byCompanyAndTitle(job: AlertJob, result: Job): boolean {
    return normalizeCompany(result.company) === normalizeCompany(job.company) && normalizeTitle(result.title) === normalizeTitle(job.title);
}

/** Returns the title the jobs share most often, as first written. */
function mostCommonTitle(jobs: AlertJob[]): string {
    const counts = new Map<string, { title: string; count: number }>();
    for (const job of jobs) {
        const key = normalizeTitle(job.title);
        counts.set(key, { title: counts.get(key)?.title ?? job.title, count: (counts.get(key)?.count ?? 0) + 1 });
    }
    return [...counts.values()].sort((left, right) => right.count - left.count)[0]?.title ?? "";
}

/** Returns the location at least half of the jobs share, or null when none does. */
function sharedLocation(jobs: AlertJob[]): string | null {
    const counts = new Map<string, number>();
    for (const job of jobs) if (job.location !== null) counts.set(job.location, (counts.get(job.location) ?? 0) + 1);
    const top = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
    return top !== undefined && top[1] * 2 >= jobs.length ? top[0] : null;
}
