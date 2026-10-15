import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const TABLE_OPTIONS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin";

const JOBS = `
CREATE TABLE jobs (
  ats VARCHAR(32) NOT NULL,
  job_id VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  source VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  normalized_title VARCHAR(500) NOT NULL,
  location VARCHAR(255) NULL,
  department VARCHAR(255) NULL,
  team VARCHAR(255) NULL,
  workplace_type VARCHAR(255) NULL,
  is_remote TINYINT NULL,
  compensation VARCHAR(255) NULL,
  url VARCHAR(2048) NOT NULL,
  posted_at VARCHAR(32) NULL,
  description MEDIUMTEXT NULL,
  publisher VARCHAR(255) NULL,
  requirements TEXT NULL,
  skills TEXT NULL,
  preferred_skills TEXT NULL,
  first_seen VARCHAR(32) NOT NULL,
  last_seen VARCHAR(32) NOT NULL,
  scored_at VARCHAR(32) NULL,
  score INT NULL,
  base_score INT NULL,
  bonus_score INT NULL,
  reasons TEXT NULL,
  gaps TEXT NULL,
  emailed_at VARCHAR(32) NULL,
  hidden TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (ats, job_id),
  KEY jobs_by_company_title (company, normalized_title),
  KEY jobs_by_source (source, scored_at)
) ${TABLE_OPTIONS}`;

const VERDICTS = `
CREATE TABLE verdicts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ats VARCHAR(32) NOT NULL,
  job_id VARCHAR(255) NOT NULL,
  run_id VARCHAR(64) NULL,
  scored_at VARCHAR(32) NOT NULL,
  score INT NOT NULL,
  base_score INT NULL,
  bonus_score INT NULL,
  reasons TEXT NOT NULL,
  gaps TEXT NOT NULL,
  PRIMARY KEY (id),
  KEY verdicts_by_time (scored_at)
) ${TABLE_OPTIONS}`;

const API_CALLS = `
CREATE TABLE api_calls (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  api VARCHAR(32) NOT NULL,
  source VARCHAR(255) NOT NULL,
  called_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  KEY api_calls_by_api_time (api, called_at)
) ${TABLE_OPTIONS}`;

/** Creates the jobs, verdicts and API-call tables with exact (binary) text comparison. */
async function up(db: Kysely<unknown>): Promise<void> {
    for (const statement of [JOBS, VERDICTS, API_CALLS]) await sql.raw(statement).execute(db);
}

export const initial: Migration = { up };
