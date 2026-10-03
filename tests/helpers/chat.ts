import type { AssistantMessage, ChatFn, Message } from "../../src/agent/llm.js";

export function toolCallsReply(...calls: Array<[string, object]>): AssistantMessage {
  return {
    role: "assistant",
    content: null,
    refusal: null,
    tool_calls: calls.map(([name, args], index) => ({
      id: `call_${index}`,
      type: "function" as const,
      function: { name, arguments: JSON.stringify(args) },
    })),
  };
}

export function toolCallReply(name: string, args: object): AssistantMessage {
  return toolCallsReply([name, args]);
}

export function textReply(content: string): AssistantMessage {
  return { role: "assistant", content, refusal: null };
}

export function chatThenCrash(replies: AssistantMessage[], crash: Error): ChatFn {
  const queue = [...replies];
  return async () => {
    const reply = queue.shift();
    if (reply) return reply;
    throw crash;
  };
}

export function scriptedChat(replies: AssistantMessage[]): { chat: ChatFn; requests: Message[][] } {
  const requests: Message[][] = [];
  const queue = [...replies];
  const chat: ChatFn = async (messages) => {
    requests.push(structuredClone(messages));
    const reply = queue.shift();
    if (!reply) throw new Error("scripted chat ran out of replies");
    return reply;
  };
  return { chat, requests };
}
