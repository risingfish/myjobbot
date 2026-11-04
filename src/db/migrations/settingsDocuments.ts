import type { Kysely } from "kysely";
import { z } from "zod";

type SettingsTable = {
    user_settings: { user_id: number; settings: unknown; updated_at: string };
};

interface StoredDocument {
    userId: number;
    document: Record<string, unknown>;
}

const settingsDocument = z.record(z.string(), z.unknown());

/** Reads every user's stored search settings document, in user order, for a data step that rewrites them. */
export async function settingsDocuments(db: Kysely<unknown>): Promise<StoredDocument[]> {
    const rows = await db.withTables<SettingsTable>().selectFrom("user_settings").select(["user_id", "settings"]).orderBy("user_id").execute();
    return rows.map((row) => ({ userId: row.user_id, document: settingsDocument.parse(row.settings) }));
}
