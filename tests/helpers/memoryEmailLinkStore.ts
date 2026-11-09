import { boundToSession, linkExpiry, type EmailLinkStore, type NewEmailToken, type SpentToken, type TokenLookup, type TokenSpend } from "../../src/db/emailLinkStore.js";
import type { AuthTables } from "./memoryAuthTables.js";

export class MemoryEmailLinkStore implements EmailLinkStore {
    constructor(private readonly tables: AuthTables) {}

    async make(userId: number, token: NewEmailToken, now: string): Promise<void> {
        for (const row of this.tables.emailTokens) if (row.userId === userId && row.purpose === token.purpose && row.usedAt === null) row.usedAt = now;
        this.tables.emailTokens.push({ digest: token.digest, userId, purpose: token.purpose, newEmail: token.newEmail ?? null, sessionDigest: token.sessionDigest ?? null, returnPath: token.returnPath ?? null, expiresAt: linkExpiry(token.purpose, now), usedAt: null });
    }

    async spend(spend: TokenSpend, now: string): Promise<SpentToken | null> {
        const row = this.tables.emailTokens.find((token) => token.digest === spend.digest && token.purpose === spend.purpose && token.usedAt === null && token.expiresAt > now && (!boundToSession(spend.purpose) || token.sessionDigest === (spend.sessionDigest ?? "")));
        if (row === undefined) return null;
        row.usedAt = now;
        return { userId: row.userId, newEmail: row.newEmail, returnPath: row.returnPath };
    }

    async lookup(digest: string, now: string): Promise<TokenLookup | null> {
        const row = this.tables.emailTokens.find((token) => token.digest === digest);
        return row === undefined ? null : { purpose: row.purpose, sessionDigest: row.sessionDigest, live: row.usedAt === null && row.expiresAt > now };
    }
}
