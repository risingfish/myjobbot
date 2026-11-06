import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const TABLE_OPTIONS = sql`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

type Db = Kysely<unknown>;

/** Adds accounts to users and the tables behind signing in: ways, keys, codes, sessions, tokens, challenges, attempts and events. */
async function up(db: Db): Promise<void> {
    await extendUsers(db);
    await createMethods(db);
    await createKeys(db);
    await createRecoveryCodes(db);
    await createSessions(db);
    await createAccountCodes(db);
    await createEmailTokens(db);
    await createChallenges(db);
    await createAttempts(db);
    await createEvents(db);
}

/** Gives every user an email, its normalised key (unique) and an admin mark. */
async function extendUsers(db: Db): Promise<void> {
    await db.schema
        .alterTable("users")
        .addColumn("email", "varchar(254)")
        .addColumn("email_key", "varchar(254)")
        .addColumn("is_admin", sql`tinyint`, (col) => col.notNull().defaultTo(0))
        .execute();
    await db.schema.createIndex("users_email_key").unique().on("users").column("email_key").execute();
}

/** Creates the table of each account's ways of signing in, one row per way. */
async function createMethods(db: Db): Promise<void> {
    await db.schema
        .createTable("sign_in_methods")
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("kind", "varchar(16)", (col) => col.notNull())
        .addColumn("enabled", sql`tinyint`, (col) => col.notNull().defaultTo(0))
        .addColumn("ready", sql`tinyint`, (col) => col.notNull().defaultTo(0))
        .addColumn("password_digest", "varchar(255)")
        .addColumn("totp_secret", "varchar(255)")
        .addColumn("totp_last_step", "bigint")
        .addColumn("updated_at", "varchar(32)", (col) => col.notNull())
        .addPrimaryKeyConstraint("sign_in_methods_pk", ["user_id", "kind"])
        .addForeignKeyConstraint("sign_in_methods_user_fk", ["user_id"], "users", ["id"])
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

/** Creates the table of hardware keys, each named uniquely within its account. */
async function createKeys(db: Db): Promise<void> {
    await db.schema
        .createTable("hardware_keys")
        .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("name", "varchar(50)", (col) => col.notNull())
        .addColumn("credential_id", "varchar(512)", (col) => col.notNull().unique())
        .addColumn("public_key", "text", (col) => col.notNull())
        .addColumn("counter", "bigint", (col) => col.notNull())
        .addColumn("transports", "varchar(100)")
        .addColumn("created_at", "varchar(32)", (col) => col.notNull())
        .addColumn("last_used_at", "varchar(32)")
        .addUniqueConstraint("hardware_keys_user_name", ["user_id", "name"])
        .addForeignKeyConstraint("hardware_keys_user_fk", ["user_id"], "users", ["id"])
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

/** Creates the table of one-time recovery codes, stored as digests. */
async function createRecoveryCodes(db: Db): Promise<void> {
    await db.schema
        .createTable("recovery_codes")
        .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("digest", "char(64)", (col) => col.notNull().unique())
        .addColumn("created_at", "varchar(32)", (col) => col.notNull())
        .addColumn("used_at", "varchar(32)")
        .addForeignKeyConstraint("recovery_codes_user_fk", ["user_id"], "users", ["id"])
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

/** Creates the table of sign-ins, keyed by the digest of the browser's cookie. */
async function createSessions(db: Db): Promise<void> {
    await db.schema
        .createTable("sessions")
        .addColumn("id_digest", "char(64)", (col) => col.primaryKey())
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("csrf_digest", "char(64)", (col) => col.notNull())
        .addColumn("created_at", "varchar(32)", (col) => col.notNull())
        .addColumn("last_used_at", "varchar(32)", (col) => col.notNull())
        .addColumn("verified_at", "varchar(32)", (col) => col.notNull())
        .addColumn("ended_at", "varchar(32)")
        .addColumn("address", "varchar(45)", (col) => col.notNull())
        .addForeignKeyConstraint("sessions_user_fk", ["user_id"], "users", ["id"])
        .modifyEnd(TABLE_OPTIONS)
        .execute();
    await db.schema.createIndex("sessions_user_ended").on("sessions").columns(["user_id", "ended_at"]).execute();
}

/** Creates the table of account creation codes an admin makes, each spent by one account. */
async function createAccountCodes(db: Db): Promise<void> {
    await db.schema
        .createTable("account_codes")
        .addColumn("digest", "char(64)", (col) => col.primaryKey())
        .addColumn("created_by", "integer", (col) => col.notNull())
        .addColumn("created_at", "varchar(32)", (col) => col.notNull())
        .addColumn("expires_at", "varchar(32)", (col) => col.notNull())
        .addColumn("used_by", "integer")
        .addColumn("used_at", "varchar(32)")
        .addForeignKeyConstraint("account_codes_creator_fk", ["created_by"], "users", ["id"])
        .addForeignKeyConstraint("account_codes_user_fk", ["used_by"], "users", ["id"])
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

/** Creates the table of one-time emailed links: sign-in, reset, email change and identity confirmation. */
async function createEmailTokens(db: Db): Promise<void> {
    await db.schema
        .createTable("email_tokens")
        .addColumn("digest", "char(64)", (col) => col.primaryKey())
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("purpose", "varchar(16)", (col) => col.notNull())
        .addColumn("new_email", "varchar(254)")
        .addColumn("session_digest", "char(64)")
        .addColumn("return_path", "varchar(512)")
        .addColumn("created_at", "varchar(32)", (col) => col.notNull())
        .addColumn("expires_at", "varchar(32)", (col) => col.notNull())
        .addColumn("used_at", "varchar(32)")
        .addForeignKeyConstraint("email_tokens_user_fk", ["user_id"], "users", ["id"])
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

/** Creates the table of hardware-key challenges, each answered once within minutes. */
async function createChallenges(db: Db): Promise<void> {
    await db.schema
        .createTable("auth_challenges")
        .addColumn("digest", "char(64)", (col) => col.primaryKey())
        .addColumn("purpose", "varchar(16)", (col) => col.notNull())
        .addColumn("user_id", "integer")
        .addColumn("expires_at", "varchar(32)", (col) => col.notNull())
        .addColumn("used_at", "varchar(32)")
        .addForeignKeyConstraint("auth_challenges_user_fk", ["user_id"], "users", ["id"])
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

/** Creates the table of failed and limited attempts, keyed by a digest of the email or address. */
async function createAttempts(db: Db): Promise<void> {
    await db.schema
        .createTable("auth_attempts")
        .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
        .addColumn("kind", "varchar(16)", (col) => col.notNull())
        .addColumn("scope", "varchar(8)", (col) => col.notNull())
        .addColumn("key_digest", "char(64)", (col) => col.notNull())
        .addColumn("at", "varchar(32)", (col) => col.notNull())
        .modifyEnd(TABLE_OPTIONS)
        .execute();
    await db.schema.createIndex("auth_attempts_lookup").on("auth_attempts").columns(["kind", "scope", "key_digest", "at"]).execute();
}

/** Creates the table of security events, fixed names only, shown on the Account tab. */
async function createEvents(db: Db): Promise<void> {
    await db.schema
        .createTable("security_events")
        .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("at", "varchar(32)", (col) => col.notNull())
        .addColumn("address", "varchar(45)")
        .addColumn("event", "varchar(32)", (col) => col.notNull())
        .addColumn("method", "varchar(16)")
        .addForeignKeyConstraint("security_events_user_fk", ["user_id"], "users", ["id"])
        .modifyEnd(TABLE_OPTIONS)
        .execute();
}

export const accounts: Migration = { up };
