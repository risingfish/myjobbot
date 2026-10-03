import type { Message } from "./llm.js";

const PINNED_HEAD = 2;
const KEEP_RECENT = 8;

export function compactInPlace(messages: Message[], budgetChars: number, notice: string): number {
  if (JSON.stringify(messages).length <= budgetChars) return 0;
  const cutoff = compactionCutoff(messages);
  const regionLength = cutoff - PINNED_HEAD;
  if (regionLength <= 0 || isExistingNotice(messages, regionLength, notice)) return 0;
  const removed = messages.splice(PINNED_HEAD, regionLength, { role: "user", content: notice });
  return removed.length;
}

function compactionCutoff(messages: Message[]): number {
  const lastAssistant = lastIndexOfRole(messages, "assistant");
  const desired = Math.min(messages.length - KEEP_RECENT, lastAssistant);
  return nearestAssistantAtOrBefore(messages, desired);
}

function lastIndexOfRole(messages: Message[], role: Message["role"]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === role) return index;
  }
  return -1;
}

function nearestAssistantAtOrBefore(messages: Message[], index: number): number {
  for (let current = index; current >= 0; current -= 1) {
    if (messages[current]?.role === "assistant") return current;
  }
  return -1;
}

function isExistingNotice(messages: Message[], regionLength: number, notice: string): boolean {
  if (regionLength !== 1) return false;
  const only = messages[PINNED_HEAD];
  return only?.role === "user" && only.content === notice;
}
