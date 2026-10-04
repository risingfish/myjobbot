import type { ToolContext } from "./context.js";
import { fetchJobsTool } from "./fetchJobs.js";
import { finishTool } from "./finish.js";
import { getJobDetailsTool } from "./getJobDetails.js";
import { listSourcesTool } from "./listSources.js";
import { recordMatchesTool } from "./recordMatches.js";
import type { Tool } from "./tool.js";

export function buildTools(context: ToolContext): Tool[] {
  return [
    listSourcesTool(context),
    fetchJobsTool(context),
    getJobDetailsTool(context),
    recordMatchesTool(context),
    finishTool(context),
  ];
}
