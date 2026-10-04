import type { ToolContext } from "./context.js";

const JSEARCH = "jsearch";
const MS_PER_HOUR = 3_600_000;

export function refreshBlocker(context: ToolContext, sourceName: string): string | null {
  const used = requestsThisMonth(context);
  const cap = context.config.jsearch.monthly_request_cap;
  if (used >= cap) return `monthly JSearch budget used (${used}/${cap})`;
  return tooRecent(context, sourceName);
}

export function requestsThisMonth(context: ToolContext): number {
  return context.apiCalls.countSince(JSEARCH, startOfMonth(context.now()).toISOString());
}

function tooRecent(context: ToolContext, sourceName: string): string | null {
  const last = context.apiCalls.lastCallAt(JSEARCH, sourceName);
  if (!last) return null;
  const ageHours = (context.now().getTime() - Date.parse(last)) / MS_PER_HOUR;
  const refreshHours = context.config.jsearch.refresh_hours;
  if (ageHours >= refreshHours) return null;
  return `refreshed ${Math.floor(ageHours)}h ago; next refresh in ${Math.ceil(refreshHours - ageHours)}h`;
}

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
