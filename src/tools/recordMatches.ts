import { z } from "zod";
import type { ToolContext } from "./context.js";
import { defineTool, type Tool } from "./tool.js";

const MAX_VERDICTS = 25;
const ALERT_ONLY = "scored from the alert only (no description)";
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
        outsideText: false,
        description: `Save scores for up to ${MAX_VERDICTS} jobs returned by next_jobs: base (0-${MAX_PART}, resume fit) plus bonus (0-${MAX_PART}, preference fit). The score is their sum. Give reasons and gaps when the sum is 40 or more.`,
        schema,
        run: ({ verdicts }) => record(context, verdicts),
    });
}

/** Persists each verdict's total score, reporting how many were recorded and which job ids were unknown. */
async function record(context: ToolContext, verdicts: Array<z.infer<typeof verdict>>) {
    const stamp = { scoredAt: context.now().toISOString(), runId: context.runId };
    const unknown: string[] = [];
    for (const entry of verdicts) {
        const gaps = await withAlertNote(context, entry);
        const known = await context.store.recordVerdict({ ...entry, gaps, score: entry.base + entry.bonus }, stamp);
        if (!known) unknown.push(entry.job_id);
    }
    return { recorded: verdicts.length - unknown.length, unknown_job_ids: unknown };
}

/** Adds a note to the gaps of a Gmail alert job scored without a description, so its reasoning says what it was scored on. */
async function withAlertNote(context: ToolContext, entry: z.infer<typeof verdict>): Promise<string[]> {
    const job = await context.store.findJob(entry.job_id);
    return job?.ats === "linkedin" && job.description === null ? [...entry.gaps, ALERT_ONLY] : entry.gaps;
}
