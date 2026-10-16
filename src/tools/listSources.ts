import { z } from "zod";
import type { ToolContext } from "./context.js";
import { unscoredJobs } from "./fetchJobs.js";
import { configuredSources, type FetchOutcome, type Source } from "./sources.js";
import { defineTool, type Tool } from "./tool.js";

/** Builds the list_sources tool, letting the model see every configured source and its run progress. */
export function listSourcesTool(context: ToolContext): Tool {
    return defineTool({
        name: "list_sources",
        description: "List the sources you can fetch jobs from (company boards, saved searches and Gmail alerts), with progress for this run.",
        schema: z.object({}),
        run: () => sourceProgress(context),
    });
}

/** Reports fetch and scoring status for every configured source in the current run. */
export function sourceProgress(context: ToolContext) {
    return Promise.all(configuredSources(context).map((source) => sourceStatus(context, source)));
}

/** Returns a source's name and kind, plus its ATS for a company board, for status reporting. */
function describeSource(source: Source) {
    if (source.kind === "board") return { name: source.name, kind: source.kind, ats: source.company.ats };
    return { name: source.name, kind: source.kind };
}

/** Describes a source that hasn't been fetched this run, flagging a failure and its note if there is one. */
function notFetched(context: ToolContext, source: Source) {
    const failure = failureNote(context, source);
    if (failure === undefined) return { ...describeSource(source), fetched: false };
    return failure === null ? { ...describeSource(source), fetched: false, fetch_failed: true } : { ...describeSource(source), fetched: false, fetch_failed: true, note: failure };
}

/** Returns why a source can't be fetched (a note, or null when the failure has none), or undefined when it can. */
function failureNote(context: ToolContext, source: Source): string | null | undefined {
    if (source.kind === "alerts" && context.gmail.usable !== true) return context.gmail.usable;
    return context.run.failedFetches.has(source.name) ? (context.run.failedFetches.get(source.name) ?? null) : undefined;
}

/** Reports a source's status, using its cached fetch when one is in flight or already complete. */
async function sourceStatus(context: ToolContext, source: Source) {
    const cached = context.run.fetches.get(source.name);
    const unusable = source.kind === "alerts" && context.gmail.usable !== true;
    return cached && !unusable ? fetchedStatus(context, source, cached) : notFetched(context, source);
}

/** Reports a fetched source's unscored-job count, falling back to "not fetched" if the fetch failed. */
async function fetchedStatus(context: ToolContext, source: Source, cached: Promise<FetchOutcome>) {
    try {
        const outcome = await cached;
        return { ...describeSource(source), fetched: true, total_unscored: (await unscoredJobs(context, source.name, outcome)).length };
    } catch {
        return notFetched(context, source);
    }
}
