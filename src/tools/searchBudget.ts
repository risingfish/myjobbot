import type { ToolContext } from "./context.js";

const JSEARCH = "jsearch";

/** Returns how many JSearch requests have been made since the start of the current month. */
export async function requestsThisMonth(context: ToolContext): Promise<number> {
    return context.apiCalls.countSince(JSEARCH, startOfMonth(context.now()).toISOString());
}

/** Returns midnight UTC on the first day of the month containing the given date. */
function startOfMonth(now: Date): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
