import type { Kysely } from "kysely";
import { Migrator, type Migration } from "kysely/migration";
import { MIGRATIONS } from "./migrations/index.js";

interface MigrateOptions {
    migrations?: Record<string, Migration>;
    tableName?: string;
}

/** Brings a database up to the latest schema step, running each pending step once, and names a step that fails. */
export async function migrateToLatest<DB>(db: Kysely<DB>, options: MigrateOptions = {}): Promise<string[]> {
    const migrations = options.migrations ?? MIGRATIONS;
    const tables = options.tableName ? { migrationTableName: options.tableName, migrationLockTableName: `${options.tableName}_lock` } : {};
    const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations }, ...tables });
    const { error, results = [] } = await migrator.migrateToLatest();
    const failed = results.find((result) => result.status === "Error");
    if (error) throw new Error(`schema step ${failed?.migrationName ?? "(unknown)"} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    return results.map((result) => result.migrationName);
}
