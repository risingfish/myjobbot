import { sql, type CreateTableBuilder, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const TABLE_OPTIONS = sql`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

/** Adds each user's saved job sources, and a link from each job to the saved source it came from, unset for the jobs already stored. */
async function up(db: Kysely<unknown>): Promise<void> {
    await createUserSources(db);
    await db.schema.alterTable("jobs").addColumn("source_id", "integer").execute();
    await db.schema.createIndex("jobs_source").on("jobs").column("source_id").execute();
    await db.schema.alterTable("jobs").addForeignKeyConstraint("jobs_source_fk", ["source_id"], "user_sources", ["id"]).onDelete("set null").execute();
}

/** Creates the saved sources table, one row per source a user added, unique per user by target and by name. */
async function createUserSources(db: Kysely<unknown>): Promise<void> {
    const table = db.schema
        .createTable("user_sources")
        .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("module", "varchar(32)", (col) => col.notNull())
        .addColumn("name", "varchar(255)", (col) => col.notNull())
        .addColumn("params", "json", (col) => col.notNull())
        .addColumn("target", "varchar(512)", (col) => col.notNull())
        .addColumn("enabled", sql`tinyint`, (col) => col.notNull());
    await withFetchState(table).addUniqueConstraint("user_sources_target", ["user_id", "target"]).addUniqueConstraint("user_sources_name", ["user_id", "name"]).addForeignKeyConstraint("user_sources_user_fk", ["user_id"], "users", ["id"]).addForeignKeyConstraint("user_sources_company_fk", ["company_id"], "companies", ["id"]).modifyEnd(TABLE_OPTIONS).execute();
}

/** Adds a saved source's company, where its last fetch stopped and how it went, and its own dates. */
function withFetchState<C extends string>(table: CreateTableBuilder<"user_sources", C>) {
    return table
        .addColumn("company_id", "integer")
        .addColumn("cursor", "json")
        .addColumn("last_fetched_at", "varchar(32)")
        .addColumn("last_outcome", "varchar(16)")
        .addColumn("last_jobs", "integer")
        .addColumn("last_cost", "integer")
        .addColumn("last_reason", "varchar(255)")
        .addColumn("created_at", "varchar(32)", (col) => col.notNull())
        .addColumn("updated_at", "varchar(32)", (col) => col.notNull());
}

export const userSources: Migration = { up };
