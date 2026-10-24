import { sql, type ExpressionBuilder, type Kysely } from "kysely";
import { z } from "zod";
import { companyKeys } from "../../companies/keys.js";
import { normalizeCompany } from "../../jobs/company.js";
import type { Job } from "../../jobs/job.js";
import { jobRowSchema, toParams, type JobFields } from "../rows.js";
import type { Database } from "../schema.js";
import { linkJobs, recordCompanies, touchCompanyOf } from "./companyRows.js";
import type { FoundDescription, JobKey, JobRow, JobStore, Verdict, VerdictStamp } from "../store.js";

const REFRESHED: Array<keyof JobFields | "company_id"> = ["company_id", "company", "source", "title", "normalized_title", "location", "department", "team", "workplace_type", "is_remote", "compensation", "url", "posted_at", "description", "description_format", "description_source", "description_url", "publisher", "requirements", "skills", "preferred_skills"];

const jobRows = z.array(jobRowSchema);

interface Batch {
    seen: string;
    source: string;
    companyIds: Map<string, number>;
}

/** Builds the insert row for a fetched job, first and last seen at the fetch time and linked to its company's record. */
function insertRow(job: Job, batch: Batch) {
    const { seen: _seen, ...fields } = toParams(job, batch.seen, batch.source);
    return { ...fields, company_id: batch.companyIds.get(normalizeCompany(job.company)) ?? null, first_seen: batch.seen, last_seen: batch.seen };
}

/** Keeps a job's scoring time, or clears it the first time its description turns from plain text (or no format) to Markdown; it must precede the format's own update, which MariaDB applies in order. */
function scoredAtAfterRefresh(eb: ExpressionBuilder<Database, "jobs">) {
    const wasPlain = eb.or([eb("description_format", "=", "text"), eb("description_format", "is", null)]);
    const becomesMarkdown = eb(sql<string>`VALUES(description_format)`, "=", "markdown");
    return eb
        .case()
        .when(eb.and([wasPlain, becomesMarkdown]))
        .then(null)
        .else(eb.ref("scored_at"))
        .end();
}

export class KyselyJobStore implements JobStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Records the companies of fetched jobs, then inserts or refreshes the jobs linked to them, keeping first seen, score, the hidden flag and the applied mark of known jobs, and marking a job for scoring again when its description first becomes Markdown. */
    async upsertAll(jobs: Job[], seen: string, source: string): Promise<void> {
        if (jobs.length === 0) return;
        const companyIds = await recordCompanies(this.db, companyKeys(jobs.map((job) => ({ name: job.company, firstSeen: seen, lastSeen: seen }))));
        const refresh = Object.fromEntries([...REFRESHED, "last_seen"].map((column) => [column, sql`VALUES(${sql.ref(column)})`]));
        await this.db
            .insertInto("jobs")
            .values(jobs.map((job) => insertRow(job, { seen, source, companyIds })))
            .onDuplicateKeyUpdate((eb) => ({ scored_at: scoredAtAfterRefresh(eb), ...refresh }))
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

    /** Moves only the last-seen time of known jobs, and their companies' found date, so seeing them again never erases their details or score. */
    async markSeen(keys: JobKey[], seen: string): Promise<void> {
        for (const key of keys) {
            await this.db.updateTable("jobs").set({ last_seen: seen }).where("ats", "=", key.ats).where("job_id", "=", key.jobId).execute();
            await touchCompanyOf(this.db, key, seen);
        }
    }

    /** Links every job without a company record to one, oldest first so each new record is named after its oldest job, and returns how many were linked. */
    async linkUnlinkedJobs(): Promise<number> {
        const rows = await this.db.selectFrom("jobs").select(["ats", "job_id", "company", "first_seen", "last_seen"]).where("company_id", "is", null).orderBy("first_seen").orderBy("ats").orderBy("job_id").execute();
        const companyIds = await recordCompanies(this.db, companyKeys(rows.map((row) => ({ name: row.company, firstSeen: row.first_seen, lastSeen: row.last_seen }))));
        return linkJobs(this.db, rows.map((row) => ({ ats: row.ats, job_id: row.job_id, company_key: normalizeCompany(row.company) })), companyIds);
    }

    /** Stores a description found outside the job's own source, with where it came from, and marks the job for scoring again. */
    async setDescription(key: JobKey, found: FoundDescription): Promise<void> {
        const values = { description: found.description, description_format: found.format, description_source: found.source, description_url: found.url, scored_at: null };
        await this.db.updateTable("jobs").set(values).where("ats", "=", key.ats).where("job_id", "=", key.jobId).execute();
    }

    /** Records when a job's outside text was first found carrying a forged data marker, on every job with that id, keeping the first time. */
    async flagInjection(jobId: string, at: string): Promise<void> {
        await this.db.updateTable("jobs").set({ injection_seen_at: at }).where("job_id", "=", jobId).where("injection_seen_at", "is", null).execute();
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

    /** Deletes jobs not seen since a cutoff, except those marked applied, and their now-orphaned verdicts; returns the number of jobs removed. */
    async pruneLastSeenBefore(cutoff: string): Promise<number> {
        const result = await this.db.deleteFrom("jobs").where("last_seen", "<", cutoff).where("applied", "=", 0).executeTakeFirst();
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
