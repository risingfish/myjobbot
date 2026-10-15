import type { GmailConnectionRow, GmailStore } from "../../src/db/store.js";

const EMPTY: GmailConnectionRow = { client_id: null, client_secret: null, credentials_saved_at: null, refresh_token: null, email: null, connected_at: null, status: "none", reason: null };

export class MemoryGmailStore implements GmailStore {
    private row: GmailConnectionRow | null = null;

    async connection(): Promise<GmailConnectionRow | null> {
        return this.row === null ? null : { ...this.row };
    }

    async saveCredentials(clientId: string, sealedSecret: string, at: string): Promise<void> {
        this.row = { ...(this.row ?? EMPTY), client_id: clientId, client_secret: sealedSecret, credentials_saved_at: at };
    }

    async clearCredentials(): Promise<void> {
        if (this.row !== null) this.row = { ...EMPTY };
    }
}
