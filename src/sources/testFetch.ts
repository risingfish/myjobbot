import type { SavedSource } from "../db/sourceStore.js";
import type { ApiCallLog } from "../db/apiCallLog.js";
import { recordCost } from "./cost.js";
import { failureReason, NotSetUp } from "./failure.js";
import type { SourceHttp } from "./module.js";
import { moduleFor } from "./registry.js";

export type TestOutcome = { ok: true; jobs: number } | { ok: false; reason: string };

export interface TestDeps {
    http: SourceHttp;
    access: Record<string, unknown>;
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

/** Reads a source's first page, recording what it cost, and counts its jobs. */
async function firstPageJobs(source: SavedSource, deps: TestDeps): Promise<number> {
    const module = moduleFor(source.module);
    if (module === null) throw new NotSetUp(`no module ${source.module}`);
    const params = module.params.parse(source.params);
    for await (const page of module.fetch(params, { http: deps.http, sourceName: source.name, access: deps.access[module.id], preview: true }, null)) {
        await recordCost(deps.apiCalls, module, page, { source: source.name, at: deps.at });
        return page.jobs.length;
    }
    return 0;
}
