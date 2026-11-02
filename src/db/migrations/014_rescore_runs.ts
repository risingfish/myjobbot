import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const TABLE_OPTIONS = sql`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

/** Adds each re-score's run, with its outcome, and the steps it logged as it ran, removed with their run. */
async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("rescore_runs")
        .addColumn("id", "varchar(36)", (col) => col.primaryKey())
        .addColumn("ats", "varchar(32)", (col) => col.notNull())
        .addColumn("job_id", "varchar(255)", (col) => col.notNull())
        .addColumn("started_at", "varchar(32)", (col) => col.notNull())
        .addColumn("ended_at", "varchar(32)")
        .addColumn("outcome", "varchar(16)")
        .addColumn("filter", "varchar(16)")
        .addColumn("score", "integer")
        .modifyEnd(TABLE_OPTIONS)
        .execute();
    await db.schema.createIndex("rescore_runs_job").on("rescore_runs").columns(["ats", "job_id", "started_at"]).execute();
    await createSteps(db);
}

/** Creates the steps table, one row per logged step, numbered within its run. */
async function createSteps(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("rescore_steps")
        .addColumn("run_id", "varchar(36)", (col) => col.notNull())
        .addColumn("seq", "integer", (col) => col.notNull())
        .addColumn("elapsed_ms", "integer", (col) => col.notNull())
        .addColumn("kind", "varchar(24)", (col) => col.notNull())
        .addColumn("fields", "text", (col) => col.notNull())
        .addPrimaryKeyConstraint("rescore_steps_pk", ["run_id", "seq"])
        .addForeignKeyConstraint("rescore_steps_run_fk", ["run_id"], "rescore_runs", ["id"], (fk) => fk.onDelete("cascade"))
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

export const rescoreRuns: Migration = { up };
