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

export type RecentFetch = Pick<FetchRecord, "at" | "outcome" | "reason" | "jobs">;

export interface FetchHistory {
    record(userId: number, fetch: FetchRecord): Promise<void>;
    recent(userId: number, sourceIds: number[], perSource: number): Promise<Map<number, RecentFetch[]>>;
    pruneBefore(cutoff: string): Promise<void>;
}

export interface UserFetchHistory {
    record(fetch: FetchRecord): Promise<void>;
    recent(sourceIds: number[], perSource: number): Promise<Map<number, RecentFetch[]>>;
}

/** Gives one user's view of the fetch history: every fetch recorded as theirs, and only their own read. */
export function userFetchHistory(store: FetchHistory, userId: number): UserFetchHistory {
    return { record: (fetch) => store.record(userId, fetch), recent: (sourceIds, perSource) => store.recent(userId, sourceIds, perSource) };
}

/** Keeps each source's latest fetches, from fetches already newest first. */
export function latestPerSource(fetches: Array<RecentFetch & { sourceId: number }>, perSource: number): Map<number, RecentFetch[]> {
    const kept = new Map<number, RecentFetch[]>();
    for (const { sourceId, ...fetch } of fetches) {
        const list = kept.get(sourceId) ?? [];
        if (list.length < perSource) kept.set(sourceId, [...list, fetch]);
    }
    return kept;
}
