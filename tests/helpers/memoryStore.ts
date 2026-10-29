import { splitSettings } from "../../src/config/searchSettings.js";
import { sourceParts, type JobSource } from "../../src/db/jobSource.js";
import { jobRowSchema, toParams } from "../../src/db/rows.js";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import type { ApiCallLog, FoundDescription, JobKey, JobRow, JobStore, Stores, Verdict, VerdictStamp } from "../../src/db/store.js";
import { companyKeys } from "../../src/companies/keys.js";
import { normalizeCompany } from "../../src/jobs/company.js";
import type { Job } from "../../src/jobs/job.js";
import { MemoryAlertStore } from "./memoryAlertStore.js";
import { recordMemoryCompanies, touchMemoryCompany } from "./memoryCompanies.js";
import { MemoryCompanyStore } from "./memoryCompanyStore.js";
import { MemoryCareersStore } from "./memoryCareersStore.js";
import { MemoryGmailStore } from "./memoryGmailStore.js";
import { MemorySearchSettingsStore } from "./memorySearchSettingsStore.js";
import { MemorySourceStore } from "./memorySourceStore.js";
import { savedSources, type SourceLists } from "./savedSources.js";
import { asc, MemoryJobViews, newTables, type Row, type Tables } from "./memoryJobViews.js";

const UNSCORED = { scored_at: null, score: null, base_score: null, bonus_score: null, reasons: null, gaps: null, hidden: 0, applied: 0, applied_on: null, company_id: null, source_id: null, emailed_at: null, injection_seen_at: null };

function companies(rows: Row[]): string[] {
    return [...new Set(rows.map((job) => String(job.company)))];
}

function fromSource(job: Row, source: JobSource): boolean {
    const { label, id } = sourceParts(source);
    return id === null ? job.source === label : job.source_id === id;
}

function minimum(values: Array<string | number | null | undefined>): string | null {
    const present = values.filter((value): value is string => typeof value === "string").sort(asc);
    return present[0] ?? null;
}

class MemoryJobStore implements JobStore {
    constructor(private readonly tables: Tables) {}

    async upsertAll(jobs: Job[], seen: string, source: JobSource): Promise<void> {
        const ids = recordMemoryCompanies(this.tables, companyKeys(jobs.map((job) => ({ name: job.company, firstSeen: seen, lastSeen: seen }))));
        const { label, id } = sourceParts(source);
        for (const job of jobs) this.upsert({ ...toParams(job, seen, label), company_id: ids.get(normalizeCompany(job.company)) ?? null, source_id: id }, seen);
    }

    async linkUnlinkedJobs(): Promise<number> {
        const unlinked = this.tables.jobs.filter((job) => job.company_id === null).sort((a, b) => asc(a.first_seen, b.first_seen) || asc(a.ats, b.ats) || asc(a.job_id, b.job_id));
        const ids = recordMemoryCompanies(this.tables, companyKeys(unlinked.map((job) => ({ name: String(job.company), firstSeen: String(job.first_seen), lastSeen: String(job.last_seen) }))));
        for (const job of unlinked) job.company_id = ids.get(normalizeCompany(String(job.company))) ?? null;
        return unlinked.filter((job) => job.company_id !== null).length;
    }

    async unscoredSince(source: JobSource, seen: string): Promise<JobRow[]> {
        return this.unscored(source).filter((row) => row.last_seen === seen);
    }

    async unscoredForSource(source: JobSource): Promise<JobRow[]> {
        return this.unscored(source);
    }

    async boardCompaniesWithTitle(normalizedTitle: string): Promise<string[]> {
        return companies(this.tables.jobs.filter((job) => job.ats !== "jsearch" && job.ats !== "linkedin" && job.normalized_title === normalizedTitle));
    }

    async companiesWithTitleOutside(source: JobSource, normalizedTitle: string): Promise<string[]> {
        return companies(this.tables.jobs.filter((job) => !fromSource(job, source) && job.normalized_title === normalizedTitle));
    }

    async markSeen(keys: JobKey[], seen: string): Promise<void> {
        for (const job of this.tables.jobs) {
            if (!keys.some((key) => key.ats === job.ats && key.jobId === job.job_id)) continue;
            job.last_seen = seen;
            touchMemoryCompany(this.tables, job, seen);
        }
    }

    async setDescription(key: JobKey, found: FoundDescription): Promise<void> {
        const job = this.tables.jobs.find((row) => row.ats === key.ats && row.job_id === key.jobId);
        if (job) Object.assign(job, { description: found.description, description_format: found.format, description_source: found.source, description_url: found.url, scored_at: null });
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
        this.tables.jobs = this.tables.jobs.filter((job) => String(job.last_seen) >= cutoff || job.applied === 1);
        const kept = new Set(this.tables.jobs.map((job) => `${job.ats}:${job.job_id}`));
        this.tables.verdicts = this.tables.verdicts.filter((verdict) => kept.has(`${verdict.ats}:${verdict.job_id}`));
        return before - this.tables.jobs.length;
    }

    async findJob(jobId: string): Promise<JobRow | null> {
        const job = this.tables.jobs.find((row) => row.job_id === jobId);
        return job === undefined ? null : jobRowSchema.parse(job);
    }

    private unscored(source: JobSource): JobRow[] {
        const rows = this.tables.jobs.filter((job) => fromSource(job, source) && job.scored_at === null);
        return rows.sort((a, b) => asc(a.job_id, b.job_id)).map((row) => jobRowSchema.parse(row));
    }

    private upsert(params: Row, seen: string): void {
        const { seen: _seen, ...fields } = params;
        const existing = this.tables.jobs.find((job) => job.ats === fields.ats && job.job_id === fields.job_id);
        if (existing && existing.description_format !== "markdown" && fields.description_format === "markdown") existing.scored_at = null;
        if (existing) Object.assign(existing, fields, { last_seen: seen });
        else this.tables.jobs.push({ ...UNSCORED, ...fields, first_seen: seen, last_seen: seen });
    }
}

function verdictValues(verdict: Verdict, stamp: VerdictStamp): Row {
    const notes = { reasons: JSON.stringify(verdict.reasons), gaps: JSON.stringify(verdict.gaps) };
    return { score: verdict.score, base_score: verdict.base ?? null, bonus_score: verdict.bonus ?? null, ...notes, scored_at: stamp.scoredAt };
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

export function memoryStores(tables: Tables = newTables()): Stores {
    const close = async (): Promise<void> => {};
    return { jobStore: new MemoryJobStore(tables), jobViews: new MemoryJobViews(tables), apiCalls: new MemoryApiCallLog(tables), gmail: new MemoryGmailStore(), alerts: new MemoryAlertStore(), careers: new MemoryCareersStore(tables), companies: new MemoryCompanyStore(tables), searchSettings: new MemorySearchSettingsStore(), sources: new MemorySourceStore(tables), close };
}

export function storesWithSettings(config: SourceLists, tables: Tables = newTables()): Stores {
    const searchSettings = new MemorySearchSettingsStore();
    searchSettings.put(OWNER_ID, splitSettings(config).search);
    const sources = new MemorySourceStore(tables);
    sources.seed(OWNER_ID, savedSources(config));
    return { ...memoryStores(tables), searchSettings, sources };
}
