import { z } from "zod";
import type { ToolContext } from "./context.js";
import { defineTool, type Tool } from "./tool.js";

const schema = z.object({
  summary: z.string().min(1).describe("One paragraph: companies searched, jobs scored, notable matches."),
});

export function finishTool(context: ToolContext): Tool {
  return defineTool({
    name: "finish",
    description: "End the run. Call only when every source has total_unscored 0.",
    schema,
    run: ({ summary }) => {
      context.run.finished = true;
      context.run.summary = summary;
      return { ok: true };
    },
  });
}
