import type { AssistantMessage, ChatFn, Message } from "../../src/agent/llm.js";
import type { Trace } from "../../src/agent/trace.js";
import { scriptedChat } from "./chat.js";

export function usageChat(replies: AssistantMessage[], usage?: { prompt_tokens: number; completion_tokens: number }) {
    const scripted = scriptedChat(replies);
    const requests: Message[][] = scripted.requests;
    const makeChat =
        (log: Trace): ChatFn =>
        async (messages, tools) => {
            const reply = await scripted.chat(messages, tools);
            log.write({ type: "llm_response", response: usage === undefined ? {} : { usage } });
            return reply;
        };
    return { makeChat, requests };
}
