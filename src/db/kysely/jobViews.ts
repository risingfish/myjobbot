import { sql, type Kysely } from "kysely";
import { z } from "zod";
import { jobDetailSchema, jobViewSchema, verdictViewSchema } from "../rows.js";
import type { Database } from "../schema.js";
import type { AppliedChange, HiddenFlag, JobDetailRow, JobKey, JobView, JobViews, Page, ScoreFilter, VerdictView } from "../store.js";
import { userJobsOf, VIEW_COLUMNS } from "./userJobsQuery.js";

const DETAIL_COLUMNS = ["j.description_source", "j.description_url", "j.requirements", "j.skills", "j.preferred_skills"] as const;

const jobViews = z.array(jobViewSchema);
const verdictViews = z.array(verdictViewSchema);

export class KyselyJobViews implements JobViews {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly userId: number,
    ) {}

    /** Returns the user's visible, newest-first jobs from the given sources that meet a minimum score, for the recommended tab. */
    async scoredFrom(filter: ScoreFilter): Promise<JobView[]> {
        if (filter.sources.length === 0) return [];
        const rows = await this.newestFirst().where("u.hidden", "=", 0).where("u.score", ">=", filter.minScore).where("u.source", "in", filter.sources).execute();
        return jobViews.parse(rows);
    }

    /** Sets whether one of the user's jobs is hidden from their recommended tab; reports whether they have the job. */
    async setHidden(flag: HiddenFlag): Promise<boolean> {
        const result = await this.mine(flag).set({ hidden: Number(flag.hidden) }).executeTakeFirst();
        return Number(result.numUpdatedRows) > 0;
    }

    /** Removes the user's score, reasons, gaps and scored time of a job, keeping their marks and verdict history; reports whether they have the job. */
    async clearScore(key: JobKey): Promise<boolean> {
        const result = await this.mine(key).set({ score: null, base_score: null, bonus_score: null, reasons: null, gaps: null, scored_at: null }).executeTakeFirst();
        return Number(result.numUpdatedRows) > 0;
    }

    /** Marks one of the user's jobs applied, keeping the time it was first marked, or clears the mark; gives the stored time, or null when they don't have the job. */
    async setApplied(change: AppliedChange): Promise<{ appliedOn: string | null } | null> {
        const result = await this.mine(change)
            .set((eb) => (change.applied ? { applied: 1, applied_on: eb.fn.coalesce("applied_on", eb.val(change.at)) } : { applied: 0, applied_on: null }))
            .executeTakeFirst();
        if (Number(result.numUpdatedRows) === 0) return null;
        const row = await this.db.selectFrom("user_jobs").select("applied_on").where("user_id", "=", this.userId).where("ats", "=", change.ats).where("job_id", "=", change.jobId).executeTakeFirstOrThrow();
        return { appliedOn: row.applied_on };
    }

    /** Returns one newest-first page of every job the user has, hidden or not, for the all-jobs tab. */
    async allJobs(page: Page): Promise<JobView[]> {
        return jobViews.parse(await this.newestFirst().limit(page.limit).offset(page.offset).execute());
    }

    /** Counts every job the user has, for paginating the all-jobs tab. */
    async countAllJobs(): Promise<number> {
        return this.countJobs(false);
    }

    /** Returns one page of the user's jobs marked applied, hidden or not, most recently marked first, for the Applied tab. */
    async appliedJobs(page: Page): Promise<JobView[]> {
        const rows = await userJobsOf(this.db, this.userId).select([...VIEW_COLUMNS]).where("u.applied", "=", 1).orderBy("u.applied_on", "desc").orderBy("j.ats").orderBy("j.job_id").limit(page.limit).offset(page.offset).execute();
        return jobViews.parse(rows);
    }

    /** Counts the user's jobs marked applied, for paginating the Applied tab. */
    async countApplied(): Promise<number> {
        return this.countJobs(true);
    }

    /** Returns one page of the user's past scoring verdicts, newest first, joined with their job's details. */
    async verdictHistory(page: Page): Promise<VerdictView[]> {
        const rows = await this.verdictsNewestFirst().limit(page.limit).offset(page.offset).execute();
        return verdictViews.parse(rows);
    }

    /** Counts the user's recorded verdicts, for paginating the verdict history tab. */
    async countVerdicts(): Promise<number> {
        const row = await this.db
            .selectFrom("verdicts")
            .select((eb) => eb.fn.countAll().as("count"))
            .where("user_id", "=", this.userId)
            .executeTakeFirstOrThrow();
        return Number(row.count);
    }

    /** Returns one of the user's jobs with its stored details, for its details panel, or null when they don't have it. */
    async jobDetail(key: JobKey): Promise<JobDetailRow | null> {
        const row = await userJobsOf(this.db, this.userId)
            .select([...VIEW_COLUMNS, ...DETAIL_COLUMNS])
            .where("j.ats", "=", key.ats)
            .where("j.job_id", "=", key.jobId)
            .executeTakeFirst();
        return row === undefined ? null : jobDetailSchema.parse(row);
    }

    /** Returns every verdict the user has for one job, newest first, for its details panel. */
    async jobVerdicts(key: JobKey): Promise<VerdictView[]> {
        const rows = await this.verdictsNewestFirst().where("v.ats", "=", key.ats).where("v.job_id", "=", key.jobId).execute();
        return verdictViews.parse(rows);
    }

    /** Lists the user's jobs scored most recently, by their latest verdict, each once, newest first. */
    async recentlyScored(limit: number): Promise<JobKey[]> {
        const rows = await this.db.selectFrom("verdicts").select(["ats", "job_id"]).select(({ fn }) => fn.max("scored_at").as("latest")).where("user_id", "=", this.userId).groupBy(["ats", "job_id"]).orderBy("latest", "desc").limit(limit).execute();
        return rows.map((row) => ({ ats: row.ats, jobId: row.job_id }));
    }

    /** Starts an update of the user's own view of one job. */
    private mine(key: JobKey) {
        return this.db.updateTable("user_jobs").where("user_id", "=", this.userId).where("ats", "=", key.ats).where("job_id", "=", key.jobId);
    }

    /** Counts the user's jobs, or only those they marked applied. */
    private async countJobs(appliedOnly: boolean): Promise<number> {
        const query = this.db.selectFrom("user_jobs").select((eb) => eb.fn.countAll().as("count")).where("user_id", "=", this.userId);
        const row = await (appliedOnly ? query.where("applied", "=", 1) : query).executeTakeFirstOrThrow();
        return Number(row.count);
    }

    /** Starts a query over the user's verdicts joined with their job's details and their label for its source, newest first, later verdicts first on a tie. */
    private verdictsNewestFirst() {
        return this.db
            .selectFrom("verdicts as v")
            .leftJoin("jobs as j", (join) => join.onRef("j.ats", "=", "v.ats").onRef("j.job_id", "=", "v.job_id"))
            .leftJoin("user_jobs as u", (join) => join.onRef("u.user_id", "=", "v.user_id").onRef("u.ats", "=", "v.ats").onRef("u.job_id", "=", "v.job_id"))
            .select(["v.id", "v.run_id", "v.scored_at", "v.score", "v.base_score", "v.bonus_score", "v.reasons", "v.gaps", "j.title", "j.company", "j.url", "u.source"])
            .where("v.user_id", "=", this.userId)
            .orderBy("v.scored_at", "desc")
            .orderBy("v.id", "desc");
    }

    /** Starts a query over the user's jobs' view columns, newest posted first, then first seen, then by id. */
    private newestFirst() {
        return userJobsOf(this.db, this.userId)
            .select([...VIEW_COLUMNS])
            .orderBy(sql`COALESCE(j.posted_at, u.first_seen)`, "desc")
            .orderBy("u.first_seen", "desc")
            .orderBy("j.ats")
            .orderBy("j.job_id");
    }
}
