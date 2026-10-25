import { searchWeb, SearchUnavailable, type SearchResult } from "../careers/searxng.js";
import type { CompanyRow } from "../db/companyStore.js";
import type { ToolContext } from "../tools/context.js";
import { pickCareers, pickWebsite, type AddressPick } from "./pickAddresses.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Searches SearXNG for the websites and careers pages of the companies due, up to the run's limit, marking the rest unavailable when SearXNG can't be used. */
export async function searchCompanies(context: ToolContext): Promise<void> {
    const limit = context.config.company_search.max_per_run;
    if (limit === 0) return;
    const due = await context.companies.dueForSearch(limit, new Date(context.now().getTime() - DAY_MS).toISOString());
    const base = context.careers.searxngUrl;
    if (base === null) return markRest(context, due, "not_configured");
    for (const [index, company] of due.entries()) {
        if (!(await searchedOrStopped(context, base, company))) return markRest(context, due.slice(index), "failed");
    }
}

/** Searches one company, reporting false when SearXNG became unusable instead of throwing. */
async function searchedOrStopped(context: ToolContext, base: string, company: CompanyRow): Promise<boolean> {
    try {
        await searchCompany(context, base, company);
        return true;
    } catch (error) {
        if (error instanceof SearchUnavailable) return false;
        throw error;
    }
}

/** Finds whichever of a company's website and careers page it is missing, stores the outcome, and traces it. */
async function searchCompany(context: ToolContext, base: string, company: CompanyRow): Promise<void> {
    const skipHosts = context.config.careers_lookup.skip_hosts;
    const website = company.website_url === null ? pickWebsite(await search(context, base, company.name), company.company_key, skipHosts) : null;
    const rejected = company.careers_rejected === null ? [] : (JSON.parse(company.careers_rejected) as string[]);
    const careersSearch = { website: website?.url ?? company.website_url, key: company.company_key, skipHosts, rejected };
    const careers = company.careers_url === null ? pickCareers(await search(context, base, `${company.name} careers`), careersSearch) : null;
    await context.companies.recordSearch(company.id, { website, careers }, context.now().toISOString());
    context.trace.write({ type: "company_search", company: company.name, website: outcome(website), careers: outcome(careers) });
}

/** Runs one SearXNG query within the careers lookup's result and size limits. */
function search(context: ToolContext, base: string, query: string): Promise<SearchResult[]> {
    const settings = context.config.careers_lookup;
    return searchWeb(context.http, { base, query, max: settings.search_results, maxChars: settings.page_chars });
}

/** Names what happened to one address in a search, for the trace. */
function outcome(pick: AddressPick | null): string {
    if (pick === null) return "kept";
    return pick.url === null ? (pick.reason ?? "no_match") : "found";
}

/** Marks the companies left unsearched as unavailable and traces why, so each is tried again a day later. */
async function markRest(context: ToolContext, rest: CompanyRow[], reason: "not_configured" | "failed"): Promise<void> {
    if (rest.length === 0) return;
    await context.companies.markUnavailable(
        rest.map((company) => company.id),
        context.now().toISOString(),
    );
    context.trace.write({ type: "company_search_unavailable", reason, skipped: rest.length });
}
