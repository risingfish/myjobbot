import { sql } from "kysely";
import { expect, test } from "vitest";
import { migrateBefore, migrateUpTo } from "../helpers/migrationSteps.js";
import { testDatabase } from "../helpers/testDb.js";

test("step 015 indexes jobs by job id alone and verdicts by job, in that column order", async () => {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "015");
        expect(await migrateUpTo(db, "020")).toEqual(["015_lookup_indexes", "016_description_boosts", "017_resume", "018_accounts", "019_session_details"]);
        const rows = await sql<{ index_name: string; column_name: string }>`SELECT index_name, column_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND index_name IN ('jobs_by_job_id', 'verdicts_by_job') ORDER BY index_name, seq_in_index`.execute(db);
        expect(rows.rows.map((row) => `${row.index_name}.${row.column_name}`)).toEqual(["jobs_by_job_id.job_id", "verdicts_by_job.ats", "verdicts_by_job.job_id", "verdicts_by_job.scored_at"]);
    } finally {
        await db.destroy();
    }
});
