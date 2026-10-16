import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const TABLE_OPTIONS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin";

const JOB_COLUMNS = "ALTER TABLE jobs ADD COLUMN description_source VARCHAR(16) NULL, ADD COLUMN description_url VARCHAR(2048) NULL";
const BACKFILL = "UPDATE jobs SET description_source = 'source' WHERE description IS NOT NULL";

const PAGES = `
CREATE TABLE careers_pages (
  company_key VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  found_at VARCHAR(32) NOT NULL,
  last_used_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (company_key)
) ${TABLE_OPTIONS}`;

const AUDIT = `
CREATE TABLE careers_audit (
  id BIGINT NOT NULL AUTO_INCREMENT,
  run_id VARCHAR(36) NOT NULL,
  at VARCHAR(32) NOT NULL,
  ats VARCHAR(32) NOT NULL,
  job_id VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  step VARCHAR(16) NOT NULL,
  url VARCHAR(2048) NULL,
  chars INT NULL,
  cut TINYINT NOT NULL DEFAULT 0,
  more_pages TINYINT NOT NULL DEFAULT 0,
  outcome VARCHAR(16) NOT NULL,
  reason VARCHAR(32) NULL,
  warning TINYINT NOT NULL DEFAULT 0,
  detail VARCHAR(2000) NULL,
  PRIMARY KEY (id),
  KEY careers_audit_by_job (ats, job_id),
  KEY careers_audit_by_company (company),
  KEY careers_audit_by_reason (reason),
  KEY careers_audit_by_time (at)
) ${TABLE_OPTIONS}`;

/** Adds description provenance to jobs and creates the remembered careers pages and the lookup audit log. */
async function up(db: Kysely<unknown>): Promise<void> {
    for (const statement of [JOB_COLUMNS, BACKFILL, PAGES, AUDIT]) await sql.raw(statement).execute(db);
}

export const careersLookup: Migration = { up };
