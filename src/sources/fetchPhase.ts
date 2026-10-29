import { OWNER_ID } from "../db/searchSettingsStore.js";
import type { SavedSource, SourceOutcome } from "../db/sourceStore.js";
import type { Job } from "../jobs/job.js";
import { alertSource } from "../tools/alertSource.js";
import type { ToolContext } from "../tools/context.js";
import { withoutDescription } from "../tools/jobLog.js";
import { requestsThisMonth } from "../tools/searchBudget.js";
import type { FetchOutcome } from "../tools/sources.js";
import { failureReason } from "./failure.js";
import { fetchOrder, fetchPlan, type FetchFacts, type SkipReason } from "./fetchPlan.js";
import { ingest, sourceContext } from "./ingest.js";
import type { Cursor, SourceModule } from "./module.js";

interface Read {
    pages: number;
    jobs: number;
    cost: number;
    next: Cursor | null;
    stored: Job[];
}

interface Planned {
    module: SourceModule<unknown>;
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

const ALERTS_MODULE = "gmail_alerts";

/** Fetches every saved source that is on, one at a time in fetch order, before the agent starts, and leaves each one's outcome where fetch_jobs finds it, so the model only scores. */
export async function fetchSources(context: ToolContext): Promise<void> {
    for (const saved of fetchOrder(context.saved.list)) {
        const outcome = await fetchGuarded(context, saved);
        if (outcome !== null) context.run.fetches.set(saved.name, Promise.resolve(outcome));
    }
}

/** Fetches one saved source, so that even a failure to decide or record its fetch leaves the other sources to be fetched. */
async function fetchGuarded(context: ToolContext, saved: SavedSource): Promise<FetchOutcome | null> {
    const fetched = await settle(saved.module === ALERTS_MODULE ? fetchAlertSource(context, saved) : fetchSource(context, saved));
    if ("value" in fetched) return fetched.value;
    const reason = failureReason(fetched.error);
    context.trace.write({ type: "source_fetch_failed", source: saved.name, reason });
    return { seen: null, note: `failing: ${reason}` };
}

/** Fetches one saved source through its module when its plan allows, and gives what fetch_jobs offers from it this run, or null for a source that is off. */
async function fetchSource(context: ToolContext, saved: SavedSource): Promise<FetchOutcome | null> {
    const plan = fetchPlan(saved, await fetchFacts(context));
    if ("skip" in plan) return skipped(context, saved, plan.skip);
    const seen = context.now().toISOString();
    const fetched = await settle(readPages(context, saved, { ...plan, seen }));
    if ("error" in fetched) return failed(context, saved, { at: seen, error: fetched.error });
    const read = fetched.value;
    await finishFetch(context, saved, { at: seen, outcome: read.next === null ? "ok" : "partial", read, reason: null, cursor: read.next });
    return { seen: plan.module.scope === "company" ? seen : null, note: null };
}

/** Fetches the Gmail alerts source, which records its own mail state and runs the careers lookup for its jobs, once Gmail can be read. */
async function fetchAlertSource(context: ToolContext, saved: SavedSource): Promise<FetchOutcome | null> {
    if (!saved.enabled) return skipped(context, saved, "off");
    if (context.gmail.usable !== true) return skipped(context, saved, "not set up");
    const at = context.now().toISOString();
    const fetched = await settle(alertSource(context, { kind: "alerts", id: saved.id, name: saved.name }));
    if ("error" in fetched) return failed(context, saved, { at, error: fetched.error });
    const { alerts } = fetched.value;
    await finishFetch(context, saved, { at, outcome: "ok", read: { pages: 1, jobs: alerts?.stored ?? 0, cost: alerts?.searches ?? 0, next: null, stored: [] }, reason: null, cursor: null });
    return fetched.value;
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
async function fetchFacts(context: ToolContext): Promise<FetchFacts> {
    const left = context.config.jsearch.monthly_request_cap - (await requestsThisMonth(context));
    return { now: context.now(), met: { jsearch_key: context.jsearchApiKey !== null, gmail: context.gmail.usable === true }, refreshHours: context.config.jsearch.refresh_hours, requestsLeft: left };
}

/** Reads a source's pages from where it stopped, storing each, until its last page or its job limit. */
async function readPages(context: ToolContext, saved: SavedSource, planned: Planned): Promise<Read> {
    const read: Read = { pages: 0, jobs: 0, cost: 0, next: planned.cursor, stored: [] };
    const batch = { source: { id: saved.id, name: saved.name }, scope: planned.module.scope, seen: planned.seen };
    const limit = planned.module.limits.maxJobsPerRun;
    for await (const page of planned.module.fetch(planned.params, sourceContext(context, saved.name), planned.cursor)) {
        for (let request = 0; request < page.cost; request += 1) await context.apiCalls.record("jsearch", saved.name, planned.seen);
        read.stored.push(...(await ingest(context, batch, page)).stored);
        Object.assign(read, { pages: read.pages + 1, jobs: read.jobs + page.jobs.length, cost: read.cost + page.cost, next: page.next });
        if (limit !== null && read.jobs >= limit) break;
    }
    return read;
}

/** Traces a source the run doesn't fetch and why, giving fetch_jobs that reason, or null for a source that is off. */
function skipped(context: ToolContext, saved: SavedSource, reason: SkipReason): FetchOutcome | null {
    context.trace.write({ type: "source_skipped", source: saved.name, reason });
    return reason === "off" ? null : { seen: null, note: `skipped: ${reason}` };
}

/** Records a source whose fetch failed by a fixed reason, keeping where it stopped so the next run tries again from there. */
async function failed(context: ToolContext, saved: SavedSource, failure: { at: string; error: unknown }): Promise<FetchOutcome> {
    const reason = failureReason(failure.error);
    await finishFetch(context, saved, { at: failure.at, outcome: "failing", read: { pages: 0, jobs: 0, cost: 0, next: null, stored: [] }, reason, cursor: saved.cursor });
    return { seen: null, note: `failing: ${reason}` };
}

/** Stores how a source's fetch went and where its next one starts, and traces and logs it. */
async function finishFetch(context: ToolContext, saved: SavedSource, done: Finished): Promise<void> {
    const { read } = done;
    await context.saved.store.recordFetch({ userId: OWNER_ID, id: saved.id }, { at: done.at, outcome: done.outcome, jobs: read.jobs, cost: read.cost, reason: done.reason }, done.cursor);
    context.trace.write({ type: "source_fetch", source: saved.name, module: saved.module, pages: read.pages, jobs: read.jobs, cost: read.cost, outcome: done.outcome, ...(done.reason === null ? {} : { reason: done.reason }) });
    context.jobLog.write({ type: "source_fetch", source: saved.name, module: saved.module, job_count: read.stored.length, jobs: read.stored.map(withoutDescription) });
}
