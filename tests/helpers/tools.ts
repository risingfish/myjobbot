import type { ToolContext } from "../../src/tools/context.js";
import { buildTools } from "../../src/tools/registry.js";

export async function invokeTool(context: ToolContext, name: string, args: unknown): Promise<unknown> {
  const tool = buildTools(context).find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  return tool.invoke(args);
}
