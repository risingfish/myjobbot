import type { JobRow } from "../db/jobStore.js";
import { daysBetween } from "../jobs/age.js";
import type { ToolContext } from "./context.js";

/** Builds the compact job fields (title, location, age, possible-ghost flag, etc.) shown to the model. */
export function summarizeJob(context: ToolContext, row: JobRow): Record<string, unknown> {
  const daysOpen = daysBetween(context.store.earliestSeen(row.company, row.normalized_title), context.now());
  return withoutNulls({
    job_id: row.job_id, title: row.title, location: row.location, department: row.department,
    team: row.team, workplace_type: row.workplace_type, is_remote: toBoolean(row.is_remote),
    compensation: row.compensation, posted_at: row.posted_at,
    days_open: daysOpen, possible_ghost: daysOpen > context.config.ghost_threshold_days,
  });
}

/** Converts the stored 0/1/null remote flag into a boolean or null. */
function toBoolean(flag: number | null): boolean | null {
  return flag === null ? null : flag === 1;
}

/** Drops null-valued fields from a record before it's returned to the model. */
function withoutNulls(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null));
}
