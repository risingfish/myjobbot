import { sourceParts, type JobSource } from "../../src/db/jobSource.js";
import { jobRowSchema, toParams } from "../../src/db/rows.js";
import type { JobKey, JobRow, JobStore, Verdict, VerdictStamp } from "../../src/db/store.js";
import { companyKeys } from "../../src/companies/keys.js";
import { normalizeCompany } from "../../src/jobs/company.js";
import type { Job } from "../../src/jobs/job.js";
import { recordMemoryCompanies, touchMemoryCompany } from "./memoryCompanies.js";
import { asc, userRows, viewOf, type Row, type Tables } from "./memoryJobViews.js";

const UNSCORED_VIEW = { scored_at: null, score: null, base_score: null, bonus_score: null, reasons: null, gaps: null, hidden: 0, applied: 0, applied_on: null };

const NEW_POSTING = { company_id: null, injection_seen_at: null };

const DESCRIBED = ["description", "description_format", "description_source", "description_url"];

function companies(rows: Row[]): string[] {
    return [...new Set(rows.map((job) => String(job.company)))];
}

function fromSource(job: Row, source: JobSource): boolean {
    const { label, id } = sourceParts(source);
    return id === null ? job.source === label : job.source_id === id;
}

export class MemoryJobStore implements JobStore {
    constructor(
        private readonly tables: Tables,
        private readonly userId: number,
    ) {}

    async upsertAll(jobs: Job[], seen: string, source: JobSource): Promise<void> {
        const ids = recordMemoryCompanies(this.tables, companyKeys(jobs.map((job) => ({ name: job.company, firstSeen: seen, lastSeen: seen }))));
        const { label, id } = sourceParts(source);
        for (const job of jobs) {
            const { seen: _seen, source: _label, ...fields } = toParams(job, seen, label);
            this.upsertPosting({ ...fields, company_id: ids.get(normalizeCompany(job.company)) ?? null }, { seen, label });
            this.upsertView({ ats: job.ats, job_id: job.jobId, source: label, source_id: id }, seen);
        }
    }

    async unscoredSince(source: JobSource, seen: string): Promise<JobRow[]> {
        return this.unscored(source).filter((row) => row.last_seen === seen);
    }

    async unscoredForSource(source: JobSource): Promise<JobRow[]> {
        return this.unscored(source);
    }

    async boardCompaniesWithTitle(normalizedTitle: string): Promise<string[]> {
        return companies(this.rows().filter((job) => job.ats !== "jsearch" && job.ats !== "linkedin" && job.normalized_title === normalizedTitle));
    }

    async companiesWithTitleOutside(source: JobSource, normalizedTitle: string): Promise<string[]> {
        return companies(this.rows().filter((job) => !fromSource(job, source) && job.normalized_title === normalizedTitle));
    }

    async markSeen(keys: JobKey[], seen: string): Promise<void> {
        for (const key of keys) {
            const posting = this.tables.jobs.find((job) => job.ats === key.ats && job.job_id === key.jobId);
            const view = viewOf(this.tables, this.userId, key);
            if (view) view.last_seen = seen;
            if (posting === undefined) continue;
            posting.last_seen = seen;
            touchMemoryCompany(this.tables, posting, seen);
        }
    }

    async recordVerdict(verdict: Verdict, stamp: VerdictStamp): Promise<boolean> {
        const views = this.tables.userJobs.filter((view) => view.user_id === this.userId && view.job_id === verdict.job_id);
        const values = verdictValues(verdict, stamp);
        for (const view of views) {
            Object.assign(view, values);
            this.tables.verdicts.push({ ...values, id: this.tables.verdicts.length + 1, user_id: this.userId, ats: view.ats ?? null, job_id: verdict.job_id, run_id: stamp.runId });
        }
        return views.length > 0;
    }

    async findJob(jobId: string): Promise<JobRow | null> {
        const job = this.rows().find((row) => row.job_id === jobId);
        return job === undefined ? null : jobRowSchema.parse(job);
    }

    private rows(): Row[] {
        return userRows(this.tables, this.userId);
    }

    private unscored(source: JobSource): JobRow[] {
        const rows = this.rows().filter((job) => fromSource(job, source) && job.scored_at === null);
        return rows.sort((a, b) => asc(a.job_id, b.job_id)).map((row) => jobRowSchema.parse(row));
    }

    private upsertPosting(fields: Row, fetch: { seen: string; label: string }): void {
        const existing = this.tables.jobs.find((job) => job.ats === fields.ats && job.job_id === fields.job_id);
        if (existing === undefined) {
            this.tables.jobs.push({ ...NEW_POSTING, ...fields, source: fetch.label, first_seen: fetch.seen, last_seen: fetch.seen });
            return;
        }
        if (existing.description_format !== "markdown" && fields.description_format === "markdown") for (const view of this.tables.userJobs) if (view.ats === fields.ats && view.job_id === fields.job_id) view.scored_at = null;
        const kept = fields.description === null ? Object.fromEntries(DESCRIBED.map((column) => [column, existing[column] ?? null])) : {};
        Object.assign(existing, fields, kept, { last_seen: fetch.seen });
    }

    private upsertView(fields: Row, seen: string): void {
        const existing = viewOf(this.tables, this.userId, { ats: fields.ats, jobId: fields.job_id });
        if (existing) Object.assign(existing, fields, { last_seen: seen });
        else this.tables.userJobs.push({ ...UNSCORED_VIEW, ...fields, user_id: this.userId, first_seen: seen, last_seen: seen });
    }
}

function verdictValues(verdict: Verdict, stamp: VerdictStamp): Row {
    const notes = { reasons: JSON.stringify(verdict.reasons), gaps: JSON.stringify(verdict.gaps) };
    return { score: verdict.score, base_score: verdict.base ?? null, bonus_score: verdict.bonus ?? null, ...notes, scored_at: stamp.scoredAt };
}
