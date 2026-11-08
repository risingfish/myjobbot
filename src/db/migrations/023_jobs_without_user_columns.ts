import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const MOVED = ["source_id", "scored_at", "score", "base_score", "bonus_score", "reasons", "gaps", "hidden", "applied", "applied_on"];

/** Drops from postings the columns that became each user's own in step 020, after they were copied, with the key and indexes on them. */
async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable("jobs").dropConstraint("jobs_source_fk").execute();
    await db.schema.dropIndex("jobs_source").on("jobs").execute();
    await db.schema.dropIndex("jobs_by_source").on("jobs").execute();
    for (const column of MOVED) await db.schema.alterTable("jobs").dropColumn(column).execute();
}

export const jobsWithoutUserColumns: Migration = { up };
