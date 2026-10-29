import { z } from "zod";
import type { ToolContext } from "./context.js";
import { sourceProgress } from "./listSources.js";
import { defineTool, type Tool } from "./tool.js";

const schema = z.object({
    summary: z.string().min(1).describe("One paragraph: companies searched, jobs scored, notable matches."),
});

/** Builds the finish tool, letting the model end the run once every source's jobs are scored. */
export function finishTool(context: ToolContext): Tool {
    return defineTool({
        name: "finish",
        outsideText: false,
        description: "End the run. Refused while any source still has unscored jobs.",
        schema,
        run: ({ summary }) => finish(context, summary),
    });
}

/** Ends the run with the given summary, or refuses while any source has unscored jobs. */
async function finish(context: ToolContext, summary: string) {
    const remaining = await remainingWork(context);
    if (remaining.length > 0) return { ok: false, not_done: remaining, next: "Keep going: call next_jobs for these sources, then finish." };
    context.run.finished = true;
    context.run.summary = summary;
    return { ok: true };
}

/** Lists the sources that still have jobs to score before the run can finish. */
async function remainingWork(context: ToolContext): Promise<string[]> {
    const progress = await sourceProgress(context);
    return progress.flatMap((source) => (source.total_unscored > 0 ? [`${source.name}: ${source.total_unscored} unscored`] : []));
}
