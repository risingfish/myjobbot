import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { jobViewSchema, verdictViewSchema } from "./rows.js";
import type { HiddenFlag, JobView, JobViews, Page, ScoreFilter, VerdictView } from "./store.js";

const JOB_COLUMNS = `ats, job_id, source, company, title, url, location, workplace_type, is_remote, compensation,
  posted_at, first_seen, last_seen, publisher, score, reasons, gaps, scored_at, hidden,
  description, base_score, bonus_score`;
const NEWEST_FIRST = "ORDER BY COALESCE(posted_at, first_seen) DESC, first_seen DESC, ats, job_id";
const ALL_JOBS = `SELECT ${JOB_COLUMNS} FROM jobs ${NEWEST_FIRST} LIMIT ? OFFSET ?`;
const VERDICT_HISTORY = `
SELECT v.rowid AS id, v.run_id, v.scored_at, v.score, v.base_score, v.bonus_score, v.reasons, v.gaps, j.title, j.company, j.url, j.source
FROM verdicts v LEFT JOIN jobs j ON j.ats = v.ats AND j.job_id = v.job_id
ORDER BY v.scored_at DESC, v.rowid DESC LIMIT ? OFFSET ?`;
const SET_HIDDEN = "UPDATE jobs SET hidden = ? WHERE ats = ? AND job_id = ?";
const count = z.object({ count: z.number() });

export class SqliteJobViews implements JobViews {
    constructor(private readonly db: DatabaseSync) {}

    /** Returns the visible, newest-first jobs from the given sources that meet a minimum score, for the recommended tab. */
    async scoredFrom(filter: ScoreFilter): Promise<JobView[]> {
        const placeholders = filter.sources.map(() => "?").join(", ");
        const sql = `SELECT ${JOB_COLUMNS} FROM jobs WHERE hidden = 0 AND score >= ? AND source IN (${placeholders}) ${NEWEST_FIRST}`;
        return z.array(jobViewSchema).parse(this.db.prepare(sql).all(filter.minScore, ...filter.sources));
    }

    /** Sets whether a job is hidden from the recommended tab; reports whether the job existed. */
    async setHidden(flag: HiddenFlag): Promise<boolean> {
        const result = this.db.prepare(SET_HIDDEN).run(Number(flag.hidden), flag.ats, flag.jobId);
        return Number(result.changes) > 0;
    }

    /** Returns one newest-first page of every stored job, hidden or not, for the all-jobs tab. */
    async allJobs(page: Page): Promise<JobView[]> {
        return z.array(jobViewSchema).parse(this.db.prepare(ALL_JOBS).all(page.limit, page.offset));
    }

    /** Counts every stored job, for paginating the all-jobs tab. */
    async countAllJobs(): Promise<number> {
        return count.parse(this.db.prepare("SELECT COUNT(*) AS count FROM jobs").get()).count;
    }

    /** Returns one page of past scoring verdicts, newest first, joined with their job's details. */
    async verdictHistory(page: Page): Promise<VerdictView[]> {
        return z.array(verdictViewSchema).parse(this.db.prepare(VERDICT_HISTORY).all(page.limit, page.offset));
    }

    /** Counts every recorded verdict, for paginating the verdict history tab. */
    async countVerdicts(): Promise<number> {
        return count.parse(this.db.prepare("SELECT COUNT(*) AS count FROM verdicts").get()).count;
    }
}
