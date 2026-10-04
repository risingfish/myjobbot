import type { Job } from "../jobs/job.js";

export function withoutDescription(job: Job): Omit<Job, "description"> {
  const { description: _description, ...rest } = job;
  return rest;
}
