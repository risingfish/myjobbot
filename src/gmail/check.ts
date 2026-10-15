import { alertQuery, newestFirst, newestUids, summarize, type AlertSummary } from "./alerts.js";
import type { GmailDeps } from "./connection.js";
import { imapApi } from "./imap.js";
import { GmailError } from "./imapErrors.js";
import { openOrNull } from "./seal.js";

export type CheckResult = { ok: true; count: number; newest: AlertSummary[] } | { ok: false; reason: string };

const REJECTED = "app password rejected; create a new one";
const KEY_CHANGED = "server key changed";

/** Counts the job-alert emails of the last 7 days and summarises the newest five, proving the connection works. */
export async function check(deps: GmailDeps, senders: string[]): Promise<CheckResult> {
    const row = await deps.gmail.connection();
    if (row?.status !== "connected" || !row.email || !row.app_password) return { ok: false, reason: "not connected" };
    const password = openOrNull(row.app_password, "app_password", deps.key);
    if (password === null) return needsReconnect(deps, KEY_CHANGED);
    try {
        const found = await (deps.imap ?? imapApi)({ email: row.email, password }).lookup(alertQuery(senders), newestUids);
        return { ok: true, count: found.count, newest: newestFirst(found.envelopes.map(summarize)) };
    } catch (error) {
        if (!(error instanceof GmailError)) throw error;
        return error.code === "bad_login" ? needsReconnect(deps, REJECTED) : { ok: false, reason: error.message };
    }
}

/** Marks the connection as needing a new app password, and reports why. */
async function needsReconnect(deps: GmailDeps, reason: string): Promise<CheckResult> {
    await deps.gmail.needsReconnect(reason);
    return { ok: false, reason };
}
