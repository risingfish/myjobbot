import type { Job } from "../jobs/job.js";

/** Strips a job's description and its format so the run's jobs log stays small and readable. */
export function withoutDescription(job: Job): Omit<Job, "description" | "descriptionFormat"> {
    const { description: _description, descriptionFormat: _format, ...rest } = job;
    return rest;
}
