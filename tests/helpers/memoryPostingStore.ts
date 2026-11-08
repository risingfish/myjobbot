import { companyKeys } from "../../src/companies/keys.js";
import type { KnownPosting, PostingStore } from "../../src/db/postingStore.js";
import type { FoundDescription, JobKey } from "../../src/db/store.js";
import { normalizeCompany } from "../../src/jobs/company.js";
import { recordMemoryCompanies } from "./memoryCompanies.js";
import { asc, type Tables } from "./memoryJobViews.js";

function minimum(values: Array<string | number | null | undefined>): string | null {
    const present = values.filter((value): value is string => typeof value === "string").sort(asc);
    return present[0] ?? null;
}

export class MemoryPostingStore implements PostingStore {
    constructor(private readonly tables: Tables) {}

    async known(keys: JobKey[]): Promise<KnownPosting[]> {
        return keys.flatMap((key) => {
            const job = this.tables.jobs.find((row) => row.ats === key.ats && row.job_id === key.jobId);
            return job === undefined ? [] : [{ ats: key.ats, jobId: key.jobId, described: job.description !== null && job.description !== undefined }];
        });
    }

    async setDescription(key: JobKey, found: FoundDescription): Promise<void> {
        const job = this.tables.jobs.find((row) => row.ats === key.ats && row.job_id === key.jobId);
        if (job) Object.assign(job, { description: found.description, description_format: found.format, description_source: found.source, description_url: found.url });
        for (const view of this.tables.userJobs) if (view.ats === key.ats && view.job_id === key.jobId) view.scored_at = null;
    }

    async flagInjection(jobId: string, at: string): Promise<void> {
        for (const job of this.tables.jobs) if (job.job_id === jobId && (job.injection_seen_at ?? null) === null) job.injection_seen_at = at;
    }

    async linkUnlinkedJobs(): Promise<number> {
        const unlinked = this.tables.jobs.filter((job) => (job.company_id ?? null) === null).sort((a, b) => asc(a.first_seen, b.first_seen) || asc(a.ats, b.ats) || asc(a.job_id, b.job_id));
        const ids = recordMemoryCompanies(this.tables, companyKeys(unlinked.map((job) => ({ name: String(job.company), firstSeen: String(job.first_seen), lastSeen: String(job.last_seen) }))));
        for (const job of unlinked) job.company_id = ids.get(normalizeCompany(String(job.company))) ?? null;
        return unlinked.filter((job) => job.company_id !== null).length;
    }

    async earliestSeen(company: string, normalizedTitle: string): Promise<string> {
        const jobs = this.tables.jobs.filter((job) => job.company === company && job.normalized_title === normalizedTitle);
        const firstSeen = minimum(jobs.map((job) => job.first_seen));
        const earliest = minimum([firstSeen, minimum(jobs.map((job) => job.posted_at)) ?? firstSeen]);
        if (earliest === null) throw new Error(`no jobs for ${company} / ${normalizedTitle}`);
        return earliest;
    }

    async prune(cutoff: string): Promise<number> {
        this.tables.userJobs = this.tables.userJobs.filter((view) => String(view.last_seen) >= cutoff || view.applied === 1);
        const views = new Set(this.tables.userJobs.map((view) => `${view.user_id}:${view.ats}:${view.job_id}`));
        this.tables.verdicts = this.tables.verdicts.filter((verdict) => views.has(`${verdict.user_id}:${verdict.ats}:${verdict.job_id}`));
        this.tables.rescoreRuns = this.tables.rescoreRuns.filter((run) => views.has(`${run.userId}:${run.ats}:${run.jobId}`));
        const runs = new Set(this.tables.rescoreRuns.map((run) => run.id));
        this.tables.rescoreSteps = this.tables.rescoreSteps.filter((step) => runs.has(step.runId));
        const held = new Set(this.tables.userJobs.map((view) => `${view.ats}:${view.job_id}`));
        const before = this.tables.jobs.length;
        this.tables.jobs = this.tables.jobs.filter((job) => held.has(`${job.ats}:${job.job_id}`));
        return before - this.tables.jobs.length;
    }
}
