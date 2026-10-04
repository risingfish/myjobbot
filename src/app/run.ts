import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createChat, type ChatFn } from "../agent/llm.js";
import { runAgent, type AgentDeps, type AgentResult } from "../agent/loop.js";
import { COMPACTION_NOTICE, initialMessages, NUDGE } from "../agent/prompt.js";
import { fileTrace, type Trace } from "../agent/trace.js";
import { loadConfig, type AppConfig } from "../config/load.js";
import { JobStore } from "../db/jobStore.js";
import { openDatabase } from "../db/open.js";
import { MS_PER_DAY } from "../jobs/age.js";
import { systemClock } from "../http/clock.js";
import { HttpClient, type JsonGetter } from "../http/client.js";
import { newRunState, type ToolContext } from "../tools/context.js";
import { buildTools } from "../tools/registry.js";

interface RunSeams {
  chat?: ChatFn;
  http?: JsonGetter;
}

interface RunReport extends AgentResult {
  summary: string | null;
}

const PROMPT_TEXTS = { nudge: NUDGE, compactionNotice: COMPACTION_NOTICE };

export async function runOnce(environment: NodeJS.ProcessEnv, seams: RunSeams = {}): Promise<RunReport> {
  const config = loadConfig(environment);
  const context = buildContext(config, seams);
  const result = await runAgent(agentDeps(config, context, seams), initialMessages(config));
  pruneOldJobs(context);
  return { ...result, summary: context.run.summary };
}

function pruneOldJobs(context: ToolContext): void {
  const cutoff = new Date(context.now().getTime() - context.config.job_retention_days * MS_PER_DAY);
  context.store.pruneLastSeenBefore(cutoff.toISOString());
}

function buildContext(config: AppConfig, seams: RunSeams): ToolContext {
  return {
    config: config.file,
    run: newRunState(),
    store: new JobStore(openDatabase(join(config.dataDir, "myjobbot.db"))),
    http: seams.http ?? new HttpClient({ config: config.file.http, clock: systemClock, fetchFn: globalThis.fetch, random: Math.random }),
    now: () => new Date(),
  };
}

function agentDeps(config: AppConfig, context: ToolContext, seams: RunSeams): AgentDeps {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    chat: seams.chat ?? createChat(config.env, openJsonl(config.env.MYJOBBOT_LOG_DIR, runId)),
    tools: buildTools(context),
    limits: config.file.agent,
    trace: openJsonl(join(config.dataDir, "runs"), runId),
    clock: Date.now,
    isFinished: () => context.run.finished,
    ...PROMPT_TEXTS,
  };
}

function openJsonl(dir: string, runId: string): Trace {
  mkdirSync(dir, { recursive: true });
  return fileTrace(join(dir, `${runId}.jsonl`));
}
