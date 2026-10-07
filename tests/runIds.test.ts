import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { scriptedChat, toolCallsReply } from "./helpers/chat.js";
import { makeDataDir, ONE_COMPANY, TEST_ENV } from "./helpers/dataDir.js";
import { fakeBoard } from "./helpers/http.js";
import { readJsonl } from "./helpers/trace.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function fetchAndFinishRun(dataDir: string) {
  const score: [string, object] = ["record_matches", { verdicts: [{ job_id: "1000", base: 10, bonus: 0 }] }];
  const replies = [toolCallsReply(["fetch_jobs", { source: "Stripe" }], score, ["finish", { summary: "done" }])];
  const http = fakeBoard(greenhouseBoard(["Backend Engineer"]));
  return runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat: scriptedChat(replies).chat, http });
}

function fileFor(dir: string, runId: string, suffix: string): string {
  const match = readdirSync(dir).find((file) => file.endsWith(`${runId}${suffix}`));
  if (!match) throw new Error(`no ${suffix} file for run ${runId} in ${dir}`);
  return join(dir, match);
}

test("one run id ties the trace and the jobs log together", async () => {
  const dataDir = makeDataDir(ONE_COMPANY);
  const { runId } = await fetchAndFinishRun(dataDir);
  expect(runId).toMatch(UUID);
  const trace = readJsonl(fileFor(join(dataDir, "runs"), runId, ".jsonl"));
  expect(trace.every((line) => line.run_id === runId)).toBe(true);
  const jobs = readJsonl(fileFor(TEST_ENV.MYJOBBOT_LOG_DIR, runId, ".jobs.jsonl"));
  expect(jobs).toMatchObject([{ run_id: runId, type: "board_fetch", company: "Stripe", job_count: 1 }]);
});

test("each run gets a different run id", async () => {
  const dataDir = makeDataDir(ONE_COMPANY);
  const first = await fetchAndFinishRun(dataDir);
  const second = await fetchAndFinishRun(dataDir);
  expect(first.runId).not.toBe(second.runId);
});
