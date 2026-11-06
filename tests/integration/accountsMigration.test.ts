import { sql } from "kysely";
import { expect, test } from "vitest";
import { migrateToLatest } from "../../src/db/migrate.js";
import { columnTypes, migrateBefore } from "../helpers/migrationSteps.js";
import { testDatabase } from "../helpers/testDb.js";

const NEW_TABLES = ["account_codes", "auth_attempts", "auth_challenges", "email_tokens", "hardware_keys", "recovery_codes", "security_events", "sessions", "sign_in_methods"];
const USER_TYPES = ["email varchar(254) YES NULL utf8mb4_bin", "email_key varchar(254) YES NULL utf8mb4_bin", "is_admin tinyint(4) NO 0 "];
const BIGINTS = ["totp_last_step bigint(20) YES NULL "];
const KEY_TYPES = ["counter bigint(20) NO  ", "credential_id varchar(512) NO  utf8mb4_bin", "name varchar(50) NO  utf8mb4_bin"];
const FOREIGN_KEYS = ["account_codes.created_by>users", "account_codes.used_by>users", "auth_challenges.user_id>users", "email_tokens.user_id>users", "hardware_keys.user_id>users", "recovery_codes.user_id>users", "security_events.user_id>users", "sessions.user_id>users", "sign_in_methods.user_id>users"];
const UNIQUE = ["hardware_keys.credential_id", "hardware_keys.hardware_keys_user_name", "recovery_codes.digest", "users.users_email_key"];

async function tableCollations(db: Awaited<ReturnType<typeof testDatabase>>) {
    const rows = await sql<{ TABLE_NAME: string; TABLE_COLLATION: string }>`SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${sql.join(NEW_TABLES)})`.execute(db);
    return rows.rows.map((row) => `${row.TABLE_NAME} ${row.TABLE_COLLATION}`).sort();
}

async function foreignKeys(db: Awaited<ReturnType<typeof testDatabase>>) {
    const rows = await sql<{ TABLE_NAME: string; COLUMN_NAME: string; REFERENCED_TABLE_NAME: string }>`SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${sql.join(NEW_TABLES)}) AND REFERENCED_TABLE_NAME IS NOT NULL`.execute(db);
    return rows.rows.map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}>${row.REFERENCED_TABLE_NAME}`).sort();
}

async function uniqueIndexes(db: Awaited<ReturnType<typeof testDatabase>>) {
    const rows = await sql<{ TABLE_NAME: string; INDEX_NAME: string }>`SELECT DISTINCT TABLE_NAME, INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'hardware_keys', 'recovery_codes') AND NON_UNIQUE = 0 AND INDEX_NAME <> 'PRIMARY'`.execute(db);
    return rows.rows.map((row) => `${row.TABLE_NAME}.${row.INDEX_NAME}`).sort();
}

test("steps 018 and 019 add accounts to users and the sign-in tables, every one tied to its user and kept exact, with each sign-in's device details", async () => {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "018");
        expect(await migrateToLatest(db)).toEqual(["018_accounts", "019_session_details"]);
        expect(await columnTypes(db, "users", ["email", "email_key", "is_admin"])).toEqual(USER_TYPES);
        expect(await columnTypes(db, "sign_in_methods", ["totp_last_step"])).toEqual(BIGINTS);
        expect(await columnTypes(db, "hardware_keys", ["counter", "credential_id", "name"])).toEqual(KEY_TYPES);
        expect(await tableCollations(db)).toEqual(NEW_TABLES.map((table) => `${table} utf8mb4_bin`));
        expect(await foreignKeys(db)).toEqual(FOREIGN_KEYS);
        expect(await uniqueIndexes(db)).toEqual(UNIQUE);
        expect(await columnTypes(db, "sessions", ["ip", "os", "location"])).toEqual(["ip varchar(45) YES NULL utf8mb4_bin", "location varchar(100) YES NULL utf8mb4_bin", "os varchar(32) YES NULL utf8mb4_bin"]);
    } finally {
        await db.destroy();
    }
});
