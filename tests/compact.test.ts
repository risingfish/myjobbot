import { expect, test } from "vitest";
import { compactInPlace } from "../src/agent/compact.js";
import type { Message } from "../src/agent/llm.js";

const NOTICE = "Earlier messages were removed.";

function round(id: string): Message[] {
  const assistant: Message = {
    role: "assistant",
    content: null,
    tool_calls: [{ id, type: "function", function: { name: "fetch_jobs", arguments: JSON.stringify({ company: id }) } }],
  };
  return [assistant, { role: "tool", tool_call_id: id, content: "x".repeat(100) }];
}

function wideRound(callCount: number): Message[] {
  const calls = Array.from({ length: callCount }, (_, index) => ({
    id: `wide_${index}`, type: "function" as const, function: { name: "fetch_jobs", arguments: "{}" },
  }));
  const assistant: Message = { role: "assistant", content: null, tool_calls: calls };
  const tools = calls.map((call) => ({ role: "tool" as const, tool_call_id: call.id, content: "y".repeat(50) }));
  return [assistant, ...tools];
}

function history(rounds: number): Message[] {
  const messages: Message[] = [{ role: "system", content: "sys" }, { role: "user", content: "resume" }];
  for (let index = 0; index < rounds; index += 1) messages.push(...round(`call_${index}`));
  return messages;
}

function collectToolCallIds(messages: Message[]): Set<string> {
  const ids = new Set<string>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const call of message.tool_calls ?? []) ids.add(call.id);
  }
  return ids;
}

function assertToolMessagesResolved(messages: Message[]): void {
  const ids = collectToolCallIds(messages);
  for (const message of messages) {
    if (message.role === "tool") expect(ids.has(message.tool_call_id)).toBe(true);
  }
}

test("compactInPlace leaves history under budget untouched", () => {
  const messages = history(6);
  expect(compactInPlace(messages, 1_000_000, NOTICE)).toBe(0);
  expect(messages).toEqual(history(6));
});

test("compactInPlace collapses old turns into a single notice, keeping the head and a whole recent window", () => {
  const messages = history(6);
  const removed = compactInPlace(messages, 100, NOTICE);
  expect(removed).toBeGreaterThan(0);
  expect(messages.slice(0, 2)).toEqual(history(6).slice(0, 2));
  expect(messages[2]).toEqual({ role: "user", content: NOTICE });
  expect(messages[3]?.role).toBe("assistant");
  assertToolMessagesResolved(messages.slice(3));
});

test("compactInPlace keeps a wide final turn whole even past KEEP_RECENT", () => {
  const wide = wideRound(10);
  const messages = [...history(5), ...wide];
  compactInPlace(messages, 100, NOTICE);
  expect(messages.slice(-wide.length)).toEqual(wide);
});

test("compactInPlace is a no-op on a second call with nothing new to elide", () => {
  const messages = history(6);
  compactInPlace(messages, 100, NOTICE);
  expect(compactInPlace(messages, 100, NOTICE)).toBe(0);
});

function walkBackHistory(): Message[] {
  const messages: Message[] = [{ role: "system", content: "sys" }, { role: "user", content: "resume" }];
  messages.push(...round("call_0"), ...round("call_1"), ...wideRound(2));
  messages.push(...round("call_2"), ...round("call_3"), ...round("call_4"));
  return messages;
}

test("compactInPlace walks back to an assistant when length - 8 lands on a tool message", () => {
  const messages = walkBackHistory();
  const removed = compactInPlace(messages, 100, NOTICE);
  expect(removed).toBeGreaterThan(0);
  expect(messages[3]?.role).toBe("assistant");
  assertToolMessagesResolved(messages);
});

test("compactInPlace keeps a single notice at index 2 across repeated overflows", () => {
  const messages = history(6);
  compactInPlace(messages, 100, NOTICE);
  messages.push(...round("call_later_a"), ...round("call_later_b"));
  compactInPlace(messages, 100, NOTICE);
  const notices = messages.filter((message) => message.role === "user" && message.content === NOTICE);
  expect(notices).toHaveLength(1);
  expect(messages[2]).toEqual({ role: "user", content: NOTICE });
});
