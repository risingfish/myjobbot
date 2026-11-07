import type { Kysely } from "kysely";
import type { AuthenticatorRow, AuthenticatorStore } from "../authenticatorStore.js";
import type { Database } from "../schema.js";
import { changeKeepingAWay } from "./wayLock.js";

export class KyselyAuthenticatorStore implements AuthenticatorStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Returns an account's authenticator: its sealed secret, and whether it is turned on and set up. */
    async authenticator(userId: number): Promise<AuthenticatorRow> {
        const row = await this.db.selectFrom("sign_in_methods").select(["totp_secret", "enabled", "ready"]).where("user_id", "=", userId).where("kind", "=", "authenticator").executeTakeFirst();
        return { sealedSecret: row?.totp_secret ?? null, enabled: row?.enabled === 1, ready: row?.ready === 1 };
    }

    /** Stores an account's sealed authenticator secret, turned on, set up only once a code has confirmed it. */
    async saveAuthenticator(userId: number, app: { sealedSecret: string; ready: boolean }, now: string): Promise<void> {
        const row = { enabled: 1, ready: app.ready ? 1 : 0, totp_secret: app.sealedSecret, updated_at: now };
        await this.db.insertInto("sign_in_methods").values({ user_id: userId, kind: "authenticator", ...row, totp_last_step: null }).onDuplicateKeyUpdate(row).execute();
    }

    /** Removes an account's authenticator, its secret and last step cleared, refusing when it is the last usable way. */
    async removeAuthenticator(userId: number, options: { mailOn: boolean }, now: string): Promise<"ok" | "last_way"> {
        return changeKeepingAWay(this.db, userId, {
            change: { kind: "authenticator", enabled: false, mailOn: options.mailOn },
            apply: async (trx) => {
                await trx.updateTable("sign_in_methods").set({ enabled: 0, ready: 0, totp_secret: null, totp_last_step: null, updated_at: now }).where("user_id", "=", userId).where("kind", "=", "authenticator").execute();
            },
        });
    }

    /** Accepts an authenticator code's step only when it is later than the last one accepted, in one statement, so a code works once. */
    async acceptStep(userId: number, step: number): Promise<boolean> {
        const result = await this.db
            .updateTable("sign_in_methods")
            .set({ totp_last_step: step })
            .where("user_id", "=", userId)
            .where("kind", "=", "authenticator")
            .where((eb) => eb.or([eb("totp_last_step", "is", null), eb("totp_last_step", "<", step)]))
            .executeTakeFirst();
        return result.numUpdatedRows === 1n;
    }
}
