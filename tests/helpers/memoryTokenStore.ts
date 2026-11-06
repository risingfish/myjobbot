import { CODE_DAYS, daysAfter, type TokenStore } from "../../src/db/tokenStore.js";
import type { AuthTables } from "./memoryAuthTables.js";

export class MemoryTokenStore implements TokenStore {
    constructor(private readonly tables: AuthTables) {}

    async makeCode(digest: string, createdBy: number, now: string): Promise<void> {
        this.tables.codes.push({ digest, createdBy, expiresAt: daysAfter(now, CODE_DAYS), usedBy: null });
    }
}
