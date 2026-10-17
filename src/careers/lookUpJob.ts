import { runAgent, type AgentDeps } from "../agent/loop.js";
import type { ChatFn } from "../agent/llm.js";
import { taggedTrace, type Trace } from "../agent/trace.js";
import type { FileConfig } from "../config/schema.js";
import type { CareersStore, JobStore } from "../db/store.js";
import type { Tool } from "../tools/tool.js";
import { fetchPublicPage, type PageFetchDeps } from "./fetchPage.js";
import { normalizeCompany } from "../jobs/company.js";
import { auditor, stored } from "./audit.js";
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

type Audit = ReturnType<typeof auditor>;

const LIMITS = { max_steps: 8, max_consecutive_tool_errors: 2, context_chars: 56_000 };

/** Looks up one job's posting in its own short conversation, storing the description when found and auditing the end. */
export async function lookUpJob(deps: LookupDeps, job: SoughtJob): Promise<LookupOutcome> {
    const session = newSession(job);
    const audit = auditor(deps, job);
    const key = normalizeCompany(job.company);
    session.remembered = await offerRemembered(deps, { session, audit, key });
    const ports = { search: () => deps.search(job.company), open: (url: string, kind: PageKind) => openPage(deps, { url, kind, sought: job.title }), audit, forget: () => stored(() => deps.careers.forgetPage(key)) };
    const result = await runAgent(agentDeps(deps, session, lookupTools(session, ports)), lookupMessages(job, session.remembered));
    if (session.stop instanceof SearchUnavailable) throw session.stop;
    const outcome = decideOutcome(session, result);
    await recordOutcome({ deps, audit, key }, session, outcome);
    return outcome;
}

/** Offers the company's remembered careers page as link 1, noting its use, or returns null when none is remembered. */
async function offerRemembered(deps: LookupDeps, lookup: { session: LookupSession; audit: Audit; key: string }): Promise<string | null> {
    const page = await deps.careers.rememberedPage(lookup.key);
    if (page === null) return null;
    lookup.session.registry.number(page.url);
    await deps.careers.usePage(lookup.key, deps.now().toISOString());
    await lookup.audit({ step: "remembered", url: page.url, outcome: "ok", reason: null });
    return page.url;
}

/** Fetches a public page and trims it for the model, keeping links only on careers pages. */
async function openPage(deps: LookupDeps, request: { url: string; kind: PageKind; sought: string }): Promise<TrimmedPage> {
    const page = await fetchPublicPage(deps.pages, request.url);
    const trimmed = trimPage(page.html, { baseUrl: page.url, maxChars: deps.settings.page_chars, sought: request.sought, links: request.kind === "careers_page" });
    return { ...trimmed, cut: trimmed.cut || page.cut };
}

/** Sets up the agent loop for a lookup: its tools, small limits, a tagged trace, and an end once finished, out of opens or stopped. */
function agentDeps(deps: LookupDeps, session: LookupSession, tools: Tool[]): AgentDeps {
    return {
        chat: deps.chat,
        tools,
        limits: { ...LIMITS, max_wall_clock_min: deps.settings.max_minutes },
        trace: taggedTrace(deps.trace, { lookup: `${session.job.ats}:${session.job.jobId}` }),
        clock: () => deps.now().getTime(),
        isFinished: () => session.finished !== null || session.overLimit || session.stop !== null,
        nudge: LOOKUP_NUDGE,
        compactionNotice: LOOKUP_COMPACTION,
    };
}

/** Stores a found description, remembers the careers page that led to it, and writes the lookup's finish row. */
async function recordOutcome(sinks: { deps: LookupDeps; audit: Audit; key: string }, session: LookupSession, outcome: LookupOutcome): Promise<void> {
    const { deps, audit } = sinks;
    const { job } = session;
    if (!outcome.found) return audit({ step: "finish", url: session.careersPage?.url ?? null, outcome: "failed", reason: outcome.reason, warning: true, detail: outcome.reason === "no_careers_page" ? session.resultUrls.join(" ") : null });
    await deps.jobs.setDescription({ ats: job.ats, jobId: job.jobId }, { description: outcome.description, url: outcome.url, source: "careers" });
    if (outcome.careersUrl !== null) await deps.careers.rememberPage({ companyKey: sinks.key, company: job.company, url: outcome.careersUrl }, deps.now().toISOString());
    await audit({ step: "finish", url: outcome.url, outcome: "found", reason: null });
}
