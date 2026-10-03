import OpenAI from "openai";
import type { Env } from "../config/schema.js";
import type { Tool } from "../tools/tool.js";

export type Message = OpenAI.Chat.ChatCompletionMessageParam;
export type AssistantMessage = OpenAI.Chat.ChatCompletionMessage;
export type ChatFn = (messages: Message[], tools: Tool[]) => Promise<AssistantMessage>;

export function createChat(env: Env): ChatFn {
  const client = new OpenAI({ baseURL: env.LLM_BASE_URL, apiKey: env.LLM_API_KEY });
  return async (messages, tools) => {
    const completion = await client.chat.completions.create({
      model: env.LLM_MODEL,
      messages,
      tools: tools.map(toFunctionTool),
    });
    return firstMessage(completion);
  };
}

export function toHistory(reply: AssistantMessage): Message {
  return { role: "assistant", content: reply.content, tool_calls: reply.tool_calls };
}

function toFunctionTool(tool: Tool): OpenAI.Chat.ChatCompletionFunctionTool {
  return { type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } };
}

function firstMessage(completion: OpenAI.Chat.ChatCompletion): AssistantMessage {
  const choice = completion.choices[0];
  if (!choice) throw new Error("LLM returned no choices");
  return choice.message;
}
