import type { JobSource } from "../db/jobSource.js";
import type { JobKey, JobStore } from "../db/store.js";
import { normalizeCompany } from "../jobs/company.js";
import { makeJob, type Job } from "../jobs/job.js";
import { normalizeTitle } from "../jobs/normalize.js";
import type { AlertJob } from "./alertJobs/parse.js";

export interface Sorted {
    fresh: AlertJob[];
    seenAgain: JobKey[];
}

type KnownJobs = Pick<JobStore, "findJob" | "companiesWithTitleOutside">;

/** Returns the stored job id for a LinkedIn posting, prefixed so it can't collide with board ids. */
function alertJobId(linkedinId: string): string {
    return `li_${linkedinId}`;
}

/** Merges repeats, sets aside the known alert jobs to be marked seen again, and drops copies of other sources' jobs, returning the new ones. */
export async function sortAlertJobs(store: KnownJobs, jobs: AlertJob[], source: JobSource): Promise<Sorted> {
    const unique = [...new Map(jobs.map((job) => [job.linkedinId, job])).values()];
    const known = await Promise.all(unique.map(async (job) => (await store.findJob(alertJobId(job.linkedinId)))?.ats === "linkedin"));
    const again = unique.filter((_, index) => known[index]).map((job) => ({ ats: "linkedin", jobId: alertJobId(job.linkedinId) }));
    const fresh = await withoutCopies(
        store,
        unique.filter((_, index) => !known[index]),
        source,
    );
    return { fresh, seenAgain: again };
}

/** Drops alert jobs whose company already has a job of the same title from another source. */
async function withoutCopies(store: KnownJobs, jobs: AlertJob[], source: JobSource): Promise<AlertJob[]> {
    const copies = await Promise.all(
        jobs.map(async (job) => {
            const companies = await store.companiesWithTitleOutside(source, normalizeTitle(job.title));
            return companies.some((name) => normalizeCompany(name) === normalizeCompany(job.company));
        }),
    );
    return jobs.filter((_, index) => !copies[index]);
}

/** Turns a parsed alert job into the shared job record, taking the description and details of its JSearch match when there is one. */
export function alertJobRecord(job: AlertJob, match?: Job): Job {
    const url = `https://www.linkedin.com/jobs/view/${job.linkedinId}/`;
    const core = { ats: "linkedin" as const, jobId: alertJobId(job.linkedinId), company: job.company, title: job.title, url };
    const details = match === undefined ? {} : { description: match.description, descriptionFormat: match.descriptionFormat, requirements: match.requirements, skills: match.skills, preferredSkills: match.preferredSkills, postedAt: match.postedAt, isRemote: match.isRemote, workplaceType: match.workplaceType };
    return makeJob(core, { ...details, location: job.location, compensation: job.salary ?? match?.compensation ?? null });
}
