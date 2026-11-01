import { runAgent, type AgentDeps } from "../agent/loop.js";
import { describeError } from "../errors.js";
import type { ChatFn } from "../agent/llm.js";
import type { DataMarkers, Lookalike } from "../agent/markers.js";
import { taggedTrace, type Trace } from "../agent/trace.js";
import type { Settings } from "../config/schema.js";
import type { CareersStore, JobStore } from "../db/store.js";
import type { Tool } from "../tools/tool.js";
import type { PageFetchDeps } from "./fetchPage.js";
import { normalizeCompany } from "../jobs/company.js";
import { auditor, stored } from "./audit.js";
import type { BoardAccess } from "./boardPages.js";
import type { PageRenderer } from "./renderState.js";
import { decideOutcome, type LookupOutcome } from "./outcome.js";
import { LOOKUP_COMPACTION, LOOKUP_NUDGE, lookupMessages } from "./prompt.js";
import { SearchUnavailable, type SearchResult } from "./searxng.js";
import { newSession, type LookupSession, type SoughtJob } from "./session.js";
import { readPage } from "./readPage.js";
import { lookupTools, type PageKind } from "./tools.js";

type CareersSettings = Settings["careers_lookup"];

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
    boards: BoardAccess;
    renderer: PageRenderer;
    markers: DataMarkers;
}

type Audit = ReturnType<typeof auditor>;

const LIMITS = { max_steps: 8, max_consecutive_tool_errors: 2, context_chars: 56_000 };

/** Looks up one job's posting in its own short conversation, storing the description when found and auditing the end. */
export async function lookUpJob(deps: LookupDeps, job: SoughtJob): Promise<LookupOutcome> {
    const session = newSession(job);
    const audit = auditor(deps, job);
    const key = normalizeCompany(job.company);
    if (job.retry === true) await audit({ step: "retry", url: null, outcome: "ok", reason: null });
    session.remembered = await offerRemembered(deps, { session, audit, key });
    const ports = { search: () => deps.search(job.company), open: (url: string, kind: PageKind) => readPage(deps, { url, kind, sought: job.title }), audit, forget: () => stored(() => deps.careers.clearLookupPage(key)) };
    const opening = lookupMessages(job, session.remembered, deps.markers);
    const trace = lookupTrace(deps, job);
    for (let count = 0; count < opening.removed; count += 1) await noteLookalike({ deps, trace, job }, { tool: "lookup_opening", jobId: job.jobId });
    const result = await runAgent(agentDeps(deps, { session, trace }, lookupTools(session, ports)), opening.messages);
    if (session.stop instanceof SearchUnavailable) throw session.stop;
    const outcome = decideOutcome(session, result);
    await recordOutcome({ deps, audit, key }, session, outcome);
    return outcome;
}

/** Offers the careers page on the company's record as link 1, or returns null when it has none. */
async function offerRemembered(deps: LookupDeps, lookup: { session: LookupSession; audit: Audit; key: string }): Promise<string | null> {
    const page = await deps.careers.careersPage(lookup.key);
    if (page === null) return null;
    lookup.session.registry.number(page);
    await lookup.audit({ step: "remembered", url: page, outcome: "ok", reason: null });
    return page;
}

/** Sets up the agent loop for a lookup: its tools, small limits, the lookup's trace, the run's markers, and an end once finished, out of opens or stopped. */
function agentDeps(deps: LookupDeps, { session, trace }: { session: LookupSession; trace: Trace }, tools: Tool[]): AgentDeps {
    return {
        chat: deps.chat,
        tools,
        limits: { ...LIMITS, max_wall_clock_min: deps.settings.max_minutes },
        trace,
        clock: () => deps.now().getTime(),
        isFinished: () => session.finished !== null || session.overLimit || session.stop !== null,
        nudge: LOOKUP_NUDGE,
        compactionNotice: LOOKUP_COMPACTION,
        markers: deps.markers,
        onLookalike: (hit) => noteLookalike({ deps, trace, job: session.job }, hit),
    };
}

/** Tags a lookup's trace events with the job being looked up. */
function lookupTrace(deps: LookupDeps, job: SoughtJob): Trace {
    return taggedTrace(deps.trace, { lookup: `${job.ats}:${job.jobId}` });
}

/** Notes that a look-alike marker was removed from something this lookup read and flags the job being looked up, tracing a failed flag instead of ending the lookup. */
async function noteLookalike({ deps, trace, job }: { deps: LookupDeps; trace: Trace; job: SoughtJob }, hit: Lookalike): Promise<void> {
    trace.write({ type: "lookalike_removed", tool: hit.tool, job_id: job.jobId });
    try {
        await deps.jobs.flagInjection(job.jobId, deps.now().toISOString());
    } catch (error) {
        trace.write({ type: "injection_flag_failed", tool: hit.tool, job_id: job.jobId, error: describeError(error) });
    }
}

/** Stores a found description, keeps the careers page that led to it on the company's record, and writes the lookup's finish row. */
async function recordOutcome(sinks: { deps: LookupDeps; audit: Audit; key: string }, session: LookupSession, outcome: LookupOutcome): Promise<void> {
    const { deps, audit } = sinks;
    const { job } = session;
    if (!outcome.found) return audit({ step: "finish", url: session.careersPage?.url ?? null, outcome: "failed", reason: outcome.reason, warning: true, detail: outcome.reason === "no_careers_page" ? session.resultUrls.join(" ") : null });
    await deps.jobs.setDescription({ ats: job.ats, jobId: job.jobId }, { description: outcome.description, format: outcome.format, url: outcome.url, source: "careers" });
    if (outcome.careersUrl !== null) await deps.careers.setLookupPage({ key: sinks.key, name: job.company, url: outcome.careersUrl }, deps.now().toISOString());
    await audit({ step: "finish", url: outcome.url, outcome: "found", reason: null });
}
