import OpenAI from "openai";
import type { Env } from "../config/schema.js";
import type { Tool } from "../tools/tool.js";
import type { Trace } from "./trace.js";

export type Message = OpenAI.Chat.ChatCompletionMessageParam;
export type AssistantMessage = OpenAI.Chat.ChatCompletionMessage;
export type ChatFn = (messages: Message[], tools: Tool[]) => Promise<AssistantMessage>;
export type FunctionCall = Extract<NonNullable<AssistantMessage["tool_calls"]>[number], { type: "function" }>;

const REQUEST_TIMEOUT_MS = 10 * 60_000;
const MAX_RETRIES = 1;

const TEMPERATURE = 0.7;
const TOP_P = 0.8;
const TOP_K = 20;
const REPEAT_PENALTY = 1.05;

const SAMPLING = { temperature: TEMPERATURE, top_p: TOP_P, top_k: TOP_K, repeat_penalty: REPEAT_PENALTY };

/** Builds the function that sends chat completions to the local llama.cpp server and logs each raw response. */
export function createChat(env: Env, responseLog: Trace): ChatFn {
  const client = openClient(env);
  return async (messages, tools) => {
    const completion = await client.chat.completions.create({ model: env.LLM_MODEL, messages, tools: tools.map(toFunctionTool), ...SAMPLING });
    responseLog.write({ type: "llm_response", response: completion });
    return firstMessage(completion);
  };
}

/** Creates the OpenAI client configured to talk to the local llama.cpp server. */
function openClient(env: Env): OpenAI {
  return new OpenAI({
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
}

/** Extracts the tool/function calls from an assistant reply, ignoring any other call types. */
export function functionCalls(reply: AssistantMessage): FunctionCall[] {
  return (reply.tool_calls ?? []).filter((call): call is FunctionCall => call.type === "function");
}

/** Converts an assistant reply into the message to append to the conversation history. */
export function toHistory(reply: AssistantMessage): Message {
  const calls = functionCalls(reply);
  if (calls.length === 0) return { role: "assistant", content: reply.content };
  return { role: "assistant", content: reply.content, tool_calls: calls };
}

/** Converts an internal Tool definition into the OpenAI function-tool schema the API expects. */
function toFunctionTool(tool: Tool): OpenAI.Chat.ChatCompletionFunctionTool {
  return { type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } };
}

/** Returns the first choice's message from a completion, failing fast if the API returned none. */
function firstMessage(completion: OpenAI.Chat.ChatCompletion): AssistantMessage {
  const choice = completion.choices[0];
  if (!choice) throw new Error("LLM returned no choices");
  return choice.message;
}
