import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

/** Gives every sign-in the device details the Account tab lists: its IP address, operating system and location. */
async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable("sessions").addColumn("ip", "varchar(45)").addColumn("os", "varchar(32)").addColumn("location", "varchar(100)").execute();
}

export const sessionDetails: Migration = { up };
