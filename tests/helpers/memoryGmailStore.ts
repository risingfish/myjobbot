import type { ConnectRequest, GmailConnectionRow, GmailGrant, GmailStore } from "../../src/db/store.js";

const EMPTY: GmailConnectionRow = { client_id: null, client_secret: null, credentials_saved_at: null, refresh_token: null, email: null, connected_at: null, status: "none", reason: null };

export class MemoryGmailStore implements GmailStore {
    private row: GmailConnectionRow | null = null;
    private readonly requests = new Map<string, ConnectRequest>();

    async connection(): Promise<GmailConnectionRow | null> {
        return this.row === null ? null : { ...this.row };
    }

    async saveCredentials(clientId: string, sealedSecret: string, at: string): Promise<void> {
        this.row = { ...(this.row ?? EMPTY), client_id: clientId, client_secret: sealedSecret, credentials_saved_at: at };
    }

    async clearCredentials(): Promise<void> {
        if (this.row !== null) this.row = { ...EMPTY };
    }

    async connected(grant: GmailGrant, at: string): Promise<void> {
        if (this.row !== null) this.row = { ...this.row, refresh_token: grant.sealedToken, email: grant.email, connected_at: at, status: "connected", reason: null };
    }

    async needsReconnect(reason: string): Promise<void> {
        if (this.row !== null) this.row = { ...this.row, status: "needs_reconnect", reason };
    }

    async disconnect(): Promise<void> {
        if (this.row !== null) this.row = { ...this.row, refresh_token: null, email: null, connected_at: null, status: "none", reason: null };
    }

    async addConnectRequest(state: string, sealedVerifier: string, at: string): Promise<void> {
        this.requests.set(state, { sealedVerifier, createdAt: at });
    }

    async takeConnectRequest(state: string): Promise<ConnectRequest | null> {
        const request = this.requests.get(state) ?? null;
        this.requests.delete(state);
        return request;
    }

    async pruneConnectRequests(before: string): Promise<void> {
        for (const [state, request] of this.requests) if (request.createdAt < before) this.requests.delete(state);
    }
}
