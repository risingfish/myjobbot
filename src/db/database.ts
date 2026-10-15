import { CompiledQuery, Kysely, MysqlDialect } from "kysely";
import { createPool } from "mysql2";
import type { Database } from "./schema.js";
import type { DbSettings } from "./settings.js";

const SET_NAMES = CompiledQuery.raw("SET NAMES utf8mb4 COLLATE utf8mb4_bin");

/** Creates a Kysely database over a small mysql2 pool whose every connection speaks utf8mb4 with exact comparison. */
export function createDatabase(settings: DbSettings): Kysely<Database> {
    const { host, port, user, password, database } = settings;
    const pool = createPool({ host, port, user, password, database, connectionLimit: 4, connectTimeout: 3000, dateStrings: true, supportBigNumbers: true });
    const dialect = new MysqlDialect({ pool, onCreateConnection: async (connection) => void (await connection.executeQuery(SET_NAMES)) });
    return new Kysely<Database>({ dialect });
}
