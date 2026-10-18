import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

type AuditAtThisStep = {
    careers_audit: { step: string; reason: string | null; retry_once: number };
};

const RETRIED_REASONS = ["careers_page_unreadable", "job_page_unreadable", "gave_up"];

/** Records how each careers page was read and gives lookups that failed on unreadable pages one more try. */
async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .alterTable("careers_audit")
        .addColumn("page_source", "varchar(16)")
        .addColumn("fallback", "varchar(32)")
        .addColumn("board", "varchar(160)")
        .addColumn("retry_once", sql`tinyint`, (col) => col.notNull().defaultTo(0))
        .execute();
    await db.withTables<AuditAtThisStep>().updateTable("careers_audit").set({ retry_once: 1 }).where("step", "=", "finish").where("reason", "in", RETRIED_REASONS).execute();
}

export const pageSources: Migration = { up };
