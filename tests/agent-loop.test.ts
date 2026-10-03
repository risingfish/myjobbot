import { expect, test } from "vitest";
import { toHistory } from "../src/agent/llm.js";
import { runScripted, TEST_LIMITS } from "./helpers/agent.js";
import { textReply, toolCallReply, toolCallsReply } from "./helpers/chat.js";

const FINISH = toolCallReply("finish", { summary: "all done" });

test("agent finishes when the model calls finish", async () => {
  const { result, context } = await runScripted([FINISH]);
  expect(result).toEqual({ status: "finished", reason: "finish called", steps: 1 });
  expect(context.run.summary).toBe("all done");
});

test("agent feeds invalid tool arguments back to the model", async () => {
  const { result, requests } = await runScripted([toolCallReply("finish", {}), FINISH]);
  expect(result.status).toBe("finished");
  expect(requests[1]?.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call_0" });
  expect(JSON.stringify(requests[1]?.at(-1))).toContain("error");
});

test("agent nudges a reply that has no tool calls", async () => {
  const { result, requests } = await runScripted([textReply("Sure, starting now."), FINISH]);
  expect(result.steps).toBe(2);
  expect(requests[1]?.at(-1)).toMatchObject({ role: "user", content: expect.stringContaining("tool calls") });
});

test("agent aborts after consecutive tool errors", async () => {
  const bad = toolCallReply("nope", {});
  const { result } = await runScripted([bad, bad, bad]);
  expect(result).toEqual({ status: "aborted", reason: "3 consecutive tool errors", steps: 3 });
});

test("agent aborts at the step limit", async () => {
  const limits = { ...TEST_LIMITS, max_steps: 2 };
  const { result } = await runScripted([textReply("a"), textReply("b")], { limits });
  expect(result).toEqual({ status: "aborted", reason: "step limit of 2 reached", steps: 2 });
});

test("agent traces the start and end of a run", async () => {
  const { events } = await runScripted([FINISH]);
  expect(events[0]).toMatchObject({ type: "start" });
  expect(events.at(-1)).toEqual({ type: "end", status: "finished", reason: "finish called", steps: 1 });
});

test("agent aborts with an end event when the LLM call fails", async () => {
  const chat = () => Promise.reject(new Error("connect ECONNREFUSED"));
  const { result, events } = await runScripted([], { chat });
  expect(result).toEqual({ status: "aborted", reason: expect.stringContaining("ECONNREFUSED"), steps: 1 });
  expect(events.at(-1)).toMatchObject({ type: "end" });
});

test("agent runs every call of a multi-call reply in order", async () => {
  const reply = toolCallsReply(["finish", {}], ["finish", { summary: "done" }]);
  const { result, events } = await runScripted([reply]);
  expect(result).toEqual({ status: "finished", reason: "finish called", steps: 1 });
  const toolEvents = events.filter((event) => event.type === "tool");
  expect(toolEvents.map((event) => event.tool_call_id)).toEqual(["call_0", "call_1"]);
});

test("toHistory omits tool_calls when the reply has no function calls", () => {
  expect(toHistory(textReply("hello"))).toEqual({ role: "assistant", content: "hello" });
});

test("agent compacts history when it exceeds the context budget", async () => {
  const list = toolCallReply("list_companies", {});
  const replies = [list, list, list, list, list, list, FINISH];
  const { events, requests } = await runScripted(replies, { limits: { ...TEST_LIMITS, context_chars: 50 } });
  const compacted = events.find((event) => event.type === "compacted");
  expect(compacted).toMatchObject({ type: "compacted" });
  expect((compacted as { removed: number }).removed).toBeGreaterThan(0);
  expect(JSON.stringify(requests.at(-1))).toContain("Earlier messages were removed.");
});
