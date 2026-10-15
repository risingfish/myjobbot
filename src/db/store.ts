import type { z } from "zod";
import type { Job } from "../jobs/job.js";
import type { jobRowSchema, jobViewSchema, verdictViewSchema } from "./rows.js";

export type JobRow = z.infer<typeof jobRowSchema>;
export type JobView = z.infer<typeof jobViewSchema>;
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
}

export interface JobViews {
    scoredFrom(filter: ScoreFilter): Promise<JobView[]>;
    setHidden(flag: HiddenFlag): Promise<boolean>;
    allJobs(page: Page): Promise<JobView[]>;
    countAllJobs(): Promise<number>;
    verdictHistory(page: Page): Promise<VerdictView[]>;
    countVerdicts(): Promise<number>;
}

export interface ApiCallLog {
    record(api: string, source: string, calledAt: string): Promise<void>;
    lastCallAt(api: string, source: string): Promise<string | null>;
    countSince(api: string, since: string): Promise<number>;
    pruneBefore(cutoff: string): Promise<void>;
}

export interface Stores {
    jobStore: JobStore;
    jobViews: JobViews;
    apiCalls: ApiCallLog;
    close(): Promise<void>;
}
