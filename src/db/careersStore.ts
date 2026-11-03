import type { CompanyPage, JobKey } from "./store.js";

type AuditStep = "retry" | "render_check" | "search" | "remembered" | "open_careers" | "open_job" | "finish" | "skipped";

type AuditOutcome = "ok" | "found" | "failed";

export interface AuditEntry {
    runId: string;
    at: string;
    ats: string;
    jobId: string;
    company: string;
    step: AuditStep;
    url: string | null;
    chars?: number | null;
    cut?: boolean;
    morePages?: boolean;
    outcome: AuditOutcome;
    reason: string | null;
    warning?: boolean;
    detail?: string | null;
    pageSource?: string | null;
    fallback?: string | null;
    board?: string | null;
}

export interface CareersStore {
    careersPage(companyKey: string): Promise<string | null>;
    setLookupPage(page: CompanyPage, at: string): Promise<void>;
    clearLookupPage(companyKey: string): Promise<void>;
    audit(entry: AuditEntry): Promise<void>;
    attempted(keys: JobKey[]): Promise<JobKey[]>;
    retries(): Promise<JobKey[]>;
    pruneAuditBefore(cutoff: string): Promise<void>;
    descriptionFoundAt(key: JobKey): Promise<string | null>;
}
