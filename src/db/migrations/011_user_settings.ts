import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const TABLE_OPTIONS = sql`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

/** Adds the users myjobbot searches for, and one stored search settings document per user. */
async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("users")
        .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
        .addColumn("name", "varchar(255)", (col) => col.notNull())
        .addColumn("created_at", "varchar(32)", (col) => col.notNull())
        .modifyEnd(TABLE_OPTIONS)
        .execute();
    await db.schema
        .createTable("user_settings")
        .addColumn("user_id", "integer", (col) => col.primaryKey())
        .addColumn("settings", "json", (col) => col.notNull())
        .addColumn("updated_at", "varchar(32)", (col) => col.notNull())
        .addForeignKeyConstraint("user_settings_user_fk", ["user_id"], "users", ["id"])
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

export const userSettings: Migration = { up };
