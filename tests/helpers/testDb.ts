import { existsSync } from "node:fs";
import { sql, type Kysely } from "kysely";
import type { Environment } from "../../src/config/load.js";
import { createDatabase } from "../../src/db/database.js";
import { migrateToLatest } from "../../src/db/migrate.js";
import type { Database } from "../../src/db/schema.js";
import { describeConnectionError, parseDbSettings, type DbSettings } from "../../src/db/settings.js";

export const TABLES = ["rescore_steps", "rescore_runs", "verdicts", "jobs", "user_sources", "companies", "api_calls", "gmail_connection", "gmail_alert_state", "careers_audit", "resume_profiles", "resumes", "user_settings", "users"] as const;

const TEST_KEYS = ["HOST", "PORT", "USER", "PASSWORD"] as const;

export function testEnvironment(env: Environment): Environment {
    const database = env.MYJOBBOT_TEST_DB_NAME ?? "myjobbot_test";
    if (!/_test(_|$)/.test(database)) throw new Error(`refusing to run tests against ${database}: the test database name must hold _test, at its end or before another _`);
    const overrides = TEST_KEYS.flatMap((key) => {
        const value = env[`MYJOBBOT_TEST_DB_${key}`];
        return value ? [[`MYJOBBOT_DB_${key}`, value]] : [];
    });
    return { ...env, ...Object.fromEntries(overrides), MYJOBBOT_DB_NAME: database };
}

export function testSettings(): DbSettings {
    if (existsSync(".env")) process.loadEnvFile(".env");
    return parseDbSettings(testEnvironment(process.env));
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
