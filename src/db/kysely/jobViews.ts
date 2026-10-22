import { sql, type Kysely } from "kysely";
import { z } from "zod";
import { jobDetailSchema, jobViewSchema, verdictViewSchema } from "../rows.js";
import type { Database } from "../schema.js";
import type { HiddenFlag, JobDetailRow, JobKey, JobView, JobViews, Page, ScoreFilter, VerdictView } from "../store.js";

const JOB_COLUMNS = ["ats", "job_id", "source", "company", "title", "url", "location", "workplace_type", "is_remote", "compensation", "posted_at", "first_seen", "last_seen", "publisher", "score", "reasons", "gaps", "scored_at", "hidden", "description", "base_score", "bonus_score", "injection_seen_at"] as const;

const DETAIL_COLUMNS = ["description_source", "description_url", "requirements", "skills", "preferred_skills"] as const;

const jobViews = z.array(jobViewSchema);
const verdictViews = z.array(verdictViewSchema);

export class KyselyJobViews implements JobViews {
    constructor(private readonly db: Kysely<Database>) {}

    /** Returns the visible, newest-first jobs from the given sources that meet a minimum score, for the recommended tab. */
    async scoredFrom(filter: ScoreFilter): Promise<JobView[]> {
        if (filter.sources.length === 0) return [];
        const rows = await this.newestFirst().where("hidden", "=", 0).where("score", ">=", filter.minScore).where("source", "in", filter.sources).execute();
        return jobViews.parse(rows);
    }

    /** Sets whether a job is hidden from the recommended tab; reports whether the job existed. */
    async setHidden(flag: HiddenFlag): Promise<boolean> {
        const result = await this.db
            .updateTable("jobs")
            .set({ hidden: Number(flag.hidden) })
            .where("ats", "=", flag.ats)
            .where("job_id", "=", flag.jobId)
            .executeTakeFirst();
        return Number(result.numUpdatedRows) > 0;
    }

    /** Returns one newest-first page of every stored job, hidden or not, for the all-jobs tab. */
    async allJobs(page: Page): Promise<JobView[]> {
        return jobViews.parse(await this.newestFirst().limit(page.limit).offset(page.offset).execute());
    }

    /** Counts every stored job, for paginating the all-jobs tab. */
    async countAllJobs(): Promise<number> {
        const row = await this.db
            .selectFrom("jobs")
            .select((eb) => eb.fn.countAll().as("count"))
            .executeTakeFirstOrThrow();
        return Number(row.count);
    }

    /** Returns one page of past scoring verdicts, newest first, joined with their job's details. */
    async verdictHistory(page: Page): Promise<VerdictView[]> {
        const rows = await this.verdictsNewestFirst().limit(page.limit).offset(page.offset).execute();
        return verdictViews.parse(rows);
    }

    /** Counts every recorded verdict, for paginating the verdict history tab. */
    async countVerdicts(): Promise<number> {
        const row = await this.db
            .selectFrom("verdicts")
            .select((eb) => eb.fn.countAll().as("count"))
            .executeTakeFirstOrThrow();
        return Number(row.count);
    }

    /** Returns one job's stored details for its details panel, or null when no job has that key. */
    async jobDetail(key: JobKey): Promise<JobDetailRow | null> {
        const row = await this.db
            .selectFrom("jobs")
            .select([...JOB_COLUMNS, ...DETAIL_COLUMNS])
            .where("ats", "=", key.ats)
            .where("job_id", "=", key.jobId)
            .executeTakeFirst();
        return row === undefined ? null : jobDetailSchema.parse(row);
    }

    /** Returns every verdict recorded for one job, newest first, for its details panel. */
    async jobVerdicts(key: JobKey): Promise<VerdictView[]> {
        const rows = await this.verdictsNewestFirst().where("v.ats", "=", key.ats).where("v.job_id", "=", key.jobId).execute();
        return verdictViews.parse(rows);
    }

    /** Starts a query over every verdict joined with its job's details, newest first, later verdicts first on a tie. */
    private verdictsNewestFirst() {
        return this.db
            .selectFrom("verdicts as v")
            .leftJoin("jobs as j", (join) => join.onRef("j.ats", "=", "v.ats").onRef("j.job_id", "=", "v.job_id"))
            .select(["v.id", "v.run_id", "v.scored_at", "v.score", "v.base_score", "v.bonus_score", "v.reasons", "v.gaps", "j.title", "j.company", "j.url", "j.source"])
            .orderBy("v.scored_at", "desc")
            .orderBy("v.id", "desc");
    }

    /** Starts a query over every job's view columns, newest posted first, then first seen, then by id. */
    private newestFirst() {
        return this.db
            .selectFrom("jobs")
            .select([...JOB_COLUMNS])
            .orderBy(sql`COALESCE(posted_at, first_seen)`, "desc")
            .orderBy("first_seen", "desc")
            .orderBy("ats")
            .orderBy("job_id");
    }
}
