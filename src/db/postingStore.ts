import type { FoundDescription, JobKey } from "./store.js";

export interface KnownPosting extends JobKey {
    described: boolean;
}

export interface PostingStore {
    known(keys: JobKey[]): Promise<KnownPosting[]>;
    setDescription(key: JobKey, found: FoundDescription): Promise<void>;
    flagInjection(jobId: string, at: string): Promise<void>;
    linkUnlinkedJobs(): Promise<number>;
    earliestSeen(company: string, normalizedTitle: string): Promise<string>;
    prune(cutoff: string): Promise<number>;
}
