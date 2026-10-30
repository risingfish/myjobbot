import type { SavedSource } from "../db/sourceStore.js";
import type { ApiCallLog } from "../db/store.js";
import { failureReason, NotSetUp } from "./failure.js";
import type { SourceContext, SourcePage } from "./module.js";
import { moduleFor } from "./registry.js";

export type TestOutcome = { ok: true; jobs: number } | { ok: false; reason: string };

export interface TestDeps {
    access: Omit<SourceContext, "sourceName">;
    apiCalls: ApiCallLog;
    at: string;
}

/** Tests a saved source by reading the first page its module would fetch in a run, as a preview, storing none of its jobs, and gives how many jobs it found or the fixed reason it failed. */
export async function testFetch(source: SavedSource, deps: TestDeps): Promise<TestOutcome> {
    try {
        return { ok: true, jobs: await firstPageJobs(source, deps) };
    } catch (error) {
        return { ok: false, reason: failureReason(error) };
    }
}

/** Records each JSearch request a fetched page cost, against the month's budget. */
export async function recordCost(apiCalls: ApiCallLog, page: SourcePage, spent: { source: string; at: string }): Promise<void> {
    for (let request = 0; request < page.cost; request += 1) await apiCalls.record("jsearch", spent.source, spent.at);
}

/** Reads a source's first page, recording what it cost, and counts its jobs. */
async function firstPageJobs(source: SavedSource, deps: TestDeps): Promise<number> {
    const module = moduleFor(source.module);
    if (module === null) throw new NotSetUp(`no module ${source.module}`);
    const params = module.params.parse(source.params);
    for await (const page of module.fetch(params, { ...deps.access, sourceName: source.name, preview: true }, null)) {
        await recordCost(deps.apiCalls, page, { source: source.name, at: deps.at });
        return page.jobs.length;
    }
    return 0;
}
