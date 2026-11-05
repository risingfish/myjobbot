import type { Count, Text } from "./columns.js";

export interface RescoreRunsTable {
    id: string;
    ats: string;
    job_id: string;
    started_at: string;
    ended_at: Text;
    outcome: Text;
    filter: Text;
    score: Count;
}

export interface RescoreStepsTable {
    run_id: string;
    seq: number;
    elapsed_ms: number;
    kind: string;
    fields: string;
}
