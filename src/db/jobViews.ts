import type { z } from "zod";
import type { jobDetailSchema, jobViewSchema, verdictViewSchema } from "./rows.js";
import type { JobKey } from "./store.js";

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
