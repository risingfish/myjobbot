import type { Kysely } from "kysely";
import { afterChange, allMethods, keepsAWay } from "../../accounts/methods.js";
import { METHOD_KINDS, type AuthenticatorRow, type MethodChange, type MethodKind, type MethodRow, type MethodStore } from "../methodStore.js";
import type { Database } from "../schema.js";

/** Says whether a stored kind is one of the four ways. */
function isKind(kind: string): kind is MethodKind {
    return (METHOD_KINDS as readonly string[]).includes(kind);
}

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

    /** Returns an account's four ways of signing in, each enabled or not and set up or not. */
    async methods(userId: number): Promise<MethodRow[]> {
        return allMethods(await this.stored(this.db, userId));
    }

    /** Switches a way on or off, refusing, with the account's row locked, a change that would leave no usable way. */
    async setEnabled(userId: number, change: MethodChange, now: string): Promise<"ok" | "last_way"> {
        return this.db.transaction().execute(async (trx) => {
            await trx.selectFrom("users").select("id").where("id", "=", userId).forUpdate().execute();
            const rows = allMethods(await this.stored(trx, userId));
            if (!keepsAWay(rows, change)) return "last_way";
            const row = afterChange(rows, change).find((method) => method.kind === change.kind);
            const values = { enabled: change.enabled ? 1 : 0, ready: row?.ready ? 1 : 0, updated_at: now };
            await trx.insertInto("sign_in_methods").values({ user_id: userId, kind: change.kind, ...values }).onDuplicateKeyUpdate(values).execute();
            return "ok";
        });
    }

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
        return this.db.transaction().execute(async (trx) => {
            await trx.selectFrom("users").select("id").where("id", "=", userId).forUpdate().execute();
            if (!keepsAWay(allMethods(await this.stored(trx, userId)), { kind: "authenticator", enabled: false, mailOn: options.mailOn })) return "last_way";
            await trx.updateTable("sign_in_methods").set({ enabled: 0, ready: 0, totp_secret: null, totp_last_step: null, updated_at: now }).where("user_id", "=", userId).where("kind", "=", "authenticator").execute();
            return "ok";
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

    /** Reads the stored ways of an account, through the database or a transaction. */
    private async stored(db: Pick<Kysely<Database>, "selectFrom">, userId: number): Promise<MethodRow[]> {
        const rows = await db.selectFrom("sign_in_methods").select(["kind", "enabled", "ready"]).where("user_id", "=", userId).execute();
        return rows.filter((row) => isKind(row.kind)).map((row) => ({ kind: row.kind as MethodKind, enabled: row.enabled === 1, ready: row.ready === 1 }));
    }
}
