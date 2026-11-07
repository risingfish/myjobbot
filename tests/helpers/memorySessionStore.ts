import { daysBefore, SESSION_DAYS, type AttemptKey, type NewSession, type Session, type SessionStore } from "../../src/db/sessionStore.js";
import type { AuthTables } from "./memoryAuthTables.js";

export class MemorySessionStore implements SessionStore {
    constructor(private readonly tables: AuthTables) {}

    async create(session: NewSession): Promise<void> {
        if (this.tables.sessions.some((row) => row.idDigest === session.idDigest)) throw new Error("duplicate id_digest");
        this.tables.sessions.push({ ...session, endedAt: null });
    }

    async find(idDigest: string, now: string): Promise<Session | null> {
        const cutoff = daysBefore(now, SESSION_DAYS);
        const row = this.tables.sessions.find((session) => session.idDigest === idDigest && session.endedAt === null && session.lastUsedAt > cutoff);
        return row === undefined ? null : { ...row };
    }

    async touch(idDigest: string, now: string): Promise<void> {
        for (const session of this.tables.sessions) if (session.idDigest === idDigest) session.lastUsedAt = now;
    }

    async end(idDigest: string, now: string): Promise<void> {
        for (const session of this.tables.sessions) if (session.idDigest === idDigest && session.endedAt === null) session.endedAt = now;
    }

    async endAllFor(userId: number, now: string, exceptDigest?: string): Promise<void> {
        for (const session of this.tables.sessions) if (session.userId === userId && session.endedAt === null && session.idDigest !== exceptDigest) session.endedAt = now;
    }

    async rebindCsrf(idDigest: string, csrfDigest: string): Promise<void> {
        for (const session of this.tables.sessions) if (session.idDigest === idDigest) session.csrfDigest = csrfDigest;
    }

    async pruneEnded(now: string): Promise<void> {
        const cutoff = daysBefore(now, SESSION_DAYS);
        const expired = daysBefore(cutoff, SESSION_DAYS);
        this.tables.sessions = this.tables.sessions.filter((session) => !((session.endedAt !== null && session.endedAt < cutoff) || session.lastUsedAt < expired));
    }

    async recordAttempt(key: AttemptKey, at: string): Promise<void> {
        const dayAgo = daysBefore(at, 1);
        this.tables.attempts = this.tables.attempts.filter((attempt) => attempt.at >= dayAgo);
        this.tables.attempts.push({ ...key, at });
    }

    async activeFor(userId: number, now: string): Promise<Session[]> {
        const cutoff = daysBefore(now, SESSION_DAYS);
        return this.tables.sessions.filter((session) => session.userId === userId && session.endedAt === null && session.lastUsedAt > cutoff).sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt)).map((session) => ({ ...session }));
    }

    async setVerified(idDigest: string, now: string): Promise<void> {
        for (const session of this.tables.sessions) if (session.idDigest === idDigest) session.verifiedAt = now;
    }

    async countAttempts(key: AttemptKey, since: string): Promise<number> {
        return this.tables.attempts.filter((attempt) => attempt.kind === key.kind && attempt.scope === key.scope && attempt.keyDigest === key.keyDigest && attempt.at >= since).length;
    }
}
