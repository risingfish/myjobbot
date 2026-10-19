import { jobRowSchema, jobViewSchema, toParams, verdictViewSchema } from "../../src/db/rows.js";
import type { ApiCallLog, FoundDescription, HiddenFlag, JobKey, JobRow, JobStore, JobView, JobViews, Page, ScoreFilter, Stores, Verdict, VerdictStamp, VerdictView } from "../../src/db/store.js";
import type { Job } from "../../src/jobs/job.js";
import { MemoryAlertStore } from "./memoryAlertStore.js";
import { MemoryCareersStore } from "./memoryCareersStore.js";
import { MemoryGmailStore } from "./memoryGmailStore.js";

type Row = Record<string, string | number | null>;

interface Tables {
    jobs: Row[];
    verdicts: Row[];
    calls: Row[];
}

const UNSCORED = { scored_at: null, score: null, base_score: null, bonus_score: null, reasons: null, gaps: null, hidden: 0, emailed_at: null, injection_seen_at: null };

function companies(rows: Row[]): string[] {
    return [...new Set(rows.map((job) => String(job.company)))];
}

const asc = (left: unknown, right: unknown): number => (String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0);

function newestFirst(a: Row, b: Row): number {
    return asc(b.posted_at ?? b.first_seen, a.posted_at ?? a.first_seen) || asc(b.first_seen, a.first_seen) || asc(a.ats, b.ats) || asc(a.job_id, b.job_id);
}

function slice<T>(rows: T[], page: Page): T[] {
    return rows.slice(page.offset, page.offset + page.limit);
}

function minimum(values: Array<string | number | null | undefined>): string | null {
    const present = values.filter((value): value is string => typeof value === "string").sort(asc);
    return present[0] ?? null;
}

class MemoryJobStore implements JobStore {
    constructor(private readonly tables: Tables) {}

    async upsertAll(jobs: Job[], seen: string, source: string): Promise<void> {
        for (const job of jobs) this.upsert(toParams(job, seen, source), seen);
    }

    async unscoredSince(source: string, seen: string): Promise<JobRow[]> {
        return this.unscored(source).filter((row) => row.last_seen === seen);
    }

    async unscoredForSource(source: string): Promise<JobRow[]> {
        return this.unscored(source);
    }

    async boardCompaniesWithTitle(normalizedTitle: string): Promise<string[]> {
        return companies(this.tables.jobs.filter((job) => job.ats !== "jsearch" && job.ats !== "linkedin" && job.normalized_title === normalizedTitle));
    }

    async companiesWithTitleOutside(source: string, normalizedTitle: string): Promise<string[]> {
        return companies(this.tables.jobs.filter((job) => job.source !== source && job.normalized_title === normalizedTitle));
    }

    async markSeen(keys: JobKey[], seen: string): Promise<void> {
        for (const job of this.tables.jobs) if (keys.some((key) => key.ats === job.ats && key.jobId === job.job_id)) job.last_seen = seen;
    }

    async setDescription(key: JobKey, found: FoundDescription): Promise<void> {
        const job = this.tables.jobs.find((row) => row.ats === key.ats && row.job_id === key.jobId);
        if (job) Object.assign(job, { description: found.description, description_source: found.source, description_url: found.url, scored_at: null });
    }

    async flagInjection(jobId: string, at: string): Promise<void> {
        for (const job of this.tables.jobs) if (job.job_id === jobId && job.injection_seen_at === null) job.injection_seen_at = at;
    }

    async recordVerdict(verdict: Verdict, stamp: VerdictStamp): Promise<boolean> {
        const jobs = this.tables.jobs.filter((job) => job.job_id === verdict.job_id);
        const values = verdictValues(verdict, stamp);
        for (const job of jobs) {
            Object.assign(job, values);
            this.tables.verdicts.push({ ...values, id: this.tables.verdicts.length + 1, ats: job.ats ?? null, job_id: verdict.job_id, run_id: stamp.runId });
        }
        return jobs.length > 0;
    }

