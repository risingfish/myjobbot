import { expect, test } from "vitest";
import { compactInPlace } from "../src/agent/compact.js";
import { toHistory, type Message } from "../src/agent/llm.js";
import { toolCallReply } from "./helpers/chat.js";

function history(rounds: number): Message[] {
  const messages: Message[] = [{ role: "system", content: "sys" }, { role: "user", content: "resume" }];
  for (let round = 0; round < rounds; round += 1) {
    messages.push(toHistory(toolCallReply("fetch_jobs", { company: "Stripe" })));
    messages.push({ role: "tool", tool_call_id: "call_0", content: "x".repeat(100) });
  }
  return messages;
}

test("compactInPlace leaves history under budget untouched", () => {
  const messages = history(6);
  expect(compactInPlace(messages, 1_000_000)).toBe(0);
  expect(messages).toEqual(history(6));
});

test("compactInPlace elides old tool traffic but keeps the head and recent messages", () => {
  const messages = history(6);
  expect(compactInPlace(messages, 100)).toBe(4);
  expect(messages.slice(0, 2)).toEqual(history(6).slice(0, 2));
  expect(messages[3]).toMatchObject({ role: "tool", content: expect.stringContaining("elided") });
  expect(JSON.stringify(messages[2])).toContain('"arguments":"{}"');
  expect(messages.slice(-8)).toEqual(history(6).slice(-8));
});

test("compactInPlace is stable once elided", () => {
  const messages = history(6);
  compactInPlace(messages, 100);
  expect(compactInPlace(messages, 100)).toBe(0);
});
