import { runAgent, type AgentDeps } from "../agent/loop.js";
import type { ChatFn } from "../agent/llm.js";
import { taggedTrace, type Trace } from "../agent/trace.js";
import type { FileConfig } from "../config/schema.js";
import type { CareersStore, JobStore } from "../db/store.js";
import type { Tool } from "../tools/tool.js";
import { fetchPublicPage, type PageFetchDeps } from "./fetchPage.js";
import { decideOutcome, type LookupOutcome } from "./outcome.js";
import { LOOKUP_COMPACTION, LOOKUP_NUDGE, lookupMessages } from "./prompt.js";
import { SearchUnavailable, type SearchResult } from "./searxng.js";
import { newSession, type LookupSession, type SoughtJob } from "./session.js";
import { lookupTools, type PageKind } from "./tools.js";
import { trimPage, type TrimmedPage } from "./trim.js";

type CareersSettings = FileConfig["careers_lookup"];

export interface LookupDeps {
    chat: ChatFn;
    trace: Trace;
    settings: CareersSettings;
    pages: PageFetchDeps;
    jobs: JobStore;
    careers: CareersStore;
    runId: string;
    now: () => Date;
    search: (company: string) => Promise<SearchResult[]>;
}

const LIMITS = { max_steps: 8, max_consecutive_tool_errors: 2, context_chars: 56_000 };

/** Looks up one job's posting in its own short conversation, storing the description when found and auditing the end. */
export async function lookUpJob(deps: LookupDeps, job: SoughtJob): Promise<LookupOutcome> {
    const session = newSession(job);
    const tools = lookupTools(session, { search: () => deps.search(job.company), open: (url, kind) => openPage(deps, { url, kind, sought: job.title }) });
    const result = await runAgent(agentDeps(deps, session, tools), lookupMessages(job));
    if (session.stop instanceof SearchUnavailable) throw session.stop;
    const outcome = decideOutcome(session, result);
    await recordOutcome(deps, session, outcome);
    return outcome;
}

/** Fetches a public page and trims it for the model, keeping links only on careers pages. */
async function openPage(deps: LookupDeps, request: { url: string; kind: PageKind; sought: string }): Promise<TrimmedPage> {
    const page = await fetchPublicPage(deps.pages, request.url);
    const trimmed = trimPage(page.html, { baseUrl: page.url, maxChars: deps.settings.page_chars, sought: request.sought, links: request.kind === "careers_page" });
    return { ...trimmed, cut: trimmed.cut || page.cut };
}

/** Sets up the agent loop for a lookup: its tools, small limits, a tagged trace, and an end once finished or stopped. */
function agentDeps(deps: LookupDeps, session: LookupSession, tools: Tool[]): AgentDeps {
    return {
        chat: deps.chat,
        tools,
        limits: { ...LIMITS, max_wall_clock_min: deps.settings.max_minutes },
        trace: taggedTrace(deps.trace, { lookup: `${session.job.ats}:${session.job.jobId}` }),
        clock: () => deps.now().getTime(),
        isFinished: () => session.finished !== null || session.stop !== null,
        nudge: LOOKUP_NUDGE,
        compactionNotice: LOOKUP_COMPACTION,
    };
}

/** Stores a found description and writes the lookup's finish row, naming the careers page when there was one. */
async function recordOutcome(deps: LookupDeps, session: LookupSession, outcome: LookupOutcome): Promise<void> {
    const { job } = session;
    if (outcome.found) await deps.jobs.setDescription({ ats: job.ats, jobId: job.jobId }, { description: outcome.description, url: outcome.url, source: "careers" });
    const where = { runId: deps.runId, at: deps.now().toISOString(), ats: job.ats, jobId: job.jobId, company: job.company, step: "finish" as const };
    const ending = outcome.found ? { url: outcome.url, outcome: "found" as const, reason: null } : { url: session.careersPage?.url ?? null, outcome: "failed" as const, reason: outcome.reason, warning: true };
    await deps.careers.audit({ ...where, ...ending });
}
