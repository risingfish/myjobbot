import { expect, test } from "vitest";
import { searchCompanies } from "../src/companies/searchCompanies.js";
import { searxngJson } from "./helpers/careersPages.js";
import { testAppSettings } from "./helpers/config.js";
import { TEST_NOW, testContext } from "./helpers/context.js";
import { newTables, type Row, type Tables } from "./helpers/memoryJobViews.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { memoryTrace } from "./helpers/trace.js";

const NO_SEARCH = { website_url: null, careers_url: null, careers_source: null, searched_at: null, website_reason: null, website_rejected: null, careers_reason: null, careers_rejected: null };

function company(id: number, name: string, overrides: Partial<Row> = {}): Row {
    return { id, company_key: name.toLowerCase(), name, created_date: "2026-09-01T00:00:00.000Z", last_found_date: `2026-10-0${id}T00:00:00.000Z`, ...NO_SEARCH, ...overrides };
}

function searxng(byQuery: Record<string, string[]>, failAfter = Infinity) {
    const queries: string[] = [];
    const getJson = async (url: string) => {
        const query = new URL(url).searchParams.get("q") ?? "";
        if (queries.length >= failAfter) throw new Error("GET https://search.example/search failed with HTTP 429");
        queries.push(query);
        return searxngJson((byQuery[query] ?? []).map((address) => ({ url: address, title: "" })));
    };
    return { queries, getJson };
}

function setup(companies: Row[], http: ReturnType<typeof searxng>, options: { maxPerRun?: number; searxng?: string | null } = {}) {
    const tables: Tables = { ...newTables(), companies };
    const trace = memoryTrace();
    const context = testContext({ http, trace, config: testAppSettings({ company_search: { max_per_run: options.maxPerRun ?? 50 } }) }, memoryStores(tables));
    context.careers.searxngUrl = options.searxng === undefined ? "https://search.example" : options.searxng;
    return { context, tables, trace };
}

test("a due company with no addresses is searched for its website, then its careers page, and the search is traced", async () => {
    const http = searxng({ Acme: ["https://www.acme.com/about"], "Acme careers": ["https://acme.com/careers"] });
    const { context, tables, trace } = setup([company(1, "Acme")], http);
    await searchCompanies(context);
    expect(http.queries).toEqual(["Acme", "Acme careers"]);
    expect(tables.companies[0]).toMatchObject({ website_url: "https://www.acme.com", careers_url: "https://acme.com/careers", careers_source: "search", searched_at: TEST_NOW.toISOString() });
    expect(trace.events).toEqual([{ type: "company_search", company: "Acme", website: "found", careers: "found" }]);
});

test("a company whose careers page is its configured board is searched only for its website", async () => {
    const http = searxng({ Acme: ["https://acme.com/"] });
    await searchCompanies(setup([company(1, "Acme", { careers_url: "https://jobs.lever.co/acme", careers_source: "board" })], http).context);
    expect(http.queries).toEqual(["Acme"]);
});

test("a run searches at most its limit, the most recently found first", async () => {
    const http = searxng({});
    await searchCompanies(setup([company(1, "Oldest"), company(3, "Newest"), company(2, "Middle")], http, { maxPerRun: 2 }).context);
    expect(http.queries).toEqual(["Newest", "Newest careers", "Middle", "Middle careers"]);
});

test("a search whose results don't pass the rules keeps the reason and the turned-down addresses", async () => {
    const { context, tables } = setup([company(1, "Acme")], searxng({ Acme: ["https://www.linkedin.com/company/acme", "https://acme-fans.example.org/"] }));
    await searchCompanies(context);
    expect(tables.companies[0]).toMatchObject({ website_url: null, website_reason: "no_match", website_rejected: JSON.stringify(["https://www.linkedin.com/company/acme", "https://acme-fans.example.org/"]), careers_reason: "no_results" });
});

test("when SearXNG fails part-way, the companies left are marked unavailable and the run carries on", async () => {
    const { context, tables, trace } = setup([company(2, "First"), company(1, "Second")], searxng({ First: ["https://first.com/"] }, 2));
    await searchCompanies(context);
    expect(tables.companies.map((row) => [row.name, row.website_reason])).toEqual([
        ["First", null],
        ["Second", "search_unavailable"],
    ]);
    expect(tables.companies[1]).toMatchObject({ careers_reason: "search_unavailable", searched_at: TEST_NOW.toISOString() });
    expect(trace.events.at(-1)).toEqual({ type: "company_search_unavailable", reason: "failed", skipped: 1 });
});

test("without a SearXNG address nothing is searched, and the companies due are marked unavailable", async () => {
    const http = searxng({});
    const { context, tables, trace } = setup([company(1, "Acme"), company(2, "Beta")], http, { searxng: null });
    await searchCompanies(context);
    expect([http.queries, tables.companies.map((row) => row.website_reason)]).toEqual([[], ["search_unavailable", "search_unavailable"]]);
    expect(trace.events).toEqual([{ type: "company_search_unavailable", reason: "not_configured", skipped: 2 }]);
});

test("a limit of zero turns the search off, without marking anything", async () => {
    const http = searxng({});
    const { context, tables } = setup([company(1, "Acme")], http, { maxPerRun: 0 });
    await searchCompanies(context);
    expect([http.queries, tables.companies[0]?.searched_at]).toEqual([[], null]);
});
