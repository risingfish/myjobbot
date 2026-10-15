import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "../schema.js";
import type { ConnectRequest, GmailConnectionRow, GmailGrant, GmailStore } from "../store.js";

const ROW = 1;
const COLUMNS = ["client_id", "client_secret", "credentials_saved_at", "refresh_token", "email", "connected_at", "status", "reason"] as const;
const EMPTY = { client_id: null, client_secret: null, credentials_saved_at: null, refresh_token: null, email: null, connected_at: null, status: "none", reason: null };

const text = z.string().nullable();
const rowSchema = z.object({
    client_id: text,
    client_secret: text,
    credentials_saved_at: text,
    refresh_token: text,
    email: text,
    connected_at: text,
    status: z.enum(["none", "connected", "needs_reconnect"]),
    reason: text,
});

export class KyselyGmailStore implements GmailStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Returns the stored Gmail connection, or null before any credentials were saved. */
    async connection(): Promise<GmailConnectionRow | null> {
        const row = await this.db.selectFrom("gmail_connection").select(COLUMNS).where("id", "=", ROW).executeTakeFirst();
        return row === undefined ? null : rowSchema.parse(row);
    }

    /** Stores the owner's Google OAuth client, its secret already sealed. */
    async saveCredentials(clientId: string, sealedSecret: string, at: string): Promise<void> {
        const credentials = { client_id: clientId, client_secret: sealedSecret, credentials_saved_at: at };
        await this.db
            .insertInto("gmail_connection")
            .values({ id: ROW, ...credentials })
            .onDuplicateKeyUpdate(credentials)
            .execute();
    }

    /** Forgets the OAuth client and any connection, leaving the panel as if nothing was ever saved. */
    async clearCredentials(): Promise<void> {
        await this.db.updateTable("gmail_connection").set(EMPTY).where("id", "=", ROW).execute();
    }

    /** Records a successful sign-in: the sealed refresh token and the address it belongs to, replacing any earlier one. */
    async connected(grant: GmailGrant, at: string): Promise<void> {
        const values = { refresh_token: grant.sealedToken, email: grant.email, connected_at: at, status: "connected", reason: null };
        await this.db.updateTable("gmail_connection").set(values).where("id", "=", ROW).execute();
    }

    /** Remembers a sign-in the owner started, so Google's return can be matched to it. */
    async addConnectRequest(state: string, sealedVerifier: string, at: string): Promise<void> {
        await this.db.insertInto("gmail_connect_requests").values({ state, code_verifier: sealedVerifier, created_at: at }).execute();
    }

    /** Removes and returns a started sign-in, so each one can be finished only once. */
    async takeConnectRequest(state: string): Promise<ConnectRequest | null> {
        return this.db.transaction().execute(async (trx) => {
            const row = await trx.selectFrom("gmail_connect_requests").select(["code_verifier", "created_at"]).where("state", "=", state).forUpdate().executeTakeFirst();
            if (row === undefined) return null;
            await trx.deleteFrom("gmail_connect_requests").where("state", "=", state).execute();
            return { sealedVerifier: row.code_verifier, createdAt: row.created_at };
        });
    }

    /** Marks the connection as needing the owner to sign in again, keeping the token so a later disconnect can still revoke it. */
    async needsReconnect(reason: string): Promise<void> {
        await this.db.updateTable("gmail_connection").set({ status: "needs_reconnect", reason }).where("id", "=", ROW).execute();
    }

    /** Forgets the connection's token and address, keeping the OAuth client for reconnecting. */
    async disconnect(): Promise<void> {
        const values = { refresh_token: null, email: null, connected_at: null, status: "none", reason: null };
        await this.db.updateTable("gmail_connection").set(values).where("id", "=", ROW).execute();
    }

    /** Forgets sign-ins started before a cutoff, which can no longer be finished. */
    async pruneConnectRequests(before: string): Promise<void> {
        await this.db.deleteFrom("gmail_connect_requests").where("created_at", "<", before).execute();
    }
}
