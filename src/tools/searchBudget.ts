import { REFRESH_GRACE_HOURS } from "../config/schema.js";
import type { ToolContext } from "./context.js";

const JSEARCH = "jsearch";
const MS_PER_HOUR = 3_600_000;

/** Reports why a JSearch search can't refresh now (monthly cap hit or refreshed too recently), or null. */
export function refreshBlocker(context: ToolContext, sourceName: string): string | null {
  const used = requestsThisMonth(context);
  const cap = context.config.jsearch.monthly_request_cap;
  if (used >= cap) return `monthly JSearch budget used (${used}/${cap})`;
  return tooRecent(context, sourceName);
}

/** Returns how many JSearch requests have been made since the start of the current month. */
export function requestsThisMonth(context: ToolContext): number {
  return context.apiCalls.countSince(JSEARCH, startOfMonth(context.now()).toISOString());
}

/** Reports why a search was refreshed too recently to refresh again, or null once enough time has passed. */
function tooRecent(context: ToolContext, sourceName: string): string | null {
  const last = context.apiCalls.lastCallAt(JSEARCH, sourceName);
  if (!last) return null;
  const ageHours = (context.now().getTime() - Date.parse(last)) / MS_PER_HOUR;
  const refreshHours = context.config.jsearch.refresh_hours;
  if (ageHours >= refreshHours - REFRESH_GRACE_HOURS) return null;
  return `refreshed ${Math.floor(ageHours)}h ago; next refresh in ${Math.ceil(refreshHours - ageHours)}h`;
}

/** Returns midnight UTC on the first day of the month containing the given date. */
function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
