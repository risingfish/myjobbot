import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { jsonList as list } from "./columns.js";

const text = z.string().nullable();

const jobView = z.object({
  ats: z.string(),
  job_id: z.string(),
  source: z.string(),
  company: z.string(),
  title: z.string(),
  url: z.string(),
  location: text,
  workplace_type: text,
  is_remote: z.number().nullable(),
  compensation: text,
  posted_at: text,
  first_seen: z.string(),
  last_seen: z.string(),
  publisher: text,
  score: z.number().nullable(),
  reasons: list,
  gaps: list,
  scored_at: text,
});
export type JobView = z.infer<typeof jobView>;

const verdictView = z.object({
  run_id: text,
  scored_at: z.string(),
  score: z.number(),
  reasons: list,
  gaps: list,
  title: text,
  company: text,
  url: text,
  source: text,
});
export type VerdictView = z.infer<typeof verdictView>;

export interface Page {
  offset: number;
  limit: number;
}

export interface ScoreFilter {
  sources: string[];
  minScore: number;
}

const JOB_COLUMNS = `ats, job_id, source, company, title, url, location, workplace_type, is_remote, compensation,
  posted_at, first_seen, last_seen, publisher, score, reasons, gaps, scored_at`;
const NEWEST_FIRST = "ORDER BY COALESCE(posted_at, first_seen) DESC, first_seen DESC, ats, job_id";
const ALL_JOBS = `SELECT ${JOB_COLUMNS} FROM jobs ${NEWEST_FIRST} LIMIT ? OFFSET ?`;
const VERDICT_HISTORY = `
SELECT v.run_id, v.scored_at, v.score, v.reasons, v.gaps, j.title, j.company, j.url, j.source
FROM verdicts v LEFT JOIN jobs j ON j.ats = v.ats AND j.job_id = v.job_id
ORDER BY v.scored_at DESC, v.rowid DESC LIMIT ? OFFSET ?`;
const count = z.object({ count: z.number() });

export class JobViews {
  constructor(private readonly db: DatabaseSync) {}

  scoredFrom(filter: ScoreFilter): JobView[] {
    const placeholders = filter.sources.map(() => "?").join(", ");
    const sql = `SELECT ${JOB_COLUMNS} FROM jobs WHERE score >= ? AND source IN (${placeholders}) ${NEWEST_FIRST}`;
    return z.array(jobView).parse(this.db.prepare(sql).all(filter.minScore, ...filter.sources));
  }

  allJobs(page: Page): JobView[] {
    return z.array(jobView).parse(this.db.prepare(ALL_JOBS).all(page.limit, page.offset));
  }

  countAllJobs(): number {
    return count.parse(this.db.prepare("SELECT COUNT(*) AS count FROM jobs").get()).count;
  }

  verdictHistory(page: Page): VerdictView[] {
    return z.array(verdictView).parse(this.db.prepare(VERDICT_HISTORY).all(page.limit, page.offset));
  }

  countVerdicts(): number {
    return count.parse(this.db.prepare("SELECT COUNT(*) AS count FROM verdicts").get()).count;
  }
}
