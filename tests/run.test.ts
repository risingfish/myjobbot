import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import { JobStore } from "../src/db/jobStore.js";
import { openDatabase } from "../src/db/open.js";
import { makeJob } from "../src/jobs/job.js";
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
  const replies = [toolCallsReply(["fetch_jobs", { source: "Stripe" }], ["finish", { summary: "done" }])];
  const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat: scriptedChat(replies).chat, http });
  expect(report.status).toBe("finished");
  expect(http.urls).toEqual(["https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true"]);
  const db = openDatabase(join(dataDir, "myjobbot.db"));
  expect({ ...db.prepare("SELECT COUNT(*) AS count FROM jobs").get() }).toEqual({ count: 1 });
});

test("runOnce prunes jobs not seen within job_retention_days", async () => {
  const dataDir = makeDataDir();
  const db = openDatabase(join(dataDir, "myjobbot.db"));
  const stale = makeJob({ ats: "greenhouse", jobId: "stale", company: "Stripe", title: "Old Engineer", url: "u" }, {});
  new JobStore(db).upsertAll([stale], "2020-01-01T00:00:00.000Z", "Stripe");
  const { chat } = scriptedChat([toolCallReply("finish", { summary: "done" })]);
  await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat });
  expect({ ...db.prepare("SELECT COUNT(*) AS count FROM jobs").get() }).toEqual({ count: 0 });
});
