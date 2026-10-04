import { join } from "node:path";
import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import { openDatabase } from "../src/db/open.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { scriptedChat, toolCallReply } from "./helpers/chat.js";
import { TEST_SEARCH } from "./helpers/config.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";
import { loadFixture } from "./helpers/fixtures.js";
import { routedHttp } from "./helpers/http.js";
import { jsearchId } from "./helpers/jsearch.js";

const CONFIG = { companies: [{ name: "Stripe", ats: "greenhouse", slug: "stripe" }], searches: [TEST_SEARCH] };

const FIRST_RUN = [
  toolCallReply("list_sources", {}),
  toolCallReply("fetch_jobs", { source: "Stripe" }),
  toolCallReply("record_matches", { verdicts: [{ job_id: "1000", score: 80 }] }),
  toolCallReply("fetch_jobs", { source: TEST_SEARCH.name }),
  toolCallReply("record_matches", { verdicts: [{ job_id: jsearchId("js-linkedin-1"), score: 85 }] }),
  toolCallReply("finish", { summary: "Scored a board and a search." }),
];
const SECOND_RUN = [toolCallReply("fetch_jobs", { source: TEST_SEARCH.name }), toolCallReply("finish", { summary: "Nothing new." })];

function scoredRows(dataDir: string) {
  const sql = "SELECT job_id, source, score FROM jobs WHERE score IS NOT NULL ORDER BY job_id";
  return openDatabase(join(dataDir, "myjobbot.db")).prepare(sql).all().map((row) => ({ ...row }));
}

test("a run scores a board and a saved search, and the next run reuses the search", async () => {
  const dataDir = makeDataDir(CONFIG);
  const http = routedHttp({ "api.openwebninja.com": loadFixture("jsearch.json"), "boards-api.greenhouse.io": greenhouseBoard(["Backend Engineer"]) });
  const env = { ...TEST_ENV, JSEARCH_API_KEY: "secret-key", MYJOBBOT_DATA_DIR: dataDir };
  expect(await runOnce(env, { chat: scriptedChat(FIRST_RUN).chat, http })).toMatchObject({ status: "finished" });
  expect(await runOnce(env, { chat: scriptedChat(SECOND_RUN).chat, http })).toMatchObject({ status: "finished" });
  expect(http.requests.filter((sent) => sent.url.includes("openwebninja"))).toHaveLength(1);
  expect(scoredRows(dataDir)).toEqual([{ job_id: "1000", source: "Stripe", score: 80 }, { job_id: jsearchId("js-linkedin-1"), source: TEST_SEARCH.name, score: 85 }]);
});
