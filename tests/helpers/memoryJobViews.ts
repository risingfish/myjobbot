import { jobDetailSchema, jobViewSchema, verdictViewSchema } from "../../src/db/rows.js";
import type { RescoreRun, StoredStep } from "../../src/db/rescoreLogStore.js";
import type { AppliedChange, HiddenFlag, JobDetailRow, JobKey, JobView, JobViews, Page, ScoreFilter, VerdictView } from "../../src/db/store.js";

export type Row = Record<string, string | number | null>;

export interface Tables {
    jobs: Row[];
    userJobs: Row[];
    verdicts: Row[];
    calls: Row[];
    companies: Row[];
    rescoreRuns: Array<RescoreRun & { userId: number }>;
    rescoreSteps: Array<StoredStep & { runId: string }>;
}

export function newTables(): Tables {
    return { jobs: [], userJobs: [], verdicts: [], calls: [], companies: [], rescoreRuns: [], rescoreSteps: [] };
}

export const asc = (left: unknown, right: unknown): number => (String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0);

export function viewOf(tables: Tables, userId: number, key: { ats: unknown; jobId: unknown }): Row | undefined {
    return tables.userJobs.find((view) => view.user_id === userId && view.ats === key.ats && view.job_id === key.jobId);
}

export function userRows(tables: Tables, userId: number): Row[] {
    return tables.userJobs.filter((view) => view.user_id === userId).flatMap((view) => {
        const posting = tables.jobs.find((job) => job.ats === view.ats && job.job_id === view.job_id);
        return posting === undefined ? [] : [{ ...posting, ...view }];
    });
}

function newestFirst(a: Row, b: Row): number {
    return asc(b.posted_at ?? b.first_seen, a.posted_at ?? a.first_seen) || asc(b.first_seen, a.first_seen) || asc(a.ats, b.ats) || asc(a.job_id, b.job_id);
}

function slice<T>(rows: T[], page: Page): T[] {
    return rows.slice(page.offset, page.offset + page.limit);
}

export class MemoryJobViews implements JobViews {
    constructor(
        private readonly tables: Tables,
        private readonly userId: number,
    ) {}

    async scoredFrom(filter: ScoreFilter): Promise<JobView[]> {
        const shown = this.rows().filter((job) => job.hidden === 0 && job.score !== null && Number(job.score) >= filter.minScore);
        return this.views(shown.filter((job) => filter.sources.includes(String(job.source))));
    }

    async setHidden(flag: HiddenFlag): Promise<boolean> {
        const view = viewOf(this.tables, this.userId, flag);
        if (view) view.hidden = Number(flag.hidden);
        return view !== undefined;
    }

    async clearScore(key: JobKey): Promise<boolean> {
        const view = viewOf(this.tables, this.userId, key);
        if (view) Object.assign(view, { score: null, base_score: null, bonus_score: null, reasons: null, gaps: null, scored_at: null });
        return view !== undefined;
    }

    async setApplied(change: AppliedChange): Promise<{ appliedOn: string | null } | null> {
        const view = viewOf(this.tables, this.userId, change);
        if (!view) return null;
        view.applied = Number(change.applied);
        view.applied_on = change.applied ? (view.applied_on ?? change.at) : null;
        return { appliedOn: view.applied_on === null ? null : String(view.applied_on) };
    }

    async allJobs(page: Page): Promise<JobView[]> {
        return slice(this.views(this.rows()), page);
    }

    async countAllJobs(): Promise<number> {
        return this.rows().length;
    }

    async appliedJobs(page: Page): Promise<JobView[]> {
        const applied = this.rows()
            .filter((job) => job.applied === 1)
            .sort((a, b) => asc(b.applied_on, a.applied_on) || asc(a.ats, b.ats) || asc(a.job_id, b.job_id));
        return slice(applied, page).map((row) => jobViewSchema.parse(row));
    }

    async countApplied(): Promise<number> {
        return this.rows().filter((job) => job.applied === 1).length;
    }

    async verdictHistory(page: Page): Promise<VerdictView[]> {
        return slice(this.verdictsNewestFirst(this.verdicts()), page);
    }

    async countVerdicts(): Promise<number> {
        return this.verdicts().length;
    }

    async jobDetail(key: JobKey): Promise<JobDetailRow | null> {
        const job = this.rows().find((row) => row.ats === key.ats && row.job_id === key.jobId);
        return job === undefined ? null : jobDetailSchema.parse(job);
    }

    async jobVerdicts(key: JobKey): Promise<VerdictView[]> {
        return this.verdictsNewestFirst(this.verdicts().filter((verdict) => verdict.ats === key.ats && verdict.job_id === key.jobId));
    }

    async recentlyScored(limit: number): Promise<JobKey[]> {
        const newest = [...this.verdicts()].sort((a, b) => asc(b.scored_at, a.scored_at) || Number(b.id) - Number(a.id));
        const keys = [...new Set(newest.map((verdict) => JSON.stringify([verdict.ats, verdict.job_id])))];
        return keys.slice(0, limit).map((key) => {
            const [ats, jobId] = JSON.parse(key) as [string, string];
            return { ats, jobId };
        });
    }

    private rows(): Row[] {
        return userRows(this.tables, this.userId);
    }

    private verdicts(): Row[] {
        return this.tables.verdicts.filter((verdict) => verdict.user_id === this.userId);
    }

    private verdictsNewestFirst(verdicts: Row[]): VerdictView[] {
        const ordered = [...verdicts].sort((a, b) => asc(b.scored_at, a.scored_at) || Number(b.id) - Number(a.id));
        return ordered.map((verdict) => this.withJob(verdict));
    }

    private views(rows: Row[]): JobView[] {
        return [...rows].sort(newestFirst).map((row) => jobViewSchema.parse(row));
    }

    private withJob(verdict: Row): VerdictView {
        const job = this.tables.jobs.find((row) => row.ats === verdict.ats && row.job_id === verdict.job_id);
        const view = viewOf(this.tables, this.userId, { ats: verdict.ats, jobId: verdict.job_id });
        const joined = { title: job?.title ?? null, company: job?.company ?? null, url: job?.url ?? null, source: view?.source ?? null };
        return verdictViewSchema.parse({ ...verdict, ...joined });
    }
}
