import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const text = z.string().nullable();
const list = z
  .string()
  .nullable()
  .transform((value) => (value === null ? [] : JSON.parse(value)))
  .pipe(z.array(z.string()));

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

export interface RecommendedFilter {
  sources: string[];
  threshold: number;
}

const JOB_COLUMNS = `ats, job_id, source, company, title, url, location, workplace_type, is_remote, compensation,
  posted_at, first_seen, last_seen, publisher, score, reasons, gaps, scored_at`;
const RECOMMENDED_ORDER = "ORDER BY score DESC, scored_at DESC, ats, job_id";
const ALL_JOBS = `SELECT ${JOB_COLUMNS} FROM jobs ORDER BY last_seen DESC, first_seen DESC, ats, job_id LIMIT ? OFFSET ?`;
const VERDICT_HISTORY = `
SELECT v.run_id, v.scored_at, v.score, v.reasons, v.gaps, j.title, j.company, j.url, j.source
FROM verdicts v LEFT JOIN jobs j ON j.ats = v.ats AND j.job_id = v.job_id
ORDER BY v.scored_at DESC, v.rowid DESC LIMIT ? OFFSET ?`;
const count = z.object({ count: z.number() });

export class JobViews {
  constructor(private readonly db: DatabaseSync) {}

  recommended(filter: RecommendedFilter, page: Page): JobView[] {
    const sql = `SELECT ${JOB_COLUMNS} FROM jobs WHERE ${recommendedWhere(filter)} ${RECOMMENDED_ORDER} LIMIT ? OFFSET ?`;
    return z.array(jobView).parse(this.db.prepare(sql).all(filter.threshold, ...filter.sources, page.limit, page.offset));
  }

  countRecommended(filter: RecommendedFilter): number {
    const sql = `SELECT COUNT(*) AS count FROM jobs WHERE ${recommendedWhere(filter)}`;
    return count.parse(this.db.prepare(sql).get(filter.threshold, ...filter.sources)).count;
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

function recommendedWhere(filter: RecommendedFilter): string {
  return `score >= ? AND source IN (${filter.sources.map(() => "?").join(", ")})`;
}
