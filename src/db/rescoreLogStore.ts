import type { JobKey } from "./store.js";

const OPEN_RUN_MINUTES = 10;

export interface RescoreEnd {
    outcome: "scored" | "filtered" | "failed";
    filter: "company" | "title" | "body" | null;
    score: number | null;
}

export interface RescoreRun {
    id: string;
    ats: string;
    jobId: string;
    startedAt: string;
    endedAt: string | null;
    outcome: RescoreEnd["outcome"] | null;
    filter: RescoreEnd["filter"];
    score: number | null;
}

export interface StoredStep {
    seq: number;
    elapsedMs: number;
    kind: string;
    fields: unknown;
}

export type BeginResult = { started: string } | { running: string } | { missing: true };

export interface RescoreLogStore {
    begin(key: JobKey, id: string, at: string): Promise<BeginResult>;
    end(id: string, result: RescoreEnd, at: string): Promise<void>;
    addStep(id: string, step: StoredStep): Promise<void>;
    stepsAfter(id: string, seq: number): Promise<StoredStep[]>;
    run(id: string): Promise<RescoreRun | null>;
    runsFor(key: JobKey): Promise<RescoreRun[]>;
}

/** Gives the earliest start time a run may have and still block a new re-score of its job. */
export function openSince(at: string): string {
    return new Date(new Date(at).getTime() - OPEN_RUN_MINUTES * 60_000).toISOString();
}
