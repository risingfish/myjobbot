import type { Job } from "../jobs/job.js";

/** Strips a job's description so the run's jobs log stays small and readable. */
export function withoutDescription(job: Job): Omit<Job, "description"> {
  const { description: _description, ...rest } = job;
  return rest;
}
