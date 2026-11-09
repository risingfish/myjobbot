import type { SecurityEvent, SecurityEventLog } from "../../src/db/securityEventLog.js";
import type { AuthTables } from "./memoryAuthTables.js";

export class MemorySecurityEventLog implements SecurityEventLog {
    constructor(private readonly tables: AuthTables) {}

    async record(event: SecurityEvent): Promise<void> {
        this.tables.events.push({ ...event });
    }

    async recent(userId: number, limit: number): Promise<SecurityEvent[]> {
        return this.tables.events
            .filter((event) => event.userId === userId)
            .map((event, index) => ({ event, index }))
            .sort((a, b) => b.event.at.localeCompare(a.event.at) || b.index - a.index)
            .slice(0, limit)
            .map(({ event }) => ({ ...event }));
    }
}
