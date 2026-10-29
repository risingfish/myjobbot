import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import type { Stores } from "../src/db/store.js";
import { publicDns } from "./helpers/fakeDns.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { scriptedChat, toolCallReply } from "./helpers/chat.js";
import { TEST_SEARCH } from "./helpers/config.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";
import { loadFixture } from "./helpers/fixtures.js";
import { routedHttp } from "./helpers/http.js";
import { jsearchId } from "./helpers/jsearch.js";
import { storesWithSettings } from "./helpers/memoryStore.js";

const CONFIG = { companies: [{ name: "Stripe", ats: "greenhouse", slug: "stripe" }], searches: [TEST_SEARCH] };

const FIRST_RUN = [toolCallReply("list_sources", {}), toolCallReply("next_jobs", { source: "Stripe" }), toolCallReply("record_matches", { verdicts: [{ job_id: "1000", base: 50, bonus: 30 }] }), toolCallReply("next_jobs", { source: TEST_SEARCH.name }), toolCallReply("record_matches", { verdicts: [{ job_id: jsearchId("js-linkedin-1"), base: 50, bonus: 35 }] }), toolCallReply("finish", { summary: "Scored a board and a search." })];
const SECOND_RUN = [toolCallReply("next_jobs", { source: "Stripe" }), toolCallReply("next_jobs", { source: TEST_SEARCH.name }), toolCallReply("finish", { summary: "Nothing new." })];

async function scoredRows(stores: Stores) {
    const jobs = await stores.jobViews.allJobs({ offset: 0, limit: 100 });
    const scored = jobs.filter((job) => job.score !== null).map(({ job_id, source, score }) => ({ job_id, source, score }));
    return scored.sort((a, b) => a.job_id.localeCompare(b.job_id));
}

test("a run scores a board and a saved search, and the next run reuses the search", async () => {
    const dataDir = makeDataDir(CONFIG);
    const http = routedHttp({ "api.openwebninja.com": loadFixture("jsearch.json"), "boards-api.greenhouse.io": greenhouseBoard(["Backend Engineer"]) });
    const env = { ...TEST_ENV, JSEARCH_API_KEY: "secret-key", MYJOBBOT_DATA_DIR: dataDir };
    const stores = storesWithSettings(CONFIG);
    const openStores = async () => stores;
    expect(await runOnce(env, { chat: scriptedChat(FIRST_RUN).chat, http, lookup: publicDns(), openStores })).toMatchObject({ status: "finished" });
    expect(await runOnce(env, { chat: scriptedChat(SECOND_RUN).chat, http, lookup: publicDns(), openStores })).toMatchObject({ status: "finished" });
    expect(http.requests.filter((sent) => sent.url.includes("openwebninja"))).toHaveLength(1);
    expect(await scoredRows(stores)).toEqual([
        { job_id: "1000", source: "Stripe", score: 80 },
        { job_id: jsearchId("js-linkedin-1"), source: TEST_SEARCH.name, score: 85 },
    ]);
});
