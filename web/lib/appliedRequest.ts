import type { JobRowView } from "../../src/web/api.js";

/** Works out what clicking a job's applied mark asks for: marking it, or undoing the mark once the owner confirms. */
export function appliedRequest(job: Pick<JobRowView, "ats" | "jobId" | "applied">) {
    return { ats: job.ats, jobId: job.jobId, applied: !job.applied, confirm: job.applied ? "Mark as not applied?" : null };
}
