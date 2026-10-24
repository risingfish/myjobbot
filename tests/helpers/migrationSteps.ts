import { sql, type Kysely } from "kysely";
import { migrateToLatest } from "../../src/db/migrate.js";
import { MIGRATIONS } from "../../src/db/migrations/index.js";
import type { Database } from "../../src/db/schema.js";
import { TABLES } from "./testDb.js";

export const LEGACY_TABLES = ["careers_pages"];

export async function columnTypes(db: Kysely<Database>, table: string, columns: string[]) {
    const query = sql<{ COLUMN_NAME: string; COLUMN_TYPE: string; IS_NULLABLE: string; COLUMN_DEFAULT: string | null; COLLATION_NAME: string | null }>`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME IN (${sql.join(columns)}) ORDER BY COLUMN_NAME`;
    return (await query.execute(db)).rows.map((row) => [row.COLUMN_NAME, row.COLUMN_TYPE, row.IS_NULLABLE, row.COLUMN_DEFAULT, row.COLLATION_NAME].join(" "));
}

export function storedJob(jobId: string, description: string | null) {
    const seen = "2026-10-22T00:00:00.000Z";
    return { ats: "greenhouse", job_id: jobId, company: "Acme", source: "Acme", title: "Engineer", normalized_title: "engineer", url: "u", description, first_seen: seen, last_seen: seen };
}

export async function migrateBefore(db: Kysely<Database>, step: string): Promise<void> {
    for (const table of [...TABLES, ...LEGACY_TABLES, "kysely_migration", "kysely_migration_lock"]) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
    await migrateToLatest(db, { migrations: Object.fromEntries(Object.entries(MIGRATIONS).filter(([name]) => name < step)) });
}
