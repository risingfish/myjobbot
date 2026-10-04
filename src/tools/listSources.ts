import { z } from "zod";
import type { ToolContext } from "./context.js";
import { unscoredJobs } from "./fetchJobs.js";
import { configuredSources, type Source } from "./sources.js";
import { defineTool, type Tool } from "./tool.js";

export function listSourcesTool(context: ToolContext): Tool {
  return defineTool({
    name: "list_sources",
    description: "List the sources you can fetch jobs from (company boards and saved searches), with progress for this run.",
    schema: z.object({}),
    run: () => Promise.all(configuredSources(context).map((source) => sourceStatus(context, source))),
  });
}

function describeSource(source: Source) {
  return { name: source.name, kind: source.kind, ats: source.company.ats };
}

function notFetched(context: ToolContext, source: Source) {
  if (context.run.failedFetches.has(source.name)) return { ...describeSource(source), fetched: false, fetch_failed: true };
  return { ...describeSource(source), fetched: false };
}

async function sourceStatus(context: ToolContext, source: Source) {
  const cached = context.run.fetches.get(source.name);
  return cached ? fetchedStatus(context, source, cached) : notFetched(context, source);
}

async function fetchedStatus(context: ToolContext, source: Source, cached: Promise<string>) {
  try {
    const seen = await cached;
    return { ...describeSource(source), fetched: true, total_unscored: unscoredJobs(context, source, seen).length };
  } catch {
    return notFetched(context, source);
  }
}
