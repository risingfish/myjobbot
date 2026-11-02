import { expect, test } from "vitest";
import type { Stores } from "../../src/db/store.js";
import { makeJob } from "../../src/jobs/job.js";
import type { MakeStores } from "./storeContract.js";

const SEEN = "2026-10-01T00:00:00.000Z";
const APPLIED_ON = "2026-10-02T00:00:00.000Z";
const KEY = { ats: "greenhouse", jobId: "kept" };

async function scoredAndMarked(make: MakeStores): Promise<Stores> {
    const stores = await make();
    await stores.jobStore.upsertAll([makeJob({ ats: "greenhouse", jobId: "kept", company: "Acme", title: "Backend Engineer", url: "https://example.com/kept" }, {})], SEEN, "Acme");
    await stores.jobStore.recordVerdict({ job_id: "kept", score: 80, base: 45, bonus: 35, reasons: ["fit"], gaps: ["gap"] }, { scoredAt: SEEN, runId: "run-1" });
    await stores.jobViews.setHidden({ ...KEY, hidden: true });
    await stores.jobViews.setApplied({ ...KEY, applied: true, at: APPLIED_ON });
    return stores;
}

export function rescoreContract(make: MakeStores): void {
    test("clearing a score empties the score fields, keeps the marks and the verdict history, and reports an unknown job", async () => {
        const { jobViews } = await scoredAndMarked(make);
        expect(await jobViews.clearScore(KEY)).toBe(true);
        const row = await jobViews.jobDetail(KEY);
        expect(row && [row.score, row.base_score, row.bonus_score, row.reasons, row.gaps, row.scored_at]).toEqual([null, null, null, [], [], null]);
        expect(row && [row.hidden, row.applied, row.applied_on]).toEqual([true, true, APPLIED_ON]);
        expect(await jobViews.jobVerdicts(KEY)).toHaveLength(1);
        expect(await jobViews.clearScore({ ats: "greenhouse", jobId: "missing" })).toBe(false);
    });
}
