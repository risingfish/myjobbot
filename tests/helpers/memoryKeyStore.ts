import { challengeExpiry, type ChallengePurpose, type KeyStore, type NewKey, type StoredKey } from "../../src/db/keyStore.js";
import { changeKeepingAWay, upsertMethod, type AuthTables } from "./memoryAuthTables.js";

export class MemoryKeyStore implements KeyStore {
    private readonly stored: StoredKey[] = [];
    private readonly challenges: Array<{ digest: string; purpose: ChallengePurpose; userId: number | null; expiresAt: string; used: boolean }> = [];

    constructor(private readonly tables: AuthTables) {}

    async addKey(userId: number, key: NewKey, now: string): Promise<"ok" | "name_taken" | "credential_taken"> {
        if (this.stored.some((row) => row.userId === userId && row.name === key.name)) return "name_taken";
        if (this.stored.some((row) => row.credentialId === key.credentialId)) return "credential_taken";
        this.stored.push({ ...key, id: this.stored.length + 1, userId });
        upsertMethod(this.tables, { userId, kind: "hardware_key", enabled: true, ready: true, passwordDigest: null, updatedAt: now });
        return "ok";
    }

    async keys(userId: number): Promise<Array<{ id: number; name: string }>> {
        return this.stored.filter((row) => row.userId === userId).map((row) => ({ id: row.id, name: row.name }));
    }

    async keyByCredential(credentialId: string): Promise<StoredKey | null> {
        const row = this.stored.find((key) => key.credentialId === credentialId);
        return row === undefined ? null : { ...row };
    }

    async credentialsOf(userId: number): Promise<Array<{ credentialId: string; transports: string[] }>> {
        return this.stored.filter((row) => row.userId === userId).map((row) => ({ credentialId: row.credentialId, transports: row.transports }));
    }

    async updateCounter(id: number, counter: number): Promise<void> {
        for (const row of this.stored) if (row.id === id) row.counter = counter;
    }

    async removeKey(userId: number, removal: { id: number; mailOn: boolean }, now: string): Promise<"ok" | "last_way"> {
        const lastKey = this.stored.every((row) => row.userId !== userId || row.id === removal.id);
        return changeKeepingAWay(this.tables, userId, {
            change: () => (lastKey ? { kind: "hardware_key", enabled: false, mailOn: removal.mailOn } : null),
            apply: () => {
                const index = this.stored.findIndex((row) => row.userId === userId && row.id === removal.id);
                if (index !== -1) this.stored.splice(index, 1);
                if (lastKey) for (const row of this.tables.methods) if (row.userId === userId && row.kind === "hardware_key") Object.assign(row, { ready: false, updatedAt: now });
            },
        });
    }

    async makeChallenge(digest: string, challenge: { purpose: ChallengePurpose; userId: number | null }, now: string): Promise<void> {
        this.challenges.push({ digest, ...challenge, expiresAt: challengeExpiry(now), used: false });
    }

    async spendChallenge(digest: string, purpose: ChallengePurpose, now: string): Promise<{ userId: number | null } | null> {
        const row = this.challenges.find((challenge) => challenge.digest === digest && challenge.purpose === purpose && !challenge.used && challenge.expiresAt > now);
        if (row === undefined) return null;
        row.used = true;
        return { userId: row.userId };
    }
}
