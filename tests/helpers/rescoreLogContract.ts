import { expect, test } from "vitest";
import type { Stores } from "../../src/db/store.js";
import { makeJob } from "../../src/jobs/job.js";
import type { MakeStores } from "./storeContract.js";

const SEEN = "2026-10-01T00:00:00.000Z";
const CUTOFF = "2026-10-10T00:00:00.000Z";
const AT = "2026-11-03T10:00:00.000Z";
const ELEVEN_LATER = "2026-11-03T10:11:00.000Z";
const ENDED = "2026-11-03T10:12:00.000Z";
const KEPT = { ats: "greenhouse", jobId: "kept" };
const OTHER = { ats: "greenhouse", jobId: "other" };
const run = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

async function seeded(make: MakeStores): Promise<Stores> {
    const stores = await make();
    const jobs = ["kept", "other"].map((jobId) => makeJob({ ats: "greenhouse", jobId, company: "Acme", title: "Backend Engineer", url: `https://example.com/${jobId}` }, {}));
    await stores.jobStore.upsertAll(jobs, SEEN, "Acme");
    return stores;
}

async function oneOpenRun({ rescoreLog }: Stores) {
    expect(await rescoreLog.begin(KEPT, run(1), AT)).toEqual({ started: run(1) });
    expect(await rescoreLog.begin(KEPT, run(2), AT)).toEqual({ running: run(1) });
    expect(await rescoreLog.begin({ ats: "greenhouse", jobId: "missing" }, run(3), AT)).toEqual({ missing: true });
    expect(await rescoreLog.begin(KEPT, run(4), ELEVEN_LATER)).toEqual({ started: run(4) });
    const both = await Promise.all([rescoreLog.begin(OTHER, run(5), AT), rescoreLog.begin(OTHER, run(6), AT)]);
    expect(both.filter((result) => "started" in result)).toHaveLength(1);
}

async function listsRuns(make: MakeStores) {
    const stores = await seeded(make);
    await oneOpenRun(stores);
    await stores.rescoreLog.end(run(4), { outcome: "scored", filter: null, score: 72 }, ENDED);
    const runs = await stores.rescoreLog.runsFor(KEPT);
    expect(runs.map((each) => [each.id, each.outcome, each.score, each.endedAt])).toEqual([
        [run(4), "scored", 72, ENDED],
        [run(1), null, null, null],
    ]);
    expect(await stores.rescoreLog.run(run(4))).toEqual({ id: run(4), ats: "greenhouse", jobId: "kept", startedAt: ELEVEN_LATER, endedAt: ENDED, outcome: "scored", filter: null, score: 72 });
    expect(await stores.rescoreLog.run(run(9))).toBeNull();
}

async function keepsSteps(make: MakeStores) {
    const stores = await seeded(make);
    await stores.rescoreLog.begin(KEPT, run(1), AT);
    await stores.rescoreLog.begin(OTHER, run(2), AT);
    await stores.rescoreLog.addStep(run(1), { seq: 2, elapsedMs: 900, kind: "reading", fields: {} });
    await stores.rescoreLog.addStep(run(1), { seq: 1, elapsedMs: 10, kind: "settings", fields: { fallbacks: 0 } });
    expect((await stores.rescoreLog.stepsAfter(run(1), 0)).map((step) => [step.seq, step.kind, step.fields])).toEqual([
        [1, "settings", { fallbacks: 0 }],
        [2, "reading", {}],
    ]);
    expect((await stores.rescoreLog.stepsAfter(run(1), 1)).map((step) => step.seq)).toEqual([2]);
    await stores.jobViews.setApplied({ ...OTHER, applied: true, at: AT });
    await stores.jobStore.pruneLastSeenBefore(CUTOFF);
    expect([await stores.rescoreLog.runsFor(KEPT), await stores.rescoreLog.stepsAfter(run(1), 0), (await stores.rescoreLog.runsFor(OTHER)).length]).toEqual([[], [], 1]);
}

export function rescoreLogContract(make: MakeStores): void {
    test("a job has one open re-score at a time, an open one blocks for 10 minutes, and runs are listed newest first", () => listsRuns(make));
    test("a run's steps are read after a step number, in order, and go with the job when it is pruned, unless it is applied", () => keepsSteps(make));
}
