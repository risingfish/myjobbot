import { z } from "zod";
import type { ToolContext } from "./context.js";
import { defineTool, type Tool } from "./tool.js";

const MAX_VERDICTS = 25;
const MAX_PART = 50;
const scorePart = z.number().int().min(0).max(MAX_PART);
const verdict = z.object({
  job_id: z.union([z.string(), z.number()]).transform(String),
  reasons: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  base: scorePart.describe("0-50: fit with the resume"),
  bonus: scorePart.describe("0-50: fit with the user's preferences"),
});
const schema = z.object({ verdicts: z.array(verdict).min(1).max(MAX_VERDICTS) });

/** Builds the record_matches tool, letting the model save its base+bonus fit scores for scored jobs. */
export function recordMatchesTool(context: ToolContext): Tool {
  return defineTool({
    name: "record_matches",
    description: `Save scores for up to ${MAX_VERDICTS} jobs returned by fetch_jobs: base (0-${MAX_PART}, resume fit) plus bonus (0-${MAX_PART}, preference fit). The score is their sum. Give reasons and gaps when the sum is 40 or more.`,
    schema,
    run: ({ verdicts }) => record(context, verdicts),
  });
}

/** Persists each verdict's total score, reporting how many were recorded and which job ids were unknown. */
function record(context: ToolContext, verdicts: Array<z.infer<typeof verdict>>) {
  const scoredAt = context.now().toISOString();
  const stamp = { scoredAt, runId: context.runId };
  const stored = verdicts.map((entry) => ({ ...entry, score: entry.base + entry.bonus }));
  const unknown = stored.filter((entry) => !context.store.recordVerdict(entry, stamp)).map((entry) => entry.job_id);
  return { recorded: verdicts.length - unknown.length, unknown_job_ids: unknown };
}
