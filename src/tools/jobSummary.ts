import type { JobRow } from "../db/jobStore.js";

export function summarizeJob(row: JobRow): Record<string, unknown> {
  return withoutNulls({
    job_id: row.job_id, title: row.title, location: row.location, department: row.department,
    team: row.team, workplace_type: row.workplace_type, is_remote: toBoolean(row.is_remote),
    compensation: row.compensation, posted_at: row.posted_at,
  });
}

function toBoolean(flag: number | null): boolean | null {
  return flag === null ? null : flag === 1;
}

function withoutNulls(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null));
}
