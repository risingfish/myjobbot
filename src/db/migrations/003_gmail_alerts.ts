import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const ALERT_STATE = `
CREATE TABLE gmail_alert_state (
  id TINYINT NOT NULL,
  uid_validity BIGINT NULL,
  last_uid BIGINT NULL,
  last_run_at VARCHAR(32) NULL,
  emails_read INT NOT NULL DEFAULT 0,
  jobs_found INT NOT NULL DEFAULT 0,
  not_understood INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

/** Creates the table remembering where alert reading stopped and what the last run found. */
async function up(db: Kysely<unknown>): Promise<void> {
    await sql.raw(ALERT_STATE).execute(db);
}

export const gmailAlerts: Migration = { up };
