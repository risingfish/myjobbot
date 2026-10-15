import { sql, type Kysely } from "kysely";
import { createDatabase } from "./database.js";
import { storesOver } from "./kysely/stores.js";
import { migrateToLatest } from "./migrate.js";
import { withRetry, type RetryOptions } from "./retry.js";
import type { Database } from "./schema.js";
import { describeConnectionError, type DbSettings } from "./settings.js";
import type { Stores } from "./store.js";

const DEFAULT_RETRY: RetryOptions = { tries: 3, delayMs: 10_000 };

/** Connects to MariaDB (retrying) and brings its schema up to date; fails with a readable reason and leaves nothing open. */
export async function connectDatabase(settings: DbSettings, retry: Partial<RetryOptions> = {}): Promise<Kysely<Database>> {
    const db = createDatabase(settings);
    try {
        await withRetry(() => sql`SELECT 1`.execute(db), { ...DEFAULT_RETRY, ...retry });
    } catch (error) {
        await db.destroy();
        throw describeConnectionError(error, settings);
    }
    await migrateOrClose(db);
    return db;
}

/** Connects to MariaDB and returns the stores that read and write it. */
export async function openStores(settings: DbSettings, retry: Partial<RetryOptions> = {}): Promise<Stores> {
    return storesOver(await connectDatabase(settings, retry));
}

/** Runs pending schema steps, closing the database if one fails so the process can exit. */
async function migrateOrClose(db: Kysely<Database>): Promise<void> {
    try {
        await migrateToLatest(db);
    } catch (error) {
        await db.destroy();
        throw error;
    }
}
