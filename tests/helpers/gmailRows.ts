import type { GmailConnectionRow } from "../../src/db/store.js";

export function gmailRow(overrides: Partial<GmailConnectionRow> = {}): GmailConnectionRow {
    return { client_id: "client-1", client_secret: "v1.sealed", credentials_saved_at: "2026-10-15T12:00:00.000Z", refresh_token: null, email: null, connected_at: null, status: "none", reason: null, ...overrides };
}
