import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runAll } from "../src/app/runAll.js";
import { runExitCode } from "../src/app/runLines.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { scriptedChat, toolCallsReply } from "./helpers/chat.js";
import { makeDataDir, ONE_COMPANY, TEST_ENV } from "./helpers/dataDir.js";
import { publicDns } from "./helpers/fakeDns.js";
import { fakeBoard } from "./helpers/http.js";
import { storesWithSettings, type TestStores } from "./helpers/memoryStore.js";

const NOW = new Date().toISOString();
const ACME = { module: "greenhouse", name: "Acme", params: { slug: "acme" }, target: "greenhouse:acme", enabled: true };

async function twoUsers(): Promise<TestStores> {
    const stores = storesWithSettings(ONE_COMPANY);
    await stores.accountCodes.makeCode("code", 1, NOW);
    await stores.accounts.createAccount({ email: "second@example.com", emailKey: "second@example.com", name: "Second", passwordDigest: "digest" }, "code", NOW);
    const second = stores.forUser(2);
    await second.sources.save(ACME, NOW);
    await second.resume.saveResume({ text: "# Sam Second\nProduct designer.", fileName: "resume.md", fileType: "md", uploadedAt: NOW });
    return stores;
}

function scoring(source: string, base: number) {
    return [toolCallsReply(["next_jobs", { source }], ["record_matches", { verdicts: [{ job_id: "1000", base, bonus: 0 }] }], ["finish", { summary: `${source} done` }])];
}

function firstEvents(dataDir: string): unknown[] {
    const traces = readdirSync(join(dataDir, "runs")).filter((name) => name.endsWith(".jsonl"));
    return traces.map((name) => JSON.parse(readFileSync(join(dataDir, "runs", name), "utf8").split("\n")[0] ?? "{}"));
}

test("each user's jobs are scored with their own resume, and each user's trace starts with their id", async () => {
    const stores = await twoUsers();
    const dataDir = makeDataDir(ONE_COMPANY);
    const { chat, requests } = scriptedChat([...scoring("Stripe", 10), ...scoring("Acme", 40)]);
    const runs = await runAll({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat, http: fakeBoard(greenhouseBoard(["Backend Engineer"])), lookup: publicDns(), openStores: async () => stores });
    expect(runs.map((run) => ("report" in run ? [run.userId, run.report.summary] : run))).toEqual([
        [1, "Stripe done"],
        [2, "Acme done"],
    ]);
    const firstPrompts = requests.filter((messages) => messages.length === 2).map((messages) => JSON.stringify(messages[1]));
    expect([firstPrompts[0]?.includes("Jane Doe"), firstPrompts[1]?.includes("Sam Second"), firstPrompts[1]?.includes("Jane Doe")]).toEqual([true, true, false]);
    expect((await stores.jobViews.allJobs({ offset: 0, limit: 5 }))[0]?.base_score).toBe(10);
    expect((await stores.forUser(2).jobViews.allJobs({ offset: 0, limit: 5 }))[0]?.base_score).toBe(40);
    expect(firstEvents(dataDir)).toEqual(expect.arrayContaining([expect.objectContaining({ type: "user", userId: 1 }), expect.objectContaining({ type: "user", userId: 2 })]));
});

test("a posting both users find gives each their own view of one posting, keeping its description", async () => {
    const stores = await twoUsers();
    const { chat } = scriptedChat([...scoring("Stripe", 10), ...scoring("Acme", 40)]);
    const http = fakeBoard(greenhouseBoard(["Backend Engineer"], undefined, ["<p>The whole posting</p>"]));
    await runAll({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat, http, lookup: publicDns(), openStores: async () => stores });
    expect([await stores.jobViews.countAllJobs(), await stores.forUser(2).jobViews.countAllJobs()]).toEqual([1, 1]);
    expect(await stores.postings.known([{ ats: "greenhouse", jobId: "1000" }])).toEqual([{ ats: "greenhouse", jobId: "1000", described: true }]);
});

test("one user's failure is reported, the next user still runs, and the exit is 1", async () => {
    const stores = await twoUsers();
    const list = stores.memory?.sources.list.bind(stores.memory.sources);
    if (stores.memory && list) stores.memory.sources.list = (userId) => (userId === 1 ? Promise.reject(new Error("sources down")) : list(userId));
    const { chat } = scriptedChat(scoring("Acme", 40));
    const runs = await runAll({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat, http: fakeBoard(greenhouseBoard(["Backend Engineer"])), lookup: publicDns(), openStores: async () => stores });
    expect(runs.map((run) => ("report" in run ? [run.userId, run.report.status] : run))).toEqual([{ userId: 1, failed: "sources down" }, [2, "finished"]]);
    expect(runExitCode(runs, undefined)).toBe(1);
});

function deactivate(stores: TestStores, userId: number): void {
    const user = stores.memory?.auth.users.find((row) => row.id === userId);
    if (user) user.deactivatedAt = NOW;
}

test("a deactivated user is skipped and nothing is fetched or scored for them", async () => {
    const stores = await twoUsers();
    deactivate(stores, 2);
    const { chat } = scriptedChat(scoring("Stripe", 10));
    const runs = await runAll({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat, http: fakeBoard(greenhouseBoard(["Backend Engineer"])), lookup: publicDns(), openStores: async () => stores });
    expect(runs.map((run) => ("report" in run ? [run.userId, run.report.status] : run))).toEqual([[1, "finished"], { userId: 2, skipped: "deactivated" }]);
    expect(await stores.forUser(2).jobViews.countAllJobs()).toBe(0);
});

test("a user deactivated while an earlier user runs is skipped when their turn comes", async () => {
    const stores = await twoUsers();
    const list = stores.memory?.sources.list.bind(stores.memory.sources);
    if (stores.memory && list) stores.memory.sources.list = (userId) => {
            if (userId === 1) deactivate(stores, 2);
            return list(userId);
        };
    const { chat } = scriptedChat(scoring("Stripe", 10));
    const runs = await runAll({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat, http: fakeBoard(greenhouseBoard(["Backend Engineer"])), lookup: publicDns(), openStores: async () => stores });
    expect(runs.map((run) => ("report" in run ? [run.userId, run.report.status] : run))).toEqual([[1, "finished"], { userId: 2, skipped: "deactivated" }]);
});
