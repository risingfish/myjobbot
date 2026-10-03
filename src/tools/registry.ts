import type { ToolContext } from "./context.js";
import { fetchJobsTool } from "./fetchJobs.js";
import { finishTool } from "./finish.js";
import { listCompaniesTool } from "./listCompanies.js";
import type { Tool } from "./tool.js";

export function buildTools(context: ToolContext): Tool[] {
  return [listCompaniesTool(context), fetchJobsTool(context), finishTool(context)];
}
