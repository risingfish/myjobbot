import type { AuditEntry, CareersStore, JobKey } from "../../src/db/store.js";

const RETRYABLE_REASONS = ["lookup_error", "search_unavailable"];

export class MemoryCareersStore implements CareersStore {
    readonly rows: AuditEntry[] = [];

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
