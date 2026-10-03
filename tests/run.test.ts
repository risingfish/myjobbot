import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import { scriptedChat, toolCallReply } from "./helpers/chat.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";

test("runOnce finishes when the model calls finish and writes a trace", async () => {
  const dataDir = makeDataDir();
  const { chat } = scriptedChat([toolCallReply("finish", { summary: "nothing to do" })]);
  const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat });
  expect(report).toMatchObject({ status: "finished", steps: 1, summary: "nothing to do" });
  expect(readdirSync(join(dataDir, "runs"))).toHaveLength(1);
});
