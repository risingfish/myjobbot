import type { Kysely } from "kysely";
import type { MethodStore } from "../methodStore.js";
import type { Database } from "../schema.js";

export class KyselyMethodStore implements MethodStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Returns an account's password digest when password sign-in is enabled and set up, else null. */
    async passwordDigest(userId: number): Promise<string | null> {
        const row = await this.db.selectFrom("sign_in_methods").select("password_digest").where("user_id", "=", userId).where("kind", "=", "password").where("enabled", "=", 1).where("ready", "=", 1).executeTakeFirst();
        return row?.password_digest ?? null;
    }

    /** Stores a new password digest, enabling and readying password sign-in. */
    async setPassword(userId: number, digest: string, now: string): Promise<void> {
        const row = { enabled: 1, ready: 1, password_digest: digest, updated_at: now };
        await this.db
            .insertInto("sign_in_methods")
            .values({ user_id: userId, kind: "password", ...row })
            .onDuplicateKeyUpdate(row)
            .execute();
    }
}
