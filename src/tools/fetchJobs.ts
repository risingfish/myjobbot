import { z } from "zod";
import type { Job } from "../jobs/job.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import { fetcherFor } from "../sources/index.js";
import type { ToolContext } from "./context.js";
import { summarizeJob } from "./jobSummary.js";
import { findSource, type Source } from "./sources.js";
import { defineTool, type Tool } from "./tool.js";

const PAGE_SIZE = 25;
const schema = z.object({ source: z.string().describe("Source name exactly as returned by list_sources") });

export function fetchJobsTool(context: ToolContext): Tool {
  return defineTool({
    name: "fetch_jobs",
    description: `Return up to ${PAGE_SIZE} unscored jobs from a source (a company board or a saved search) plus total_unscored. Score them with record_matches, then call again until total_unscored is 0.`,
    schema,
    run: ({ source }) => jobPage(context, findSource(context, source)),
  });
}

export function unscoredJobs(context: ToolContext, source: Source, seen: string) {
  const filter = context.config.title_filter;
  return context.store.unscoredSince(source.name, seen).filter((row) => passesTitleFilter(row.title, filter));
}

async function jobPage(context: ToolContext, source: Source) {
  const seen = await fetchOnce(context, source);
  const unscored = unscoredJobs(context, source, seen);
  const jobs = unscored.slice(0, PAGE_SIZE).map((row) => summarizeJob(context, row));
  return { source: source.name, total_unscored: unscored.length, jobs };
}

function fetchOnce(context: ToolContext, source: Source): Promise<string> {
  const cached = context.run.fetches.get(source.name);
  if (cached) return cached;
  const pending = fetchAndStore(context, source);
  context.run.fetches.set(source.name, pending);
  pending.then(() => onFetchSuccess(context, source), () => onFetchFailure(context, source));
  return pending;
}

function onFetchSuccess(context: ToolContext, source: Source): void {
  context.run.failedFetches.delete(source.name);
}

function onFetchFailure(context: ToolContext, source: Source): void {
  context.run.fetches.delete(source.name);
  context.run.failedFetches.add(source.name);
}

async function fetchAndStore(context: ToolContext, source: Source): Promise<string> {
  const jobs = await fetcherFor(source.company.ats)(source.company, context.http);
  logBoardFetch(context, source, jobs);
  const seen = context.now().toISOString();
  context.store.upsertAll(jobs, seen, source.name);
  return seen;
}

function logBoardFetch(context: ToolContext, source: Source, jobs: Job[]): void {
  const { name, ats, slug } = source.company;
  const logged = jobs.map(({ description: _description, ...job }) => job);
  context.jobLog.write({ type: "board_fetch", source: source.name, company: name, ats, slug, job_count: jobs.length, jobs: logged });
}
