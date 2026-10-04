import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { createChat } from "../src/agent/llm.js";
import type { TraceEvent } from "../src/agent/trace.js";
import { runOnce } from "../src/app/run.js";
import { envSchema } from "../src/config/schema.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";
import { CANNED_COMPLETION, startFakeLlm } from "./helpers/llmServer.js";

async function fakeLlmEnv() {
  const llm = await startFakeLlm();
  onTestFinished(llm.close);
  return { ...TEST_ENV, LLM_BASE_URL: llm.baseUrl };
}

test("createChat returns the model's message and logs the raw response", async () => {
  const events: TraceEvent[] = [];
  const chat = createChat(envSchema.parse(await fakeLlmEnv()), { write: (event) => void events.push(event) });
  const reply = await chat([{ role: "user", content: "hi" }], []);
  expect(reply.tool_calls?.[0]).toMatchObject({ function: { name: "finish" } });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ type: "llm_response", response: CANNED_COMPLETION });
});

test("runOnce writes each raw LLM response to the log directory", async () => {
  const logDir = mkdtempSync(join(tmpdir(), "myjobbot-log-"));
  const env = { ...(await fakeLlmEnv()), MYJOBBOT_DATA_DIR: makeDataDir(), MYJOBBOT_LOG_DIR: logDir };
  expect(await runOnce(env)).toMatchObject({ status: "finished", steps: 1 });
  const files = readdirSync(logDir);
  expect(files).toHaveLength(1);
  const lines = readFileSync(join(logDir, files[0] ?? ""), "utf8").trim().split("\n");
  expect(lines.map((line) => JSON.parse(line))).toMatchObject([{ type: "llm_response", response: { id: "chatcmpl-test", usage: { total_tokens: 303 } } }]);
});
