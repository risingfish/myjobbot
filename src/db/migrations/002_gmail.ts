import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const CONNECTION = `
CREATE TABLE gmail_connection (
  id TINYINT NOT NULL,
  email VARCHAR(320) NULL,
  app_password TEXT NULL,
  connected_at VARCHAR(32) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'none',
  reason VARCHAR(200) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

/** Creates the table holding the Gmail address and its sealed app password. */
async function up(db: Kysely<unknown>): Promise<void> {
    await sql.raw(CONNECTION).execute(db);
}

export const gmail: Migration = { up };
