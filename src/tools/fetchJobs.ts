import { z } from "zod";
import { isExcludedCompany } from "../jobs/companyFilter.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import { fetchBoard } from "./boardFetch.js";
import type { ToolContext } from "./context.js";
import { summarizeJob } from "./jobSummary.js";
import { refreshSearch } from "./searchFetch.js";
import { findSource, type FetchOutcome, type Source } from "./sources.js";
import { defineTool, type Tool } from "./tool.js";

const PAGE_SIZE = 25;
const schema = z.object({ source: z.string().describe("Source name exactly as returned by list_sources") });

/** Builds the fetch_jobs tool, letting the model refresh a source and page through its unscored jobs. */
export function fetchJobsTool(context: ToolContext): Tool {
  return defineTool({
    name: "fetch_jobs",
    description: `Return up to ${PAGE_SIZE} unscored jobs from a source (a company board or a saved search) plus total_unscored. Score them with record_matches, then call again until total_unscored is 0.`,
    schema,
    run: ({ source }) => jobPage(context, findSource(context, source)),
  });
}

/** Returns a source's jobs that still need scoring, filtered by the title and excluded-company config. */
export function unscoredJobs(context: ToolContext, sourceName: string, outcome: FetchOutcome) {
  const { store, config } = context;
  const rows = outcome.seen === null ? store.unscoredForSource(sourceName) : store.unscoredSince(sourceName, outcome.seen);
  return rows.filter((row) => passesTitleFilter(row.title, config.title_filter) && !isExcludedCompany(row.company, config.exclude_companies));
}

/** Fetches a source, then builds the paginated fetch_jobs response of its unscored jobs. */
async function jobPage(context: ToolContext, source: Source) {
  const outcome = await fetchOnce(context, source);
  const unscored = unscoredJobs(context, source.name, outcome);
  const jobs = unscored.slice(0, PAGE_SIZE).map((row) => summarizeJob(context, row));
  const page = { source: source.name, total_unscored: unscored.length, jobs };
  return source.kind === "search" ? { ...page, ...refreshFields(outcome) } : page;
}

/** Reports, for a search source, whether JSearch was actually refreshed or skipped and why. */
function refreshFields(outcome: FetchOutcome) {
  return outcome.note === null ? { refreshed: true } : { refreshed: false, refresh_note: outcome.note };
}

/** Fetches a source at most once per run, caching and reusing the in-flight or completed fetch. */
function fetchOnce(context: ToolContext, source: Source): Promise<FetchOutcome> {
  const cached = context.run.fetches.get(source.name);
  if (cached) return cached;
  const pending = source.kind === "board" ? fetchBoard(context, source.company) : refreshSearch(context, source.search);
  context.run.fetches.set(source.name, pending);
  pending.then(() => context.run.failedFetches.delete(source.name), () => onFetchFailure(context, source));
  return pending;
}

/** Records that a source's fetch failed so later status checks and finish report it. */
function onFetchFailure(context: ToolContext, source: Source): void {
  context.run.fetches.delete(source.name);
  context.run.failedFetches.add(source.name);
}
