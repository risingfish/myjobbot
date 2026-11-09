import type { z } from "zod";
import type { Job } from "../jobs/job.js";
import type { JobSource } from "./jobSource.js";
import type { jobRowSchema } from "./rows.js";
import type { JobKey } from "./store.js";

export type JobRow = z.infer<typeof jobRowSchema>;

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
    boardCompaniesWithTitle(normalizedTitle: string, notBoards: readonly string[]): Promise<string[]>;
    recordVerdict(verdict: Verdict, stamp: VerdictStamp): Promise<boolean>;
    findJob(jobId: string): Promise<JobRow | null>;
    companiesWithTitleOutside(source: JobSource, normalizedTitle: string): Promise<string[]>;
    markSeen(keys: JobKey[], seen: string): Promise<void>;
}
