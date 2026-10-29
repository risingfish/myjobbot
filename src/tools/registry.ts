import type { ToolContext } from "./context.js";
import { finishTool } from "./finish.js";
import { getJobDetailsTool } from "./getJobDetails.js";
import { listSourcesTool } from "./listSources.js";
import { nextJobsTool } from "./nextJobs.js";
import { recordMatchesTool } from "./recordMatches.js";
import type { Tool } from "./tool.js";

/** Assembles the list_sources, next_jobs, get_job_details, record_matches, and finish tools for the model. */
export function buildTools(context: ToolContext): Tool[] {
    return [listSourcesTool(context), nextJobsTool(context), getJobDetailsTool(context), recordMatchesTool(context), finishTool(context)];
}
