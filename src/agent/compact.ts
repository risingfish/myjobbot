import type OpenAI from "openai";
import type { Message } from "./llm.js";

type ToolCall = OpenAI.Chat.ChatCompletionMessageToolCall;

const PINNED_HEAD = 2;
const KEEP_RECENT = 8;
const EMPTY_ARGUMENTS = "{}";
const ELIDED = "[elided to save context; tools return current state, so call them again if you need it]";

export function compactInPlace(messages: Message[], budgetChars: number): number {
  if (JSON.stringify(messages).length <= budgetChars) return 0;
  let elided = 0;
  for (let index = PINNED_HEAD; index < messages.length - KEEP_RECENT; index += 1) {
    const before = messages[index];
    const after = before && elide(before);
    if (!after || after === before) continue;
    messages[index] = after;
    elided += 1;
  }
  return elided;
}

function elide(message: Message): Message {
  if (message.role === "tool") return message.content === ELIDED ? message : { ...message, content: ELIDED };
  if (message.role !== "assistant" || !message.tool_calls?.some(hasArguments)) return message;
  return { ...message, tool_calls: message.tool_calls.map(clearArguments) };
}

function hasArguments(call: ToolCall): boolean {
  return call.type === "function" && call.function.arguments !== EMPTY_ARGUMENTS;
}

function clearArguments(call: ToolCall): ToolCall {
  return call.type === "function" ? { ...call, function: { ...call.function, arguments: EMPTY_ARGUMENTS } } : call;
}
