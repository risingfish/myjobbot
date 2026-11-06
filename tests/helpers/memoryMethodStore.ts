import type { MethodStore } from "../../src/db/methodStore.js";
import { upsertMethod, type AuthTables } from "./memoryAuthTables.js";

export class MemoryMethodStore implements MethodStore {
    constructor(private readonly tables: AuthTables) {}

    async passwordDigest(userId: number): Promise<string | null> {
        const row = this.tables.methods.find((method) => method.userId === userId && method.kind === "password" && method.enabled && method.ready);
        return row?.passwordDigest ?? null;
    }

    async setPassword(userId: number, digest: string, now: string): Promise<void> {
        upsertMethod(this.tables, { userId, kind: "password", enabled: true, ready: true, passwordDigest: digest, updatedAt: now });
    }
}
