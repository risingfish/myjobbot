import { sql, type CreateTableBuilder, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const TABLE_OPTIONS = sql`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

const OWNER = 1;

const COPIED = ["ats", "job_id", "source_id", "source", "first_seen", "last_seen", "scored_at", "score", "base_score", "bonus_score", "reasons", "gaps", "hidden", "applied", "applied_on"] as const;

type JobsAtThisStep = {
    users: { id: number; name: string; created_at: string };
    jobs: { ats: string; job_id: string; source_id: number | null; source: string; first_seen: string; last_seen: string; scored_at: string | null; score: number | null; base_score: number | null; bonus_score: number | null; reasons: string | null; gaps: string | null; hidden: number; applied: number; applied_on: string | null };
    user_jobs: { user_id: number } & JobsAtThisStep["jobs"];
};

/** Adds each user's own view of a posting, and gives every job stored so far to the owner, user 1. */
async function up(db: Kysely<unknown>): Promise<void> {
    const typed = db.withTables<JobsAtThisStep>();
    await typed.insertInto("users").values({ id: OWNER, name: "owner", created_at: new Date().toISOString() }).onDuplicateKeyUpdate({ id: OWNER }).execute();
    await createUserJobs(db);
    await typed
        .insertInto("user_jobs")
        .columns(["user_id", ...COPIED])
        .expression((eb) => eb.selectFrom("jobs").select([eb.lit(OWNER).as("user_id"), ...COPIED]))
        .execute();
}

/** Creates the table of each user's view of a posting, keyed by user and posting, with its indexes. */
async function createUserJobs(db: Kysely<unknown>): Promise<void> {
    const table = db.schema
        .createTable("user_jobs")
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("ats", "varchar(32)", (col) => col.notNull())
        .addColumn("job_id", "varchar(255)", (col) => col.notNull())
        .addColumn("source_id", "integer")
        .addColumn("source", "varchar(255)", (col) => col.notNull());
    await withView(table)
        .addPrimaryKeyConstraint("user_jobs_pk", ["user_id", "ats", "job_id"])
        .addForeignKeyConstraint("user_jobs_user_fk", ["user_id"], "users", ["id"])
        .addForeignKeyConstraint("user_jobs_job_fk", ["ats", "job_id"], "jobs", ["ats", "job_id"])
        .addForeignKeyConstraint("user_jobs_source_fk", ["source_id"], "user_sources", ["id"], (fk) => fk.onDelete("set null"))
        .modifyEnd(TABLE_OPTIONS)
        .execute();
    for (const [name, column] of [["user_jobs_scored", "scored_at"], ["user_jobs_applied", "applied"], ["user_jobs_seen", "last_seen"]] as const) await db.schema.createIndex(name).on("user_jobs").columns(["user_id", column]).execute();
}

/** Adds what one user has of a posting: when they saw it, their score and its notes, and their hidden and applied marks. */
function withView<C extends string>(table: CreateTableBuilder<"user_jobs", C>) {
    return table
        .addColumn("first_seen", "varchar(32)", (col) => col.notNull())
        .addColumn("last_seen", "varchar(32)", (col) => col.notNull())
        .addColumn("scored_at", "varchar(32)")
        .addColumn("score", "integer")
        .addColumn("base_score", "integer")
        .addColumn("bonus_score", "integer")
        .addColumn("reasons", "text")
        .addColumn("gaps", "text")
        .addColumn("hidden", sql`tinyint`, (col) => col.notNull().defaultTo(0))
        .addColumn("applied", sql`tinyint`, (col) => col.notNull().defaultTo(0))
        .addColumn("applied_on", "varchar(32)");
}

export const userJobs: Migration = { up };
