import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createChat, type ChatFn } from "../agent/llm.js";
import { runAgent, type AgentDeps, type AgentResult } from "../agent/loop.js";
import { COMPACTION_NOTICE, initialMessages, NUDGE } from "../agent/prompt.js";
import { fileTrace, type Trace } from "../agent/trace.js";
import { loadConfig, type AppConfig, type Environment } from "../config/load.js";
import { openStores } from "../db/connect.js";
import { parseDbSettings } from "../db/settings.js";
import type { Stores } from "../db/store.js";
import { MS_PER_DAY } from "../jobs/age.js";
import { systemClock } from "../http/clock.js";
import { HttpClient, type JsonGetter } from "../http/client.js";
import { newRunState, type ToolContext } from "../tools/context.js";
import { buildTools } from "../tools/registry.js";

interface RunSeams {
    chat?: ChatFn;
    http?: JsonGetter;
    openStores?: () => Promise<Stores>;
}

interface RunParts {
    logs: RunLogs;
    stores: Stores;
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
export async function runOnce(environment: Environment, seams: RunSeams = {}): Promise<RunReport> {
    const config = loadConfig(environment);
    const logs = openRunLogs(config);
    const stores = await (seams.openStores ?? (() => openStores(parseDbSettings(environment))))();
    try {
        return await runWithStores(config, seams, { logs, stores });
    } finally {
        await stores.close();
    }
}

/** Runs the agent against open stores, then prunes stale jobs, reporting the run's outcome. */
async function runWithStores(config: AppConfig, seams: RunSeams, parts: RunParts): Promise<RunReport> {
    const context = buildContext(config, seams, parts);
    const chat = seams.chat ?? createChat(config.env, parts.logs.llm);
    const result = await runAgent(agentDeps(config, context, { chat, trace: parts.logs.trace }), initialMessages(config));
    await pruneOldJobs(context);
    return { ...result, runId: parts.logs.runId, summary: context.run.summary };
}

/** Deletes jobs and API call records older than the configured retention window. */
async function pruneOldJobs(context: ToolContext): Promise<void> {
    const cutoff = new Date(context.now().getTime() - context.config.job_retention_days * MS_PER_DAY).toISOString();
    await context.store.pruneLastSeenBefore(cutoff);
    await context.apiCalls.pruneBefore(cutoff);
}

/** Assembles the tool context (stores, HTTP client, run state) a single run's tools operate against. */
function buildContext(config: AppConfig, seams: RunSeams, { logs, stores }: RunParts): ToolContext {
    return {
        config: config.file,
        run: newRunState(),
        runId: logs.runId,
        store: stores.jobStore,
        apiCalls: stores.apiCalls,
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
