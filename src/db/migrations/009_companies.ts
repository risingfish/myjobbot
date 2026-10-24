import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const TABLE_OPTIONS = sql`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

/** Adds a record for every company myjobbot finds jobs from, and a link from each job to its company, unset for the jobs already stored. */
async function up(db: Kysely<unknown>): Promise<void> {
    await createCompanies(db);
    await db.schema.createIndex("companies_last_found").on("companies").column("last_found_date").execute();
    await db.schema.alterTable("jobs").addColumn("company_id", "integer").execute();
    await db.schema.createIndex("jobs_company").on("jobs").column("company_id").execute();
    await db.schema.alterTable("jobs").addForeignKeyConstraint("jobs_company_fk", ["company_id"], "companies", ["id"]).execute();
}

/** Creates the companies table: its key and name, its two addresses with where the careers page came from, its dates, and the outcome of its last search. */
async function createCompanies(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("companies")
        .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
        .addColumn("company_key", "varchar(255)", (col) => col.notNull().unique())
        .addColumn("name", "varchar(255)", (col) => col.notNull())
        .addColumn("website_url", "varchar(2048)")
        .addColumn("careers_url", "varchar(2048)")
        .addColumn("careers_source", "varchar(16)")
        .addColumn("created_date", "varchar(32)", (col) => col.notNull())
        .addColumn("last_found_date", "varchar(32)", (col) => col.notNull())
        .addColumn("searched_at", "varchar(32)")
        .addColumn("website_reason", "varchar(32)")
        .addColumn("website_rejected", "text")
        .addColumn("careers_reason", "varchar(32)")
        .addColumn("careers_rejected", "text")
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

export const companies: Migration = { up };