    async earliestSeen(company: string, normalizedTitle: string): Promise<string> {
        const jobs = this.tables.jobs.filter((job) => job.company === company && job.normalized_title === normalizedTitle);
        const firstSeen = minimum(jobs.map((job) => job.first_seen));
        const earliest = minimum([firstSeen, minimum(jobs.map((job) => job.posted_at)) ?? firstSeen]);
        if (earliest === null) throw new Error(`no jobs for ${company} / ${normalizedTitle}`);
        return earliest;
    }

    async pruneLastSeenBefore(cutoff: string): Promise<number> {
        const before = this.tables.jobs.length;
        this.tables.jobs = this.tables.jobs.filter((job) => String(job.last_seen) >= cutoff);
        const kept = new Set(this.tables.jobs.map((job) => `${job.ats}:${job.job_id}`));
        this.tables.verdicts = this.tables.verdicts.filter((verdict) => kept.has(`${verdict.ats}:${verdict.job_id}`));
        return before - this.tables.jobs.length;
    }

    async findJob(jobId: string): Promise<JobRow | null> {
        const job = this.tables.jobs.find((row) => row.job_id === jobId);
        return job === undefined ? null : jobRowSchema.parse(job);
    }

    private unscored(source: string): JobRow[] {
        const rows = this.tables.jobs.filter((job) => job.source === source && job.scored_at === null);
        return rows.sort((a, b) => asc(a.job_id, b.job_id)).map((row) => jobRowSchema.parse(row));
    }

    private upsert(params: Row, seen: string): void {
        const { seen: _seen, ...fields } = params;
        const existing = this.tables.jobs.find((job) => job.ats === fields.ats && job.job_id === fields.job_id);
        if (existing) Object.assign(existing, fields, { last_seen: seen });
        else this.tables.jobs.push({ ...UNSCORED, ...fields, first_seen: seen, last_seen: seen });
    }
}

function verdictValues(verdict: Verdict, stamp: VerdictStamp): Row {
    const notes = { reasons: JSON.stringify(verdict.reasons), gaps: JSON.stringify(verdict.gaps) };
    return { score: verdict.score, base_score: verdict.base ?? null, bonus_score: verdict.bonus ?? null, ...notes, scored_at: stamp.scoredAt };
}

class MemoryJobViews implements JobViews {
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

    private views(rows: Row[]): JobView[] {
        return [...rows].sort(newestFirst).map((row) => jobViewSchema.parse(row));
    }

    private withJob(verdict: Row): VerdictView {
        const job = this.tables.jobs.find((row) => row.ats === verdict.ats && row.job_id === verdict.job_id);
        const joined = { title: job?.title ?? null, company: job?.company ?? null, url: job?.url ?? null, source: job?.source ?? null };
        return verdictViewSchema.parse({ ...verdict, ...joined });
    }
}

class MemoryApiCallLog implements ApiCallLog {
    constructor(private readonly tables: Tables) {}

    async record(api: string, source: string, calledAt: string): Promise<void> {
        this.tables.calls.push({ api, source, called_at: calledAt });
    }

    async lastCallAt(api: string, source: string): Promise<string | null> {
        const times = this.tables.calls.filter((call) => call.api === api && call.source === source).map((call) => String(call.called_at));
        return times.sort(asc).at(-1) ?? null;
    }

    async countSince(api: string, since: string): Promise<number> {
        return this.tables.calls.filter((call) => call.api === api && String(call.called_at) >= since).length;
    }

    async pruneBefore(cutoff: string): Promise<void> {
        this.tables.calls = this.tables.calls.filter((call) => String(call.called_at) >= cutoff);
    }
}

export function memoryStores(): Stores {
    const tables: Tables = { jobs: [], verdicts: [], calls: [] };
    const close = async (): Promise<void> => {};
    return { jobStore: new MemoryJobStore(tables), jobViews: new MemoryJobViews(tables), apiCalls: new MemoryApiCallLog(tables), gmail: new MemoryGmailStore(), alerts: new MemoryAlertStore(), careers: new MemoryCareersStore(), close };
}
