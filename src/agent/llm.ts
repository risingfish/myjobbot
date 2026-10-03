import OpenAI from "openai";
import type { Env } from "../config/schema.js";
import type { Tool } from "../tools/tool.js";

export type Message = OpenAI.Chat.ChatCompletionMessageParam;
export type AssistantMessage = OpenAI.Chat.ChatCompletionMessage;
export type ChatFn = (messages: Message[], tools: Tool[]) => Promise<AssistantMessage>;
export type FunctionCall = Extract<NonNullable<AssistantMessage["tool_calls"]>[number], { type: "function" }>;

const REQUEST_TIMEOUT_MS = 10 * 60_000;
const MAX_RETRIES = 1;

export function createChat(env: Env): ChatFn {
  const client = new OpenAI({
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
  return async (messages, tools) => {
    const completion = await client.chat.completions.create({ model: env.LLM_MODEL, messages, tools: tools.map(toFunctionTool) });
    return firstMessage(completion);
  };
}

export function functionCalls(reply: AssistantMessage): FunctionCall[] {
  return (reply.tool_calls ?? []).filter((call): call is FunctionCall => call.type === "function");
}

export function toHistory(reply: AssistantMessage): Message {
  const calls = functionCalls(reply);
  if (calls.length === 0) return { role: "assistant", content: reply.content };
  return { role: "assistant", content: reply.content, tool_calls: calls };
}

function toFunctionTool(tool: Tool): OpenAI.Chat.ChatCompletionFunctionTool {
  return { type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } };
}

function firstMessage(completion: OpenAI.Chat.ChatCompletion): AssistantMessage {
  const choice = completion.choices[0];
  if (!choice) throw new Error("LLM returned no choices");
  return choice.message;
}
