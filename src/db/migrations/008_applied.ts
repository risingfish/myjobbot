import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

/** Adds whether the owner has applied to each job and when they marked it, leaving every job already stored not applied. */
async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .alterTable("jobs")
        .addColumn("applied", sql`tinyint`, (col) => col.notNull().defaultTo(0))
        .addColumn("applied_on", "varchar(32)")
        .execute();
}

export const applied: Migration = { up };
