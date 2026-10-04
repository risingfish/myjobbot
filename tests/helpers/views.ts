import { JobStore } from "../../src/db/jobStore.js";
import { JobViews } from "../../src/db/jobViews.js";
import { openDatabase } from "../../src/db/open.js";
import { makeJob } from "../../src/jobs/job.js";

export const FIRST_PAGE = { offset: 0, limit: 100 };

export interface SeedJob {
  id: string;
  source?: string;
  score?: number;
  title?: string;
  url?: string;
  postedAt?: string | null;
  publisher?: string;
}

export function seededViews(entries: SeedJob[]): JobViews {
  const db = openDatabase(":memory:");
  const store = new JobStore(db);
  for (const entry of entries) store.upsertAll([seedJob(entry)], "2026-10-01T00:00:00.000Z", entry.source ?? "Stripe");
  const scored = entries.filter((entry) => entry.score !== undefined);
  for (const entry of scored) store.recordVerdict(seedVerdict(entry), { scoredAt: "2026-10-02T00:00:00.000Z", runId: "run-1" });
  return new JobViews(db);
}

function seedJob(entry: SeedJob) {
  const core = { ats: "greenhouse" as const, jobId: entry.id, company: "Acme", title: entry.title ?? `Software Engineer ${entry.id}`, url: entry.url ?? `https://example.com/${entry.id}` };
  return makeJob(core, { location: "Remote", postedAt: entry.postedAt === undefined ? "2026-09-30T00:00:00.000Z" : entry.postedAt, publisher: entry.publisher ?? null });
}

function seedVerdict(entry: SeedJob) {
  return { job_id: entry.id, score: entry.score ?? 0, reasons: [`reason ${entry.id}`], gaps: [`gap ${entry.id}`] };
}
