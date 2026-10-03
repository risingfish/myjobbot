import { z } from "zod";
import type { ToolContext } from "./context.js";
import { summarizeJob } from "./jobSummary.js";
import { defineTool, type Tool } from "./tool.js";

const schema = z.object({ job_id: z.union([z.string(), z.number()]).transform(String) });

export function getJobDetailsTool(context: ToolContext): Tool {
  return defineTool({
    name: "get_job_details",
    description: "Return stored details for one job. Full descriptions are not available yet; this returns the same metadata as fetch_jobs.",
    schema,
    run: ({ job_id }) => details(context, job_id),
  });
}

function details(context: ToolContext, jobId: string): Record<string, unknown> {
  const row = context.store.findJob(jobId);
  if (!row) throw new Error(`unknown job_id "${jobId}"`);
  return { ...summarizeJob(context, row), full_description: "not_available_in_v1" };
}
