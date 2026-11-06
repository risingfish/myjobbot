import type { z } from "zod";
import type { AccountStore } from "./accountStore.js";
import type { CompanyStore } from "./companyStore.js";
import type { MethodStore } from "./methodStore.js";
import type { SessionStore } from "./sessionStore.js";
import type { JobSource } from "./jobSource.js";
import type { CareersStore } from "./careersStore.js";
import type { RescoreLogStore } from "./rescoreLogStore.js";
import type { ResumeStore } from "./resumeStore.js";
import type { SearchSettingsStore } from "./searchSettingsStore.js";
import type { SourceStore } from "./sourceStore.js";
import type { DescriptionFormat, Job } from "../jobs/job.js";
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

export interface AppliedChange {
    ats: string;
    jobId: string;
    applied: boolean;
    at: string;
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
    upsertAll(jobs: Job[], seen: string, source: JobSource): Promise<void>;
    unscoredSince(source: JobSource, seen: string): Promise<JobRow[]>;
    unscoredForSource(source: JobSource): Promise<JobRow[]>;
    boardCompaniesWithTitle(normalizedTitle: string): Promise<string[]>;
    recordVerdict(verdict: Verdict, stamp: VerdictStamp): Promise<boolean>;
    earliestSeen(company: string, normalizedTitle: string): Promise<string>;
    pruneLastSeenBefore(cutoff: string): Promise<number>;
    findJob(jobId: string): Promise<JobRow | null>;
    companiesWithTitleOutside(source: JobSource, normalizedTitle: string): Promise<string[]>;
    markSeen(keys: JobKey[], seen: string): Promise<void>;
    linkUnlinkedJobs(): Promise<number>;
    setDescription(key: JobKey, found: FoundDescription): Promise<void>;
    flagInjection(jobId: string, at: string): Promise<void>;
}

export interface FoundDescription {
    description: string;
    format: DescriptionFormat;
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
    clearScore(key: JobKey): Promise<boolean>;
    setApplied(change: AppliedChange): Promise<{ appliedOn: string | null } | null>;
    allJobs(page: Page): Promise<JobView[]>;
    countAllJobs(): Promise<number>;
    appliedJobs(page: Page): Promise<JobView[]>;
    countApplied(): Promise<number>;
    verdictHistory(page: Page): Promise<VerdictView[]>;
    countVerdicts(): Promise<number>;
    jobDetail(key: JobKey): Promise<JobDetailRow | null>;
    jobVerdicts(key: JobKey): Promise<VerdictView[]>;
    recentlyScored(limit: number): Promise<JobKey[]>;
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

export interface CompanyPage {
    key: string;
    name: string;
    url: string;
}

export interface Stores {
    jobStore: JobStore;
    rescoreLog: RescoreLogStore;
    jobViews: JobViews;
    apiCalls: ApiCallLog;
    gmail: GmailStore;
    alerts: AlertStore;
    careers: CareersStore;
    companies: CompanyStore;
    searchSettings: SearchSettingsStore;
    sources: SourceStore;
    resume: ResumeStore;
    sessions: SessionStore;
    accounts: AccountStore;
    methods: MethodStore;
    close(): Promise<void>;
}
