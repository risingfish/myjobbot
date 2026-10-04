import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { Job } from "../jobs/job.js";
import { normalizeTitle } from "../jobs/normalize.js";

const nullableText = z.string().nullable();
const jobRow = z.object({
  ats: z.string(),
  job_id: z.string(),
  company: z.string(),
  title: z.string(),
  normalized_title: z.string(),
  location: nullableText,
  department: nullableText,
  team: nullableText,
  workplace_type: nullableText,
  is_remote: z.number().nullable(),
  compensation: nullableText,
  url: z.string(),
  posted_at: nullableText,
  first_seen: z.string(),
  last_seen: z.string(),
  scored_at: nullableText,
  score: z.number().nullable(),
});
export type JobRow = z.infer<typeof jobRow>;

const UPSERT = `
INSERT INTO jobs (ats, job_id, company, source, title, normalized_title, location, department, team,
  workplace_type, is_remote, compensation, url, posted_at, description, publisher, first_seen, last_seen)
VALUES (:ats, :job_id, :company, :source, :title, :normalized_title, :location, :department, :team,
  :workplace_type, :is_remote, :compensation, :url, :posted_at, :description, :publisher, :seen, :seen)
ON CONFLICT (ats, job_id) DO UPDATE SET
  company = excluded.company, source = excluded.source, title = excluded.title,
  normalized_title = excluded.normalized_title, location = excluded.location,
  department = excluded.department, team = excluded.team, workplace_type = excluded.workplace_type,
  is_remote = excluded.is_remote, compensation = excluded.compensation, url = excluded.url,
  posted_at = excluded.posted_at, description = excluded.description, publisher = excluded.publisher,
  last_seen = excluded.last_seen`;
const UNSCORED = "SELECT * FROM jobs WHERE source = ? AND last_seen = ? AND scored_at IS NULL ORDER BY job_id";
const RECORD_VERDICT = "UPDATE jobs SET score = ?, reasons = ?, gaps = ?, scored_at = ? WHERE job_id = ? RETURNING ats";
const INSERT_VERDICT = "INSERT INTO verdicts (ats, job_id, run_id, scored_at, score, reasons, gaps) VALUES (?, ?, ?, ?, ?, ?, ?)";
const PRUNE_ORPHAN_VERDICTS = `
DELETE FROM verdicts WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE jobs.ats = verdicts.ats AND jobs.job_id = verdicts.job_id)`;
const EARLIEST_SEEN = `
SELECT MIN(MIN(first_seen), COALESCE(MIN(posted_at), MIN(first_seen))) AS earliest
FROM jobs WHERE company = ? AND normalized_title = ?`;
const PRUNE = "DELETE FROM jobs WHERE last_seen < ?";
const UNSCORED_FOR_SOURCE = "SELECT * FROM jobs WHERE source = ? AND scored_at IS NULL ORDER BY job_id";
const BOARD_COMPANIES_WITH_TITLE = "SELECT DISTINCT company FROM jobs WHERE ats != 'jsearch' AND normalized_title = ?";
const FIND_JOB = "SELECT * FROM jobs WHERE job_id = ? LIMIT 1";

interface VerdictStamp {
  scoredAt: string;
  runId: string | null;
}

interface Verdict {
  job_id: string;
  score: number;
  reasons: string[];
  gaps: string[];
}

export class JobStore {
  constructor(private readonly db: DatabaseSync) {}

  upsertAll(jobs: Job[], seen: string, source: string): void {
    const statement = this.db.prepare(UPSERT);
    this.transaction(() => {
      for (const job of jobs) statement.run(toParams(job, seen, source));
    });
  }

  unscoredSince(source: string, seen: string): JobRow[] {
    return z.array(jobRow).parse(this.db.prepare(UNSCORED).all(source, seen));
  }

  unscoredForSource(source: string): JobRow[] {
    return z.array(jobRow).parse(this.db.prepare(UNSCORED_FOR_SOURCE).all(source));
  }

  boardCompaniesWithTitle(normalizedTitle: string): string[] {
    const rows = this.db.prepare(BOARD_COMPANIES_WITH_TITLE).all(normalizedTitle);
    return z.array(z.object({ company: z.string() })).parse(rows).map((row) => row.company);
  }

  recordVerdict(verdict: Verdict, stamp: VerdictStamp): boolean {
    const reasons = JSON.stringify(verdict.reasons);
    const gaps = JSON.stringify(verdict.gaps);
    return this.transaction(() => {
      const updated = this.db.prepare(RECORD_VERDICT).all(verdict.score, reasons, gaps, stamp.scoredAt, verdict.job_id);
      const insert = this.db.prepare(INSERT_VERDICT);
      for (const row of updated) insert.run(String(row.ats), verdict.job_id, stamp.runId, stamp.scoredAt, verdict.score, reasons, gaps);
      return updated.length > 0;
    });
  }

  earliestSeen(company: string, normalizedTitle: string): string {
    const row = this.db.prepare(EARLIEST_SEEN).get(company, normalizedTitle);
    return z.object({ earliest: z.string() }).parse(row).earliest;
  }

  pruneLastSeenBefore(cutoff: string): number {
    const pruned = Number(this.db.prepare(PRUNE).run(cutoff).changes);
    this.db.exec(PRUNE_ORPHAN_VERDICTS);
    return pruned;
  }

  findJob(jobId: string): JobRow | null {
    const row = this.db.prepare(FIND_JOB).get(jobId);
    return row === undefined ? null : jobRow.parse(row);
  }

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

function toParams(job: Job, seen: string, source: string): Record<string, string | number | null> {
  return {
    ats: job.ats, job_id: job.jobId, company: job.company, source, title: job.title,
    normalized_title: normalizeTitle(job.title), location: job.location, department: job.department,
    team: job.team, workplace_type: job.workplaceType, is_remote: toFlag(job.isRemote),
    compensation: job.compensation, url: job.url, posted_at: job.postedAt, description: job.description,
    publisher: job.publisher, seen,
  };
}

function toFlag(value: boolean | null): number | null {
  return value === null ? null : Number(value);
}
