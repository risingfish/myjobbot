import type { AttemptKey, AttemptStore } from "../../src/db/attemptStore.js";
import { daysBefore } from "../../src/db/sessionStore.js";
import type { AuthTables } from "./memoryAuthTables.js";

export class MemoryAttemptStore implements AttemptStore {
    constructor(private readonly tables: AuthTables) {}

    async recordAttempt(key: AttemptKey, at: string): Promise<void> {
        const dayAgo = daysBefore(at, 1);
        this.tables.attempts = this.tables.attempts.filter((attempt) => attempt.at >= dayAgo);
        this.tables.attempts.push({ ...key, at });
    }

    async countAttempts(key: AttemptKey, since: string): Promise<number> {
        return this.tables.attempts.filter((attempt) => attempt.kind === key.kind && attempt.scope === key.scope && attempt.keyDigest === key.keyDigest && attempt.at >= since).length;
    }
}
