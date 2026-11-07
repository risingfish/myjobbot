import { CODE_DAYS, daysAfter, linkExpiry, type NewEmailToken, type SpentToken, type TokenLookup, type TokenSpend, type TokenStore } from "../../src/db/tokenStore.js";
import type { AuthTables } from "./memoryAuthTables.js";

export class MemoryTokenStore implements TokenStore {
    constructor(private readonly tables: AuthTables) {}

    async makeCode(digest: string, createdBy: number, now: string): Promise<void> {
        this.tables.codes.push({ digest, createdBy, expiresAt: daysAfter(now, CODE_DAYS), usedBy: null });
    }

    async makeEmailToken(userId: number, token: NewEmailToken, now: string): Promise<void> {
        for (const row of this.tables.emailTokens) if (row.userId === userId && row.purpose === token.purpose && row.usedAt === null) row.usedAt = now;
        this.tables.emailTokens.push({ digest: token.digest, userId, purpose: token.purpose, newEmail: token.newEmail ?? null, sessionDigest: token.sessionDigest ?? null, returnPath: token.returnPath ?? null, expiresAt: linkExpiry(token.purpose, now), usedAt: null });
    }

    async spendEmailToken(spend: TokenSpend, now: string): Promise<SpentToken | null> {
        const row = this.tables.emailTokens.find((token) => token.digest === spend.digest && token.purpose === spend.purpose && token.usedAt === null && token.expiresAt > now && (spend.purpose !== "step_up" || token.sessionDigest === (spend.sessionDigest ?? "")));
        if (row === undefined) return null;
        row.usedAt = now;
        return { userId: row.userId, newEmail: row.newEmail, returnPath: row.returnPath };
    }

    async replaceRecoveryCodes(userId: number, digests: string[]): Promise<void> {
        this.tables.recoveryCodes = [...this.tables.recoveryCodes.filter((code) => code.userId !== userId), ...digests.map((digest) => ({ userId, digest, usedAt: null }))];
    }

    async spendRecoveryCode(userId: number, digest: string, now: string): Promise<boolean> {
        const row = this.tables.recoveryCodes.find((code) => code.userId === userId && code.digest === digest && code.usedAt === null);
        if (row === undefined) return false;
        row.usedAt = now;
        return true;
    }

    async recoveryCodesLeft(userId: number): Promise<number> {
        return this.tables.recoveryCodes.filter((code) => code.userId === userId && code.usedAt === null).length;
    }

    async emailTokenFor(digest: string, now: string): Promise<TokenLookup | null> {
        const row = this.tables.emailTokens.find((token) => token.digest === digest);
        return row === undefined ? null : { purpose: row.purpose, sessionDigest: row.sessionDigest, live: row.usedAt === null && row.expiresAt > now };
    }
}
