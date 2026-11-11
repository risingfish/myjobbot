import { sql, type CreateTableBuilder, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const TABLE_OPTIONS = sql`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;
const TALLY_COUNTS = ["fetches", "fetch_failures", "jobs_found", "jobs_scored", "searches", "search_failures", "model_calls", "prompt_tokens", "completion_tokens"];
const RUN_COUNTS = ["users", "users_failed", "users_skipped", ...TALLY_COUNTS];
const MODEL_USE = ["model_calls", "prompt_tokens", "completion_tokens"];

type Builder = CreateTableBuilder<string, never>;

/** Adds each run with its heartbeat, each user's part of it, each source fetch, each mail send, and the re-scores' model use. */
async function up(db: Kysely<unknown>): Promise<void> {
    await createRuns(db);
    await createRunUsers(db);
    await createSourceFetches(db);
    await createMailSends(db);
    for (const column of MODEL_USE) await db.schema.alterTable("rescore_runs").addColumn(column, "integer", (col) => col.notNull().defaultTo(0)).execute();
}

/** Adds an integer column, 0 until counted, for each name given. */
function withCounts(table: Builder, names: string[]): Builder {
    return names.reduce((built, name) => built.addColumn(name, "integer", (col) => col.notNull().defaultTo(0)), table);
}

/** Creates the runs table: when each run started, when it last showed it was alive, how it ended and its totals. */
async function createRuns(db: Kysely<unknown>): Promise<void> {
    const table = db.schema
        .createTable("agent_runs")
        .addColumn("id", "varchar(36)", (col) => col.primaryKey())
        .addColumn("started_at", "varchar(32)", (col) => col.notNull())
        .addColumn("alive_at", "varchar(32)", (col) => col.notNull())
        .addColumn("ended_at", "varchar(32)")
        .addColumn("outcome", "varchar(32)")
        .addColumn("reason", "varchar(32)")
        .addColumn("incomplete", sql`tinyint`, (col) => col.notNull().defaultTo(0));
    await withCounts(table, RUN_COUNTS).modifyEnd(TABLE_OPTIONS).execute();
    await db.schema.createIndex("agent_runs_started").on("agent_runs").column("started_at").execute();
}

/** Creates the run parts table, one row per user in a run, removed with its run. */
async function createRunUsers(db: Kysely<unknown>): Promise<void> {
    const table = db.schema
        .createTable("run_users")
        .addColumn("run_id", "varchar(36)", (col) => col.notNull())
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("part_id", "varchar(36)")
        .addColumn("started_at", "varchar(32)", (col) => col.notNull())
        .addColumn("ended_at", "varchar(32)")
        .addColumn("outcome", "varchar(32)", (col) => col.notNull())
        .addColumn("reason", "varchar(32)")
        .addPrimaryKeyConstraint("run_users_pk", ["run_id", "user_id"])
        .addForeignKeyConstraint("run_users_run_fk", ["run_id"], "agent_runs", ["id"], (fk) => fk.onDelete("cascade"))
        .addForeignKeyConstraint("run_users_user_fk", ["user_id"], "users", ["id"]);
    await withCounts(table, TALLY_COUNTS).modifyEnd(TABLE_OPTIONS).execute();
    await db.schema.createIndex("run_users_part").on("run_users").column("part_id").execute();
}

/** Creates the fetch history, one row per fetch or planned skip of a saved source, removed with its source. */
async function createSourceFetches(db: Kysely<unknown>): Promise<void> {
    const table = db.schema
        .createTable("source_fetches")
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("source_id", "integer", (col) => col.notNull())
        .addColumn("part_id", "varchar(36)", (col) => col.notNull())
        .addColumn("module", "varchar(64)", (col) => col.notNull())
        .addColumn("at", "varchar(32)", (col) => col.notNull())
        .addColumn("ms", "integer", (col) => col.notNull())
        .addColumn("outcome", "varchar(16)", (col) => col.notNull())
        .addColumn("reason", "varchar(64)")
        .addForeignKeyConstraint("source_fetches_user_fk", ["user_id"], "users", ["id"])
        .addForeignKeyConstraint("source_fetches_source_fk", ["source_id"], "user_sources", ["id"], (fk) => fk.onDelete("cascade"));
    await withCounts(table, ["pages", "jobs", "cost"]).modifyEnd(TABLE_OPTIONS).execute();
    await db.schema.createIndex("source_fetches_source").on("source_fetches").columns(["user_id", "source_id", "at"]).execute();
    await db.schema.createIndex("source_fetches_module").on("source_fetches").columns(["module", "at"]).execute();
}

/** Creates the mail log: each send's kind and outcome, never its address or content. */
async function createMailSends(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("mail_sends")
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("at", "varchar(32)", (col) => col.notNull())
        .addColumn("kind", "varchar(32)", (col) => col.notNull())
        .addColumn("outcome", "varchar(8)", (col) => col.notNull())
        .addColumn("reason", "varchar(16)")
        .modifyEnd(TABLE_OPTIONS)
        .execute();
    await db.schema.createIndex("mail_sends_at").on("mail_sends").column("at").execute();
}

export const monitoringTables: Migration = { up };
