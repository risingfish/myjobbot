import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

type JobsAtThisStep = {
    jobs: { description: string | null; description_format: string | null };
};

/** Records whether each job's description is Markdown or plain text, marking every description already stored as plain text. */
async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable("jobs").addColumn("description_format", "varchar(16)").execute();
    await db.withTables<JobsAtThisStep>().updateTable("jobs").set({ description_format: "text" }).where("description", "is not", null).execute();
}

export const descriptionFormat: Migration = { up };
