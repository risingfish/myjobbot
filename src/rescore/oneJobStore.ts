import type { JobKey } from "../db/store.js";
import type { JobStore } from "../db/jobStore.js";

export type OneJobStore = Pick<JobStore, "findJob" | "recordVerdict"> & { recorded(): boolean };

/** Narrows the job store to one job, so a re-score's model can read and score only that job, and reports once its verdict is saved, with its score. */
export function oneJobStore(store: Pick<JobStore, "findJob" | "recordVerdict">, key: JobKey, onSaved?: (score: number) => void): OneJobStore {
    let recorded = false;
    return {
        findJob: async (jobId) => {
            const row = jobId === key.jobId ? await store.findJob(jobId) : null;
            return row !== null && row.ats === key.ats ? row : null;
        },
        recordVerdict: async (verdict, stamp) => {
            if (verdict.job_id !== key.jobId) return false;
            const known = await store.recordVerdict(verdict, stamp);
            recorded = recorded || known;
            if (known) onSaved?.(verdict.score);
            return known;
        },
        recorded: () => recorded,
    };
}
