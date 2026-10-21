import { expect, test } from "vitest";
import { makeJob } from "../src/jobs/job.js";
import { toJobDetailView } from "../src/web/jobDetail.js";
import { rowContext } from "../src/web/pageData.js";
import { testFileConfig } from "./helpers/config.js";
import { memoryStores } from "./helpers/memoryStore.js";

const context = rowContext(testFileConfig(), new Date("2026-10-03T00:00:00.000Z"));
const KEY = { ats: "greenhouse", jobId: "a" };

async function storedDetail(details: Parameters<typeof makeJob>[1]) {
    const stores = memoryStores();
    const job = makeJob({ ats: "greenhouse", jobId: "a", company: "Acme", title: "Backend Engineer", url: "https://example.com/a" }, { postedAt: "2026-09-30T00:00:00.000Z", ...details });
    await stores.jobStore.upsertAll([job], "2026-10-01T00:00:00.000Z", "Stripe");
    const row = await stores.jobViews.jobDetail(KEY);
    if (row === null) throw new Error("seeded job missing");
    return row;
}

test("a job's details carry its row view plus its pay and workplace terms", async () => {
    const view = toJobDetailView(await storedDetail({ compensation: "$150k", workplaceType: "hybrid", location: "Denver" }), context);
    expect(view.job).toMatchObject({ ats: "greenhouse", jobId: "a", title: "Backend Engineer", company: "Acme", location: "Denver", source: "Stripe", pay: "$150k", workplace: "hybrid" });
    expect(view.job.posted).toEqual({ date: "2026-09-30", daysOpen: 3, ghost: false });
});

test("missing pay and workplace terms are null", async () => {
    expect(toJobDetailView(await storedDetail({}), context).job).toMatchObject({ pay: null, workplace: null });
});
