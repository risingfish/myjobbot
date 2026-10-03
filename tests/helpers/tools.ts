import { z } from "zod";
import type { ToolContext } from "../../src/tools/context.js";
import { buildTools } from "../../src/tools/registry.js";

export async function invokeTool(context: ToolContext, name: string, args: unknown): Promise<unknown> {
  const tool = buildTools(context).find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  return tool.invoke(args);
}

const pageSchema = z.object({
  company: z.string(),
  total_unscored: z.number(),
  jobs: z.array(z.looseObject({ job_id: z.string() })),
});

export async function fetchPage(context: ToolContext, company: string) {
  return pageSchema.parse(await invokeTool(context, "fetch_jobs", { company }));
}
