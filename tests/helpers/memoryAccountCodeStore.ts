import { CODE_DAYS, daysAfter, type AccountCodeStore } from "../../src/db/accountCodeStore.js";
import type { AuthTables } from "./memoryAuthTables.js";

export class MemoryAccountCodeStore implements AccountCodeStore {
    constructor(private readonly tables: AuthTables) {}

    async makeCode(digest: string, createdBy: number, now: string): Promise<void> {
        this.tables.codes.push({ digest, createdBy, expiresAt: daysAfter(now, CODE_DAYS), usedBy: null });
    }
}
