import { existsSync } from "node:fs";
import { sql, type Kysely } from "kysely";
import { createDatabase } from "../../src/db/database.js";
import { migrateToLatest } from "../../src/db/migrate.js";
import type { Database } from "../../src/db/schema.js";
import { describeConnectionError, parseDbSettings, type DbSettings } from "../../src/db/settings.js";

export const TABLES = ["verdicts", "jobs", "companies", "api_calls", "gmail_connection", "gmail_alert_state", "careers_audit", "user_settings", "users"] as const;

export function testSettings(): DbSettings {
    if (existsSync(".env")) process.loadEnvFile(".env");
    const database = process.env.MYJOBBOT_TEST_DB_NAME ?? "myjobbot_test";
    if (!database.endsWith("_test")) throw new Error(`refusing to run tests against ${database}: the test database name must end in _test`);
    return parseDbSettings({ ...process.env, MYJOBBOT_DB_NAME: database });
}

export async function testDatabase(): Promise<Kysely<Database>> {
    const settings = testSettings();
    const db = createDatabase(settings);
    try {
        await sql`SELECT 1`.execute(db);
    } catch (error) {
        await db.destroy();
        throw describeConnectionError(error, settings);
    }
    return db;
}

export async function connectTestDb(): Promise<Kysely<Database>> {
    const db = await testDatabase();
    await migrateToLatest(db);
    return db;
}

export async function emptyTables(db: Kysely<Database>): Promise<void> {
    for (const table of TABLES) await db.deleteFrom(table).execute();
}
