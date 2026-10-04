import type { Job } from "../jobs/job.js";
import { fetcherFor } from "../sources/index.js";
import type { ToolContext } from "./context.js";
import { withoutDescription } from "./jobLog.js";
import type { Company, FetchOutcome } from "./sources.js";

export async function fetchBoard(context: ToolContext, company: Company): Promise<FetchOutcome> {
  const jobs = await fetcherFor(company.ats)(company, context.http);
  logBoardFetch(context, company, jobs);
  const seen = context.now().toISOString();
  context.store.upsertAll(jobs, seen, company.name);
  return { seen, note: null };
}

function logBoardFetch(context: ToolContext, company: Company, jobs: Job[]): void {
  const { name, ats, slug } = company;
  const logged = jobs.map(withoutDescription);
  context.jobLog.write({ type: "board_fetch", source: name, company: name, ats, slug, job_count: jobs.length, jobs: logged });
}
