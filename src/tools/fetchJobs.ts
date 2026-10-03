import { z } from "zod";
import type { FileConfig } from "../config/schema.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import { fetcherFor } from "../sources/index.js";
import type { ToolContext } from "./context.js";
import { summarizeJob } from "./jobSummary.js";
import { defineTool, type Tool } from "./tool.js";

export type Company = FileConfig["companies"][number];

const PAGE_SIZE = 25;
const schema = z.object({ company: z.string().describe("Company name exactly as returned by list_companies") });

export function fetchJobsTool(context: ToolContext): Tool {
  return defineTool({
    name: "fetch_jobs",
    description: `Return up to ${PAGE_SIZE} unscored jobs for a company plus total_unscored. Score them with record_matches, then call again until total_unscored is 0.`,
    schema,
    run: ({ company }) => jobPage(context, findCompany(context, company)),
  });
}

export function unscoredJobs(context: ToolContext, company: Company, seen: string) {
  const filter = context.config.title_filter;
  return context.store.unscoredSince(company.name, seen).filter((row) => passesTitleFilter(row.title, filter));
}

async function jobPage(context: ToolContext, company: Company) {
  const seen = await fetchOnce(context, company);
  const unscored = unscoredJobs(context, company, seen);
  const jobs = unscored.slice(0, PAGE_SIZE).map((row) => summarizeJob(context, row));
  return { company: company.name, total_unscored: unscored.length, jobs };
}

function fetchOnce(context: ToolContext, company: Company): Promise<string> {
  const cached = context.run.fetches.get(company.name);
  if (cached) return cached;
  const pending = fetchAndStore(context, company);
  context.run.fetches.set(company.name, pending);
  pending.catch(() => context.run.fetches.delete(company.name));
  return pending;
}

async function fetchAndStore(context: ToolContext, company: Company): Promise<string> {
  const jobs = await fetcherFor(company.ats)(company, context.http);
  const seen = context.now().toISOString();
  context.store.upsertAll(jobs, seen);
  return seen;
}

function findCompany(context: ToolContext, name: string): Company {
  const wanted = name.trim().toLowerCase();
  const company = context.config.companies.find((candidate) => candidate.name.toLowerCase() === wanted);
  if (!company) throw new Error(`unknown company "${name}"; call list_companies for valid names`);
  return company;
}
