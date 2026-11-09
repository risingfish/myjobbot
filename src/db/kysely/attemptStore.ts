import type { Kysely } from "kysely";
import type { AttemptKey, AttemptStore } from "../attemptStore.js";
import type { Database } from "../schema.js";
import { daysBefore } from "../sessionStore.js";

export class KyselyAttemptStore implements AttemptStore {
    constructor(private readonly db: Kysely<Database>) {}

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
