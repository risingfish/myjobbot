import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { runOnce } from "../src/app/run.js";
import { PageRenderer } from "../src/careers/renderState.js";
import { HttpClient } from "../src/http/client.js";
import { makeJob } from "../src/jobs/job.js";
import { publicDns } from "./helpers/fakeDns.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { chatThenCrash, scriptedChat, toolCallsReply } from "./helpers/chat.js";
import { makeDataDir, ONE_COMPANY, TEST_ENV } from "./helpers/dataDir.js";
import { fakeBoard } from "./helpers/http.js";
import { newTables } from "./helpers/memoryJobViews.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { memoryStores, storesWithSettings } from "./helpers/memoryStore.js";
import { TEST_SEARCH } from "./helpers/config.js";

const ACME = { companies: [{ name: "Acme", ats: "greenhouse", slug: "acme" }] };

test("runOnce finishes when the model calls finish and writes a trace", async () => {
    const dataDir = makeDataDir(ONE_COMPANY);
    const { chat } = scriptedChat([toolCallsReply(["fetch_jobs", { source: "Stripe" }], ["finish", { summary: "nothing to do" }])]);
    const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat, http: fakeBoard(greenhouseBoard([])), lookup: publicDns(), openStores: async () => storesWithSettings(ONE_COMPANY) });
    expect(report).toMatchObject({ status: "finished", steps: 1, summary: "nothing to do" });
    expect(readdirSync(join(dataDir, "runs"))).toHaveLength(1);
});

test("runOnce stores fetched jobs in its stores", async () => {
    const dataDir = makeDataDir(ONE_COMPANY);
    const stores = storesWithSettings(ONE_COMPANY);
    const http = fakeBoard(greenhouseBoard(["Backend Engineer"]));
    const score: [string, object] = ["record_matches", { verdicts: [{ job_id: "1000", base: 10, bonus: 0 }] }];
    const replies = [toolCallsReply(["fetch_jobs", { source: "Stripe" }], score, ["finish", { summary: "done" }])];
    const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat: scriptedChat(replies).chat, http, lookup: publicDns(), openStores: async () => stores });
    expect(report.status).toBe("finished");
    expect(http.urls).toEqual(["https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true"]);
    expect(await stores.jobViews.countAllJobs()).toBe(1);
});

test("runOnce prunes jobs not seen within job_retention_days", async () => {
    const dataDir = makeDataDir(ONE_COMPANY);
    const stores = storesWithSettings(ONE_COMPANY);
    const stale = makeJob({ ats: "greenhouse", jobId: "stale", company: "Stripe", title: "Old Engineer", url: "u" }, {});
    await stores.jobStore.upsertAll([stale], "2020-01-01T00:00:00.000Z", "Stripe");
    const { chat } = scriptedChat([toolCallsReply(["fetch_jobs", { source: "Stripe" }], ["finish", { summary: "done" }])]);
    await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat, http: fakeBoard(greenhouseBoard([])), lookup: publicDns(), openStores: async () => stores });
    expect(await stores.jobViews.countAllJobs()).toBe(0);
});

test("an unreachable database ends the run with its reason before the model is asked anything", async () => {
    const chat = vi.fn();
    const openStores = async () => Promise.reject(new Error("can't reach MariaDB at 192.0.2.1:3306"));
    const run = runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat, http: fakeBoard(greenhouseBoard([])), lookup: publicDns(), openStores });
    await expect(run).rejects.toThrow("can't reach MariaDB at 192.0.2.1:3306");
    expect(chat).not.toHaveBeenCalled();
});

test("the page renderer is closed after a finished run and after an aborted one", async () => {
    const close = vi.spyOn(PageRenderer.prototype, "close");
    for (const chat of [scriptedChat([toolCallsReply(["finish", { summary: "done" }])]).chat, chatThenCrash([], new Error("LLM down"))]) {
        await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY), MYJOBBOT_BROWSER_URL: "ws://browser:3000/" }, { chat, http: fakeBoard(greenhouseBoard([])), lookup: publicDns(), openStores: async () => storesWithSettings(ONE_COMPANY) });
    }
    expect(close).toHaveBeenCalledTimes(2);
    close.mockRestore();
});

test("board data is read through the client that refuses redirects", async () => {
    const withoutRedirects = vi.spyOn(HttpClient.prototype, "withoutRedirects");
    await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat: scriptedChat([toolCallsReply(["finish", { summary: "done" }])]).chat, http: fakeBoard(greenhouseBoard([])), lookup: publicDns(), openStores: async () => storesWithSettings(ONE_COMPANY) });
    expect(withoutRedirects).toHaveBeenCalledOnce();
    withoutRedirects.mockRestore();
});

