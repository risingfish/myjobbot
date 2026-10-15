import type { GmailConnectionRow, GmailLogin, GmailStore } from "../../src/db/store.js";

export class MemoryGmailStore implements GmailStore {
    private row: GmailConnectionRow | null = null;

    async connection(): Promise<GmailConnectionRow | null> {
        return this.row === null ? null : { ...this.row };
    }

    async connected(login: GmailLogin, at: string): Promise<void> {
        this.row = { email: login.email, app_password: login.sealedPassword, connected_at: at, status: "connected", reason: null };
    }

    async needsReconnect(reason: string): Promise<void> {
        if (this.row !== null) this.row = { ...this.row, status: "needs_reconnect", reason };
    }

    async disconnect(): Promise<void> {
        if (this.row !== null) this.row = { email: null, app_password: null, connected_at: null, status: "none", reason: null };
    }
}
