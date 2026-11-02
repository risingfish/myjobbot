import { z } from "zod";
import type { Settings } from "../config/schema.js";
import type { JobKey } from "../db/store.js";
import { jobDetails } from "../tools/getJobDetails.js";
import { recordMatchesTool } from "../tools/recordMatches.js";
import { defineTool, type Tool } from "../tools/tool.js";
import type { OneJobStore } from "./oneJobStore.js";

export interface RescoreToolContext {
    store: OneJobStore;
    key: JobKey;
    config: Settings;
    now: () => Date;
    runId: string;
}

/** Gives a re-score's model its two tools: get_job for the one job, and record_matches to save its score. */
export function rescoreTools(context: RescoreToolContext): Tool[] {
    return [getJobTool(context), recordMatchesTool(context)];
}

/** Builds the get_job tool, which returns the one job being re-scored without the model naming it. */
function getJobTool(context: RescoreToolContext): Tool {
    return defineTool({
        name: "get_job",
        outsideText: true,
        description: "Return the job to re-score: its metadata, its description and, when the source provides them, requirements and skills.",
        schema: z.object({}),
        run: () => jobDetails(context, context.key.jobId),
    });
}
