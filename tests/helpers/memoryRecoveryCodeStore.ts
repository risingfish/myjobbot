import type { RecoveryCodeStore } from "../../src/db/recoveryCodeStore.js";
import type { AuthTables } from "./memoryAuthTables.js";

export class MemoryRecoveryCodeStore implements RecoveryCodeStore {
    constructor(private readonly tables: AuthTables) {}

    async replace(userId: number, digests: string[]): Promise<void> {
        this.tables.recoveryCodes = [...this.tables.recoveryCodes.filter((code) => code.userId !== userId), ...digests.map((digest) => ({ userId, digest, usedAt: null }))];
    }

    async spend(userId: number, digest: string, now: string): Promise<boolean> {
        const row = this.tables.recoveryCodes.find((code) => code.userId === userId && code.digest === digest && code.usedAt === null);
        if (row === undefined) return false;
        row.usedAt = now;
        return true;
    }

    async left(userId: number): Promise<number> {
        return this.tables.recoveryCodes.filter((code) => code.userId === userId && code.usedAt === null).length;
    }
}
