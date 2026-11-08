import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

/** Keys the Gmail connection and its alert progress by user, the existing row becoming the owner's (user 1), with the column made the same type as a user's id so it can point at one. */
async function up(db: Kysely<unknown>): Promise<void> {
    for (const table of ["gmail_connection", "gmail_alert_state"]) {
        await db.schema.alterTable(table).renameColumn("id", "user_id").execute();
        await db.schema.alterTable(table).modifyColumn("user_id", "integer", (col) => col.notNull()).execute();
        await db.schema.alterTable(table).addForeignKeyConstraint(`${table}_user_fk`, ["user_id"], "users", ["id"]).execute();
    }
}

export const gmailByUser: Migration = { up };
