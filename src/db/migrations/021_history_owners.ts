import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

/** Gives every verdict and re-score run a user, the owner (user 1) for those stored so far. */
async function up(db: Kysely<unknown>): Promise<void> {
    for (const table of ["verdicts", "rescore_runs"]) {
        await db.schema.alterTable(table).addColumn("user_id", "integer", (col) => col.notNull().defaultTo(1)).execute();
        await db.schema.alterTable(table).alterColumn("user_id", (col) => col.dropDefault()).execute();
        await db.schema.alterTable(table).addForeignKeyConstraint(`${table}_user_fk`, ["user_id"], "users", ["id"]).execute();
    }
    await db.schema.createIndex("verdicts_by_user_job").on("verdicts").columns(["user_id", "ats", "job_id", "scored_at"]).execute();
}

export const historyOwners: Migration = { up };
