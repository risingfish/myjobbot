import { expect, test } from "vitest";
import { makeJob } from "../../src/jobs/job.js";
import type { MakeStores } from "./storeContract.js";

const SEEN = "2026-10-01T00:00:00.000Z";
const verdict = (id: string) => ({ job_id: id, score: 50, base: 25, bonus: 25, reasons: [], gaps: [] });

async function newestFirst(make: MakeStores) {
    const stores = await make();
    const jobs = ["a", "b", "c", "d"].map((jobId) => makeJob({ ats: "greenhouse", jobId, company: "Acme", title: "Backend Engineer", url: `https://example.com/${jobId}` }, {}));
    await stores.jobStore.upsertAll(jobs, SEEN, "Acme");
    const scores: Array<[string, string]> = [["a", "2026-10-02"], ["b", "2026-10-03"], ["c", "2026-10-04"], ["a", "2026-10-05"]];
    for (const [id, day] of scores) await stores.jobStore.recordVerdict(verdict(id), { scoredAt: `${day}T00:00:00.000Z`, runId: `run-${day}` });
    await stores.jobViews.clearScore({ ats: "greenhouse", jobId: "c" });
    const keys = (limit: number) => stores.jobViews.recentlyScored(limit).then((found) => found.map((key) => `${key.ats}:${key.jobId}`));
    expect([await keys(10), await keys(2)]).toEqual([["greenhouse:a", "greenhouse:c", "greenhouse:b"], ["greenhouse:a", "greenhouse:c"]]);
}

export function recentContract(make: MakeStores): void {
    test("the most recently scored jobs come by their latest verdict, each once, a cleared score still counting, up to the limit", () => newestFirst(make));
}
