import { sql, type Kysely } from "kysely";
import { z } from "zod";
import type { Job } from "../../jobs/job.js";
import { jobRowSchema, toParams, type JobFields } from "../rows.js";
import type { Database } from "../schema.js";
import type { FoundDescription, JobKey, JobRow, JobStore, Verdict, VerdictStamp } from "../store.js";

const REFRESHED: Array<keyof JobFields> = ["company", "source", "title", "normalized_title", "location", "department", "team", "workplace_type", "is_remote", "compensation", "url", "posted_at", "description", "description_source", "description_url", "publisher", "requirements", "skills", "preferred_skills"];

const jobRows = z.array(jobRowSchema);

/** Builds the insert row for a fetched job, first and last seen at the fetch time. */
function insertRow(job: Job, seen: string, source: string) {
    const { seen: _seen, ...fields } = toParams(job, seen, source);
    return { ...fields, first_seen: seen, last_seen: seen };
}

export class KyselyJobStore implements JobStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Inserts or refreshes jobs from a fetch, keeping first seen, score and the hidden flag of known jobs. */
    async upsertAll(jobs: Job[], seen: string, source: string): Promise<void> {
        if (jobs.length === 0) return;
        const refresh = Object.fromEntries([...REFRESHED, "last_seen"].map((column) => [column, sql`VALUES(${sql.ref(column)})`]));
        await this.db
            .insertInto("jobs")
            .values(jobs.map((job) => insertRow(job, seen, source)))
            .onDuplicateKeyUpdate(refresh)
            .execute();
    }

    /** Returns jobs from a source that were last seen in a given fetch and still need scoring. */
    async unscoredSince(source: string, seen: string): Promise<JobRow[]> {
        const rows = await this.unscoredQuery(source).where("last_seen", "=", seen).execute();
        return jobRows.parse(rows);
    }

    /** Returns every unscored job for a source, regardless of when it was last seen. */
    async unscoredForSource(source: string): Promise<JobRow[]> {
        return jobRows.parse(await this.unscoredQuery(source).execute());
    }

    /** Lists company names with company-board postings for a title, so JSearch duplicates can be skipped; alert jobs don't count as board postings. */
    async boardCompaniesWithTitle(normalizedTitle: string): Promise<string[]> {
        const rows = await this.db.selectFrom("jobs").select("company").distinct().where("ats", "not in", ["jsearch", "linkedin"]).where("normalized_title", "=", normalizedTitle).execute();
        return rows.map((row) => row.company);
    }

    /** Lists company names with a job of this title from any source but one, so alert copies of known jobs can be skipped. */
    async companiesWithTitleOutside(source: string, normalizedTitle: string): Promise<string[]> {
        const rows = await this.db.selectFrom("jobs").select("company").distinct().where("source", "!=", source).where("normalized_title", "=", normalizedTitle).execute();
        return rows.map((row) => row.company);
    }

    /** Moves only the last-seen time of known jobs, so seeing them again never erases their details or score. */
    async markSeen(keys: JobKey[], seen: string): Promise<void> {
        for (const key of keys) await this.db.updateTable("jobs").set({ last_seen: seen }).where("ats", "=", key.ats).where("job_id", "=", key.jobId).execute();
    }

    /** Stores a description found outside the job's own source, with where it came from, and marks the job for scoring again. */
    async setDescription(key: JobKey, found: FoundDescription): Promise<void> {
        const values = { description: found.description, description_source: found.source, description_url: found.url, scored_at: null };
        await this.db.updateTable("jobs").set(values).where("ats", "=", key.ats).where("job_id", "=", key.jobId).execute();
    }

    /** Stores a job's score on every job with that id and appends each to the verdict history; reports whether any existed. */
    async recordVerdict(verdict: Verdict, stamp: VerdictStamp): Promise<boolean> {
        const values = verdictValues(verdict, stamp);
        return this.db.transaction().execute(async (trx) => {
            const matches = await trx.selectFrom("jobs").select("ats").where("job_id", "=", verdict.job_id).forUpdate().execute();
            if (matches.length === 0) return false;
            await trx.updateTable("jobs").set(values).where("job_id", "=", verdict.job_id).execute();
            const history = matches.map(({ ats }) => ({ ...values, ats, job_id: verdict.job_id, run_id: stamp.runId }));
            await trx.insertInto("verdicts").values(history).execute();
            return true;
        });
    }

    /** Returns the oldest date seen for a company and title across reposts, so ghost detection counts true age. */
    async earliestSeen(company: string, normalizedTitle: string): Promise<string> {
        const earliest = sql<string | null>`LEAST(MIN(first_seen), COALESCE(MIN(posted_at), MIN(first_seen)))`.as("earliest");
        const row = await this.db.selectFrom("jobs").select(earliest).where("company", "=", company).where("normalized_title", "=", normalizedTitle).executeTakeFirst();
        return z.object({ earliest: z.string() }).parse(row).earliest;
    }

    /** Deletes jobs not seen since a cutoff and their now-orphaned verdicts; returns the number of jobs removed. */
    async pruneLastSeenBefore(cutoff: string): Promise<number> {
        const result = await this.db.deleteFrom("jobs").where("last_seen", "<", cutoff).executeTakeFirst();
        await this.db
            .deleteFrom("verdicts")
            .where(({ not, exists, selectFrom }) =>
                not(
                    exists(
                        selectFrom("jobs")
                            .select(sql`1`.as("one"))
                            .whereRef("jobs.ats", "=", "verdicts.ats")
                            .whereRef("jobs.job_id", "=", "verdicts.job_id"),
                    ),
                ),
            )
            .execute();
        return Number(result.numDeletedRows);
    }

    /** Looks up a single job by its id, or null if no such job is stored. */
    async findJob(jobId: string): Promise<JobRow | null> {
        const row = await this.db.selectFrom("jobs").selectAll().where("job_id", "=", jobId).limit(1).executeTakeFirst();
        return row === undefined ? null : jobRowSchema.parse(row);
    }

    /** Starts the query for a source's unscored jobs, ordered by job id. */
    private unscoredQuery(source: string) {
        return this.db.selectFrom("jobs").selectAll().where("source", "=", source).where("scored_at", "is", null).orderBy("job_id");
    }
}

/** Returns the score columns a verdict writes, with reasons and gaps stored as JSON lists. */
function verdictValues(verdict: Verdict, stamp: VerdictStamp) {
    const notes = { reasons: JSON.stringify(verdict.reasons), gaps: JSON.stringify(verdict.gaps) };
    return { score: verdict.score, base_score: verdict.base ?? null, bonus_score: verdict.bonus ?? null, ...notes, scored_at: stamp.scoredAt };
}
