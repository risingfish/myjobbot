import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { runOnce } from "../src/app/run.js";
import { PageRenderer } from "../src/careers/renderState.js";
import { makeJob } from "../src/jobs/job.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { chatThenCrash, scriptedChat, toolCallsReply } from "./helpers/chat.js";
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

test("an unreachable database ends the run with its reason before the model is asked anything", async () => {
    const chat = vi.fn();
    const openStores = async () => Promise.reject(new Error("can't reach MariaDB at 192.0.2.1:3306"));
    const run = runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat, http: fakeBoard(greenhouseBoard([])), openStores });
    await expect(run).rejects.toThrow("can't reach MariaDB at 192.0.2.1:3306");
    expect(chat).not.toHaveBeenCalled();
});

test("the page renderer is closed after a finished run and after an aborted one", async () => {
    const close = vi.spyOn(PageRenderer.prototype, "close");
    for (const chat of [scriptedChat([toolCallsReply(["finish", { summary: "done" }])]).chat, chatThenCrash([], new Error("LLM down"))]) {
        await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY), MYJOBBOT_BROWSER_URL: "ws://browser:3000/" }, { chat, http: fakeBoard(greenhouseBoard([])), openStores: async () => memoryStores() });
    }
    expect(close).toHaveBeenCalledTimes(2);
    close.mockRestore();
});

test("the stores are closed after a finished run and after an aborted one", async () => {
    for (const chat of [scriptedChat([toolCallsReply(["finish", { summary: "done" }])]).chat, chatThenCrash([], new Error("LLM down"))]) {
        const stores = memoryStores();
        const close = vi.spyOn(stores, "close");
        await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat, http: fakeBoard(greenhouseBoard([])), openStores: async () => stores });
        expect(close).toHaveBeenCalledOnce();
    }
});
