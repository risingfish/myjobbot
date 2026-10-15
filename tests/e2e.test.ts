import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { scriptedChat, toolCallReply } from "./helpers/chat.js";
import { makeDataDir, ONE_COMPANY, TEST_ENV } from "./helpers/dataDir.js";
import { fakeBoard } from "./helpers/http.js";
import { memoryStores } from "./helpers/memoryStore.js";

const VERDICTS = [
    { job_id: "1000", base: 50, bonus: 40, reasons: ["Backend, Go"], gaps: [] },
    { job_id: "1001", base: 10, bonus: 0 },
];

const SCRIPT = [toolCallReply("list_sources", {}), toolCallReply("fetch_jobs", { source: "Stripe" }), toolCallReply("record_matches", { verdicts: VERDICTS }), toolCallReply("fetch_jobs", { source: "Stripe" }), toolCallReply("finish", { summary: "Scored 2 Stripe jobs." })];

test("a scripted model drives a full run and its verdicts land in the stores", async () => {
    const dataDir = makeDataDir(ONE_COMPANY);
    const http = fakeBoard(greenhouseBoard(["Backend Engineer", "Platform Engineer"]));
    const stores = memoryStores();
    const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat: scriptedChat(SCRIPT).chat, http, openStores: async () => stores });
    expect(report).toMatchObject({ status: "finished", steps: 5, summary: "Scored 2 Stripe jobs." });
    const rows = (await stores.jobViews.allJobs({ offset: 0, limit: 10 })).map(({ job_id, score }) => ({ job_id, score }));
    expect(rows.sort((a, b) => a.job_id.localeCompare(b.job_id))).toEqual([
        { job_id: "1000", score: 90 },
        { job_id: "1001", score: 10 },
    ]);
});
