import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "../schema.js";
import type { GmailConnectionRow, GmailStore } from "../store.js";

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
}
