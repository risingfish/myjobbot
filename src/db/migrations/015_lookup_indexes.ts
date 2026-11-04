import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

/** Indexes jobs by job id alone, as the model's tools look them up and verdicts lock them, and verdicts by job, as each job's history reads them. */
async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema.createIndex("jobs_by_job_id").on("jobs").column("job_id").execute();
    await db.schema.createIndex("verdicts_by_job").on("verdicts").columns(["ats", "job_id", "scored_at"]).execute();
}

export const lookupIndexes: Migration = { up };
