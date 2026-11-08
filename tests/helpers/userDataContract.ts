import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import type { MakeStores } from "./storeContract.js";
import { posting, withTwoUsers, type UserHooks } from "./userJobContract.js";

const SEEN = "2026-11-08T00:00:00.000Z";
const STALE = "2026-09-01T00:00:00.000Z";
const KEY = { ats: "greenhouse", jobId: "run-job" };

type Second = ReturnType<TestStores["forUser"]>;

async function runsArePerUser(stores: TestStores, second: Second): Promise<void> {
    await stores.jobStore.upsertAll([posting("run-job")], SEEN, "Acme");
    expect(await stores.rescoreLog.begin(KEY, "11111111-1111-4111-8111-111111111111", SEEN)).toEqual({ started: "11111111-1111-4111-8111-111111111111" });
    expect([await second.rescoreLog.run("11111111-1111-4111-8111-111111111111"), await second.rescoreLog.runsFor(KEY), await second.rescoreLog.begin(KEY, "22222222-2222-4222-8222-222222222222", SEEN)]).toEqual([null, [], { missing: true }]);
}

async function gmailIsPerUser(stores: TestStores, second: Second): Promise<void> {
    await stores.gmail.connected({ email: "owner@example.com", sealedPassword: "sealed-1" }, SEEN);
    await stores.alerts.recordRead({ uidValidity: 1, lastUid: 9, emails: 2, jobs: 3, notUnderstood: 0 }, SEEN);
    expect([await second.gmail.connection(), await second.alerts.state()]).toEqual([null, null]);
    await second.gmail.connected({ email: "second@example.com", sealedPassword: "sealed-2" }, SEEN);
    await second.gmail.disconnect();
    expect([(await stores.gmail.connection())?.email, (await stores.alerts.state())?.last_uid, (await second.gmail.connection())?.status]).toEqual(["owner@example.com", 9, "none"]);
}

async function callsAreShared(stores: TestStores, second: Second): Promise<void> {
    await stores.apiCalls.record("jsearch", "Mine", SEEN);
    await second.apiCalls.record("jsearch", "Theirs", SEEN);
    expect([await stores.apiCalls.countSince("jsearch", STALE), await second.apiCalls.countSince("jsearch", STALE)]).toEqual([2, 2]);
}

async function prunedPerUser(stores: TestStores, second: Second): Promise<void> {
    await stores.jobStore.upsertAll([posting("old"), posting("applied"), posting("kept-by-other")], STALE, "Acme");
    await second.jobStore.upsertAll([posting("kept-by-other")], SEEN, "Acme");
    await stores.jobViews.setApplied({ ats: "greenhouse", jobId: "applied", applied: true, at: STALE });
    expect(await stores.postings.prune(SEEN)).toBe(1);
    expect((await stores.jobViews.allJobs({ offset: 0, limit: 5 })).map((job) => job.job_id)).toEqual(["applied"]);
    expect((await stores.postings.known(["old", "applied", "kept-by-other"].map((jobId) => ({ ats: "greenhouse", jobId })))).map((known) => known.jobId).sort()).toEqual(["applied", "kept-by-other"]);
}

async function beganOncePerUser(stores: TestStores, second: Second): Promise<void> {
    await stores.jobStore.upsertAll([posting("run-job")], SEEN, "Acme");
    await second.jobStore.upsertAll([posting("run-job")], SEEN, "Acme");
    const [mine, theirs, again] = await Promise.all([stores.rescoreLog.begin(KEY, "33333333-3333-4333-8333-333333333333", SEEN), second.rescoreLog.begin(KEY, "44444444-4444-4444-8444-444444444444", SEEN), stores.rescoreLog.begin(KEY, "55555555-5555-4555-8555-555555555555", SEEN)]);
    expect([mine, theirs]).toEqual([{ started: "33333333-3333-4333-8333-333333333333" }, { started: "44444444-4444-4444-8444-444444444444" }]);
    expect(again).toEqual({ running: "33333333-3333-4333-8333-333333333333" });
}

export function userDataContract(make: MakeStores, hooks: UserHooks): void {
    test("a user's re-score runs are their own, and another user can't re-score a job they don't have", withTwoUsers(make, hooks, runsArePerUser));
    test("each user's Gmail connection and alert progress are their own", withTwoUsers(make, hooks, gmailIsPerUser));
    test("the JSearch call count is the deployment's, shared by every user", withTwoUsers(make, hooks, callsAreShared));
    userDataStrictCases(make, hooks);
}

export function userDataStrictCases(make: MakeStores, hooks: UserHooks): void {
    test("clean-up drops each user's stale views but never an applied one, and a posting only once no user has it", withTwoUsers(make, hooks, prunedPerUser));
    test("each user has one open re-score of a job, and two users may re-score it at once", withTwoUsers(make, hooks, beganOncePerUser));
}
