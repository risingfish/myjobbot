import type { Lookalike } from "../agent/markers.js";
import type { ToolContext } from "../tools/context.js";

/** Reports that a look-alike marker was removed from the main agent's outside text: a trace note naming the tool and job, never the text. */
export async function reportLookalike(context: ToolContext, hit: Lookalike): Promise<void> {
    context.trace.write({ type: "lookalike_removed", tool: hit.tool, job_id: hit.jobId });
}
