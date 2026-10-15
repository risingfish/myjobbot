import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { Job } from "../jobs/job.js";
import { jobRowSchema, toParams } from "./rows.js";
import type { JobRow, JobStore, Verdict, VerdictStamp } from "./store.js";

const UPSERT = `
INSERT INTO jobs (ats, job_id, company, source, title, normalized_title, location, department, team,
  workplace_type, is_remote, compensation, url, posted_at, description, publisher, requirements, skills,
  preferred_skills, first_seen, last_seen)
VALUES (:ats, :job_id, :company, :source, :title, :normalized_title, :location, :department, :team,
  :workplace_type, :is_remote, :compensation, :url, :posted_at, :description, :publisher, :requirements, :skills,
  :preferred_skills, :seen, :seen)
ON CONFLICT (ats, job_id) DO UPDATE SET
  company = excluded.company, source = excluded.source, title = excluded.title,
  normalized_title = excluded.normalized_title, location = excluded.location,
  department = excluded.department, team = excluded.team, workplace_type = excluded.workplace_type,
  is_remote = excluded.is_remote, compensation = excluded.compensation, url = excluded.url,
  posted_at = excluded.posted_at, description = excluded.description, publisher = excluded.publisher,
  requirements = excluded.requirements, skills = excluded.skills, preferred_skills = excluded.preferred_skills,
  last_seen = excluded.last_seen`;
const UNSCORED = "SELECT * FROM jobs WHERE source = ? AND last_seen = ? AND scored_at IS NULL ORDER BY job_id";
const RECORD_VERDICT = `
UPDATE jobs SET score = ?, base_score = ?, bonus_score = ?, reasons = ?, gaps = ?, scored_at = ? WHERE job_id = ? RETURNING ats`;
const INSERT_VERDICT = `
INSERT INTO verdicts (ats, job_id, run_id, scored_at, score, base_score, bonus_score, reasons, gaps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const PRUNE_ORPHAN_VERDICTS = `
DELETE FROM verdicts WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE jobs.ats = verdicts.ats AND jobs.job_id = verdicts.job_id)`;
const EARLIEST_SEEN = `
SELECT MIN(MIN(first_seen), COALESCE(MIN(posted_at), MIN(first_seen))) AS earliest
FROM jobs WHERE company = ? AND normalized_title = ?`;
const PRUNE = "DELETE FROM jobs WHERE last_seen < ?";
const UNSCORED_FOR_SOURCE = "SELECT * FROM jobs WHERE source = ? AND scored_at IS NULL ORDER BY job_id";
const BOARD_COMPANIES_WITH_TITLE = "SELECT DISTINCT company FROM jobs WHERE ats != 'jsearch' AND normalized_title = ?";
const FIND_JOB = "SELECT * FROM jobs WHERE job_id = ? LIMIT 1";

export class SqliteJobStore implements JobStore {
    constructor(private readonly db: DatabaseSync) {}

    /** Inserts or refreshes jobs from a fetch, marking them seen now so stale postings age out later. */
    async upsertAll(jobs: Job[], seen: string, source: string): Promise<void> {
        const statement = this.db.prepare(UPSERT);
        this.transaction(() => {
            for (const job of jobs) statement.run(toParams(job, seen, source));
        });
    }

    /** Returns jobs from a source that were last seen in a given fetch and still need scoring. */
    async unscoredSince(source: string, seen: string): Promise<JobRow[]> {
        return z.array(jobRowSchema).parse(this.db.prepare(UNSCORED).all(source, seen));
    }

    /** Returns every unscored job for a source, regardless of when it was last seen. */
    async unscoredForSource(source: string): Promise<JobRow[]> {
        return z.array(jobRowSchema).parse(this.db.prepare(UNSCORED_FOR_SOURCE).all(source));
    }

    /** Lists company names with company-board postings for a title, so JSearch duplicates can be skipped. */
    async boardCompaniesWithTitle(normalizedTitle: string): Promise<string[]> {
        const rows = this.db.prepare(BOARD_COMPANIES_WITH_TITLE).all(normalizedTitle);
        return z
            .array(z.object({ company: z.string() }))
            .parse(rows)
            .map((row) => row.company);
    }

    /** Stores a job's score on the job row and appends it to the verdict history; reports whether the job existed. */
    async recordVerdict(verdict: Verdict, stamp: VerdictStamp): Promise<boolean> {
        const parts = [verdict.score, verdict.base ?? null, verdict.bonus ?? null] as const;
        const notes = [JSON.stringify(verdict.reasons), JSON.stringify(verdict.gaps)] as const;
        return this.transaction(() => {
            const updated = this.db.prepare(RECORD_VERDICT).all(...parts, ...notes, stamp.scoredAt, verdict.job_id);
            const insert = this.db.prepare(INSERT_VERDICT);
            for (const row of updated) insert.run(String(row.ats), verdict.job_id, stamp.runId, stamp.scoredAt, ...parts, ...notes);
            return updated.length > 0;
        });
    }

    /** Returns the oldest date seen for a company and title across reposts, so ghost detection counts true age. */
    async earliestSeen(company: string, normalizedTitle: string): Promise<string> {
        const row = this.db.prepare(EARLIEST_SEEN).get(company, normalizedTitle);
        return z.object({ earliest: z.string() }).parse(row).earliest;
    }

    /** Deletes jobs not seen since a cutoff and their now-orphaned verdicts; returns the number of jobs removed. */
    async pruneLastSeenBefore(cutoff: string): Promise<number> {
        const pruned = Number(this.db.prepare(PRUNE).run(cutoff).changes);
        this.db.exec(PRUNE_ORPHAN_VERDICTS);
        return pruned;
    }

    /** Looks up a single job by its id, or null if no such job is stored. */
    async findJob(jobId: string): Promise<JobRow | null> {
        const row = this.db.prepare(FIND_JOB).get(jobId);
        return row === undefined ? null : jobRowSchema.parse(row);
    }

    /** Runs a block of writes atomically, rolling back if any step throws. */
    private transaction<T>(work: () => T): T {
        this.db.exec("BEGIN");
        try {
            const result = work();
            this.db.exec("COMMIT");
            return result;
        } catch (error) {
            this.db.exec("ROLLBACK");
            throw error;
        }
    }
}
