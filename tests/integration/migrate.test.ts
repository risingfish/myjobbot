import { sql, type Kysely } from "kysely";
import { expect, test } from "vitest";
import { storesOver } from "../../src/db/kysely/stores.js";
import { migrateToLatest } from "../../src/db/migrate.js";
import { MIGRATIONS } from "../../src/db/migrations/index.js";
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
        expect(ran.flat()).toEqual(["001_initial", "002_gmail", "003_gmail_alerts", "004_careers_lookup", "005_page_sources", "006_injection_flag", "007_description_format", "008_applied", "009_companies"]);
        expect(await migrateToLatest(first)).toEqual([]);
        expect(await tableCollations(first)).toEqual(["api_calls utf8mb4_bin", "careers_audit utf8mb4_bin", "careers_pages utf8mb4_bin", "companies utf8mb4_bin", "gmail_alert_state utf8mb4_bin", "gmail_connection utf8mb4_bin", "jobs utf8mb4_bin", "verdicts utf8mb4_bin"]);
    } finally {
        await Promise.all([first.destroy(), second.destroy()]);
    }
});

const FINISHES = ["careers_page_unreadable", "job_page_unreadable", "gave_up", "job_not_found", null];

async function columnTypes(db: Kysely<Database>, table: string, columns: string[]) {
    const query = sql<{ COLUMN_NAME: string; COLUMN_TYPE: string; IS_NULLABLE: string; COLUMN_DEFAULT: string | null; COLLATION_NAME: string | null }>`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME IN (${sql.join(columns)}) ORDER BY COLUMN_NAME`;
    return (await query.execute(db)).rows.map((row) => [row.COLUMN_NAME, row.COLUMN_TYPE, row.IS_NULLABLE, row.COLUMN_DEFAULT, row.COLLATION_NAME].join(" "));
}

test("step 005 adds how pages were read and marks earlier unreadable or gave-up finishes for one retry", async () => {
    const db = await testDatabase();
    try {
        for (const table of [...TABLES, "kysely_migration", "kysely_migration_lock"]) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
        await migrateToLatest(db, { migrations: Object.fromEntries(Object.entries(MIGRATIONS).filter(([name]) => name < "005")) });
        for (const [index, reason] of FINISHES.entries()) await sql`INSERT INTO careers_audit (run_id, at, ats, job_id, company, step, outcome, reason) VALUES ('r', 'now', 'linkedin', ${`li_${index}`}, 'Acme', 'finish', 'failed', ${reason})`.execute(db);
        expect(await migrateToLatest(db)).toEqual(["005_page_sources", "006_injection_flag", "007_description_format", "008_applied", "009_companies"]);
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

function storedJob(jobId: string, description: string | null) {
    const seen = "2026-10-22T00:00:00.000Z";
    return { ats: "greenhouse", job_id: jobId, company: "Acme", source: "Acme", title: "Engineer", normalized_title: "engineer", url: "u", description, first_seen: seen, last_seen: seen };
}

test("step 007 records the format of every stored description as plain text, and none where there is no description", async () => {
    const db = await testDatabase();
    try {
        for (const table of [...TABLES, "kysely_migration", "kysely_migration_lock"]) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
        await migrateToLatest(db, { migrations: Object.fromEntries(Object.entries(MIGRATIONS).filter(([name]) => name < "007")) });
        await db
            .insertInto("jobs")
            .values([storedJob("with", "Build APIs."), storedJob("without", null)])
            .execute();
        expect(await migrateToLatest(db)).toEqual(["007_description_format", "008_applied", "009_companies"]);
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
        for (const table of [...TABLES, "kysely_migration", "kysely_migration_lock"]) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
        await migrateToLatest(db, { migrations: Object.fromEntries(Object.entries(MIGRATIONS).filter(([name]) => name < "008")) });
        await db.insertInto("jobs").values(storedJob("before", null)).execute();
        expect(await migrateToLatest(db)).toEqual(["008_applied", "009_companies"]);
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

const COMPANY_COLUMNS = ["id", "company_key", "name", "website_url", "careers_url", "careers_source", "created_date", "last_found_date", "searched_at", "website_reason", "website_rejected", "careers_reason", "careers_rejected"];

const COMPANY_TYPES = [
    "careers_reason varchar(32) YES NULL utf8mb4_bin",
    "careers_rejected text YES NULL utf8mb4_bin",
    "careers_source varchar(16) YES NULL utf8mb4_bin",
    "careers_url varchar(2048) YES NULL utf8mb4_bin",
    "company_key varchar(255) NO  utf8mb4_bin",
    "created_date varchar(32) NO  utf8mb4_bin",
    "id int(11) NO  ",
    "last_found_date varchar(32) NO  utf8mb4_bin",
    "name varchar(255) NO  utf8mb4_bin",
    "searched_at varchar(32) YES NULL utf8mb4_bin",
    "website_reason varchar(32) YES NULL utf8mb4_bin",
    "website_rejected text YES NULL utf8mb4_bin",
    "website_url varchar(2048) YES NULL utf8mb4_bin",
];

test("step 009 adds an empty companies table and a company link on every job, unset for jobs already there", async () => {
    const db = await testDatabase();
    try {
        for (const table of [...TABLES, "kysely_migration", "kysely_migration_lock"]) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
        await migrateToLatest(db, { migrations: Object.fromEntries(Object.entries(MIGRATIONS).filter(([name]) => name < "009")) });
        await db.insertInto("jobs").values([storedJob("one", null), storedJob("two", null)]).execute();
        expect(await migrateToLatest(db)).toEqual(["009_companies"]);
        expect([await db.selectFrom("companies").selectAll().execute(), await db.selectFrom("jobs").select("company_id").execute()]).toEqual([[], [{ company_id: null }, { company_id: null }]]);
        expect(await columnTypes(db, "companies", COMPANY_COLUMNS)).toEqual(COMPANY_TYPES);
        expect(await columnTypes(db, "jobs", ["company_id"])).toEqual(["company_id int(11) YES NULL "]);
    } finally {
        await db.destroy();
    }
});
