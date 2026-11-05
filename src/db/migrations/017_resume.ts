import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const TABLE_OPTIONS = sql`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

/** Adds each user's uploaded resume and the profile extracted from it, one row of each per user. */
async function up(db: Kysely<unknown>): Promise<void> {
    await createResumes(db);
    await createProfiles(db);
}

/** Creates the table holding each user's uploaded resume as text, with its file name, type and content id. */
async function createResumes(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("resumes")
        .addColumn("user_id", "integer", (col) => col.primaryKey())
        .addColumn("text", sql`mediumtext`, (col) => col.notNull())
        .addColumn("file_name", "varchar(255)", (col) => col.notNull())
        .addColumn("file_type", "varchar(8)", (col) => col.notNull())
        .addColumn("uploaded_at", "varchar(32)", (col) => col.notNull())
        .addColumn("content_id", "char(16)", (col) => col.notNull())
        .addForeignKeyConstraint("resumes_user_fk", ["user_id"], "users", ["id"])
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

/** Creates the table holding the profile extracted from each user's resume, tied to the resume by its content id. */
async function createProfiles(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("resume_profiles")
        .addColumn("user_id", "integer", (col) => col.primaryKey())
        .addColumn("resume_id", "char(16)", (col) => col.notNull())
        .addColumn("summary", "text", (col) => col.notNull())
        .addColumn("skills", "text", (col) => col.notNull())
        .addColumn("extracted_at", "varchar(32)", (col) => col.notNull())
        .addColumn("edited_at", "varchar(32)")
        .addForeignKeyConstraint("resume_profiles_user_fk", ["user_id"], "users", ["id"])
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

export const resume: Migration = { up };
