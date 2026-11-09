import type { Kysely } from "kysely";
import type { RecoveryCodeStore } from "../recoveryCodeStore.js";
import type { Database } from "../schema.js";

export class KyselyRecoveryCodeStore implements RecoveryCodeStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Replaces an account's recovery codes with a new set of digests, in one transaction. */
    async replace(userId: number, digests: string[], now: string): Promise<void> {
        await this.db.transaction().execute(async (trx) => {
            await trx.deleteFrom("recovery_codes").where("user_id", "=", userId).execute();
            if (digests.length > 0)
                await trx
                    .insertInto("recovery_codes")
                    .values(digests.map((digest) => ({ user_id: userId, digest, created_at: now })))
                    .execute();
        });
    }

    /** Spends one of an account's unused recovery codes in the statement that checks it. */
    async spend(userId: number, digest: string, now: string): Promise<boolean> {
        const result = await this.db.updateTable("recovery_codes").set({ used_at: now }).where("user_id", "=", userId).where("digest", "=", digest).where("used_at", "is", null).executeTakeFirst();
        return result.numUpdatedRows === 1n;
    }

    /** Counts an account's unused recovery codes. */
    async left(userId: number): Promise<number> {
        const row = await this.db
            .selectFrom("recovery_codes")
            .select((eb) => eb.fn.countAll<number>().as("count"))
            .where("user_id", "=", userId)
            .where("used_at", "is", null)
            .executeTakeFirstOrThrow();
        return Number(row.count);
    }
}
