import type { JobKey, JobStore } from "../db/store.js";

export type OneJobStore = Pick<JobStore, "findJob" | "recordVerdict" | "earliestSeen" | "flagInjection"> & { recorded(): boolean };

/** Narrows the job store to one job, so a re-score's model can read and score only that job, and reports once its verdict is saved. */
export function oneJobStore(store: JobStore, key: JobKey): OneJobStore {
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
            return known;
        },
        earliestSeen: (company, normalizedTitle) => store.earliestSeen(company, normalizedTitle),
        flagInjection: (jobId, at) => store.flagInjection(jobId, at),
        recorded: () => recorded,
    };
}
