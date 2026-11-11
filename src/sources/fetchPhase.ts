import type { SavedSource, SourceOutcome } from "../db/sourceStore.js";
import type { Job } from "../jobs/job.js";
import type { SourceRun, ToolContext } from "../tools/context.js";
import { withoutDescription } from "../tools/jobLog.js";
import { requestsThisMonth } from "../tools/searchBudget.js";
import { failureReason } from "./failure.js";
import { fetchOrder, fetchPlan, type FetchFacts, type SkipReason } from "./fetchPlan.js";
import { ingest } from "./ingest.js";
import type { Cursor, SourceModule } from "./module.js";
import { hookFor, type HookContext, type RunHook } from "./runHooks.js";
import { recordCost } from "./cost.js";
import { recordFetch, type RecordContext } from "./fetchRecord.js";

type FinishContext = Pick<ToolContext, "saved" | "jobLog"> & RecordContext;
type FactsContext = Pick<ToolContext, "config" | "now" | "jsearchApiKey" | "gmail" | "apiCalls">;
type PagesContext = HookContext & Pick<ToolContext, "store" | "config" | "sources" | "apiCalls">;
export type FetchContext = FinishContext & FactsContext & PagesContext & Pick<ToolContext, "run">;

interface Read {
    pages: number;
    jobs: number;
    cost: number;
    next: Cursor | null;
    stored: Job[];
    skipped: { duplicates: number; publishers: number };
    access?: unknown;
}

const NOTHING_READ: Read = { pages: 0, jobs: 0, cost: 0, next: null, stored: [], skipped: { duplicates: 0, publishers: 0 } };

interface Planned {
    module: SourceModule<unknown>;
    hook: RunHook<unknown, HookContext> | null;
    params: unknown;
    cursor: Cursor | null;
    seen: string;
}

interface Finished {
    at: string;
    outcome: SourceOutcome["outcome"];
    read: Read;
    reason: string | null;
    cursor: unknown;
}

/** Fetches every saved source that is on, one at a time in fetch order, before the agent starts, and leaves each one's outcome where next_jobs and list_sources find it, so the model only scores. */
export async function fetchSources(context: FetchContext): Promise<void> {
    for (const saved of fetchOrder(context.saved.list)) {
        const outcome = await fetchGuarded(context, saved);
        if (outcome !== null) context.run.sources.set(saved.name, outcome);
    }
}

/** Fetches one saved source, so that even a failure to decide or record its fetch leaves the other sources to be fetched. */
async function fetchGuarded(context: FetchContext, saved: SavedSource): Promise<SourceRun | null> {
    const fetched = await settle(fetchSource(context, saved));
    if ("value" in fetched) return fetched.value;
    const reason = failureReason(fetched.error);
    context.trace.write({ type: "source_fetch_failed", source: saved.name, reason });
    return { outcome: "failing", reason, seen: null };
}

/** Fetches one saved source through its module when its plan allows, and gives how it went this run, or null for a source that is off. */
async function fetchSource(context: FetchContext, saved: SavedSource): Promise<SourceRun | null> {
    const plan = fetchPlan(saved, await fetchFacts(context));
    if ("skip" in plan) return skipped(context, saved, plan.skip);
    const seen = context.now().toISOString();
    const hook = hookFor(saved.module);
    const fetched = await settle(readPages(context, saved, { ...plan, hook, seen }));
    if ("error" in fetched) return failed(context, saved, { at: seen, error: fetched.error });
    const read = fetched.value;
    const outcome = read.next === null ? "ok" : "partial";
    await finishFetch(context, saved, { at: seen, outcome, read, reason: null, cursor: read.next });
    const whole = plan.module.scope === "company" && plan.cursor === null && outcome === "ok";
    const after = hook?.afterFetch === undefined ? {} : await hook.afterFetch(context, read.access);
    return { outcome, reason: null, seen: whole ? seen : null, ...after };
}

/** Waits for some work, giving back its value or what it threw, so a failure can be handled without a try around the rest. */
async function settle<T>(work: Promise<T>): Promise<{ value: T } | { error: unknown }> {
    try {
        return { value: await work };
    } catch (error) {
        return { error };
    }
}

