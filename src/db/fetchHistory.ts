import type { SourceOutcome } from "./sourceStore.js";

export interface FetchRecord {
    sourceId: number;
    partId: string;
    module: string;
    at: string;
    ms: number;
    outcome: SourceOutcome["outcome"] | "skipped";
    reason: string | null;
    pages: number;
    jobs: number;
    cost: number;
}

export interface FetchHistory {
    record(userId: number, fetch: FetchRecord): Promise<void>;
    pruneBefore(cutoff: string): Promise<void>;
}

export interface UserFetchHistory {
    record(fetch: FetchRecord): Promise<void>;
}

/** Gives one user's view of the fetch history, every fetch recorded as theirs. */
export function userFetchHistory(store: FetchHistory, userId: number): UserFetchHistory {
    return { record: (fetch) => store.record(userId, fetch) };
}
