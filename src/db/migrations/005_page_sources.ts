import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const COLUMNS = "ALTER TABLE careers_audit ADD COLUMN page_source VARCHAR(16) NULL, ADD COLUMN fallback VARCHAR(32) NULL, ADD COLUMN board VARCHAR(160) NULL, ADD COLUMN retry_once TINYINT NOT NULL DEFAULT 0";
const MARK_RETRIES = "UPDATE careers_audit SET retry_once = 1 WHERE step = 'finish' AND reason IN ('careers_page_unreadable', 'job_page_unreadable', 'gave_up')";

/** Records how each careers page was read and gives lookups that failed on unreadable pages one more try. */
async function up(db: Kysely<unknown>): Promise<void> {
    for (const statement of [COLUMNS, MARK_RETRIES]) await sql.raw(statement).execute(db);
}

export const pageSources: Migration = { up };
