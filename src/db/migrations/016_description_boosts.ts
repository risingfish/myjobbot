import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { withDescriptionBoosts } from "../../config/boostCarryOver.js";
import { settingsDocuments } from "./settingsDocuments.js";

type TablesAtThisStep = {
    user_settings: { user_id: number; settings: unknown; updated_at: string };
};

/** Copies every user's title boosts into a new description boosts list once, so each job's boost stays the same when title boosts start matching titles only. */
async function up(db: Kysely<unknown>): Promise<void> {
    const typed = db.withTables<TablesAtThisStep>();
    for (const { userId, document } of await settingsDocuments(db)) {
        const next = withDescriptionBoosts(document);
        if (next !== null)
            await typed
                .updateTable("user_settings")
                .set({ settings: JSON.stringify(next) })
                .where("user_id", "=", userId)
                .execute();
    }
}

export const descriptionBoosts: Migration = { up };