test("the stores are closed after a finished run and after an aborted one", async () => {
    for (const chat of [scriptedChat([toolCallsReply(["finish", { summary: "done" }])]).chat, chatThenCrash([], new Error("LLM down"))]) {
        const stores = storesWithSettings(ONE_COMPANY);
        const close = vi.spyOn(stores, "close");
        await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat, http: fakeBoard(greenhouseBoard([])), lookup: publicDns(), openStores: async () => stores });
        expect(close).toHaveBeenCalledOnce();
    }
});

test("before the agent starts, each configured board's public address becomes its company's careers page", async () => {
    const tables = newTables();
    const { chat } = scriptedChat([toolCallsReply(["finish", { summary: "done" }])]);
    await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat, http: fakeBoard(greenhouseBoard([])), lookup: publicDns(), openStores: async () => storesWithSettings(ONE_COMPANY, tables) });
    expect(tables.companies).toMatchObject([{ company_key: "stripe", name: "Stripe", careers_url: "https://job-boards.greenhouse.io/stripe", careers_source: "board" }]);
});

test("a company search that fails unexpectedly is traced, and the run still finishes", async () => {
    const dataDir = makeDataDir(ONE_COMPANY);
    const stores = storesWithSettings(ONE_COMPANY);
    stores.companies.dueForSearch = () => Promise.reject(new Error("search store down"));
    const { chat } = scriptedChat([toolCallsReply(["fetch_jobs", { source: "Stripe" }], ["finish", { summary: "done" }])]);
    const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat, http: fakeBoard(greenhouseBoard([])), lookup: publicDns(), openStores: async () => stores });
    const [trace] = readdirSync(join(dataDir, "runs")).filter((name) => name.endsWith(".jsonl"));
    expect(report.status).toBe("finished");
    expect(readFileSync(join(dataDir, "runs", trace ?? ""), "utf8")).toContain('"type":"company_search_failed"');
});

test("a run fetches from the saved sources, not the companies left in the file", async () => {
    const http = fakeBoard(greenhouseBoard([]));
    const replies = [toolCallsReply(["fetch_jobs", { source: "Acme" }], ["finish", { summary: "done" }])];
    const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat: scriptedChat(replies).chat, http, lookup: publicDns(), openStores: async () => storesWithSettings(ACME) });
    expect(report.status).toBe("finished");
    expect(http.urls).toEqual(["https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true"]);
});

test("a run with no source on finishes at once, without asking the model", async () => {
    const chat = () => Promise.reject(new Error("the model was asked"));
    const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat, lookup: publicDns(), openStores: async () => memoryStores() });
    expect(report).toMatchObject({ status: "finished", steps: 0, summary: "no sources are on" });
});

test("before the agent, each company source's company gets its board as careers page and the source is linked to it", async () => {
    const tables = newTables();
    const stores = storesWithSettings(ONE_COMPANY, tables);
    const chat = scriptedChat([toolCallsReply(["finish", { summary: "done" }])]).chat;
    await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir(ONE_COMPANY) }, { chat, lookup: publicDns(), openStores: async () => stores });
    const stripe = tables.companies.find((row) => row.company_key === "stripe");
    expect([stripe?.careers_url, stripe?.careers_source]).toEqual(["https://job-boards.greenhouse.io/stripe", "board"]);
    expect((await stores.sources.list(OWNER_ID)).map((source) => [source.name, source.companyId])).toEqual([
        ["Stripe", stripe?.id],
        ["Gmail alerts", null],
    ]);
});

test("a run with a saved search on and no JSEARCH_API_KEY still starts, and skips the search as not set up", async () => {
    const dataDir = makeDataDir(ONE_COMPANY);
    const { chat } = scriptedChat([toolCallsReply(["fetch_jobs", { source: TEST_SEARCH.name }], ["finish", { summary: "done" }])]);
    const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat, lookup: publicDns(), openStores: async () => storesWithSettings({ searches: [TEST_SEARCH] }) });
    const [trace] = readdirSync(join(dataDir, "runs"));
    expect([report.status, readFileSync(join(dataDir, "runs", trace ?? ""), "utf8")]).toEqual(["finished", expect.stringMatching(/"type":"source_skipped","source":"Backend remote","reason":"not set up"/)]);
});
