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

/** Pairs JSearch results with alert jobs, by LinkedIn id first and then by company and title, each result used once. */
export function matchResults(jobs: AlertJob[], results: Job[]): Map<string, Job> {
    const matches = new Map<string, Job>();
    const unused = [...results];
    for (const pass of [byLinkedinId, byCompanyAndTitle]) {
        for (const job of jobs.filter((candidate) => !matches.has(candidate.linkedinId))) {
            const index = unused.findIndex((resultJob) => pass(job, resultJob));
            const [found] = index >= 0 ? unused.splice(index, 1) : [];
            if (found !== undefined) matches.set(job.linkedinId, found);
        }
    }
    return matches;
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
