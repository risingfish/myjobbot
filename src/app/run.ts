import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createChat, type ChatFn } from "../agent/llm.js";
import { runAgent, type AgentDeps, type AgentResult } from "../agent/loop.js";
import { initialMessages } from "../agent/prompt.js";
import { fileTrace, type Trace } from "../agent/trace.js";
import { loadConfig, type AppConfig } from "../config/load.js";
import { newRunState, type ToolContext } from "../tools/context.js";
import { buildTools } from "../tools/registry.js";

interface RunSeams {
  chat?: ChatFn;
}

interface RunReport extends AgentResult {
  summary: string | null;
}

export async function runOnce(environment: NodeJS.ProcessEnv, seams: RunSeams = {}): Promise<RunReport> {
  const config = loadConfig(environment);
  const context = buildContext(config);
  const result = await runAgent(agentDeps(config, context, seams), initialMessages(config));
  return { ...result, summary: context.run.summary };
}

function buildContext(config: AppConfig): ToolContext {
  return { config: config.file, run: newRunState() };
}

function agentDeps(config: AppConfig, context: ToolContext, seams: RunSeams): AgentDeps {
  return {
    chat: seams.chat ?? createChat(config.env),
    tools: buildTools(context),
    limits: config.file.agent,
    trace: openTrace(config.dataDir),
    clock: Date.now,
    isFinished: () => context.run.finished,
  };
}

function openTrace(dataDir: string): Trace {
  const runsDir = join(dataDir, "runs");
  mkdirSync(runsDir, { recursive: true });
  return fileTrace(join(runsDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`));
}
