import type { FileConfig } from "../config/schema.js";
import { dispatch } from "../tools/dispatch.js";
import type { Tool } from "../tools/tool.js";
import { Budget } from "./budget.js";
import { toHistory, type AssistantMessage, type ChatFn, type Message } from "./llm.js";
import type { Trace, TraceEvent } from "./trace.js";

export interface AgentDeps {
  chat: ChatFn;
  tools: Tool[];
  limits: FileConfig["agent"];
  trace: Trace;
  clock: () => number;
  isFinished: () => boolean;
}

export interface AgentResult {
  status: "finished" | "aborted";
  reason: string;
  steps: number;
}

type FunctionCall = Extract<NonNullable<AssistantMessage["tool_calls"]>[number], { type: "function" }>;

const NUDGE = "Respond only with tool calls. Call finish when every company has total_unscored 0.";

export async function runAgent(deps: AgentDeps, messages: Message[]): Promise<AgentResult> {
  return new AgentSession(deps, messages).run();
}

class AgentSession {
  private readonly budget: Budget;

  constructor(
    private readonly deps: AgentDeps,
    private readonly messages: Message[],
  ) {
    this.budget = new Budget(deps.limits, deps.clock);
  }

  async run(): Promise<AgentResult> {
    this.deps.trace.write({ type: "start", messages: this.messages });
    while (!this.deps.isFinished()) {
      const exhausted = this.budget.exhaustedReason();
      if (exhausted) return this.end("aborted", exhausted);
      await this.step();
    }
    return this.end("finished", "finish called");
  }

  private async step(): Promise<void> {
    this.budget.countStep();
    const reply = await this.deps.chat(this.messages, this.deps.tools);
    this.record({ type: "assistant", content: reply.content, tool_calls: reply.tool_calls }, toHistory(reply));
    const calls = functionCalls(reply);
    if (calls.length === 0) return this.nudge();
    for (const call of calls) await this.execute(call);
  }

  private async execute(call: FunctionCall): Promise<void> {
    const outcome = await dispatch(this.deps.tools, call.function);
    this.budget.recordOutcome(outcome.ok);
    this.record(
      { type: "tool", name: call.function.name, ok: outcome.ok, content: outcome.content },
      { role: "tool", tool_call_id: call.id, content: outcome.content },
    );
  }

  private nudge(): void {
    this.budget.recordOutcome(false);
    this.record({ type: "nudge" }, { role: "user", content: NUDGE });
  }

  private record(event: TraceEvent, message: Message): void {
    this.deps.trace.write(event);
    this.messages.push(message);
  }

  private end(status: AgentResult["status"], reason: string): AgentResult {
    const result = { status, reason, steps: this.budget.steps };
    this.deps.trace.write({ type: "end", ...result });
    return result;
  }
}

function functionCalls(reply: AssistantMessage): FunctionCall[] {
  return (reply.tool_calls ?? []).filter((call): call is FunctionCall => call.type === "function");
}
