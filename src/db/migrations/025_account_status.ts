import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const CODE_KEYS = [
    { name: "account_codes_creator_fk", column: "created_by" },
    { name: "account_codes_user_fk", column: "used_by" },
];

/** Gives every account a deactivation date and a deletion date, and lets the users a creation code names be deleted while the code stays. */
async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable("users").addColumn("deactivated_at", "varchar(32)").addColumn("delete_after", "varchar(32)").execute();
    for (const key of CODE_KEYS) await db.schema.alterTable("account_codes").dropConstraint(key.name).execute();
    await db.schema.alterTable("account_codes").modifyColumn("created_by", "integer").execute();
    for (const key of CODE_KEYS) await db.schema.alterTable("account_codes").addForeignKeyConstraint(key.name, [key.column], "users", ["id"], (fk) => fk.onDelete("set null")).execute();
}

export const accountStatusColumns: Migration = { up };
