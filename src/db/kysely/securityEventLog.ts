import type { Kysely } from "kysely";
import type { SecurityEventName } from "../../accounts/events.js";
import type { Database } from "../schema.js";
import type { SecurityEvent, SecurityEventLog } from "../securityEventLog.js";

export class KyselySecurityEventLog implements SecurityEventLog {
    constructor(private readonly db: Kysely<Database>) {}

    /** Stores one security event. */
    async record(event: SecurityEvent): Promise<void> {
        await this.db.insertInto("security_events").values({ user_id: event.userId, at: event.at, address: event.address, event: event.event, method: event.method }).execute();
    }

    /** Returns an account's most recent security events, newest first. */
    async recent(userId: number, limit: number): Promise<SecurityEvent[]> {
        const rows = await this.db.selectFrom("security_events").select(["user_id", "at", "address", "event", "method"]).where("user_id", "=", userId).orderBy("at", "desc").orderBy("id", "desc").limit(limit).execute();
        return rows.map((row) => ({ userId: row.user_id, at: row.at, address: row.address, event: row.event as SecurityEventName, method: row.method }));
    }
}
