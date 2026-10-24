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
import { HttpClient, type JsonGetter, type TextGetter } from "../http/client.js";
import { connectBrowser, type BrowserPort } from "../careers/browser.js";
import { systemLookup } from "../careers/fetchPage.js";
import { PageRenderer } from "../careers/renderState.js";
import { newRunState, type ToolContext } from "../tools/context.js";
import { alertsUsability } from "../gmail/alertJobs/usable.js";
import { secretKeyStatus, type SecretKeyStatus } from "../gmail/secretKey.js";
import { buildTools } from "../tools/registry.js";
import { reportLookalike } from "./lookalikes.js";
import { dataMarkers } from "../agent/markers.js";

interface RunSeams {
    chat?: ChatFn;
    http?: JsonGetter;
    pages?: TextGetter;
    openStores?: () => Promise<Stores>;
    browser?: (url: string) => Promise<BrowserPort>;
}

interface RunParts {
    logs: RunLogs;
    stores: Stores;
    key: SecretKeyStatus;
}

interface ContextParts extends RunParts {
    usable: true | string;
    chat: ChatFn;
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
        return await runWithStores(config, seams, { logs, stores, key: secretKeyStatus(environment) });
    } finally {
        await stores.close();
    }
}

/** Links stored jobs to their companies, runs the agent against open stores, then prunes stale jobs, reporting the run's outcome. */
async function runWithStores(config: AppConfig, seams: RunSeams, parts: RunParts): Promise<RunReport> {
    const chat = seams.chat ?? createChat(config.env, parts.logs.llm);
    const context = buildContext(config, seams, { ...parts, chat, usable: await gmailUsable(parts) });
    try {
        await beforeAgent(context);
        const result = await runAgent(agentDeps(config, context, { chat, trace: parts.logs.trace }), initialMessages(config, context.markers));
        await pruneOldJobs(context);
        return { ...result, runId: parts.logs.runId, summary: context.run.summary };
    } finally {
        await context.careers.renderer.close();
    }
}

/** Prepares the stored data before the agent starts: links any job not yet linked to its company's record, which after an upgrade is every stored job. */
async function beforeAgent(context: ToolContext): Promise<void> {
    const linked = await context.store.linkUnlinkedJobs();
    if (linked > 0) context.trace.write({ type: "companies_linked", jobs: linked });
}

/** Deletes jobs and API call records older than the configured retention window. */
async function pruneOldJobs(context: ToolContext): Promise<void> {
    const cutoff = new Date(context.now().getTime() - context.config.job_retention_days * MS_PER_DAY).toISOString();
    await context.store.pruneLastSeenBefore(cutoff);
    await context.apiCalls.pruneBefore(cutoff);
    await context.careers.store.pruneAuditBefore(cutoff);
}

/** Settles once per run whether the Gmail alerts source can be read, or the fixed note saying why not. */
async function gmailUsable({ stores, key }: RunParts): Promise<true | string> {
    const usability = alertsUsability(await stores.gmail.connection(), key);
    return usability.usable ? true : usability.note;
}

/** Assembles the tool context (stores, HTTP client, run state) a single run's tools operate against. */
function buildContext(config: AppConfig, seams: RunSeams, { logs, stores, key, usable, chat }: ContextParts): ToolContext {
    const client = new HttpClient({ config: config.file.http, clock: systemClock, fetchFn: globalThis.fetch, random: Math.random });
    return {
        config: config.file,
        run: newRunState(),
        runId: logs.runId,
        markers: dataMarkers(logs.runId),
        store: stores.jobStore,
        apiCalls: stores.apiCalls,
        http: seams.http ?? client,
        now: () => new Date(),
        jobLog: logs.jobs,
        jsearchApiKey: config.env.JSEARCH_API_KEY ?? null,
        gmail: { store: stores.gmail, alerts: stores.alerts, key, usable },
        trace: logs.trace,
        chat,
        careers: { store: stores.careers, searxngUrl: config.env.MYJOBBOT_SEARXNG_URL ?? null, lookup: systemLookup, pages: seams.pages ?? client, boards: client.withoutRedirects(), renderer: pageRenderer(config, seams, { logs, stores }) },
    };
}

/** Creates the run's page renderer, connected to the browser service only when one is configured. */
function pageRenderer(config: AppConfig, seams: RunSeams, { logs, stores }: Pick<RunParts, "logs" | "stores">): PageRenderer {
    const url = config.env.MYJOBBOT_BROWSER_URL;
    const connect = url === undefined ? null : () => (seams.browser ?? connectBrowser)(url);
    return new PageRenderer({ connect, settings: config.file.careers_lookup, lookup: systemLookup, careers: stores.careers, trace: logs.trace, runId: logs.runId, now: () => new Date() });
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
        markers: context.markers,
        onLookalike: (hit) => reportLookalike(context, hit),
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
