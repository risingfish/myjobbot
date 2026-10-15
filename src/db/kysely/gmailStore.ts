import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "../schema.js";
import type { GmailConnectionRow, GmailLogin, GmailStore } from "../store.js";

const ROW = 1;
const COLUMNS = ["email", "app_password", "connected_at", "status", "reason"] as const;

const text = z.string().nullable();
const rowSchema = z.object({ email: text, app_password: text, connected_at: text, status: z.enum(["none", "connected", "needs_reconnect"]), reason: text });

export class KyselyGmailStore implements GmailStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Returns the stored Gmail connection, or null before Gmail was ever connected. */
    async connection(): Promise<GmailConnectionRow | null> {
        const row = await this.db.selectFrom("gmail_connection").select(COLUMNS).where("id", "=", ROW).executeTakeFirst();
        return row === undefined ? null : rowSchema.parse(row);
    }

    /** Records a verified sign-in: the address and its sealed app password, replacing any earlier connection. */
    async connected(login: GmailLogin, at: string): Promise<void> {
        const values = { email: login.email, app_password: login.sealedPassword, connected_at: at, status: "connected", reason: null };
        await this.db
            .insertInto("gmail_connection")
            .values({ id: ROW, ...values })
            .onDuplicateKeyUpdate(values)
            .execute();
    }

    /** Marks the connection as needing a new app password, keeping the address so the panel can name it. */
    async needsReconnect(reason: string): Promise<void> {
        await this.db.updateTable("gmail_connection").set({ status: "needs_reconnect", reason }).where("id", "=", ROW).execute();
    }

    /** Forgets the address and app password. */
    async disconnect(): Promise<void> {
        const values = { email: null, app_password: null, connected_at: null, status: "none", reason: null };
        await this.db.updateTable("gmail_connection").set(values).where("id", "=", ROW).execute();
    }
}
