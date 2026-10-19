import { expect, test } from "vitest";
import { reportLookalike } from "../src/app/lookalikes.js";
import type { JobViews } from "../src/db/store.js";
import { makeJob } from "../src/jobs/job.js";
import { TEST_NOW, testContext } from "./helpers/context.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { memoryTrace } from "./helpers/trace.js";

test("a removed look-alike is noted in the trace with its tool and job, and nothing else", async () => {
    const trace = memoryTrace();
    await reportLookalike(testContext({ trace }), { tool: "get_job_details", jobId: "a" });
    expect(trace.events).toEqual([{ type: "lookalike_removed", tool: "get_job_details", job_id: "a" }]);
});

async function contextWithJobs() {
    const trace = memoryTrace();
    const stores = memoryStores();
    const context = testContext({ trace }, stores);
    await context.store.upsertAll(["a", "b"].map((jobId) => makeJob({ ats: "greenhouse", jobId, company: "Acme", title: "Engineer", url: "u" }, {})), "2026-10-01T00:00:00.000Z", "Acme");
    return { context, trace, views: stores.jobViews };
}

async function flags(views: JobViews) {
    return Object.fromEntries((await views.allJobs({ offset: 0, limit: 10 })).map((view) => [view.job_id, view.injection_seen_at]));
}

test("a removal tied to a job flags that job only, and one tied to no job flags nothing", async () => {
    const { context, views } = await contextWithJobs();
    await reportLookalike(context, { tool: "fetch_jobs", jobId: "a" });
    await reportLookalike(context, { tool: "get_job_details", jobId: null });
    expect(await flags(views)).toEqual({ a: TEST_NOW.toISOString(), b: null });
});

test("a store that fails while flagging is traced, and the run carries on", async () => {
    const { context, trace } = await contextWithJobs();
    const failing = { ...context, store: { ...context.store, flagInjection: () => Promise.reject(new Error("database gone")) } };
    await expect(reportLookalike(failing, { tool: "fetch_jobs", jobId: "a" })).resolves.toBeUndefined();
    expect(trace.events.at(-1)).toEqual({ type: "injection_flag_failed", tool: "fetch_jobs", job_id: "a", error: "database gone" });
});
