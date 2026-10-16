import type { AuditEntry, CareersStore } from "../db/store.js";
import type { SoughtJob } from "./session.js";

export type StepRecord = Omit<AuditEntry, "runId" | "at" | "ats" | "jobId" | "company">;

export interface AuditDeps {
    careers: CareersStore;
    runId: string;
    now: () => Date;
}

export class StoreFailed extends Error {}

/** Runs a careers-store write, reporting a failure as StoreFailed so the lookup ends as lookup_error. */
export async function stored(write: () => Promise<void>): Promise<void> {
    try {
        await write();
    } catch (error) {
        throw new StoreFailed("the careers store could not be written", { cause: error });
    }
}

/** Builds the function a lookup uses to log its steps for one job, reporting a failed write as StoreFailed. */
export function auditor(deps: AuditDeps, job: SoughtJob): (record: StepRecord) => Promise<void> {
    return (record) => stored(() => deps.careers.audit({ runId: deps.runId, at: deps.now().toISOString(), ats: job.ats, jobId: job.jobId, company: job.company, ...record }));
}

/** Logs that a run's lookups were skipped because search can't be used; the row belongs to no job. */
export async function auditSkipped(deps: AuditDeps, note: string): Promise<void> {
    const log = auditor(deps, { ats: "", jobId: "", company: "", title: "", location: null });
    await log({ step: "skipped", url: null, outcome: "failed", reason: "search_unavailable", detail: note });
}
