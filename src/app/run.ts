import { searchCompanies } from "../companies/searchCompanies.js";
import { describeError } from "../errors.js";
import { createChat, type ChatFn } from "../agent/llm.js";
import { runAgent, type AgentDeps } from "../agent/loop.js";
import { COMPACTION_NOTICE, initialMessages, NUDGE } from "../agent/prompt.js";
import type { AppConfig, LoadedConfig } from "../config/load.js";
import type { SavedSource } from "../db/sourceStore.js";
import type { Stores } from "../db/store.js";
import type { UserStores } from "../db/userStores.js";
import type { JsonGetter, JsonPoster, TextGetter } from "../http/client.js";
import type { BrowserPort } from "../careers/browser.js";
import type { HostLookup } from "../careers/fetchPage.js";
import { sourceHttp } from "../sources/sourceHttp.js";
import { sourcesOn } from "../tools/sources.js";
import { beforeAgent } from "./beforeAgent.js";
import { newRunState, type ToolContext } from "../tools/context.js";
import type { SecretKeyStatus } from "../gmail/secretKey.js";
import { gmailState, type GmailState } from "./gmailState.js";
import { buildTools } from "../tools/registry.js";
import { reportLookalike } from "./lookalikes.js";
import { dataMarkers } from "../agent/markers.js";
import { openRunLogs, type RunLogs } from "./runLogs.js";
import { pageRenderer, runClients, type RunClients } from "./runParts.js";
import { settingsForRun } from "./runSettings.js";
import type { RunReport } from "./runLines.js";
import { NO_SOURCES } from "./usersToRun.js";

export interface RunSeams {
    chat?: ChatFn;
    http?: JsonGetter & JsonPoster;
    pages?: TextGetter;
    lookup?: HostLookup;
    openStores?: () => Promise<Stores>;
    browser?: (url: string) => Promise<BrowserPort>;
}

interface UserParts {
    stores: UserStores;
    key: SecretKeyStatus;
}

interface RunParts extends UserParts {
    logs: RunLogs;
}

interface ContextParts extends RunParts {
    saved: SavedSource[];
    gmail: GmailState;
    chat: ChatFn;
    clients: RunClients;
}

const PROMPT_TEXTS = { nudge: NUDGE, compactionNotice: COMPACTION_NOTICE };

/** Runs one user's agent session with their own logs, settings and resume, against stores already bound to them. */
export async function runForUser(loaded: LoadedConfig, seams: RunSeams, { stores, key }: UserParts): Promise<RunReport> {
    const logs = openRunLogs(loaded);
    logs.trace.write({ type: "user", userId: stores.userId });
    const config = await settingsForRun(loaded, stores, logs.trace);
    return runWithStores(config, seams, { logs, stores, key });
}

/** Links stored jobs to their companies, runs the agent, or finishes at once when no source is on, against open stores, then searches for companies' addresses, reporting the run's outcome. */
async function runWithStores(config: AppConfig, seams: RunSeams, parts: RunParts): Promise<RunReport> {
    const chat = seams.chat ?? createChat(config.env, parts.logs.llm);
    const saved = await parts.stores.sources.list();
    const context = buildContext(config, seams, { ...parts, chat, saved, gmail: await gmailState(parts.stores.gmail, parts.key), clients: runClients(config, seams) });
    try {
        if (sourcesOn(context).length === 0) return { status: "finished", reason: NO_SOURCES, steps: 0, runId: parts.logs.runId, summary: NO_SOURCES };
        await beforeAgent(context);
        const result = await runAgent(agentDeps(config, context, { chat, trace: parts.logs.trace }), initialMessages(config, context.markers));
        await afterAgent(context);
        return { ...result, runId: parts.logs.runId, summary: context.run.summary };
    } finally {
        await context.careers.renderer.close();
    }
}

/** Finishes the user's part after the agent: searches for the companies' missing addresses, tracing an unexpected failure without failing the run. */
async function afterAgent(context: ToolContext): Promise<void> {
    try {
        await searchCompanies(context);
    } catch (error) {
        context.trace.write({ type: "company_search_failed", error: describeError(error) });
    }
}

/** Assembles the tool context (stores, HTTP client, run state) a single run's tools operate against. */
function buildContext(config: AppConfig, seams: RunSeams, { logs, stores, key, gmail, chat, saved, clients: { client, boards, lookup } }: ContextParts): ToolContext {
    return {
        config: config.settings,
        run: newRunState(),
        runId: logs.runId,
        markers: dataMarkers(logs.runId),
        ...storeParts(stores),
        http: seams.http ?? client,
        sources: sourceHttp({ http: seams.http ?? boards, lookup }),
        saved: { store: stores.sources, list: saved },
        now: () => new Date(),
        jobLog: logs.jobs,
        jsearchApiKey: config.env.JSEARCH_API_KEY ?? null,
        gmail: { store: stores.gmail, alerts: stores.alerts, key, ...gmail },
        trace: logs.trace,
        chat,
        careers: { store: stores.careers, searxngUrl: config.env.MYJOBBOT_SEARXNG_URL ?? null, lookup, pages: seams.pages ?? client, boards, renderer: pageRenderer(config, seams, { logs, stores }) },
    };
}

/** Gives the stores the tools read and write jobs, API calls and company records through. */
function storeParts(stores: UserStores): Pick<ToolContext, "store" | "postings" | "sourcePlans" | "apiCalls" | "companies"> {
    return { store: stores.jobStore, postings: stores.postings, sourcePlans: stores.sourcePlans, apiCalls: stores.apiCalls, companies: stores.companies };
}

/** Assembles the dependencies the agent loop needs from the run's config, tools, and context. */
function agentDeps(config: AppConfig, context: ToolContext, io: Pick<AgentDeps, "chat" | "trace">): AgentDeps {
    return {
        ...io,
        tools: buildTools(context),
        limits: config.settings.agent,
        clock: Date.now,
        isFinished: () => context.run.finished,
        ...PROMPT_TEXTS,
        markers: context.markers,
        onLookalike: (hit) => reportLookalike(context, hit),
    };
}
