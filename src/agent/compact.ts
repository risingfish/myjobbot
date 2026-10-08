import type { Message } from "./llm.js";

const PINNED_HEAD = 2;
const KEEP_RECENT = 8;

/** Drops older messages once the conversation outgrows its context budget, replacing them with a notice. */
export function compactInPlace(messages: Message[], budgetChars: number, notice: string): number {
  if (JSON.stringify(messages).length <= budgetChars) return 0;
  const cutoff = compactionCutoff(messages);
  const regionLength = cutoff - PINNED_HEAD;
  if (regionLength <= 0 || isExistingNotice(messages, regionLength, notice)) return 0;
  const removed = messages.splice(PINNED_HEAD, regionLength, { role: "user", content: notice });
  return removed.length;
}

/** Finds the index up to which messages can be compacted, keeping the pinned head and recent tail intact. */
function compactionCutoff(messages: Message[]): number {
  const lastAssistant = lastIndexOfRole(messages, "assistant");
  const desired = Math.min(messages.length - KEEP_RECENT, lastAssistant);
  return nearestAssistantAtOrBefore(messages, desired);
}

/** Returns the index of the last message with the given role, or -1 if none is found. */
function lastIndexOfRole(messages: Message[], role: Message["role"]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === role) return index;
  }
  return -1;
}

/** Finds the nearest assistant message at or before the given index, so compaction cuts on a turn boundary. */
function nearestAssistantAtOrBefore(messages: Message[], index: number): number {
  for (let current = index; current >= 0; current -= 1) {
    if (messages[current]?.role === "assistant") return current;
  }
  return -1;
}

/** Reports whether the compaction region is already just the notice, so compaction doesn't repeat for nothing. */
function isExistingNotice(messages: Message[], regionLength: number, notice: string): boolean {
  if (regionLength !== 1) return false;
  const only = messages[PINNED_HEAD];
  return only?.role === "user" && only.content === notice;
}
