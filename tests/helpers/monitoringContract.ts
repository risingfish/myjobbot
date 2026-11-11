import { expect, test } from "vitest";
import type { RunTotals } from "../../src/db/runHistory.js";
import type { TallyTotals } from "../../src/monitoring/tallyEvents.js";
import { OWNER_ID } from "../../src/db/owner.js";
import type { FetchRecord } from "../../src/db/fetchHistory.js";
import type { MailSend } from "../../src/db/mailLog.js";
import type { StoredFetch, StoredPart, StoredRun } from "./memoryMonitoring.js";
import type { TestStores } from "./memoryStore.js";
import type { MakeStores } from "./storeContract.js";

export interface MonitoringHooks {
    run(runId: string): Promise<StoredRun | null>;
    parts(runId: string): Promise<StoredPart[]>;
    fetches(userId: number): Promise<StoredFetch[]>;
    mails(): Promise<MailSend[]>;
}

type Check = (stores: TestStores, hooks: MonitoringHooks) => Promise<void>;

const START = "2026-11-10T01:00:00.000Z";
const LATER = "2026-11-10T01:01:00.000Z";
const END = "2026-11-10T01:05:00.000Z";
const PAST = "2026-11-01T00:00:00.000Z";
export const NO_TALLY: TallyTotals = { fetches: 0, fetchFailures: 0, jobsFound: 0, jobsScored: 0, searches: 0, searchFailures: 0, modelCalls: 0, promptTokens: 0, completionTokens: 0 };
const TALLY: TallyTotals = { ...NO_TALLY, fetches: 3, fetchFailures: 1, jobsFound: 9, jobsScored: 4, modelCalls: 6, promptTokens: 900, completionTokens: 120 };
const TOTALS: RunTotals = { ...TALLY, users: 2, usersFailed: 0, usersSkipped: 1 };
const ACME = { module: "greenhouse", name: "Acme", params: { slug: "acme" }, target: "greenhouse:acme", enabled: true };

function fetchOf(sourceId: number, at = START): FetchRecord {
    return { sourceId, partId: "part-1", module: "greenhouse", at, ms: 1200, outcome: "failing", reason: "http_404", pages: 1, jobs: 0, cost: 0 };
}

async function sourceOf(stores: TestStores, userId: number): Promise<number> {
    return (await stores.forUser(userId).sources.save(ACME, START)).id;
}

function withStores(make: MakeStores, hooks: (stores: TestStores) => MonitoringHooks, check: Check) {
    return async () => {
        const stores = await make();
        try {
            await check(stores, hooks(stores));
        } finally {
            await stores.close();
        }
    };
}

async function aRunFromStartToEnd({ runHistory }: TestStores, hooks: MonitoringHooks): Promise<void> {
    await runHistory.begin("run-1", START);
    await runHistory.alive("run-1", LATER);
    await runHistory.partStarted({ runId: "run-1", userId: OWNER_ID, partId: "part-1", at: START });
    expect(await hooks.parts("run-1")).toEqual([{ runId: "run-1", userId: OWNER_ID, partId: "part-1", startedAt: START, endedAt: null, outcome: "running", reason: null, totals: null }]);
    expect(await hooks.run("run-1")).toMatchObject({ aliveAt: LATER, endedAt: null, outcome: null, incomplete: false });
    await runHistory.partEnded({ runId: "run-1", userId: OWNER_ID, partId: "part-1", at: START, endedAt: END, outcome: "finished", reason: null, totals: TALLY });
    await runHistory.markIncomplete("run-1");
    await runHistory.end("run-1", { at: END, outcome: "finished", reason: null, totals: TOTALS });
    expect(await hooks.parts("run-1")).toEqual([{ runId: "run-1", userId: OWNER_ID, partId: "part-1", startedAt: START, endedAt: END, outcome: "finished", reason: null, totals: TALLY }]);
    expect(await hooks.run("run-1")).toEqual({ id: "run-1", startedAt: START, aliveAt: END, endedAt: END, outcome: "finished", reason: null, incomplete: true, totals: TOTALS });
}

async function aSkippedPartIsWrittenOnce({ runHistory }: TestStores, hooks: MonitoringHooks): Promise<void> {
    await runHistory.begin("run-1", START);
    await runHistory.partEnded({ runId: "run-1", userId: OWNER_ID, partId: null, at: START, endedAt: START, outcome: "skipped", reason: "deactivated", totals: NO_TALLY });
    expect(await hooks.parts("run-1")).toEqual([{ runId: "run-1", userId: OWNER_ID, partId: null, startedAt: START, endedAt: START, outcome: "skipped", reason: "deactivated", totals: NO_TALLY }]);
}

