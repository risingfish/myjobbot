import { z } from "zod";
import type { SavedSource } from "../db/sourceStore.js";
import type { ToolContext } from "./context.js";
import { sourcesOn } from "./sources.js";
import { defineTool, type Tool } from "./tool.js";
import { unscoredJobs } from "./unscored.js";

/** Builds the list_sources tool, letting the model see every source that is on, how its fetch went this run, and what is left to score. */
export function listSourcesTool(context: ToolContext): Tool {
    return defineTool({
        name: "list_sources",
        outsideText: false,
        description: "List the sources that are on (company boards, saved searches and Gmail alerts): how each one's fetch went this run, and total_unscored, the jobs left to score.",
        schema: z.object({}),
        run: () => sourceProgress(context),
    });
}

/** Reports, for every source that is on, how its fetch went this run and how many of its jobs are left to score. */
export function sourceProgress(context: ToolContext) {
    return Promise.all(sourcesOn(context).map((source) => sourceStatus(context, source)));
}

/** Reports one source's module, this run's fetch outcome with any reason, and its unscored count. */
async function sourceStatus(context: ToolContext, source: SavedSource) {
    const run = context.run.sources.get(source.name);
    const fetch = run === undefined ? { fetch: "not fetched" } : { fetch: run.outcome, ...(run.reason === null ? {} : { reason: run.reason }) };
    return { name: source.name, module: source.module, ...fetch, total_unscored: (await unscoredJobs(context, source)).length };
}
