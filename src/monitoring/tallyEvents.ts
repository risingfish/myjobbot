import { z } from "zod";

export interface TallyTotals {
    fetches: number;
    fetchFailures: number;
    jobsFound: number;
    jobsScored: number;
    searches: number;
    searchFailures: number;
    modelCalls: number;
    promptTokens: number;
    completionTokens: number;
}

interface Counted<T> {
    schema: z.ZodType<T>;
    count(event: T, totals: TallyTotals): void;
}

const OFF = "off";
const count = z.number().int().min(0);
const usage = z.object({ prompt_tokens: count.optional(), completion_tokens: count.optional() });

/** Pairs an event's schema with how it adds to the totals, so each counted event is declared in one place. */
function counted<T>(schema: z.ZodType<T>, add: (event: T, totals: TallyTotals) => void): Counted<unknown> {
    return { schema, count: add } as Counted<unknown>;
}

export const TALLY_EVENTS = new Map<string, Counted<unknown>>([
    ["source_fetch", counted(z.object({ outcome: z.string(), jobs: count }), (event, totals) => Object.assign(totals, { fetches: totals.fetches + 1, fetchFailures: totals.fetchFailures + (event.outcome === "failing" ? 1 : 0), jobsFound: totals.jobsFound + event.jobs }))],
    ["source_skipped", counted(z.object({ reason: z.string() }), (event, totals) => Object.assign(totals, { fetches: totals.fetches + (event.reason === OFF ? 0 : 1) }))],
    ["source_fetch_failed", counted(z.object({}), (_event, totals) => Object.assign(totals, { fetches: totals.fetches + 1, fetchFailures: totals.fetchFailures + 1 }))],
    ["company_search", counted(z.object({}), (_event, totals) => Object.assign(totals, { searches: totals.searches + 1 }))],
    ["company_search_failed", counted(z.object({}), (_event, totals) => Object.assign(totals, { searchFailures: totals.searchFailures + 1 }))],
    ["jobs_scored", counted(z.object({ count }), (event, totals) => Object.assign(totals, { jobsScored: totals.jobsScored + event.count }))],
    ["llm_response", counted(z.object({ response: z.object({ usage: usage.optional() }) }), (event, totals) => Object.assign(totals, { modelCalls: totals.modelCalls + 1, promptTokens: totals.promptTokens + (event.response.usage?.prompt_tokens ?? 0), completionTokens: totals.completionTokens + (event.response.usage?.completion_tokens ?? 0) }))],
]);