/** Gathers what deciding a fetch needs: the time, what is set up, the search schedule, and this month's JSearch requests left. */
async function fetchFacts(context: FactsContext): Promise<FetchFacts> {
    const left = context.config.jsearch.monthly_request_cap - (await requestsThisMonth(context));
    return { now: context.now(), met: { jsearch_key: context.jsearchApiKey !== null, gmail: context.gmail.usable === true }, refreshHours: context.config.jsearch.refresh_hours, requestsLeft: left };
}

/** Reads a source's pages from where it stopped, storing each, until its last page or its job limit. */
async function readPages(context: PagesContext, saved: SavedSource, planned: Planned): Promise<Read> {
    const read: Read = { ...NOTHING_READ, next: planned.cursor, stored: [], skipped: { duplicates: 0, publishers: 0 } };
    const batch = { source: { id: saved.id, name: saved.name }, scope: planned.module.scope, seen: planned.seen };
    const limit = planned.module.limits.maxJobsPerRun;
    const access = planned.hook === null ? undefined : await planned.hook.access(context, saved);
    Object.assign(read, { access });
    for await (const page of planned.module.fetch(planned.params, { http: context.sources, sourceName: saved.name, access }, planned.cursor)) {
        await recordCost(context.apiCalls, planned.module, page, { source: saved.name, at: planned.seen });
        const ingested = await ingest(context, batch, page);
        read.stored.push(...ingested.stored);
        read.skipped = { duplicates: read.skipped.duplicates + ingested.skippedCopies, publishers: read.skipped.publishers + ingested.skippedPublishers };
        await planned.hook?.afterPage?.(context, page, access);
        Object.assign(read, { pages: read.pages + 1, jobs: read.jobs + page.jobs.length, cost: read.cost + page.cost, next: page.next });
        if (limit !== null && read.jobs >= limit) break;
    }
    return read;
}

/** Traces a source the run doesn't fetch and why, recording the planned skip, giving that reason as its outcome, or null for a source that is off. */
async function skipped(context: RecordContext, saved: SavedSource, reason: SkipReason): Promise<SourceRun | null> {
    context.trace.write({ type: "source_skipped", source: saved.name, reason });
    if (reason === "off") return null;
    await recordFetch(context, saved, { at: context.now().toISOString(), outcome: "skipped", reason, pages: 0, jobs: 0, cost: 0 });
    return { outcome: "skipped", reason, seen: null };
}

/** Records a source whose fetch failed by a fixed reason, keeping where it stopped so the next run tries again from there. */
async function failed(context: FinishContext, saved: SavedSource, failure: { at: string; error: unknown }): Promise<SourceRun> {
    const reason = failureReason(failure.error);
    await finishFetch(context, saved, { at: failure.at, outcome: "failing", read: NOTHING_READ, reason, cursor: saved.cursor });
    return { outcome: "failing", reason, seen: null };
}

/** Stores how a source's fetch went and where its next one starts, adds it to the fetch history, and traces and logs it. */
async function finishFetch(context: FinishContext, saved: SavedSource, done: Finished): Promise<void> {
    const { read } = done;
    await context.saved.store.recordFetch(saved.id, { at: done.at, outcome: done.outcome, jobs: read.jobs, cost: read.cost, reason: done.reason }, done.cursor);
    await recordFetch(context, saved, { at: done.at, outcome: done.outcome, reason: done.reason, pages: read.pages, jobs: read.jobs, cost: read.cost });
    context.trace.write({ type: "source_fetch", source: saved.name, module: saved.module, pages: read.pages, jobs: read.jobs, cost: read.cost, outcome: done.outcome, ...(done.reason === null ? {} : { reason: done.reason }) });
    const skipped = { skipped_duplicates: read.skipped.duplicates, skipped_publishers: read.skipped.publishers };
    context.jobLog.write({ type: "source_fetch", source: saved.name, module: saved.module, job_count: read.stored.length, ...skipped, jobs: read.stored.map(withoutDescription) });
}
