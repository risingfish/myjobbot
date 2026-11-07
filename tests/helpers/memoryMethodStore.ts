import { afterChange, allMethods } from "../../src/accounts/methods.js";
import type { MethodChange, MethodRow, MethodStore } from "../../src/db/methodStore.js";
import { changeKeepingAWay, storedWays, upsertMethod, type AuthTables } from "./memoryAuthTables.js";

export class MemoryMethodStore implements MethodStore {
    constructor(private readonly tables: AuthTables) {}

    async passwordDigest(userId: number): Promise<string | null> {
        const row = this.tables.methods.find((method) => method.userId === userId && method.kind === "password" && method.enabled && method.ready);
        return row?.passwordDigest ?? null;
    }

    async methods(userId: number): Promise<MethodRow[]> {
        return allMethods(storedWays(this.tables, userId));
    }

    async setEnabled(userId: number, change: MethodChange, now: string): Promise<"ok" | "last_way"> {
        return changeKeepingAWay(this.tables, userId, {
            change,
            apply: (rows) => {
                const row = afterChange(rows, change).find((method) => method.kind === change.kind);
                const existing = this.tables.methods.find((method) => method.userId === userId && method.kind === change.kind);
                upsertMethod(this.tables, { userId, kind: change.kind, enabled: change.enabled, ready: row?.ready ?? false, passwordDigest: existing?.passwordDigest ?? null, updatedAt: now });
            },
        });
    }

    async setPassword(userId: number, digest: string, now: string): Promise<void> {
        upsertMethod(this.tables, { userId, kind: "password", enabled: true, ready: true, passwordDigest: digest, updatedAt: now });
    }
}
