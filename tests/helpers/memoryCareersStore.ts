import type { AuditEntry, CareersStore, CompanyPage, JobKey } from "../../src/db/store.js";
import { recordMemoryCompanies } from "./memoryCompanies.js";
import { newTables, type Row, type Tables } from "./memoryJobViews.js";

const RETRYABLE_REASONS = ["lookup_error", "search_unavailable"];

export class MemoryCareersStore implements CareersStore {
    readonly rows: Array<AuditEntry & { retryOnce?: boolean }> = [];

    constructor(private readonly tables: Tables = newTables()) {}

    async careersPage(companyKey: string): Promise<string | null> {
        const url = this.company(companyKey)?.careers_url;
        return url === undefined || url === null ? null : String(url);
    }

    async setLookupPage(page: CompanyPage, at: string): Promise<void> {
        if (!this.company(page.key)) recordMemoryCompanies(this.tables, [{ key: page.key, name: page.name, firstSeen: at, lastSeen: at }]);
        const company = this.company(page.key);
        if (company && company.careers_source !== "board") Object.assign(company, { careers_url: page.url, careers_source: "lookup", careers_reason: null, careers_rejected: null });
    }

    async clearLookupPage(companyKey: string): Promise<void> {
        const company = this.company(companyKey);
        if (!company || company.careers_url === null || !["lookup", "search"].includes(String(company.careers_source))) return;
        const rejected = [...(JSON.parse(String(company.careers_rejected ?? "[]")) as string[]), String(company.careers_url)];
        Object.assign(company, { careers_url: null, careers_source: null, careers_rejected: JSON.stringify(rejected) });
    }

    async audit(entry: AuditEntry): Promise<void> {
        this.rows.push({ ...entry, detail: entry.detail?.slice(0, 2000) ?? null });
    }

    async attempted(keys: JobKey[]): Promise<JobKey[]> {
        const ended = this.rows.filter((row) => endedForGood(row) && row.retryOnce !== true);
        return keys.filter((key) => ended.some((row) => row.ats === key.ats && row.jobId === key.jobId));
    }

    async retries(): Promise<JobKey[]> {
        const owed = this.rows.filter((row, index) => row.step === "finish" && row.retryOnce === true && !this.rows.slice(index + 1).some((later) => later.ats === row.ats && later.jobId === row.jobId && endedForGood(later)));
        return owed.map((row) => ({ ats: row.ats, jobId: row.jobId }));
    }

    async pruneAuditBefore(cutoff: string): Promise<void> {
        const kept = this.rows.filter((row) => row.at >= cutoff);
        this.rows.splice(0, this.rows.length, ...kept);
    }

    private company(companyKey: string): Row | undefined {
        return this.tables.companies.find((row) => row.company_key === companyKey);
    }
}

function endedForGood(row: AuditEntry): boolean {
    return row.step === "finish" && !RETRYABLE_REASONS.includes(row.reason ?? "");
}
