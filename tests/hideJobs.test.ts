import { expect, test } from "vitest";
import { makeJob } from "../src/jobs/job.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { FIRST_PAGE } from "./helpers/views.js";

test("a hidden job stays hidden when the same posting is fetched again", async () => {
    const { jobStore, jobViews } = memoryStores();
    const job = makeJob({ ats: "greenhouse", jobId: "a", company: "Acme", title: "Software Engineer", url: "u" }, {});
    await jobStore.upsertAll([job], "2026-10-01T00:00:00.000Z", "Stripe");
    expect(await jobViews.setHidden({ ats: "greenhouse", jobId: "a", hidden: true })).toBe(true);
    await jobStore.upsertAll([job], "2026-10-02T00:00:00.000Z", "Stripe");
    expect((await jobViews.allJobs(FIRST_PAGE))[0]?.hidden).toBe(true);
});
