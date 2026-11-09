import { expect, test } from "vitest";
import { makeJob, type Job } from "../../src/jobs/job.js";
import type { TestStores } from "./memoryStore.js";
import type { MakeStores } from "./storeContract.js";

export interface UserHooks {
    seedUsers(ids: number[]): Promise<void>;
}

const SEEN = "2026-11-08T00:00:00.000Z";
const LATER = "2026-11-09T00:00:00.000Z";

export function posting(jobId: string, description: Partial<Pick<Job, "description" | "descriptionFormat">> = {}): Job {
    return makeJob({ ats: "greenhouse", jobId, company: "Acme", title: "Engineer", url: `https://acme.example/${jobId}` }, description);
}

export function withTwoUsers(make: MakeStores, hooks: UserHooks, check: (stores: TestStores, second: ReturnType<TestStores["forUser"]>) => Promise<void>) {
    return async () => {
        const stores = await make();
        try {
            await hooks.seedUsers([1, 2]);
            await check(stores, stores.forUser(2));
        } finally {
            await stores.close();
        }
    };
}

async function eachSeesOnlyTheirOwn(stores: TestStores, second: ReturnType<TestStores["forUser"]>): Promise<void> {
    await stores.jobStore.upsertAll([posting("mine")], SEEN, "Acme");
    expect([await second.jobViews.countAllJobs(), await second.jobViews.allJobs({ offset: 0, limit: 5 }), await second.jobStore.findJob("mine")]).toEqual([0, [], null]);
    expect(await second.jobViews.jobDetail({ ats: "greenhouse", jobId: "mine" })).toBeNull();
}

async function marksArePerUser(stores: TestStores, second: ReturnType<TestStores["forUser"]>): Promise<void> {
    await stores.jobStore.upsertAll([posting("both")], SEEN, "Acme");
    await second.jobStore.upsertAll([posting("both")], SEEN, "Acme board");
    await second.jobViews.setHidden({ ats: "greenhouse", jobId: "both", hidden: true });
    await second.jobViews.setApplied({ ats: "greenhouse", jobId: "both", applied: true, at: SEEN });
    const [mine] = await stores.jobViews.allJobs({ offset: 0, limit: 5 });
    expect([mine?.hidden, mine?.applied, mine?.source]).toEqual([false, false, "Acme"]);
    const [theirs] = await second.jobViews.allJobs({ offset: 0, limit: 5 });
    expect([theirs?.hidden, theirs?.applied, theirs?.source]).toEqual([true, true, "Acme board"]);
}

async function scoredSeparately(stores: TestStores, second: ReturnType<TestStores["forUser"]>): Promise<void> {
    await stores.jobStore.upsertAll([posting("shared")], SEEN, "Acme");
    await second.jobStore.upsertAll([posting("shared")], SEEN, "Acme");
    await stores.jobStore.recordVerdict({ job_id: "shared", score: 80, reasons: ["Go"], gaps: [] }, { scoredAt: SEEN, runId: "run-1" });
    await second.jobStore.recordVerdict({ job_id: "shared", score: 40, reasons: [], gaps: ["Go"] }, { scoredAt: SEEN, runId: "run-2" });
    expect([(await stores.jobStore.findJob("shared"))?.score, (await second.jobStore.findJob("shared"))?.score]).toEqual([80, 40]);
    expect([(await stores.jobViews.jobVerdicts({ ats: "greenhouse", jobId: "shared" })).map((v) => v.score), (await second.jobViews.jobVerdicts({ ats: "greenhouse", jobId: "shared" })).map((v) => v.score)]).toEqual([[80], [40]]);
    expect(await stores.postings.known([{ ats: "greenhouse", jobId: "shared" }])).toHaveLength(1);
}

async function descriptionKept(stores: TestStores, second: ReturnType<TestStores["forUser"]>): Promise<void> {
    await stores.jobStore.upsertAll([posting("described", { description: "Build APIs.", descriptionFormat: "text" })], SEEN, "Acme");
    await second.jobStore.upsertAll([posting("described")], LATER, "Gmail alerts");
    expect((await second.jobStore.findJob("described"))?.description).toBe("Build APIs.");
    expect(
        await stores.postings.known([
            { ats: "greenhouse", jobId: "described" },
            { ats: "greenhouse", jobId: "absent" },
        ]),
    ).toEqual([{ ats: "greenhouse", jobId: "described", described: true }]);
}

async function markdownRescoresEveryone(stores: TestStores, second: ReturnType<TestStores["forUser"]>): Promise<void> {
    for (const user of [stores, second]) {
        await user.jobStore.upsertAll([posting("turned", { description: "plain", descriptionFormat: "text" })], SEEN, "Acme");
        await user.jobStore.recordVerdict({ job_id: "turned", score: 60, reasons: [], gaps: [] }, { scoredAt: SEEN, runId: "run" });
    }
    await stores.jobStore.upsertAll([posting("turned", { description: "plain again", descriptionFormat: "text" })], LATER, "Acme");
    expect([(await stores.jobStore.findJob("turned"))?.scored_at, (await second.jobStore.findJob("turned"))?.scored_at]).toEqual([SEEN, SEEN]);
    await stores.jobStore.upsertAll([posting("turned", { description: "## now markdown", descriptionFormat: "markdown" })], LATER, "Acme");
    expect([(await stores.jobStore.findJob("turned"))?.scored_at, (await second.jobStore.findJob("turned"))?.scored_at]).toEqual([null, null]);
}

async function upsertedTogether(stores: TestStores, second: ReturnType<TestStores["forUser"]>): Promise<void> {
    await Promise.all([stores.jobStore.upsertAll([posting("race")], SEEN, "Acme"), second.jobStore.upsertAll([posting("race")], SEEN, "Acme")]);
    expect([await stores.jobViews.countAllJobs(), await second.jobViews.countAllJobs(), await stores.postings.known([{ ats: "greenhouse", jobId: "race" }])]).toEqual([1, 1, [{ ats: "greenhouse", jobId: "race", described: false }]]);
}

export function userJobContract(make: MakeStores, hooks: UserHooks): void {
    test("a user sees none of another user's jobs", withTwoUsers(make, hooks, eachSeesOnlyTheirOwn));
    test("hide, applied and source label are each user's own", withTwoUsers(make, hooks, marksArePerUser));
    test("one posting found by two users is stored once and scored separately, each with their own history", withTwoUsers(make, hooks, scoredSeparately));
    test("a later fetch without a description keeps the one found, and postings report what is known", withTwoUsers(make, hooks, descriptionKept));
    test("a posting turning from plain text to Markdown is scored again by every user, and any other refresh by none", withTwoUsers(make, hooks, markdownRescoresEveryone));
    userJobStrictCases(make, hooks);
}

export function userJobStrictCases(make: MakeStores, hooks: UserHooks): void {
    test("two users storing the same posting at once give one posting and two views", withTwoUsers(make, hooks, upsertedTogether));
}
