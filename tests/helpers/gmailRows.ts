import type { GmailConnectionRow } from "../../src/db/store.js";

export function gmailRow(overrides: Partial<GmailConnectionRow> = {}): GmailConnectionRow {
    return { email: "me@example.com", app_password: "v1.sealed", connected_at: "2026-10-15T20:00:00.000Z", status: "connected", reason: null, ...overrides };
}
