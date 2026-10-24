import { sql, type Kysely } from "kysely";
import { expect, test } from "vitest";
import { storesOver } from "../../src/db/kysely/stores.js";
import { migrateToLatest } from "../../src/db/migrate.js";
import { MIGRATIONS } from "../../src/db/migrations/index.js";
import type { Database } from "../../src/db/schema.js";
import { makeJob } from "../../src/jobs/job.js";
import { columnTypes, LEGACY_TABLES, storedJob } from "../helpers/migrationSteps.js";
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
        for (const table of [...TABLES, ...LEGACY_TABLES, "kysely_migration", "kysely_migration_lock"]) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(first);
        const ran = await Promise.all([migrateToLatest(first), migrateToLatest(second)]);
        expect(ran.flat()).toEqual(["001_initial", "002_gmail", "003_gmail_alerts", "004_careers_lookup", "005_page_sources", "006_injection_flag", "007_description_format", "008_applied", "009_companies", "010_fold_careers_pages"]);
        expect(await migrateToLatest(first)).toEqual([]);
        expect(await tableCollations(first)).toEqual(["api_calls utf8mb4_bin", "careers_audit utf8mb4_bin", "companies utf8mb4_bin", "gmail_alert_state utf8mb4_bin", "gmail_connection utf8mb4_bin", "jobs utf8mb4_bin", "verdicts utf8mb4_bin"]);
    } finally {
        await Promise.all([first.destroy(), second.destroy()]);
    }
});

const FINISHES = ["careers_page_unreadable", "job_page_unreadable", "gave_up", "job_not_found", null];

test("step 005 adds how pages were read and marks earlier unreadable or gave-up finishes for one retry", async () => {
    const db = await testDatabase();
    try {
        for (const table of [...TABLES, ...LEGACY_TABLES, "kysely_migration", "kysely_migration_lock"]) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
        await migrateToLatest(db, { migrations: Object.fromEntries(Object.entries(MIGRATIONS).filter(([name]) => name < "005")) });
        for (const [index, reason] of FINISHES.entries()) await sql`INSERT INTO careers_audit (run_id, at, ats, job_id, company, step, outcome, reason) VALUES ('r', 'now', 'linkedin', ${`li_${index}`}, 'Acme', 'finish', 'failed', ${reason})`.execute(db);
        expect(await migrateToLatest(db)).toEqual(["005_page_sources", "006_injection_flag", "007_description_format", "008_applied", "009_companies", "010_fold_careers_pages"]);
        const marked = await sql<{ job_id: string; retry_once: number }>`SELECT job_id, retry_once FROM careers_audit ORDER BY job_id`.execute(db);
        expect(marked.rows.map((row) => row.retry_once)).toEqual([1, 1, 1, 0, 0]);
        expect(await columnTypes(db, "careers_audit", ["page_source", "fallback", "board", "retry_once"])).toEqual(["board varchar(160) YES NULL utf8mb4_bin", "fallback varchar(32) YES NULL utf8mb4_bin", "page_source varchar(16) YES NULL utf8mb4_bin", "retry_once tinyint(4) NO 0 "]);
    } finally {
        await db.destroy();
    }
});

test("step 006 adds the injection flag to jobs, empty for every job already there", async () => {
    const db = await connectTestDb();
    try {
        await emptyTables(db);
        await storesOver(db).jobStore.upsertAll([makeJob({ ats: "greenhouse", jobId: "old", company: "Acme", title: "Engineer", url: "u" }, {})], "2026-10-14T00:00:00.000Z", "Acme");
        expect(await columnTypes(db, "jobs", ["injection_seen_at"])).toEqual(["injection_seen_at varchar(32) YES NULL utf8mb4_bin"]);
        const flags = await db.selectFrom("jobs").select("injection_seen_at").execute();
        expect(flags).toEqual([{ injection_seen_at: null }]);
    } finally {
        await db.destroy();
    }
});

test("step 007 records the format of every stored description as plain text, and none where there is no description", async () => {
    const db = await testDatabase();
    try {
        for (const table of [...TABLES, ...LEGACY_TABLES, "kysely_migration", "kysely_migration_lock"]) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
        await migrateToLatest(db, { migrations: Object.fromEntries(Object.entries(MIGRATIONS).filter(([name]) => name < "007")) });
        await db
            .insertInto("jobs")
            .values([storedJob("with", "Build APIs."), storedJob("without", null)])
            .execute();
        expect(await migrateToLatest(db)).toEqual(["007_description_format", "008_applied", "009_companies", "010_fold_careers_pages"]);
        const formats = await db.selectFrom("jobs").select(["job_id", "description_format"]).orderBy("job_id").execute();
        expect(formats).toEqual([
            { job_id: "with", description_format: "text" },
            { job_id: "without", description_format: null },
        ]);
        expect(await columnTypes(db, "jobs", ["description_format"])).toEqual(["description_format varchar(16) YES NULL utf8mb4_bin"]);
    } finally {
        await db.destroy();
    }
});

test("step 008 adds the applied mark to jobs, not applied for every job already there or added without it", async () => {
    const db = await testDatabase();
    try {
        for (const table of [...TABLES, ...LEGACY_TABLES, "kysely_migration", "kysely_migration_lock"]) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
        await migrateToLatest(db, { migrations: Object.fromEntries(Object.entries(MIGRATIONS).filter(([name]) => name < "008")) });
        await db.insertInto("jobs").values(storedJob("before", null)).execute();
        expect(await migrateToLatest(db)).toEqual(["008_applied", "009_companies", "010_fold_careers_pages"]);
        await db.insertInto("jobs").values(storedJob("after", null)).execute();
        const marks = await db.selectFrom("jobs").select(["job_id", "applied", "applied_on"]).orderBy("job_id").execute();
        expect(marks).toEqual([
            { job_id: "after", applied: 0, applied_on: null },
            { job_id: "before", applied: 0, applied_on: null },
        ]);
        expect(await columnTypes(db, "jobs", ["applied", "applied_on"])).toEqual(["applied tinyint(4) NO 0 ", "applied_on varchar(32) YES NULL utf8mb4_bin"]);
    } finally {
        await db.destroy();
    }
});
