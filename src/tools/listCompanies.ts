import { z } from "zod";
import type { ToolContext } from "./context.js";
import { unscoredJobs, type Company } from "./fetchJobs.js";
import { defineTool, type Tool } from "./tool.js";

export function listCompaniesTool(context: ToolContext): Tool {
  return defineTool({
    name: "list_companies",
    description: "List the companies whose job boards you can search, with progress for this run.",
    schema: z.object({}),
    run: () => Promise.all(context.config.companies.map((company) => companyStatus(context, company))),
  });
}

function notFetched(context: ToolContext, company: Company) {
  if (context.run.failedFetches.has(company.name)) {
    return { name: company.name, ats: company.ats, fetched: false, fetch_failed: true };
  }
  return { name: company.name, ats: company.ats, fetched: false };
}

async function companyStatus(context: ToolContext, company: Company) {
  const cached = context.run.fetches.get(company.name);
  return cached ? fetchedStatus(context, company, cached) : notFetched(context, company);
}

async function fetchedStatus(context: ToolContext, company: Company, cached: Promise<string>) {
  try {
    const seen = await cached;
    return { name: company.name, ats: company.ats, fetched: true, total_unscored: unscoredJobs(context, company, seen).length };
  } catch {
    return notFetched(context, company);
  }
}
