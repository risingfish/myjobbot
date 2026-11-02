import type { Lookalike } from "../agent/markers.js";
import { describeError } from "../errors.js";
import type { JobStore } from "../db/store.js";
import type { ToolContext } from "../tools/context.js";

type LookalikeContext = { store: Pick<JobStore, "flagInjection"> } & Pick<ToolContext, "trace" | "now">;

/** Reports that a look-alike marker was removed from the main agent's outside text: a trace note naming the tool and job (never the text), and a flag on that job. */
export async function reportLookalike(context: LookalikeContext, hit: Lookalike): Promise<void> {
    context.trace.write({ type: "lookalike_removed", tool: hit.tool, job_id: hit.jobId });
    if (hit.jobId === null) return;
    try {
        await context.store.flagInjection(hit.jobId, context.now().toISOString());
    } catch (error) {
        context.trace.write({ type: "injection_flag_failed", tool: hit.tool, job_id: hit.jobId, error: describeError(error) });
    }
}
