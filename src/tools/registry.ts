import type { ToolContext } from "./context.js";
import { finishTool } from "./finish.js";
import type { Tool } from "./tool.js";

export function buildTools(context: ToolContext): Tool[] {
  return [finishTool(context)];
}