async function twoRunsAtOnceAndPruning({ runHistory }: TestStores, hooks: MonitoringHooks): Promise<void> {
    await runHistory.begin("old", PAST);
    await runHistory.partStarted({ runId: "old", userId: OWNER_ID, partId: "p-old", at: PAST });
    await runHistory.begin("manual", START);
    await runHistory.begin("scheduled", START);
    await runHistory.partStarted({ runId: "manual", userId: OWNER_ID, partId: "p-manual", at: START });
    await runHistory.alive("scheduled", LATER);
    await runHistory.end("manual", { at: END, outcome: "failed", reason: "database", totals: { ...TOTALS, users: 1 } });
    expect([(await hooks.run("manual"))?.aliveAt, (await hooks.run("scheduled"))?.aliveAt, (await hooks.run("scheduled"))?.outcome, (await hooks.parts("scheduled")).length]).toEqual([END, LATER, null, 0]);
    await runHistory.pruneBefore(START);
    expect([await hooks.run("old"), await hooks.parts("old"), (await hooks.parts("manual")).length]).toEqual([null, [], 1]);
}

async function secondUser(stores: TestStores): Promise<number> {
    await stores.accounts.initOwner({ email: "o@example.com", emailKey: "o@example.com", passwordDigest: "d" }, START);
    await stores.accountCodes.makeCode("code", OWNER_ID, START);
    const created = await stores.accounts.createAccount({ email: "ada@example.com", emailKey: "ada@example.com", name: "Ada", passwordDigest: "d" }, "code", START);
    if (created.kind !== "created") throw new Error(`no account: ${created.kind}`);
    return created.userId;
}

async function aRemovedAccountsPartsGoAndTotalsStay(stores: TestStores, hooks: MonitoringHooks): Promise<void> {
    const created = { userId: await secondUser(stores) };
    await stores.runHistory.begin("run-1", START);
    for (const userId of [OWNER_ID, created.userId]) await stores.runHistory.partEnded({ runId: "run-1", userId, partId: `p-${userId}`, at: START, endedAt: END, outcome: "finished", reason: null, totals: TALLY });
    await stores.runHistory.end("run-1", { at: END, outcome: "finished", reason: null, totals: TOTALS });
    for (const userId of [OWNER_ID, created.userId]) await stores.forUser(userId).fetches.record(fetchOf(await sourceOf(stores, userId)));
    await stores.accounts.setStatus(created.userId, { deactivatedAt: PAST, deleteAfter: PAST });
    expect(await stores.removal.remove(created.userId, END)).toBe("deleted");
    expect([(await hooks.parts("run-1")).map((part) => part.userId), (await hooks.run("run-1"))?.totals]).toEqual([[OWNER_ID], TOTALS]);
    expect([(await hooks.fetches(created.userId)).length, (await hooks.fetches(OWNER_ID)).length]).toEqual([0, 1]);
}

async function aSourcesFetchesGoWithIt(stores: TestStores, hooks: MonitoringHooks): Promise<void> {
    const kept = await sourceOf(stores, OWNER_ID);
    const removed = (await stores.sources.save({ ...ACME, name: "Beta", target: "greenhouse:beta" }, START)).id;
    for (const id of [kept, removed]) await stores.fetches.record(fetchOf(id));
    await stores.sources.remove(removed);
    expect((await hooks.fetches(OWNER_ID)).map((fetch) => fetch.sourceId)).toEqual([kept]);
}

async function fetchesAreRecordedAndPruned(stores: TestStores, hooks: MonitoringHooks): Promise<void> {
    const id = await sourceOf(stores, OWNER_ID);
    await stores.fetches.record(fetchOf(id, PAST));
    await stores.fetches.record({ ...fetchOf(id), outcome: "skipped", reason: "not due", ms: 0, pages: 0 });
    expect(await hooks.fetches(OWNER_ID)).toEqual([{ userId: OWNER_ID, ...fetchOf(id, PAST) }, { userId: OWNER_ID, ...fetchOf(id), outcome: "skipped", reason: "not due", ms: 0, pages: 0 }]);
    await stores.fetchHistory.pruneBefore(START);
    expect((await hooks.fetches(OWNER_ID)).map((fetch) => fetch.at)).toEqual([START]);
}

