import type { ToolContext } from "./context.js";
import { fetchJobsTool } from "./fetchJobs.js";
import { finishTool } from "./finish.js";
import { getJobDetailsTool } from "./getJobDetails.js";
import { listCompaniesTool } from "./listCompanies.js";
import { recordMatchesTool } from "./recordMatches.js";
import type { Tool } from "./tool.js";

export function buildTools(context: ToolContext): Tool[] {
  return [
    listCompaniesTool(context),
    fetchJobsTool(context),
    getJobDetailsTool(context),
    recordMatchesTool(context),
    finishTool(context),
  ];
}
