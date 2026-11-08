import { expect, test } from "vitest";
import { makeJob } from "../src/jobs/job.js";
import { memoryStores } from "./helpers/memoryStore.js";

const SEEN = "2026-11-08T00:00:00.000Z";
const JOB = makeJob({ ats: "greenhouse", jobId: "g1", company: "Acme", title: "Engineer", url: "u" }, {});

test("forUser binds each per-user store to that user and passes the shared stores through as they are", async () => {
    const stores = memoryStores();
    const second = stores.forUser(2);
    expect([second.userId, second.companies, second.careers, second.apiCalls, second.postings, second.accounts, second.sessions]).toEqual([2, stores.companies, stores.careers, stores.apiCalls, stores.postings, stores.accounts, stores.sessions]);
    await stores.jobStore.upsertAll([JOB], SEEN, "Acme");
    await stores.searchSettings.save({ match_threshold: 50 }, SEEN);
    await stores.gmail.connected({ email: "owner@example.com", sealedPassword: "sealed" }, SEEN);
    await stores.sources.ensureAccountSource({ module: "gmail_alerts", name: "Gmail alerts" }, SEEN);
    expect([await second.jobViews.countAllJobs(), await second.searchSettings.load(), await second.gmail.connection(), await second.sources.list(), await second.rescoreLog.runsFor({ ats: "greenhouse", jobId: "g1" }), await second.resume.currentResume()]).toEqual([0, null, null, [], [], null]);
    expect([await stores.jobViews.countAllJobs(), await stores.forUser(1).jobViews.countAllJobs()]).toEqual([1, 1]);
});
