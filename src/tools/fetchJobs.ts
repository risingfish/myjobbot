import { z } from "zod";
import { AlertsUnavailable } from "../gmail/alertJobs/usable.js";
import { alertSource } from "./alertSource.js";
import { fetchBoard } from "./boardFetch.js";
import type { ToolContext } from "./context.js";
import { summarizeJob } from "./jobSummary.js";
import { refreshSearch } from "./searchFetch.js";
import { unscoredJobs } from "./unscored.js";
import { findSource, type FetchOutcome, type Source } from "./sources.js";
import { defineTool, type Tool } from "./tool.js";

const PAGE_SIZE = 25;
const schema = z.object({ source: z.string().describe("Source name exactly as returned by list_sources") });

/** Builds the fetch_jobs tool, letting the model refresh a source and page through its unscored jobs. */
export function fetchJobsTool(context: ToolContext): Tool {
    return defineTool({
        name: "fetch_jobs",
        outsideText: true,
        description: `Return up to ${PAGE_SIZE} unscored jobs from a source (a company board, a saved search or Gmail alerts) plus total_unscored. Score them with record_matches, then call again until total_unscored is 0.`,
        schema,
        run: ({ source }) => jobPage(context, findSource(context, source)),
    });
}

/** Fetches a source, then builds the paginated fetch_jobs response of its unscored jobs. */
async function jobPage(context: ToolContext, source: Source) {
    const outcome = await fetchOnce(context, source);
    const unscored = await unscoredJobs(context, source.name, outcome);
    const jobs = await Promise.all(unscored.slice(0, PAGE_SIZE).map((row) => summarizeJob(context, row)));
    const page = { source: source.name, total_unscored: unscored.length, jobs };
    if (source.kind === "search") return { ...page, ...refreshFields(outcome) };
    return outcome.alerts === undefined ? page : { ...page, alerts: outcome.alerts, careers: outcome.careers };
}

/** Reports, for a search source, whether JSearch was actually refreshed or skipped and why. */
function refreshFields(outcome: FetchOutcome) {
    return outcome.note === null ? { refreshed: true } : { refreshed: false, refresh_note: outcome.note };
}

/** Fetches a source at most once per run, caching and reusing the in-flight or completed fetch. */
function fetchOnce(context: ToolContext, source: Source): Promise<FetchOutcome> {
    const cached = context.run.fetches.get(source.name);
    if (cached) return cached;
    const pending = startFetch(context, source);
    context.run.fetches.set(source.name, pending);
    pending.then(
        () => context.run.failedFetches.delete(source.name),
        (error: unknown) => onFetchFailure(context, source, error),
    );
    return pending;
}

/** Starts the fetch that suits a source's kind: a company board, a saved search, or the Gmail alerts. */
function startFetch(context: ToolContext, source: Source): Promise<FetchOutcome> {
    if (source.kind === "board") return fetchBoard(context, source.company);
    if (source.kind === "search") return refreshSearch(context, source.search);
    return alertSource(context);
}

/** Records that a source's fetch failed, with its fixed note when it has one, so status checks and finish report it. */
function onFetchFailure(context: ToolContext, source: Source, error: unknown): void {
    context.run.fetches.delete(source.name);
    context.run.failedFetches.set(source.name, error instanceof AlertsUnavailable ? error.note : null);
}
