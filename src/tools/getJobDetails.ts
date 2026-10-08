import { z } from "zod";
import type { JobRow } from "../db/jobStore.js";
import type { ToolContext } from "./context.js";
import { summarizeJob } from "./jobSummary.js";
import { defineTool, type Tool } from "./tool.js";

const MAX_DESCRIPTION_CHARS = 6000;
const schema = z.object({ job_id: z.union([z.string(), z.number()]).transform(String) });

/** Builds the get_job_details tool: fetches one job's full description, requirements, and skills. */
export function getJobDetailsTool(context: ToolContext): Tool {
  return defineTool({
    name: "get_job_details",
    description: `Return one job's metadata plus its full description (up to ${MAX_DESCRIPTION_CHARS} characters) and, when the source provides them, requirements and skills.`,
    schema,
    run: ({ job_id }) => details(context, job_id),
  });
}

/** Looks up a job by id and assembles its summary, description, and list fields for the model. */
function details(context: ToolContext, jobId: string): Record<string, unknown> {
  const row = context.store.findJob(jobId);
  if (!row) throw new Error(`unknown job_id "${jobId}"`);
  return { ...summarizeJob(context, row), ...descriptionFields(row.description), ...listFields(row) };
}

/** Returns the job's description, truncated to the limit when needed, or a placeholder when absent. */
function descriptionFields(description: string | null): Record<string, unknown> {
  if (!description) return { description: "(none provided)" };
  if (description.length <= MAX_DESCRIPTION_CHARS) return { description };
  return { description: description.slice(0, MAX_DESCRIPTION_CHARS), description_truncated: true };
}

/** Returns only the non-empty requirements/skills/preferred_skills lists for a job. */
function listFields(row: JobRow): Record<string, string[]> {
  const lists = { requirements: row.requirements, skills: row.skills, preferred_skills: row.preferred_skills };
  return Object.fromEntries(Object.entries(lists).filter(([, items]) => items.length > 0));
}
