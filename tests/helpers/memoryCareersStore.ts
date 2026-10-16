import type { AuditEntry, CareersPageRow, CareersStore, JobKey, RememberedPage } from "../../src/db/store.js";

const RETRYABLE_REASONS = ["lookup_error", "search_unavailable"];

export class MemoryCareersStore implements CareersStore {
    readonly rows: AuditEntry[] = [];
    private readonly pages = new Map<string, CareersPageRow>();

    async rememberedPage(companyKey: string): Promise<CareersPageRow | null> {
        const page = this.pages.get(companyKey);
        return page === undefined ? null : { ...page };
    }

    async rememberPage(page: RememberedPage, at: string): Promise<void> {
        this.pages.set(page.companyKey, { company_key: page.companyKey, company: page.company, url: page.url, found_at: at, last_used_at: at });
    }

    async usePage(companyKey: string, at: string): Promise<void> {
        const page = this.pages.get(companyKey);
        if (page) page.last_used_at = at;
    }

    async forgetPage(companyKey: string): Promise<void> {
        this.pages.delete(companyKey);
    }

    async audit(entry: AuditEntry): Promise<void> {
        this.rows.push({ ...entry, detail: entry.detail?.slice(0, 2000) ?? null });
    }

    async attempted(keys: JobKey[]): Promise<JobKey[]> {
        const ended = this.rows.filter((row) => row.step === "finish" && !RETRYABLE_REASONS.includes(row.reason ?? ""));
        return keys.filter((key) => ended.some((row) => row.ats === key.ats && row.jobId === key.jobId));
    }

    async pruneAuditBefore(cutoff: string): Promise<void> {
        const kept = this.rows.filter((row) => row.at >= cutoff);
        this.rows.splice(0, this.rows.length, ...kept);
    }
}
