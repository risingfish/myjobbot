import { searchWeb, SearchUnavailable, type SearchResult } from "../careers/searxng.js";
import type { Trace } from "../agent/trace.js";
import type { Settings } from "../config/schema.js";
import type { CompanyRow, CompanyStore } from "../db/companyStore.js";
import type { JsonGetter } from "../http/client.js";
import { pickCareers, pickWebsite, type AddressPick } from "./pickAddresses.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CompanySearchDeps {
    settings: Pick<Settings, "company_search" | "careers_lookup">;
    companies: CompanyStore;
    searxngUrl: string | null;
    http: JsonGetter;
    trace: Trace;
    now: () => Date;
}

/** Searches SearXNG for the websites and careers pages of the companies due, up to the run's limit, marking the rest unavailable when SearXNG can't be used. */
export async function searchCompanies(deps: CompanySearchDeps): Promise<void> {
    const limit = deps.settings.company_search.max_per_run;
    if (limit === 0) return;
    const due = await deps.companies.dueForSearch(limit, new Date(deps.now().getTime() - DAY_MS).toISOString());
    const base = deps.searxngUrl;
    if (base === null) return markRest(deps, due, "not_configured");
    for (const [index, company] of due.entries()) {
        if (!(await searchedOrStopped(deps, base, company))) return markRest(deps, due.slice(index), "failed");
    }
}

/** Searches one company, reporting false when SearXNG became unusable instead of throwing. */
async function searchedOrStopped(deps: CompanySearchDeps, base: string, company: CompanyRow): Promise<boolean> {
    try {
        await searchCompany(deps, base, company);
        return true;
    } catch (error) {
        if (error instanceof SearchUnavailable) return false;
        throw error;
    }
}

/** Finds whichever of a company's website and careers page it is missing, stores the outcome, and traces it. */
async function searchCompany(deps: CompanySearchDeps, base: string, company: CompanyRow): Promise<void> {
    const skipHosts = deps.settings.careers_lookup.skip_hosts;
    const website = company.website_url === null ? pickWebsite(await search(deps, base, company.name), company.company_key, skipHosts) : null;
    const rejected = company.careers_rejected === null ? [] : (JSON.parse(company.careers_rejected) as string[]);
    const careersSearch = { website: website?.url ?? company.website_url, key: company.company_key, skipHosts, rejected };
    const careers = company.careers_url === null ? pickCareers(await search(deps, base, `${company.name} careers`), careersSearch) : null;
    await deps.companies.recordSearch(company.id, { website, careers }, deps.now().toISOString());
    deps.trace.write({ type: "company_search", company: company.name, website: outcome(website), careers: outcome(careers) });
}

/** Runs one SearXNG query within the careers lookup's result and size limits. */
function search(deps: CompanySearchDeps, base: string, query: string): Promise<SearchResult[]> {
    const settings = deps.settings.careers_lookup;
    return searchWeb(deps.http, { base, query, max: settings.search_results, maxChars: settings.page_chars });
}

/** Names what happened to one address in a search, for the trace. */
function outcome(pick: AddressPick | null): string {
    if (pick === null) return "kept";
    return pick.url === null ? (pick.reason ?? "no_match") : "found";
}

/** Marks the companies left unsearched as unavailable and traces why, so each is tried again a day later. */
async function markRest(deps: CompanySearchDeps, rest: CompanyRow[], reason: "not_configured" | "failed"): Promise<void> {
    if (rest.length === 0) return;
    await deps.companies.markUnavailable(
        rest.map((company) => company.id),
        deps.now().toISOString(),
    );
    deps.trace.write({ type: "company_search_unavailable", reason, skipped: rest.length });
}
