import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import { companyKeys } from "../../companies/keys.js";
import type { Job } from "../../jobs/job.js";
import { sourceParts, type JobSource } from "../jobSource.js";
import { jobRowSchema } from "../rows.js";
import { isDeadlock, withRetry } from "../retry.js";
import type { Database } from "../schema.js";
import { recordCompanies, touchCompanyOf } from "./companyRows.js";
import { keyOf, plainPostings, upsertPostings, type PostingBatch } from "./postingWrites.js";
import { fromSource, outsideSource, ROW_COLUMNS, userJobsOf } from "./userJobsQuery.js";
import type { JobKey } from "../store.js";
import type { JobRow, JobStore, Verdict, VerdictStamp } from "../jobStore.js";

const jobRows = z.array(jobRowSchema);

const DEADLOCK_RETRY = { tries: 3, delayMs: 25, retryable: isDeadlock };

export class KyselyJobStore implements JobStore {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly userId: number,
    ) {}

    /** Records the companies of fetched jobs, then stores their postings and the user's view of each, keeping first seen, score and marks of known jobs, and marking a job for scoring again, for every user, when its description first becomes Markdown. */
    async upsertAll(jobs: Job[], seen: string, source: JobSource): Promise<void> {
        if (jobs.length === 0) return;
        const companyIds = await recordCompanies(this.db, companyKeys(jobs.map((job) => ({ name: job.company, firstSeen: seen, lastSeen: seen }))));
        const write = () =>
            this.db.transaction().execute(async (trx) => {
                const plain = await plainPostings(trx, jobs);
                await upsertPostings(trx, { jobs, seen, source, companyIds });
                await this.upsertViews(trx, { jobs, seen, source, companyIds });
                const turned = jobs.filter((job) => job.description !== null && job.descriptionFormat === "markdown" && plain.has(keyOf({ ats: job.ats, jobId: job.jobId })));
                for (const job of turned) await trx.updateTable("user_jobs").set({ scored_at: null }).where("ats", "=", job.ats).where("job_id", "=", job.jobId).execute();
            });
        await withRetry(write, DEADLOCK_RETRY);
    }

    /** Returns the user's jobs from a source that were last seen in a given fetch and still need scoring. */
    async unscoredSince(source: JobSource, seen: string): Promise<JobRow[]> {
        const rows = await this.unscoredQuery(source).where("u.last_seen", "=", seen).execute();
        return jobRows.parse(rows);
    }

    /** Returns every unscored job the user has from a source, regardless of when it was last seen. */
    async unscoredForSource(source: JobSource): Promise<JobRow[]> {
        return jobRows.parse(await this.unscoredQuery(source).execute());
    }

    /** Lists company names among the user's company-board postings with a title, so JSearch duplicates can be skipped; alert jobs don't count as board postings. */
    async boardCompaniesWithTitle(normalizedTitle: string, notBoards: readonly string[]): Promise<string[]> {
        const rows = await userJobsOf(this.db, this.userId).select("j.company").distinct().where("j.ats", "not in", notBoards).where("j.normalized_title", "=", normalizedTitle).execute();
        return rows.map((row) => row.company);
    }

    /** Lists company names among the user's jobs with this title from any source but one, so alert copies of known jobs can be skipped. */
    async companiesWithTitleOutside(source: JobSource, normalizedTitle: string): Promise<string[]> {
        const rows = await userJobsOf(this.db, this.userId)
            .select("j.company")
            .distinct()
            .where((eb) => outsideSource(eb, source))
            .where("j.normalized_title", "=", normalizedTitle)
            .execute();
        return rows.map((row) => row.company);
    }

    /** Moves only the last-seen time of known jobs, the posting's and the user's, and their companies' found date, so seeing them again never erases their details or score. */
    async markSeen(keys: JobKey[], seen: string): Promise<void> {
        for (const key of keys) {
            await this.db.updateTable("jobs").set({ last_seen: seen }).where("ats", "=", key.ats).where("job_id", "=", key.jobId).execute();
            await this.db.updateTable("user_jobs").set({ last_seen: seen }).where("user_id", "=", this.userId).where("ats", "=", key.ats).where("job_id", "=", key.jobId).execute();
            await touchCompanyOf(this.db, key, seen);
        }
    }

    /** Stores the user's score of a job on each of their jobs with that id and appends each to their verdict history; reports whether they had any. */
    async recordVerdict(verdict: Verdict, stamp: VerdictStamp): Promise<boolean> {
        const values = verdictValues(verdict, stamp);
        return this.db.transaction().execute(async (trx) => {
            const matches = await trx.selectFrom("user_jobs").select("ats").where("user_id", "=", this.userId).where("job_id", "=", verdict.job_id).forUpdate().execute();
            if (matches.length === 0) return false;
            await trx.updateTable("user_jobs").set(values).where("user_id", "=", this.userId).where("job_id", "=", verdict.job_id).execute();
            const history = matches.map(({ ats }) => ({ ...values, user_id: this.userId, ats, job_id: verdict.job_id, run_id: stamp.runId }));
            await trx.insertInto("verdicts").values(history).execute();
            return true;
        });
    }

    /** Looks up one of the user's jobs by its id, or null if they have no such job. */
    async findJob(jobId: string): Promise<JobRow | null> {
        const row = await userJobsOf(this.db, this.userId)
            .select([...ROW_COLUMNS])
            .where("j.job_id", "=", jobId)
            .limit(1)
            .executeTakeFirst();
        return row === undefined ? null : jobRowSchema.parse(row);
    }

    /** Stores the user's view of each fetched posting, the source that found it and when, keeping their first seen, score and marks. */
    private async upsertViews(trx: Transaction<Database>, batch: PostingBatch): Promise<void> {
        const { label, id } = sourceParts(batch.source);
        const rows = batch.jobs.map((job) => ({ user_id: this.userId, ats: job.ats, job_id: job.jobId, source_id: id, source: label, first_seen: batch.seen, last_seen: batch.seen }));
        await trx.insertInto("user_jobs").values(rows).onDuplicateKeyUpdate({ source_id: id, source: label, last_seen: batch.seen }).execute();
    }

    /** Starts the query for the user's unscored jobs from a source, ordered by job id. */
    private unscoredQuery(source: JobSource) {
        return userJobsOf(this.db, this.userId)
            .select([...ROW_COLUMNS])
            .where((eb) => fromSource(eb, source))
            .where("u.scored_at", "is", null)
            .orderBy("j.job_id");
    }
}

/** Returns the score columns a verdict writes, with reasons and gaps stored as JSON lists. */
function verdictValues(verdict: Verdict, stamp: VerdictStamp) {
    const notes = { reasons: JSON.stringify(verdict.reasons), gaps: JSON.stringify(verdict.gaps) };
    return { score: verdict.score, base_score: verdict.base ?? null, bonus_score: verdict.bonus ?? null, ...notes, scored_at: stamp.scoredAt };
}
