import { jobDetailSchema, jobViewSchema, verdictViewSchema } from "../../src/db/rows.js";
import type { HiddenFlag, JobDetailRow, JobKey, JobView, JobViews, Page, ScoreFilter, VerdictView } from "../../src/db/store.js";

export type Row = Record<string, string | number | null>;

export interface Tables {
    jobs: Row[];
    verdicts: Row[];
    calls: Row[];
}

export const asc = (left: unknown, right: unknown): number => (String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0);

function newestFirst(a: Row, b: Row): number {
    return asc(b.posted_at ?? b.first_seen, a.posted_at ?? a.first_seen) || asc(b.first_seen, a.first_seen) || asc(a.ats, b.ats) || asc(a.job_id, b.job_id);
}

function slice<T>(rows: T[], page: Page): T[] {
    return rows.slice(page.offset, page.offset + page.limit);
}

export class MemoryJobViews implements JobViews {
    constructor(private readonly tables: Tables) {}

    async scoredFrom(filter: ScoreFilter): Promise<JobView[]> {
        const shown = this.tables.jobs.filter((job) => job.hidden === 0 && job.score !== null && Number(job.score) >= filter.minScore);
        return this.views(shown.filter((job) => filter.sources.includes(String(job.source))));
    }

    async setHidden(flag: HiddenFlag): Promise<boolean> {
        const job = this.tables.jobs.find((row) => row.ats === flag.ats && row.job_id === flag.jobId);
        if (job) job.hidden = Number(flag.hidden);
        return job !== undefined;
    }

    async allJobs(page: Page): Promise<JobView[]> {
        return slice(this.views(this.tables.jobs), page);
    }

    async countAllJobs(): Promise<number> {
        return this.tables.jobs.length;
    }

    async verdictHistory(page: Page): Promise<VerdictView[]> {
        const ordered = [...this.tables.verdicts].sort((a, b) => asc(b.scored_at, a.scored_at) || Number(b.id) - Number(a.id));
        return slice(ordered, page).map((verdict) => this.withJob(verdict));
    }

    async countVerdicts(): Promise<number> {
        return this.tables.verdicts.length;
    }

    async jobDetail(key: JobKey): Promise<JobDetailRow | null> {
        const job = this.tables.jobs.find((row) => row.ats === key.ats && row.job_id === key.jobId);
        return job === undefined ? null : jobDetailSchema.parse(job);
    }

    private views(rows: Row[]): JobView[] {
        return [...rows].sort(newestFirst).map((row) => jobViewSchema.parse(row));
    }

    private withJob(verdict: Row): VerdictView {
        const job = this.tables.jobs.find((row) => row.ats === verdict.ats && row.job_id === verdict.job_id);
        const joined = { title: job?.title ?? null, company: job?.company ?? null, url: job?.url ?? null, source: job?.source ?? null };
        return verdictViewSchema.parse({ ...verdict, ...joined });
    }
}
