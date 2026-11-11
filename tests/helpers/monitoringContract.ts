import { expect, test } from "vitest";
import type { RunTotals } from "../../src/db/runHistory.js";
import type { TallyTotals } from "../../src/monitoring/tallyEvents.js";
import { OWNER_ID } from "../../src/db/owner.js";
import type { StoredPart, StoredRun } from "./memoryMonitoring.js";
import type { TestStores } from "./memoryStore.js";
import type { MakeStores } from "./storeContract.js";

export interface MonitoringHooks {
    run(runId: string): Promise<StoredRun | null>;
    parts(runId: string): Promise<StoredPart[]>;
}

type Check = (stores: TestStores, hooks: MonitoringHooks) => Promise<void>;

const START = "2026-11-10T01:00:00.000Z";
const LATER = "2026-11-10T01:01:00.000Z";
const END = "2026-11-10T01:05:00.000Z";
const PAST = "2026-11-01T00:00:00.000Z";
export const NO_TALLY: TallyTotals = { fetches: 0, fetchFailures: 0, jobsFound: 0, jobsScored: 0, searches: 0, searchFailures: 0, modelCalls: 0, promptTokens: 0, completionTokens: 0 };
const TALLY: TallyTotals = { ...NO_TALLY, fetches: 3, fetchFailures: 1, jobsFound: 9, jobsScored: 4, modelCalls: 6, promptTokens: 900, completionTokens: 120 };
const TOTALS: RunTotals = { ...TALLY, users: 2, usersFailed: 0, usersSkipped: 1 };

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

async function aRemovedAccountsPartsGoAndTotalsStay(stores: TestStores, hooks: MonitoringHooks): Promise<void> {
    await stores.accounts.initOwner({ email: "o@example.com", emailKey: "o@example.com", passwordDigest: "d" }, START);
    await stores.accountCodes.makeCode("code", OWNER_ID, START);
    const created = await stores.accounts.createAccount({ email: "ada@example.com", emailKey: "ada@example.com", name: "Ada", passwordDigest: "d" }, "code", START);
    if (created.kind !== "created") throw new Error(`no account: ${created.kind}`);
    await stores.runHistory.begin("run-1", START);
    for (const userId of [OWNER_ID, created.userId]) await stores.runHistory.partEnded({ runId: "run-1", userId, partId: `p-${userId}`, at: START, endedAt: END, outcome: "finished", reason: null, totals: TALLY });
    await stores.runHistory.end("run-1", { at: END, outcome: "finished", reason: null, totals: TOTALS });
    await stores.accounts.setStatus(created.userId, { deactivatedAt: PAST, deleteAfter: PAST });
    expect(await stores.removal.remove(created.userId, END)).toBe("deleted");
    expect([(await hooks.parts("run-1")).map((part) => part.userId), (await hooks.run("run-1"))?.totals]).toEqual([[OWNER_ID], TOTALS]);
}

export function runHistoryCases(make: MakeStores, hooks: (stores: TestStores) => MonitoringHooks): void {
    test("a run is recorded from its start, through its heartbeat and its parts, to how it ended, and can be marked incomplete", withStores(make, hooks, aRunFromStartToEnd));
    test("a part that never started, a skip, is written once with how it ended", withStores(make, hooks, aSkippedPartIsWrittenOnce));
    test("two runs open at once keep their own heartbeat, parts and ending, and pruning removes older runs with their parts", withStores(make, hooks, twoRunsAtOnceAndPruning));
}

export function monitoringStrictCases(make: MakeStores, hooks: (stores: TestStores) => MonitoringHooks): void {
    test("removing an account removes its parts of runs, keeping the other users' parts and each run's totals", withStores(make, hooks, aRemovedAccountsPartsGoAndTotalsStay));
}
