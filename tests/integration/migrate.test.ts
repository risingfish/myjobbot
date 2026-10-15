import { sql, type Kysely } from "kysely";
import { expect, test } from "vitest";
import { storesOver } from "../../src/db/kysely/stores.js";
import { migrateToLatest } from "../../src/db/migrate.js";
import type { Database } from "../../src/db/schema.js";
import { makeJob } from "../../src/jobs/job.js";
import { connectTestDb, emptyTables, TABLES, testDatabase, testSettings } from "../helpers/testDb.js";

test("the production and test databases use the same character set and collation", async () => {
    const db = await testDatabase();
    try {
        const names = ["myjobbot", testSettings().database];
        const rows = await sql<{ SCHEMA_NAME: string; CS: string; CO: string }>`SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME AS CS, DEFAULT_COLLATION_NAME AS CO FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN (${sql.join(names)})`.execute(db);
        expect(rows.rows).toHaveLength(2);
        expect(new Set(rows.rows.map((row) => `${row.CS}/${row.CO}`)).size).toBe(1);
    } finally {
        await db.destroy();
    }
});

const RENAME = { up: async (db: Kysely<unknown>) => void (await sql`ALTER TABLE jobs RENAME COLUMN compensation TO pay`.execute(db)) };
const RENAME_BACK = { up: async (db: Kysely<unknown>) => void (await sql`ALTER TABLE jobs RENAME COLUMN pay TO compensation`.execute(db)) };
const STEP_TABLE = "test_kysely_migration";

async function columnValue(db: Kysely<Database>, column: string): Promise<unknown> {
    const rows = await sql<Record<string, unknown>>`SELECT ${sql.ref(column)} AS value FROM jobs WHERE job_id = 'renamed'`.execute(db);
    return rows.rows[0]?.value;
}

test("a step that renames a column keeps its values, and each step is recorded once", async () => {
    const db = await connectTestDb();
    try {
        await emptyTables(db);
        await storesOver(db).jobStore.upsertAll([makeJob({ ats: "greenhouse", jobId: "renamed", company: "Acme", title: "Engineer", url: "u" }, { compensation: "$100k" })], "2026-10-14T00:00:00.000Z", "Acme");
        expect(await migrateToLatest(db, { migrations: { "002_rename": RENAME }, tableName: STEP_TABLE })).toEqual(["002_rename"]);
        expect(await columnValue(db, "pay")).toBe("$100k");
        expect(await migrateToLatest(db, { migrations: { "002_rename": RENAME, "003_rename_back": RENAME_BACK }, tableName: STEP_TABLE })).toEqual(["003_rename_back"]);
        expect(await columnValue(db, "compensation")).toBe("$100k");
    } finally {
        await sql`DROP TABLE IF EXISTS ${sql.table(STEP_TABLE)}, ${sql.table(`${STEP_TABLE}_lock`)}`.execute(db);
        await db.destroy();
    }
});

async function tableCollations(db: Kysely<Database>) {
    const query = sql<{ TABLE_NAME: string; TABLE_COLLATION: string }>`SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${sql.join([...TABLES])}) ORDER BY TABLE_NAME`;
    return (await query.execute(db)).rows.map((row) => `${row.TABLE_NAME} ${row.TABLE_COLLATION}`);
}

test("on an empty database, two processes migrating at once run each step once, and running again does nothing", async () => {
    const [first, second] = await Promise.all([testDatabase(), testDatabase()]);
    try {
        for (const table of [...TABLES, "kysely_migration", "kysely_migration_lock"]) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(first);
        const ran = await Promise.all([migrateToLatest(first), migrateToLatest(second)]);
        expect(ran.flat()).toEqual(["001_initial", "002_gmail"]);
        expect(await migrateToLatest(first)).toEqual([]);
        expect(await tableCollations(first)).toEqual(["api_calls utf8mb4_bin", "gmail_connection utf8mb4_bin", "jobs utf8mb4_bin", "verdicts utf8mb4_bin"]);
    } finally {
        await Promise.all([first.destroy(), second.destroy()]);
    }
});
