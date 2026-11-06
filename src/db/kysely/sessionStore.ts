import type { Kysely, Selectable } from "kysely";
import type { Database } from "../schema.js";
import type { SessionsTable } from "../schema/accounts.js";
import { daysBefore, SESSION_DAYS, type AttemptKey, type NewSession, type Session, type SessionStore } from "../sessionStore.js";

export class KyselySessionStore implements SessionStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Stores a new sign-in. */
    async create(session: NewSession): Promise<void> {
        await this.db
            .insertInto("sessions")
            .values({ id_digest: session.idDigest, user_id: session.userId, csrf_digest: session.csrfDigest, created_at: session.createdAt, last_used_at: session.lastUsedAt, verified_at: session.verifiedAt, address: session.address })
            .execute();
    }

    /** Returns a sign-in that hasn't ended and was used within its lifetime, or null. */
    async find(idDigest: string, now: string): Promise<Session | null> {
        const row = await this.db
            .selectFrom("sessions")
            .selectAll()
            .where("id_digest", "=", idDigest)
            .where("ended_at", "is", null)
            .where("last_used_at", ">", daysBefore(now, SESSION_DAYS))
            .executeTakeFirst();
        return row === undefined ? null : fromRow(row);
    }

    /** Records that a sign-in was just used. */
    async touch(idDigest: string, now: string): Promise<void> {
        await this.db.updateTable("sessions").set({ last_used_at: now }).where("id_digest", "=", idDigest).execute();
    }

    /** Ends one sign-in. */
    async end(idDigest: string, now: string): Promise<void> {
        await this.db.updateTable("sessions").set({ ended_at: now }).where("id_digest", "=", idDigest).where("ended_at", "is", null).execute();
    }

    /** Ends every sign-in of an account, except the one named. */
    async endAllFor(userId: number, now: string, exceptDigest?: string): Promise<void> {
        let query = this.db.updateTable("sessions").set({ ended_at: now }).where("user_id", "=", userId).where("ended_at", "is", null);
        if (exceptDigest !== undefined) query = query.where("id_digest", "<>", exceptDigest);
        await query.execute();
    }

    /** Ties a sign-in to a new cross-site request forgery cookie. */
    async rebindCsrf(idDigest: string, csrfDigest: string): Promise<void> {
        await this.db.updateTable("sessions").set({ csrf_digest: csrfDigest }).where("id_digest", "=", idDigest).execute();
    }

    /** Deletes sign-ins that ended or expired more than their lifetime ago. */
    async pruneEnded(now: string): Promise<void> {
        const cutoff = daysBefore(now, SESSION_DAYS);
        await this.db
            .deleteFrom("sessions")
            .where((eb) => eb.or([eb("ended_at", "<", cutoff), eb("last_used_at", "<", daysBefore(cutoff, SESSION_DAYS))]))
            .execute();
    }

    /** Records one attempt, deleting attempts older than a day. */
    async recordAttempt(key: AttemptKey, at: string): Promise<void> {
        await this.db.deleteFrom("auth_attempts").where("at", "<", daysBefore(at, 1)).execute();
        await this.db.insertInto("auth_attempts").values({ kind: key.kind, scope: key.scope, key_digest: key.keyDigest, at }).execute();
    }

    /** Counts the attempts of one kind and key since a time. */
    async countAttempts(key: AttemptKey, since: string): Promise<number> {
        const row = await this.db
            .selectFrom("auth_attempts")
            .select((eb) => eb.fn.countAll<number>().as("count"))
            .where("kind", "=", key.kind)
            .where("scope", "=", key.scope)
            .where("key_digest", "=", key.keyDigest)
            .where("at", ">=", since)
            .executeTakeFirstOrThrow();
        return Number(row.count);
    }
}

/** Turns a stored sign-in row into a session. */
function fromRow(row: Selectable<SessionsTable>): Session {
    return { idDigest: row.id_digest, userId: row.user_id, csrfDigest: row.csrf_digest, createdAt: row.created_at, lastUsedAt: row.last_used_at, verifiedAt: row.verified_at, endedAt: row.ended_at, address: row.address };
}
