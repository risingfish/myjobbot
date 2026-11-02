import { expect, test } from "vitest";
import { makeJob } from "../src/jobs/job.js";
import { oneJobStore } from "../src/rescore/oneJobStore.js";
import { memoryStores } from "./helpers/memoryStore.js";

const SEEN = "2026-10-01T00:00:00.000Z";
const STAMP = { scoredAt: SEEN, runId: "rescore-1" };

async function twoJobs() {
    const stores = memoryStores();
    const jobs = ["a", "b"].map((jobId) => makeJob({ ats: "greenhouse", jobId, company: "Initech", title: "Backend Engineer", url: `https://example.com/${jobId}` }, {}));
    await stores.jobStore.upsertAll(jobs, SEEN, "Initech");
    return { stores, one: oneJobStore(stores.jobStore, { ats: "greenhouse", jobId: "a" }) };
}

test("the one-job store finds only its own job", async () => {
    const { one } = await twoJobs();
    expect([(await one.findJob("a"))?.job_id, await one.findJob("b")]).toEqual(["a", null]);
});

test("the one-job store records a verdict only for its own job, and says when it has", async () => {
    const { stores, one } = await twoJobs();
    expect([await one.recordVerdict({ job_id: "b", score: 70, reasons: [], gaps: [] }, STAMP), (await stores.jobStore.findJob("b"))?.score, one.recorded()]).toEqual([false, null, false]);
    expect([await one.recordVerdict({ job_id: "a", score: 70, reasons: [], gaps: [] }, STAMP), (await stores.jobStore.findJob("a"))?.score, one.recorded()]).toEqual([true, 70, true]);
});
