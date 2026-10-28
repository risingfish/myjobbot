import type { Kysely, Transaction } from "kysely";
import type { Database } from "../schema.js";
import { OWNER_ID, rawSearchSettings, type RawSearchSettings, type SearchSettingsStore } from "../searchSettingsStore.js";

export class KyselySearchSettingsStore implements SearchSettingsStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Returns a user's stored search settings document, or null when none is stored. */
    async load(userId: number): Promise<RawSearchSettings | null> {
        const row = await this.db.selectFrom("user_settings").select("settings").where("user_id", "=", userId).executeTakeFirst();
        return row === undefined ? null : rawSearchSettings.parse(row.settings);
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
export async function ensureOwner(trx: Transaction<Database>, at: string): Promise<void> {
    await trx.insertInto("users").values({ id: OWNER_ID, name: "owner", created_at: at }).onDuplicateKeyUpdate({ id: OWNER_ID }).execute();
}

