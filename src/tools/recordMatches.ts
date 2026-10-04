import { z } from "zod";
import type { ToolContext } from "./context.js";
import { defineTool, type Tool } from "./tool.js";

const MAX_VERDICTS = 25;
const verdict = z.object({
  job_id: z.union([z.string(), z.number()]).transform(String),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
});
const schema = z.object({ verdicts: z.array(verdict).min(1).max(MAX_VERDICTS) });

export function recordMatchesTool(context: ToolContext): Tool {
  return defineTool({
    name: "record_matches",
    description: `Save fit scores (0-100) for up to ${MAX_VERDICTS} jobs returned by fetch_jobs. Give reasons and gaps for scores of 40 or more.`,
    schema,
    run: ({ verdicts }) => record(context, verdicts),
  });
}

function record(context: ToolContext, verdicts: Array<z.infer<typeof verdict>>) {
  const scoredAt = context.now().toISOString();
  const stamp = { scoredAt, runId: context.runId };
  const unknown = verdicts.filter((entry) => !context.store.recordVerdict(entry, stamp)).map((entry) => entry.job_id);
  return { recorded: verdicts.length - unknown.length, unknown_job_ids: unknown };
}
