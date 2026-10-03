import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import { openDatabase } from "../src/db/open.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { scriptedChat, toolCallReply, toolCallsReply } from "./helpers/chat.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";
import { fakeBoard } from "./helpers/http.js";

test("runOnce finishes when the model calls finish and writes a trace", async () => {
  const dataDir = makeDataDir();
  const { chat } = scriptedChat([toolCallReply("finish", { summary: "nothing to do" })]);
  const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat });
  expect(report).toMatchObject({ status: "finished", steps: 1, summary: "nothing to do" });
  expect(readdirSync(join(dataDir, "runs"))).toHaveLength(1);
});

test("runOnce stores fetched jobs in the data directory database", async () => {
  const dataDir = makeDataDir();
  const http = fakeBoard(greenhouseBoard(["Backend Engineer"]));
  const replies = [toolCallsReply(["fetch_jobs", { company: "Stripe" }], ["finish", { summary: "done" }])];
  const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat: scriptedChat(replies).chat, http });
  expect(report.status).toBe("finished");
  expect(http.urls).toEqual(["https://boards-api.greenhouse.io/v1/boards/stripe/jobs"]);
  const db = openDatabase(join(dataDir, "myjobbot.db"));
  expect({ ...db.prepare("SELECT COUNT(*) AS count FROM jobs").get() }).toEqual({ count: 1 });
});
