import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import type { JobKey, JobViews } from "../../src/db/store.js";
import { makeJob } from "../../src/jobs/job.js";
import type { MakeStores } from "./storeContract.js";

const SEEN = "2026-10-01T00:00:00.000Z";
const CUTOFF = "2026-10-10T00:00:00.000Z";
const SEEN_AGAIN = "2026-10-15T00:00:00.000Z";
const FIRST = "2026-10-20T09:00:00.000Z";
const LATER = "2026-10-21T09:00:00.000Z";
const KEPT = { ats: "greenhouse", jobId: "kept" };
const OTHER = { ats: "greenhouse", jobId: "other" };

function job(jobId: string) {
    return makeJob({ ats: "greenhouse", jobId, company: "Acme", title: "Backend Engineer", url: `https://example.com/${jobId}` }, {});
}

async function seeded(make: MakeStores): Promise<TestStores> {
    const stores = await make();
    await stores.jobStore.upsertAll([job("kept"), job("other")], SEEN, "Acme");
    for (const id of ["kept", "other"]) await stores.jobStore.recordVerdict({ job_id: id, score: 80, reasons: [], gaps: [] }, { scoredAt: SEEN, runId: "run-1" });
    return stores;
}

function mark(views: JobViews, applied: boolean, at: string) {
    return views.setApplied({ ...KEPT, applied, at });
}

async function markOf(views: JobViews, key: JobKey = KEPT) {
    const row = await views.jobDetail(key);
    return row && { applied: row.applied, appliedOn: row.applied_on, hidden: row.hidden };
}

async function scoring({ jobStore, jobViews }: TestStores) {
    const recommended = await jobViews.scoredFrom({ sources: ["Acme"], minScore: 70 });
    const kept = await jobStore.findJob("kept");
    return { recommended: recommended.map((row) => row.job_id), score: kept?.score, scoredAt: kept?.scored_at };
}

async function marksOnce({ jobViews }: TestStores) {
    expect(await mark(jobViews, true, FIRST)).toEqual({ appliedOn: FIRST });
    expect(await mark(jobViews, true, LATER)).toEqual({ appliedOn: FIRST });
    expect(await markOf(jobViews)).toEqual({ applied: true, appliedOn: FIRST, hidden: false });
    expect(await jobViews.setApplied({ ats: "greenhouse", jobId: "missing", applied: true, at: FIRST })).toBeNull();
}

async function independentOfHiding({ jobViews }: TestStores) {
    await jobViews.setHidden({ ...KEPT, hidden: true });
    expect(await markOf(jobViews)).toEqual({ applied: true, appliedOn: FIRST, hidden: true });
    await jobViews.setHidden({ ...KEPT, hidden: false });
}

async function keptByCleanupAndRuns({ jobStore, jobViews, postings }: TestStores) {
    await postings.prune(CUTOFF);
    expect([await markOf(jobViews, OTHER), (await jobViews.jobVerdicts(KEPT)).length]).toEqual([null, 1]);
    await jobStore.upsertAll([job("kept")], SEEN_AGAIN, "Acme");
    expect(await markOf(jobViews)).toEqual({ applied: true, appliedOn: FIRST, hidden: false });
}

async function undoneAndMarkedAgain({ jobViews, postings }: TestStores) {
    expect(await mark(jobViews, false, LATER)).toEqual({ appliedOn: null });
    expect(await markOf(jobViews)).toEqual({ applied: false, appliedOn: null, hidden: false });
    expect(await mark(jobViews, true, LATER)).toEqual({ appliedOn: LATER });
    await mark(jobViews, false, LATER);
    await postings.prune(LATER);
    expect(await markOf(jobViews)).toBeNull();
}

async function appliedList({ jobViews }: TestStores) {
    const jobs = await jobViews.appliedJobs({ offset: 0, limit: 10 });
    return [jobs.map((job) => job.job_id), await jobViews.countApplied()];
}

async function listsMarkedJobs(stores: TestStores) {
    expect(await appliedList(stores)).toEqual([[], 0]);
    await stores.jobViews.setApplied({ ...KEPT, applied: true, at: FIRST });
    await stores.jobViews.setApplied({ ...OTHER, applied: true, at: LATER });
    await stores.jobViews.setHidden({ ...OTHER, hidden: true });
    expect(await appliedList(stores)).toEqual([["other", "kept"], 2]);
    expect((await stores.jobViews.appliedJobs({ offset: 1, limit: 1 })).map((job) => job.job_id)).toEqual(["kept"]);
    await stores.jobViews.setApplied({ ...KEPT, applied: false, at: LATER });
    expect(await appliedList(stores)).toEqual([["other"], 1]);
}

export function appliedContract(make: MakeStores): void {
    test("the applied list holds the marked jobs, most recently marked first, hidden ones too, and counts them", async () => {
        await listsMarkedJobs(await seeded(make));
    });

    test("the applied mark is set once, undone, kept through runs and the cleanup, and independent of hiding", async () => {
        const stores = await seeded(make);
        const before = await scoring(stores);
        await marksOnce(stores);
        expect(await scoring(stores)).toEqual(before);
        await independentOfHiding(stores);
        await keptByCleanupAndRuns(stores);
        await undoneAndMarkedAgain(stores);
    });
}
