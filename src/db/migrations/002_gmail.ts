import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const TABLE_OPTIONS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin";

const CONNECTION = `
CREATE TABLE gmail_connection (
  id TINYINT NOT NULL,
  client_id VARCHAR(255) NULL,
  client_secret TEXT NULL,
  credentials_saved_at VARCHAR(32) NULL,
  refresh_token TEXT NULL,
  email VARCHAR(320) NULL,
  connected_at VARCHAR(32) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'none',
  reason VARCHAR(200) NULL,
  PRIMARY KEY (id)
) ${TABLE_OPTIONS}`;

const CONNECT_REQUESTS = `
CREATE TABLE gmail_connect_requests (
  state CHAR(43) NOT NULL,
  code_verifier TEXT NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (state),
  KEY gmail_connect_requests_by_age (created_at)
) ${TABLE_OPTIONS}`;

/** Creates the tables holding the sealed Gmail connection and the short-lived sign-in requests. */
async function up(db: Kysely<unknown>): Promise<void> {
    for (const statement of [CONNECTION, CONNECT_REQUESTS]) await sql.raw(statement).execute(db);
}

export const gmail: Migration = { up };
