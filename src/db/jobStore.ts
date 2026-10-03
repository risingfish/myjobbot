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
INSERT INTO jobs (ats, job_id, company, title, normalized_title, location, department, team,
  workplace_type, is_remote, compensation, url, posted_at, description, first_seen, last_seen)
VALUES (:ats, :job_id, :company, :title, :normalized_title, :location, :department, :team,
  :workplace_type, :is_remote, :compensation, :url, :posted_at, :description, :seen, :seen)
ON CONFLICT (ats, job_id) DO UPDATE SET
  company = excluded.company, title = excluded.title, normalized_title = excluded.normalized_title,
  location = excluded.location, department = excluded.department, team = excluded.team,
  workplace_type = excluded.workplace_type, is_remote = excluded.is_remote,
  compensation = excluded.compensation, url = excluded.url, posted_at = excluded.posted_at,
  description = excluded.description, last_seen = excluded.last_seen`;
const UNSCORED = "SELECT * FROM jobs WHERE company = ? AND last_seen = ? AND scored_at IS NULL ORDER BY job_id";
const RECORD_VERDICT = "UPDATE jobs SET score = ?, reasons = ?, gaps = ?, scored_at = ? WHERE job_id = ?";
const EARLIEST_SEEN = `
SELECT MIN(MIN(first_seen), COALESCE(MIN(posted_at), MIN(first_seen))) AS earliest
FROM jobs WHERE company = ? AND normalized_title = ?`;
const PRUNE = "DELETE FROM jobs WHERE last_seen < ?";

interface Verdict {
  job_id: string;
  score: number;
  reasons: string[];
  gaps: string[];
}

export class JobStore {
  constructor(private readonly db: DatabaseSync) {}

  upsertAll(jobs: Job[], seen: string): void {
    const statement = this.db.prepare(UPSERT);
    this.transaction(() => {
      for (const job of jobs) statement.run(toParams(job, seen));
    });
  }

  unscoredSince(company: string, seen: string): JobRow[] {
    return z.array(jobRow).parse(this.db.prepare(UNSCORED).all(company, seen));
  }

  recordVerdict(verdict: Verdict, scoredAt: string): boolean {
    const { job_id, score, reasons, gaps } = verdict;
    const result = this.db.prepare(RECORD_VERDICT).run(score, JSON.stringify(reasons), JSON.stringify(gaps), scoredAt, job_id);
    return Number(result.changes) > 0;
  }

  earliestSeen(company: string, normalizedTitle: string): string {
    const row = this.db.prepare(EARLIEST_SEEN).get(company, normalizedTitle);
    return z.object({ earliest: z.string() }).parse(row).earliest;
  }

  pruneLastSeenBefore(cutoff: string): number {
    return Number(this.db.prepare(PRUNE).run(cutoff).changes);
  }

  private transaction(work: () => void): void {
    this.db.exec("BEGIN");
    try {
      work();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

function toParams(job: Job, seen: string): Record<string, string | number | null> {
  return {
    ats: job.ats, job_id: job.jobId, company: job.company, title: job.title,
    normalized_title: normalizeTitle(job.title), location: job.location, department: job.department,
    team: job.team, workplace_type: job.workplaceType, is_remote: toFlag(job.isRemote),
    compensation: job.compensation, url: job.url, posted_at: job.postedAt, description: job.description, seen,
  };
}

function toFlag(value: boolean | null): number | null {
  return value === null ? null : Number(value);
}
