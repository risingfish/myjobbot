import { clientFor, openOrNull } from "./access.js";
import { alertQuery, newestFirst, summarize, type AlertSummary } from "./alerts.js";
import type { GmailDeps } from "./connection.js";
import type { GoogleApi } from "./google.js";
import { GoogleError } from "./googleErrors.js";

export type CheckResult = { ok: true; count: number; newest: AlertSummary[] } | { ok: false; reason: string };

const NEWEST = 5;
const MAX_PAGES = 20;
const REVOKED = "access revoked or expired";
const KEY_CHANGED = "server key changed";

/** Counts the job-alert emails of the last 7 days and summarises the newest five, proving the connection works. */
export async function check(deps: GmailDeps, senders: string[]): Promise<CheckResult> {
    const row = await deps.gmail.connection();
    if (row?.status !== "connected" || !row.refresh_token) return { ok: false, reason: "not connected" };
    const token = openOrNull(row.refresh_token, "refresh_token", deps.key);
    const api = await clientFor(deps, "localhost");
    if (token === null || typeof api === "string") return needsReconnect(deps, KEY_CHANGED);
    try {
        const ids = await allIds(api, { token, query: alertQuery(senders) });
        const newest = await Promise.all(ids.slice(0, NEWEST).map(async (id) => summarize(await api.messageHeaders(token, id))));
        return { ok: true, count: ids.length, newest: newestFirst(newest) };
    } catch (error) {
        if (!(error instanceof GoogleError)) throw error;
        return error.code === "invalid_grant" ? needsReconnect(deps, REVOKED) : { ok: false, reason: "Gmail could not be reached; try again." };
    }
}

/** Collects every matching message id, page by page, up to a safety limit. */
async function allIds(api: GoogleApi, search: { token: string; query: string }): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await api.messagePage(search.token, search.query, pageToken);
        ids.push(...result.ids);
        pageToken = result.next;
        if (pageToken === null) break;
    }
    return ids;
}

/** Marks the connection as needing the owner to sign in again, and reports why. */
async function needsReconnect(deps: GmailDeps, reason: string): Promise<CheckResult> {
    await deps.gmail.needsReconnect(reason);
    return { ok: false, reason };
}
