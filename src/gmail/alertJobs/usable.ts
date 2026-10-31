import type { GmailConnectionRow } from "../../db/store.js";
import type { SecretKeyStatus } from "../secretKey.js";
import { openOrNull } from "../seal.js";

export const ALERT_NOTES = {
    notConnected: "Gmail not connected",
    needsReconnect: "Gmail needs reconnecting",
    keyMissing: "server key missing",
    keyInvalid: "server key invalid",
    keyChanged: "server key changed",
    unreachable: "Gmail couldn't be reached",
    error: "Gmail error",
} as const;

export type AlertsUsability = { usable: true; email: string; password: string } | { usable: false; note: string };

export class AlertsUnavailable extends Error {
    /** Reports why the Gmail alerts source can't be read this run, by a fixed note. */
    constructor(readonly note: string) {
        super(note);
        this.name = "AlertsUnavailable";
    }
}

/** Reports whether Gmail is connected: signed in once and not disconnected since, even if it now needs reconnecting. */
export function gmailConnected(row: GmailConnectionRow | null): boolean {
    return row !== null && row.status !== "none";
}

/** Decides whether Gmail alerts can be read, from the stored connection and the server key alone. */
export function alertsUsability(row: GmailConnectionRow | null, key: SecretKeyStatus): AlertsUsability {
    if (key.status === "missing") return { usable: false, note: ALERT_NOTES.keyMissing };
    if (key.status === "invalid") return { usable: false, note: ALERT_NOTES.keyInvalid };
    if (row?.status === "needs_reconnect") return { usable: false, note: ALERT_NOTES.needsReconnect };
    if (row?.status !== "connected" || !row.email || !row.app_password) return { usable: false, note: ALERT_NOTES.notConnected };
    const password = openOrNull(row.app_password, "app_password", key.key);
    return password === null ? { usable: false, note: ALERT_NOTES.keyChanged } : { usable: true, email: row.email, password };
}
