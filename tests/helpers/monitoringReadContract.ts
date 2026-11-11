import { expect, test } from "vitest";
import { OWNER_ID } from "../../src/db/owner.js";
import { makeJob } from "../../src/jobs/job.js";
import { ACME, END, fetchOf, LATER, PAST, secondUser, sourceOf, START, TALLY, withStores, type MonitoringHooks } from "./monitoringContract.js";
import type { TestStores } from "./memoryStore.js";
import type { MakeStores } from "./storeContract.js";

async function seedRuns(stores: TestStores): Promise<number> {
    const { runHistory } = stores;
    await runHistory.begin("old", PAST);
    await runHistory.begin("run-1", START);
    await runHistory.partEnded({ runId: "run-1", userId: OWNER_ID, partId: "part-1", at: START, endedAt: END, outcome: "finished", reason: null, totals: TALLY });
    const second = await secondUser(stores);
    await runHistory.partStarted({ runId: "run-1", userId: second, partId: "part-2", at: LATER });
    await runHistory.begin("run-2", LATER);
    for (const step of ["search", "finish", "finish"] as const) await stores.careers.audit({ runId: "part-1", at: START, ats: "linkedin", jobId: step, company: "Acme", step, url: null, outcome: "found", reason: null, warning: false });
    return second;
}

async function readsGiveRunsAndParts(stores: TestStores): Promise<number> {
    const { monitoring } = stores;
    const second = await seedRuns(stores);
    expect((await monitoring.runs(START)).map((run) => [run.id, run.outcome, run.endedAt])).toEqual([
        ["run-2", null, null],
        ["run-1", null, null],
    ]);
    const detail = await monitoring.run("run-1");
    expect(detail?.parts.map((part) => [part.userId, part.partId, part.outcome, part.lookups, part.totals.jobsScored])).toEqual([
        [OWNER_ID, "part-1", "finished", 2, 4],
        [second, "part-2", "running", 0, 0],
    ]);
    expect(await monitoring.run("missing")).toBeNull();
    return second;
}

async function readsGiveFetches(stores: TestStores): Promise<void> {
    const { monitoring } = stores;
    const id = await sourceOf(stores, OWNER_ID);
    await stores.fetches.record(fetchOf(id, START));
    await stores.fetches.record({ ...fetchOf(id, LATER), outcome: "ok", reason: null });
    await stores.fetches.record(fetchOf(id, PAST));
    expect(await monitoring.fetches(START)).toEqual([
        { sourceId: id, module: "greenhouse", at: LATER, outcome: "ok", reason: null, pages: 1, jobs: 0, cost: 0 },
        { sourceId: id, module: "greenhouse", at: START, outcome: "failing", reason: "http_404", pages: 1, jobs: 0, cost: 0 },
    ]);
}

async function recentFetchesPerSource(stores: TestStores, otherUser: number): Promise<void> {
    const first = (await stores.sources.save({ ...ACME, name: "Gamma", target: "greenhouse:gamma" }, START)).id;
    const second = (await stores.sources.save({ ...ACME, name: "Delta", target: "greenhouse:delta" }, START)).id;
    for (let day = 1; day <= 12; day += 1) await stores.fetches.record(fetchOf(first, `2026-11-${String(day).padStart(2, "0")}T00:00:00.000Z`));
    await stores.fetches.record({ ...fetchOf(second, START), outcome: "ok", reason: null, jobs: 3 });
    const recent = await stores.fetches.recent([first, second], 10);
    expect(recent.get(first)?.map((fetch) => fetch.at.slice(8, 10))).toEqual(["12", "11", "10", "09", "08", "07", "06", "05", "04", "03"]);
    expect(recent.get(second)).toEqual([{ at: START, outcome: "ok", reason: null, jobs: 3 }]);
    expect((await stores.forUser(otherUser).fetches.recent([first, second], 10)).size).toBe(0);
}

async function lookupsRescoresAndMails(stores: TestStores): Promise<void> {
    const audit = { runId: "part-1", at: LATER, ats: "linkedin", jobId: "1", company: "Acme", url: null, reason: null, warning: false };
    await stores.careers.audit({ ...audit, step: "open_job", url: "https://boards.example/1", outcome: "ok", pageSource: "board" });
    await stores.careers.audit({ ...audit, step: "finish", outcome: "failed", reason: "job_not_found" });
    await stores.careers.audit({ ...audit, step: "search", outcome: "ok" });
    await stores.careers.audit({ ...audit, at: PAST, step: "finish", outcome: "found" });
    expect(await stores.monitoring.lookups(LATER)).toEqual([
        { at: LATER, step: "open_job", outcome: "ok", reason: null, pageSource: "board" },
        { at: LATER, step: "finish", outcome: "failed", reason: "job_not_found", pageSource: null },
    ]);
    await stores.jobStore.upsertAll([makeJob({ ats: "greenhouse", jobId: "1", company: "Acme", title: "Engineer", url: "https://example.com/1" }, {})], START, "Acme");
    expect(await stores.rescoreLog.begin({ ats: "greenhouse", jobId: "1" }, "11111111-1111-4111-8111-111111111111", LATER)).toEqual({ started: "11111111-1111-4111-8111-111111111111" });
    await stores.rescoreLog.end("11111111-1111-4111-8111-111111111111", { outcome: "scored", filter: null, score: 72 }, END, { modelCalls: 3, promptTokens: 2400, completionTokens: 180 });
    expect(await stores.monitoring.rescores(LATER)).toEqual([{ startedAt: LATER, endedAt: END, outcome: "scored", filter: null, score: 72, modelCalls: 3, promptTokens: 2400, completionTokens: 180 }]);
    await stores.mailLog.record({ at: PAST, kind: "test", outcome: "sent", reason: null });
    await stores.mailLog.record({ at: LATER, kind: "sign_in_link", outcome: "failed", reason: "auth" });
    expect(await stores.monitoring.mails(LATER)).toEqual([{ at: LATER, kind: "sign_in_link", outcome: "failed", reason: "auth" }]);
}

async function readsAndRecentFetches(stores: TestStores): Promise<void> {
    const other = await readsGiveRunsAndParts(stores);
    await readsGiveFetches(stores);
    await recentFetchesPerSource(stores, other);
    await lookupsRescoresAndMails(stores);
}

export function monitoringReadCases(make: MakeStores, hooks: (stores: TestStores) => MonitoringHooks): void {
    test("the reads give runs newest first, a run's parts by user with their lookups, and fetches by source id and module, a user's recent fetches are each source's latest and only theirs, and lookups, re-scores and mail are read by fixed values only", withStores(make, hooks, readsAndRecentFetches));
}
