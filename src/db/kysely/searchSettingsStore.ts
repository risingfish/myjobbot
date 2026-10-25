import type { Kysely, Transaction } from "kysely";
import { withRetry } from "../retry.js";
import type { Database } from "../schema.js";
import { OWNER_ID, rawSearchSettings, type RawSearchSettings, type SearchSettingsStore } from "../searchSettingsStore.js";

const IMPORT_RETRY = { tries: 2, delayMs: 100 };

export class KyselySearchSettingsStore implements SearchSettingsStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Returns a user's stored search settings document, or null when none is stored. */
    async load(userId: number): Promise<RawSearchSettings | null> {
        const row = await this.db.selectFrom("user_settings").select("settings").where("user_id", "=", userId).executeTakeFirst();
        return row === undefined ? null : rawSearchSettings.parse(row.settings);
    }

    /** Stores the owner's search settings unless some are already stored, reporting whether it stored them. */
    async importIfAbsent(settings: RawSearchSettings, at: string): Promise<boolean> {
        return withRetry(() => this.db.transaction().execute((trx) => insertOwnerSettings(trx, settings, at)), IMPORT_RETRY);
    }

    /** Replaces a user's whole stored search settings document, creating the owner first when the owner's are saved; any other user must already exist. */
    async save(userId: number, settings: RawSearchSettings, at: string): Promise<void> {
        const row = { user_id: userId, settings: JSON.stringify(settings), updated_at: at };
        await this.db.transaction().execute(async (trx) => {
            if (userId === OWNER_ID) await ensureOwner(trx, at);
            await trx.insertInto("user_settings").values(row).onDuplicateKeyUpdate({ settings: row.settings, updated_at: at }).execute();
        });
    }
}

/** Creates the owner's user row unless it exists. */
async function ensureOwner(trx: Transaction<Database>, at: string): Promise<void> {
    await trx.insertInto("users").values({ id: OWNER_ID, name: "owner", created_at: at }).onDuplicateKeyUpdate({ id: OWNER_ID }).execute();
}

/** Creates the owner if missing, then inserts the owner's settings unless a row exists, reporting whether it inserted one. */
async function insertOwnerSettings(trx: Transaction<Database>, settings: RawSearchSettings, at: string): Promise<boolean> {
    await ensureOwner(trx, at);
    const result = await trx.insertInto("user_settings").values({ user_id: OWNER_ID, settings: JSON.stringify(settings), updated_at: at }).ignore().executeTakeFirst();
    return result.numInsertedOrUpdatedRows === 1n;
}
