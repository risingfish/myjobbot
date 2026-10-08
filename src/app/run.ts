import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createChat, type ChatFn } from "../agent/llm.js";
import { runAgent, type AgentDeps, type AgentResult } from "../agent/loop.js";
import { COMPACTION_NOTICE, initialMessages, NUDGE } from "../agent/prompt.js";
import { fileTrace, type Trace } from "../agent/trace.js";
import { loadConfig, type AppConfig } from "../config/load.js";
import { ApiCallLog } from "../db/apiCalls.js";
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

interface RunLogs {
  runId: string;
  trace: Trace;
  llm: Trace;
  jobs: Trace;
}

interface RunReport extends AgentResult {
  runId: string;
  summary: string | null;
}

const PROMPT_TEXTS = { nudge: NUDGE, compactionNotice: COMPACTION_NOTICE };

/** Runs one full agent session end to end: loads config, runs the agent, and prunes stale jobs afterward. */
export async function runOnce(environment: NodeJS.ProcessEnv, seams: RunSeams = {}): Promise<RunReport> {
  const config = loadConfig(environment);
  const logs = openRunLogs(config);
  const context = buildContext(config, seams, logs);
  const chat = seams.chat ?? createChat(config.env, logs.llm);
  const result = await runAgent(agentDeps(config, context, { chat, trace: logs.trace }), initialMessages(config));
  pruneOldJobs(context);
  return { ...result, runId: logs.runId, summary: context.run.summary };
}

/** Deletes jobs and API call records older than the configured retention window. */
function pruneOldJobs(context: ToolContext): void {
  const cutoff = new Date(context.now().getTime() - context.config.job_retention_days * MS_PER_DAY).toISOString();
  context.store.pruneLastSeenBefore(cutoff);
  context.apiCalls.pruneBefore(cutoff);
}

/** Assembles the tool context (database, HTTP client, run state) a single run's tools operate against. */
function buildContext(config: AppConfig, seams: RunSeams, logs: RunLogs): ToolContext {
  const db = openDatabase(join(config.dataDir, "myjobbot.db"));
  return {
    config: config.file,
    run: newRunState(), runId: logs.runId,
    store: new JobStore(db), apiCalls: new ApiCallLog(db),
    http: seams.http ?? new HttpClient({ config: config.file.http, clock: systemClock, fetchFn: globalThis.fetch, random: Math.random }),
    now: () => new Date(),
    jobLog: logs.jobs,
    jsearchApiKey: config.env.JSEARCH_API_KEY ?? null,
  };
}

/** Assembles the dependencies the agent loop needs from the run's config, tools, and context. */
function agentDeps(config: AppConfig, context: ToolContext, io: Pick<AgentDeps, "chat" | "trace">): AgentDeps {
  return {
    ...io,
    tools: buildTools(context),
    limits: config.file.agent,
    clock: Date.now,
    isFinished: () => context.run.finished,
    ...PROMPT_TEXTS,
  };
}

/** Opens the trace, LLM, and job JSONL log files used to record one run. */
function openRunLogs(config: AppConfig): RunLogs {
  const runId = randomUUID();
  const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${runId}`;
  const logDir = config.env.MYJOBBOT_LOG_DIR;
  return {
    runId,
    trace: openJsonl(join(config.dataDir, "runs"), `${name}.jsonl`, runId),
    llm: openJsonl(logDir, `${name}.llm.jsonl`, runId),
    jobs: openJsonl(logDir, `${name}.jobs.jsonl`, runId),
  };
}

/** Creates a file-backed Trace, creating its parent directory first if needed. */
function openJsonl(dir: string, file: string, runId: string): Trace {
  mkdirSync(dir, { recursive: true });
  return fileTrace(join(dir, file), runId);
}
