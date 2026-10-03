import { z } from "zod";
import type { ToolContext } from "./context.js";
import { defineTool, type Tool } from "./tool.js";

export function listCompaniesTool(context: ToolContext): Tool {
  return defineTool({
    name: "list_companies",
    description: "List the companies whose job boards you can search.",
    schema: z.object({}),
    run: () => context.config.companies.map(({ name, ats }) => ({ name, ats })),
  });
}
