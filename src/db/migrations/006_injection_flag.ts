import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

/** Adds when a job's outside text was first found carrying a forged data marker, so the web UI can flag the job. */
async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable("jobs").addColumn("injection_seen_at", "varchar(32)").execute();
}

export const injectionFlag: Migration = { up };
