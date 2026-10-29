import { z } from "zod";
import type { SavedSource } from "../db/sourceStore.js";
import type { ToolContext } from "./context.js";
import { summarizeJob } from "./jobSummary.js";
import { findSource } from "./sources.js";
import { defineTool, type Tool } from "./tool.js";
import { unscoredJobs } from "./unscored.js";

const PAGE_SIZE = 25;
const schema = z.object({ source: z.string().describe("Source name exactly as returned by list_sources") });

/** Builds the next_jobs tool, letting the model page through one source's unscored jobs; sources are fetched before the run's first turn, so it fetches nothing. */
export function nextJobsTool(context: ToolContext): Tool {
    return defineTool({
        name: "next_jobs",
        outsideText: true,
        description: `Return up to ${PAGE_SIZE} unscored jobs from one source (a company board, a saved search or Gmail alerts) plus total_unscored. It fetches nothing. Score them with record_matches, then call again until total_unscored is 0.`,
        schema,
        run: ({ source }) => jobPage(context, findSource(context, source)),
    });
}

/** Builds one page of a source's unscored jobs, as summaries the model scores from. */
async function jobPage(context: ToolContext, source: SavedSource) {
    const unscored = await unscoredJobs(context, source);
    const jobs = await Promise.all(unscored.slice(0, PAGE_SIZE).map((row) => summarizeJob(context, row)));
    return { source: source.name, total_unscored: unscored.length, jobs };
}
