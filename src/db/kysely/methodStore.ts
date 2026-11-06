import type { Kysely } from "kysely";
import { afterChange, allMethods, keepsAWay } from "../../accounts/methods.js";
import { METHOD_KINDS, type MethodChange, type MethodKind, type MethodRow, type MethodStore } from "../methodStore.js";
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

    /** Reads the stored ways of an account, through the database or a transaction. */
    private async stored(db: Pick<Kysely<Database>, "selectFrom">, userId: number): Promise<MethodRow[]> {
        const rows = await db.selectFrom("sign_in_methods").select(["kind", "enabled", "ready"]).where("user_id", "=", userId).execute();
        return rows.filter((row) => isKind(row.kind)).map((row) => ({ kind: row.kind as MethodKind, enabled: row.enabled === 1, ready: row.ready === 1 }));
    }
}
