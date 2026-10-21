import type { z } from "zod";
import type { Job } from "../jobs/job.js";
import type { jobDetailSchema, jobRowSchema, jobViewSchema, verdictViewSchema } from "./rows.js";

export type JobRow = z.infer<typeof jobRowSchema>;
export type JobView = z.infer<typeof jobViewSchema>;
export type JobDetailRow = z.infer<typeof jobDetailSchema>;
export type VerdictView = z.infer<typeof verdictViewSchema>;

export interface Page {
    offset: number;
    limit: number;
}

export interface HiddenFlag {
    ats: string;
    jobId: string;
    hidden: boolean;
}

export interface ScoreFilter {
    sources: string[];
    minScore: number;
}

export interface VerdictStamp {
    scoredAt: string;
    runId: string | null;
}

export interface Verdict {
    job_id: string;
    score: number;
    base?: number;
    bonus?: number;
    reasons: string[];
    gaps: string[];
}

export interface JobStore {
    upsertAll(jobs: Job[], seen: string, source: string): Promise<void>;
    unscoredSince(source: string, seen: string): Promise<JobRow[]>;
    unscoredForSource(source: string): Promise<JobRow[]>;
    boardCompaniesWithTitle(normalizedTitle: string): Promise<string[]>;
    recordVerdict(verdict: Verdict, stamp: VerdictStamp): Promise<boolean>;
    earliestSeen(company: string, normalizedTitle: string): Promise<string>;
    pruneLastSeenBefore(cutoff: string): Promise<number>;
    findJob(jobId: string): Promise<JobRow | null>;
    companiesWithTitleOutside(source: string, normalizedTitle: string): Promise<string[]>;
    markSeen(keys: JobKey[], seen: string): Promise<void>;
    setDescription(key: JobKey, found: FoundDescription): Promise<void>;
    flagInjection(jobId: string, at: string): Promise<void>;
}

export interface FoundDescription {
    description: string;
    url: string;
    source: "careers";
}

export interface JobKey {
    ats: string;
    jobId: string;
}

export interface JobViews {
    scoredFrom(filter: ScoreFilter): Promise<JobView[]>;
    setHidden(flag: HiddenFlag): Promise<boolean>;
    allJobs(page: Page): Promise<JobView[]>;
    countAllJobs(): Promise<number>;
    verdictHistory(page: Page): Promise<VerdictView[]>;
    countVerdicts(): Promise<number>;
    jobDetail(key: JobKey): Promise<JobDetailRow | null>;
}

export interface ApiCallLog {
    record(api: string, source: string, calledAt: string): Promise<void>;
    lastCallAt(api: string, source: string): Promise<string | null>;
    countSince(api: string, since: string): Promise<number>;
    pruneBefore(cutoff: string): Promise<void>;
}

export type GmailStatus = "none" | "connected" | "needs_reconnect";

export interface GmailConnectionRow {
    email: string | null;
    app_password: string | null;
    connected_at: string | null;
    status: GmailStatus;
    reason: string | null;
}

export interface GmailLogin {
    email: string;
    sealedPassword: string;
}

export interface GmailStore {
    connection(): Promise<GmailConnectionRow | null>;
    connected(login: GmailLogin, at: string): Promise<void>;
    needsReconnect(reason: string): Promise<void>;
    disconnect(): Promise<void>;
}

export interface AlertStateRow {
    uid_validity: number | null;
    last_uid: number | null;
    last_run_at: string | null;
    emails_read: number;
    jobs_found: number;
    not_understood: number;
}

export interface AlertRead {
    uidValidity: number;
    lastUid: number | null;
    emails: number;
    jobs: number;
    notUnderstood: number;
}

export interface AlertStore {
    state(): Promise<AlertStateRow | null>;
    recordRead(read: AlertRead, at: string): Promise<void>;
    clear(): Promise<void>;
}

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

export interface CareersPageRow {
    company_key: string;
    company: string;
    url: string;
    found_at: string;
    last_used_at: string;
}

export interface RememberedPage {
    companyKey: string;
    company: string;
    url: string;
}

export interface CareersStore {
    rememberedPage(companyKey: string): Promise<CareersPageRow | null>;
    rememberPage(page: RememberedPage, at: string): Promise<void>;
    usePage(companyKey: string, at: string): Promise<void>;
    forgetPage(companyKey: string): Promise<void>;
    audit(entry: AuditEntry): Promise<void>;
    attempted(keys: JobKey[]): Promise<JobKey[]>;
    retries(): Promise<JobKey[]>;
    pruneAuditBefore(cutoff: string): Promise<void>;
}

export interface Stores {
    jobStore: JobStore;
    jobViews: JobViews;
    apiCalls: ApiCallLog;
    gmail: GmailStore;
    alerts: AlertStore;
    careers: CareersStore;
    close(): Promise<void>;
}
