import { z } from "zod";
import { StoreFailed, type StepRecord } from "./audit.js";
import { defineTool, type Tool } from "../tools/tool.js";
import { FetchRefused, FetchTimedOut } from "./fetchPage.js";
import { SearchUnavailable, type SearchResult } from "./searxng.js";
import { MODEL_REASONS, type LookupSession } from "./session.js";
import type { TrimmedPage } from "./trim.js";

export type PageKind = "careers_page" | "job_page";

export interface ToolPorts {
    search(): Promise<SearchResult[]>;
    open(url: string, kind: PageKind): Promise<TrimmedPage>;
    audit(record: StepRecord): Promise<void>;
    forget(): Promise<void>;
}

const MAX_OPENS = 3;
const NO_LINKS = "no job links on this page";
const openSchema = z.object({ link: z.number().int().min(1).describe("A link number from search_careers or an opened page"), as: z.enum(["careers_page", "job_page"]) });
const finishSchema = z.object({ found: z.boolean(), reason: z.enum(MODEL_REASONS).optional() });

/** Builds the three tools of a lookup conversation, all acting on one job's session. */
export function lookupTools(session: LookupSession, ports: ToolPorts): Tool[] {
    return [defineTool({ name: "search_careers", description: `Search the web for "${session.job.company} careers". Returns numbered results.`, schema: z.object({}), run: () => stopOn(session, () => search(session, ports)) }), defineTool({ name: "open_link", description: `Open a numbered link, as the employer's careers page or as the job's own page. At most ${MAX_OPENS} per lookup.`, schema: openSchema, run: (request) => stopOn(session, () => openLink(session, ports, request)) }), defineTool({ name: "finish_lookup", description: "End the lookup: found when an opened job page describes this job, otherwise not found with a reason.", schema: finishSchema, run: (args) => finish(session, args) })];
}

/** Runs a tool step, recording a failure that must end the whole lookup before the loop turns it into a tool error. */
async function stopOn<T>(session: LookupSession, step: () => Promise<T>): Promise<T> {
    try {
        return await step();
    } catch (error) {
        if (error instanceof SearchUnavailable || error instanceof StoreFailed) session.stop = error;
        throw error;
    }
}

/** Searches for the company's careers page and offers the results as numbered links. */
async function search(session: LookupSession, ports: ToolPorts) {
    const results = await ports.search();
    session.searched = results.length;
    session.resultUrls = results.map((result) => result.url);
    const shown = results.length === 0 ? { results: [], note: "no results" } : { results: results.map((result) => ({ n: session.registry.number(result.url), ...result })) };
    await ports.audit({ step: "search", url: `${session.job.company} careers`, chars: JSON.stringify(shown).length, outcome: "ok", reason: null });
    return shown;
}

/** Opens a numbered link as a careers page or a job page, within the per-lookup limit. */
async function openLink(session: LookupSession, ports: ToolPorts, request: z.infer<typeof openSchema>) {
    const url = offeredUrl(session, request.link);
    session.opens += 1;
    const step = request.as === "careers_page" ? "open_careers" : "open_job";
    const page = await tracked(session, () => ports.open(url, request.as)).catch(async (error: unknown) => {
        await ports.audit({ step, url, outcome: "failed", reason: session.lastFailure, detail: await forgetIfRemembered(session, ports, url) });
        throw error;
    });
    const stale = request.as === "careers_page" && page.links.length === 0 ? await forgetIfRemembered(session, ports, url) : null;
    await ports.audit({ step, url: page.url, chars: page.chars, cut: page.cut, morePages: page.morePages, outcome: stale === null ? "ok" : "failed", reason: null, detail: stale });
    return request.as === "careers_page" ? careersResult(session, page) : jobResult(session, page);
}

/** Forgets the remembered careers page when it is the one that just failed, returning the audit detail saying so. */
async function forgetIfRemembered(session: LookupSession, ports: ToolPorts, url: string): Promise<string | null> {
    if (url !== session.remembered) return null;
    session.remembered = null;
    await ports.forget();
    return "forgotten";
}

/** Returns the address behind a link number, refusing unknown numbers and opens past the limit. */
function offeredUrl(session: LookupSession, link: number): string {
    if (session.opens >= MAX_OPENS) throw new Error(`at most ${MAX_OPENS} pages can be opened in one lookup; call finish_lookup`);
    const url = session.registry.get(link);
    if (url === undefined) throw new Error(session.registry.size === 0 ? "no links yet; call search_careers first" : `unknown link ${link}; valid links are 1-${session.registry.size}`);
    return url;
}

/** Fetches a page, remembering whether the fetch was refused or timed out so the outcome can say so. */
async function tracked(session: LookupSession, fetch: () => Promise<TrimmedPage>): Promise<TrimmedPage> {
    try {
        const page = await fetch();
        session.lastFailure = null;
        return page;
    } catch (error) {
        session.lastFailure = error instanceof FetchRefused ? "fetch_refused" : error instanceof FetchTimedOut ? "timed_out" : null;
        throw error;
    }
}

/** Shows a careers page with the job being looked for and its links as numbers only. */
function careersResult(session: LookupSession, page: TrimmedPage) {
    session.careersPage = { url: page.url, links: page.links.length };
    session.lastOpened = "careers";
    const { title, company, location } = session.job;
    const links = page.links.map((link) => ({ n: session.registry.number(link.url), text: link.text }));
    const shown = { url: page.url, looking_for: { title, company, location }, text: page.text, links, cut: page.cut, more_pages: page.morePages };
    return links.length === 0 ? { ...shown, note: NO_LINKS } : shown;
}

/** Shows a job page's text, which becomes the description if the lookup finishes as found. */
function jobResult(session: LookupSession, page: TrimmedPage) {
    session.jobPage = { url: page.url, text: page.text };
    session.lastOpened = "job";
    return { url: page.url, text: page.text, links: [], cut: page.cut, more_pages: false };
}

/** Ends the lookup, requiring an opened job page for found and a reason otherwise. */
function finish(session: LookupSession, args: z.infer<typeof finishSchema>) {
    if (args.found && session.jobPage === null) throw new Error("open the job's own page with open_link as job_page before finishing with found");
    if (!args.found && args.reason === undefined) throw new Error("give a reason when the job wasn't found");
    session.finished = { found: args.found, reason: args.found ? null : (args.reason ?? null) };
    return { ok: true };
}
