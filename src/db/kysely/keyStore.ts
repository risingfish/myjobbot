import type { Kysely, Selectable } from "kysely";
import { allMethods, keepsAWay } from "../../accounts/methods.js";
import { challengeExpiry, type ChallengePurpose, type KeyStore, type NewKey, type StoredKey } from "../keyStore.js";
import type { MethodRow } from "../methodStore.js";
import type { Database } from "../schema.js";
import type { HardwareKeysTable } from "../schema/accounts.js";

/** Says whether a failed insert broke a unique index, and which one. */
function duplicateOf(error: unknown): "name_taken" | "credential_taken" | null {
    const found = error as { code?: unknown; message?: unknown } | null;
    if (found?.code !== "ER_DUP_ENTRY") return null;
    return String(found.message).includes("hardware_keys_user_name") ? "name_taken" : "credential_taken";
}

export class KyselyKeyStore implements KeyStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Adds a hardware key under its name, turning the way on and set up; a repeated name or credential is refused by the unique indexes. */
    async addKey(userId: number, key: NewKey, now: string): Promise<"ok" | "name_taken" | "credential_taken"> {
        try {
            await this.db.transaction().execute(async (trx) => {
                await trx.insertInto("hardware_keys").values({ user_id: userId, name: key.name, credential_id: key.credentialId, public_key: key.publicKey, counter: key.counter, transports: JSON.stringify(key.transports), created_at: now }).execute();
                const row = { enabled: 1, ready: 1, updated_at: now };
                await trx.insertInto("sign_in_methods").values({ user_id: userId, kind: "hardware_key", ...row }).onDuplicateKeyUpdate(row).execute();
            });
            return "ok";
        } catch (error) {
            const duplicate = duplicateOf(error);
            if (duplicate === null) throw error;
            return duplicate;
        }
    }

    /** Lists an account's keys by name only. */
    async keys(userId: number): Promise<Array<{ id: number; name: string }>> {
        return this.db.selectFrom("hardware_keys").select(["id", "name"]).where("user_id", "=", userId).orderBy("id").execute();
    }

    /** Finds a key by the credential a browser answered with. */
    async keyByCredential(credentialId: string): Promise<StoredKey | null> {
        const row = await this.db.selectFrom("hardware_keys").selectAll().where("credential_id", "=", credentialId).executeTakeFirst();
        return row === undefined ? null : fromRow(row);
    }

    /** Lists an account's key credentials, so a browser won't register the same key twice. */
    async credentialsOf(userId: number): Promise<Array<{ credentialId: string; transports: string[] }>> {
        const rows = await this.db.selectFrom("hardware_keys").select(["credential_id", "transports"]).where("user_id", "=", userId).execute();
        return rows.map((row) => ({ credentialId: row.credential_id, transports: JSON.parse(row.transports ?? "[]") as string[] }));
    }

    /** Stores a key's new signature counter and when it was last used. */
    async updateCounter(id: number, counter: number, now: string): Promise<void> {
        await this.db.updateTable("hardware_keys").set({ counter, last_used_at: now }).where("id", "=", id).execute();
    }

    /** Deletes one of an account's keys, turning the way's setup off with the last one, never when that would leave no usable way. */
    async removeKey(userId: number, removal: { id: number; mailOn: boolean }, now: string): Promise<"ok" | "last_way"> {
        return this.db.transaction().execute(async (trx) => {
            await trx.selectFrom("users").select("id").where("id", "=", userId).forUpdate().execute();
            const left = (await trx.selectFrom("hardware_keys").select("id").where("user_id", "=", userId).execute()).filter((row) => row.id !== removal.id);
            const methods = (await trx.selectFrom("sign_in_methods").select(["kind", "enabled", "ready"]).where("user_id", "=", userId).execute()).map((row) => ({ kind: row.kind, enabled: row.enabled === 1, ready: row.ready === 1 }) as MethodRow);
            if (left.length === 0 && !keepsAWay(allMethods(methods), { kind: "hardware_key", enabled: false, mailOn: removal.mailOn })) return "last_way";
            await trx.deleteFrom("hardware_keys").where("user_id", "=", userId).where("id", "=", removal.id).execute();
            if (left.length === 0) await trx.updateTable("sign_in_methods").set({ ready: 0, updated_at: now }).where("user_id", "=", userId).where("kind", "=", "hardware_key").execute();
            return "ok";
        });
    }

    /** Stores a key challenge by its digest, working once for 5 minutes. */
    async makeChallenge(digest: string, challenge: { purpose: ChallengePurpose; userId: number | null }, now: string): Promise<void> {
        await this.db.insertInto("auth_challenges").values({ digest, purpose: challenge.purpose, user_id: challenge.userId, expires_at: challengeExpiry(now) }).execute();
    }

    /** Spends an unexpired challenge of a purpose in the statement that checks it, giving the account it was made for. */
    async spendChallenge(digest: string, purpose: ChallengePurpose, now: string): Promise<{ userId: number | null } | null> {
        const result = await this.db.updateTable("auth_challenges").set({ used_at: now }).where("digest", "=", digest).where("purpose", "=", purpose).where("used_at", "is", null).where("expires_at", ">", now).executeTakeFirst();
        if (result.numUpdatedRows !== 1n) return null;
        const row = await this.db.selectFrom("auth_challenges").select("user_id").where("digest", "=", digest).executeTakeFirstOrThrow();
        return { userId: row.user_id };
    }
}

/** Turns a stored key row into a key. */
function fromRow(row: Selectable<HardwareKeysTable>): StoredKey {
    return { id: row.id, userId: row.user_id, name: row.name, credentialId: row.credential_id, publicKey: row.public_key, counter: Number(row.counter), transports: JSON.parse(row.transports ?? "[]") as string[] };
}
