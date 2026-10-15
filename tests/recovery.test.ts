import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import type { Stores } from "../src/db/store.js";
import type { JsonGetter } from "../src/http/client.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { chatThenCrash, scriptedChat, toolCallReply } from "./helpers/chat.js";
import { makeDataDir, ONE_COMPANY, TEST_ENV } from "./helpers/dataDir.js";
import { fakeBoard } from "./helpers/http.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { latestToolEvent } from "./helpers/traceFiles.js";

function envFor(dataDir: string) {
    return { ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir };
}

const stores: Stores = memoryStores();

function runAndCrash(dataDir: string, http: JsonGetter) {
    const crash = chatThenCrash([toolCallReply("fetch_jobs", { source: "Stripe" })], new Error("LLM down"));
    return runOnce(envFor(dataDir), { chat: crash, http, openStores: async () => stores });
}

function runToCompletion(dataDir: string, http: JsonGetter) {
    const score = toolCallReply("record_matches", { verdicts: [{ job_id: "1000", base: 30, bonus: 25 }] });
    const replies = [toolCallReply("fetch_jobs", { source: "Stripe" }), score, toolCallReply("finish", { summary: "done" })];
    return runOnce(envFor(dataDir), { chat: scriptedChat(replies).chat, http, openStores: async () => stores });
}

test("a job left unscored by a crashed run is re-offered on the next run", async () => {
    const dataDir = makeDataDir(ONE_COMPANY);
    const http = fakeBoard(greenhouseBoard(["Backend Engineer"]));
    expect((await runAndCrash(dataDir, http)).status).toBe("aborted");
    expect((await runToCompletion(dataDir, http)).status).toBe("finished");
    const fetchEvent = latestToolEvent(dataDir, "fetch_jobs");
    expect(fetchEvent.content).toContain('"total_unscored":1');
    const job = await stores.jobStore.findJob("1000");
    expect(job?.score).toBe(55);
});
