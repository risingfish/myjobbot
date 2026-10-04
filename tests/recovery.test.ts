import { join } from "node:path";
import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import { JobStore } from "../src/db/jobStore.js";
import { openDatabase } from "../src/db/open.js";
import type { JsonGetter } from "../src/http/client.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { chatThenCrash, scriptedChat, toolCallReply } from "./helpers/chat.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";
import { fakeBoard } from "./helpers/http.js";
import { latestToolEvent } from "./helpers/trace.js";

function envFor(dataDir: string) {
  return { ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir };
}

function runAndCrash(dataDir: string, http: JsonGetter) {
  const crash = chatThenCrash([toolCallReply("fetch_jobs", { source: "Stripe" })], new Error("LLM down"));
  return runOnce(envFor(dataDir), { chat: crash, http });
}

function runToCompletion(dataDir: string, http: JsonGetter) {
  const replies = [toolCallReply("fetch_jobs", { source: "Stripe" }), toolCallReply("finish", { summary: "done" })];
  return runOnce(envFor(dataDir), { chat: scriptedChat(replies).chat, http });
}

test("a job left unscored by a crashed run is re-offered on the next run", async () => {
  const dataDir = makeDataDir();
  const http = fakeBoard(greenhouseBoard(["Backend Engineer"]));
  expect((await runAndCrash(dataDir, http)).status).toBe("aborted");
  expect((await runToCompletion(dataDir, http)).status).toBe("finished");
  const fetchEvent = latestToolEvent(dataDir, "fetch_jobs");
  expect(fetchEvent.content).toContain('"total_unscored":1');
  const job = new JobStore(openDatabase(join(dataDir, "myjobbot.db"))).findJob("1000");
  expect(job?.scored_at).toBeNull();
});
