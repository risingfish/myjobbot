import type { AssistantMessage, Message } from "../../src/agent/llm.js";
import { runAgent, type AgentDeps, type AgentResult } from "../../src/agent/loop.js";
import type { TraceEvent } from "../../src/agent/trace.js";
import type { ToolContext } from "../../src/tools/context.js";
import { buildTools } from "../../src/tools/registry.js";
import { scriptedChat } from "./chat.js";
import { doneContext } from "./context.js";
import { memoryTrace } from "./trace.js";

export const TEST_LIMITS = { max_steps: 10, max_wall_clock_min: 5, max_consecutive_tool_errors: 3, context_chars: 160_000 };

interface Harness {
  result: AgentResult;
  context: ToolContext;
  requests: Message[][];
  events: TraceEvent[];
}

export async function runScripted(
  replies: AssistantMessage[],
  overrides: Partial<AgentDeps> = {},
  context = doneContext(),
): Promise<Harness> {
  const { chat, requests } = scriptedChat(replies);
  const trace = memoryTrace();
  const deps = { ...baseDeps(context), chat, trace, ...overrides };
  const result = await runAgent(deps, [{ role: "system", content: "test" }, { role: "user", content: "go" }]);
  return { result, context, requests, events: trace.events };
}

function baseDeps(context: ToolContext): Omit<AgentDeps, "chat" | "trace"> {
  return {
    tools: buildTools(context),
    limits: TEST_LIMITS,
    clock: () => 0,
    isFinished: () => context.run.finished,
    nudge: "Respond only with tool calls.",
    compactionNotice: "Earlier messages were removed.",
  };
}