export function runHistoryCases(make: MakeStores, hooks: (stores: TestStores) => MonitoringHooks): void {
    test("a run is recorded from its start, through its heartbeat and its parts, to how it ended, and can be marked incomplete", withStores(make, hooks, aRunFromStartToEnd));
    test("a part that never started, a skip, is written once with how it ended", withStores(make, hooks, aSkippedPartIsWrittenOnce));
    test("two runs open at once keep their own heartbeat, parts and ending, and pruning removes older runs with their parts", withStores(make, hooks, twoRunsAtOnceAndPruning));
}

async function mailsAreRecordedAndPruned({ mailLog }: TestStores, hooks: MonitoringHooks): Promise<void> {
    const old: MailSend = { at: PAST, kind: "test", outcome: "sent", reason: null };
    const failed: MailSend = { at: START, kind: "sign_in_link", outcome: "failed", reason: "connect" };
    await mailLog.record(old);
    await mailLog.record(failed);
    expect(await hooks.mails()).toEqual([old, failed]);
    await mailLog.pruneBefore(START);
    expect(await hooks.mails()).toEqual([failed]);
}

async function readsGiveRunsPartsAndFetches(stores: TestStores): Promise<number> {
    const { runHistory, monitoring } = stores;
    await runHistory.begin("old", PAST);
    await runHistory.begin("run-1", START);
    await runHistory.partEnded({ runId: "run-1", userId: OWNER_ID, partId: "part-1", at: START, endedAt: END, outcome: "finished", reason: null, totals: TALLY });
    const second = await secondUser(stores);
    await runHistory.partStarted({ runId: "run-1", userId: second, partId: "part-2", at: LATER });
    await runHistory.begin("run-2", LATER);
    for (const step of ["search", "finish", "finish"] as const) await stores.careers.audit({ runId: "part-1", at: START, ats: "linkedin", jobId: step, company: "Acme", step, url: null, outcome: "found", reason: null, warning: false });
    expect((await monitoring.runs(START)).map((run) => [run.id, run.outcome, run.endedAt])).toEqual([["run-2", null, null], ["run-1", null, null]]);
    const detail = await monitoring.run("run-1");
    expect(detail?.parts.map((part) => [part.userId, part.partId, part.outcome, part.lookups, part.totals.jobsScored])).toEqual([[OWNER_ID, "part-1", "finished", 2, 4], [second, "part-2", "running", 0, 0]]);
    expect(await monitoring.run("missing")).toBeNull();
    const id = await sourceOf(stores, OWNER_ID);
    await stores.fetches.record(fetchOf(id, START));
    await stores.fetches.record({ ...fetchOf(id, LATER), outcome: "ok", reason: null });
    await stores.fetches.record(fetchOf(id, PAST));
    expect(await monitoring.fetches(START)).toEqual([{ sourceId: id, module: "greenhouse", at: LATER, outcome: "ok", reason: null, pages: 1, jobs: 0, cost: 0 }, { sourceId: id, module: "greenhouse", at: START, outcome: "failing", reason: "http_404", pages: 1, jobs: 0, cost: 0 }]);
    return second;
}

export function monitoringReadCases(make: MakeStores, hooks: (stores: TestStores) => MonitoringHooks): void {
    test("the reads give runs newest first, a run's parts by user with their lookups, and fetches by source id and module, and a user's recent fetches are each source's latest and only theirs", withStores(make, hooks, readsAndRecentFetches));
}

export function mailLogCases(make: MakeStores, hooks: (stores: TestStores) => MonitoringHooks): void {
    test("a mail send is recorded by its kind, outcome and fixed reason, and older sends are pruned", withStores(make, hooks, mailsAreRecordedAndPruned));
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

async function readsAndRecentFetches(stores: TestStores): Promise<void> {
    const other = await readsGiveRunsPartsAndFetches(stores);
    await recentFetchesPerSource(stores, other);
}

export function fetchHistoryCases(make: MakeStores, hooks: (stores: TestStores) => MonitoringHooks): void {
    test("a fetch, or planned skip, is recorded with every field, and older fetches are pruned", withStores(make, hooks, fetchesAreRecordedAndPruned));
}

export function monitoringStrictCases(make: MakeStores, hooks: (stores: TestStores) => MonitoringHooks): void {
    test("removing an account removes its parts of runs and its fetches, keeping the other users' and each run's totals", withStores(make, hooks, aRemovedAccountsPartsGoAndTotalsStay));
    test("deleting a source deletes its fetches and keeps the others'", withStores(make, hooks, aSourcesFetchesGoWithIt));
}
