import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import { makeJob } from "../src/jobs/job.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { scriptedChat, toolCallsReply } from "./helpers/chat.js";
import { makeDataDir, ONE_COMPANY, TEST_ENV } from "./helpers/dataDir.js";
import { fakeBoard } from "./helpers/http.js";
import { memoryStores } from "./helpers/memoryStore.js";

test("runOnce finishes when the model calls finish and writes a trace", async () => {
    const dataDir = makeDataDir(ONE_COMPANY);
    const { chat } = scriptedChat([toolCallsReply(["fetch_jobs", { source: "Stripe" }], ["finish", { summary: "nothing to do" }])]);
    const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat, http: fakeBoard(greenhouseBoard([])), openStores: async () => memoryStores() });
    expect(report).toMatchObject({ status: "finished", steps: 1, summary: "nothing to do" });
    expect(readdirSync(join(dataDir, "runs"))).toHaveLength(1);
});

test("runOnce stores fetched jobs in its stores", async () => {
    const dataDir = makeDataDir(ONE_COMPANY);
    const stores = memoryStores();
    const http = fakeBoard(greenhouseBoard(["Backend Engineer"]));
    const score: [string, object] = ["record_matches", { verdicts: [{ job_id: "1000", base: 10, bonus: 0 }] }];
    const replies = [toolCallsReply(["fetch_jobs", { source: "Stripe" }], score, ["finish", { summary: "done" }])];
    const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat: scriptedChat(replies).chat, http, openStores: async () => stores });
    expect(report.status).toBe("finished");
    expect(http.urls).toEqual(["https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true"]);
    expect(await stores.jobViews.countAllJobs()).toBe(1);
});

test("runOnce prunes jobs not seen within job_retention_days", async () => {
    const dataDir = makeDataDir(ONE_COMPANY);
    const stores = memoryStores();
    const stale = makeJob({ ats: "greenhouse", jobId: "stale", company: "Stripe", title: "Old Engineer", url: "u" }, {});
    await stores.jobStore.upsertAll([stale], "2020-01-01T00:00:00.000Z", "Stripe");
    const { chat } = scriptedChat([toolCallsReply(["fetch_jobs", { source: "Stripe" }], ["finish", { summary: "done" }])]);
    await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat, http: fakeBoard(greenhouseBoard([])), openStores: async () => stores });
    expect(await stores.jobViews.countAllJobs()).toBe(0);
});
