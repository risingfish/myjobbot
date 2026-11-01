import { expect, test } from "vitest";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import type { SavedSource } from "../src/db/sourceStore.js";
import { newRunState, type ToolContext } from "../src/tools/context.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { TEST_SEARCH, testAppSettings } from "./helpers/config.js";
import { TEST_NOW, testContext } from "./helpers/context.js";
import { loadFixture } from "./helpers/fixtures.js";
import { routedHttp } from "./helpers/http.js";
import { jsearchId } from "./helpers/jsearch.js";
import { newTables } from "./helpers/memoryJobViews.js";
import { MemorySourceStore } from "./helpers/memorySourceStore.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { savedSources, STRIPE_BOARD } from "./helpers/savedSources.js";
import { fetchRun, invokeTool, nextPage } from "./helpers/tools.js";
import { memoryTrace } from "./helpers/trace.js";

const JSEARCH_HOST = "api.openwebninja.com";
const SEARCH_NAME = TEST_SEARCH.name;
const HOUR = 3_600_000;

function fetchedHoursAgo(hours: number): { last: SavedSource["last"] } {
    return { last: { at: new Date(TEST_NOW.getTime() - hours * HOUR).toISOString(), outcome: "ok", jobs: 2, cost: 1, reason: null } };
}

function searchContext(overrides: Partial<ToolContext> = {}, { last = null, board = true }: { last?: SavedSource["last"]; board?: boolean } = {}) {
    const http = routedHttp({ [JSEARCH_HOST]: loadFixture("jsearch.json"), "boards-api.greenhouse.io": greenhouseBoard(["Backend Engineer"]) });
    const tables = newTables();
    const store = new MemorySourceStore(tables);
    store.seed(
        OWNER_ID,
        savedSources({ companies: board ? [STRIPE_BOARD] : [], searches: [TEST_SEARCH] }).map((source) => (source.module === "jsearch" ? { ...source, last } : source)),
    );
    const context = testContext({ config: testAppSettings(), http, ...overrides }, memoryStores(tables));
    context.saved = { store, list: [] };
    const jsearchRequests = () => http.requests.filter((sent) => new URL(sent.url).host === JSEARCH_HOST);
    return { context, jsearchRequests };
}

test("a saved search is fetched once a run, before the model's first turn, and next_jobs serves its jobs", async () => {
    const { context, jsearchRequests } = searchContext();
    expect(await nextPage(context, SEARCH_NAME)).toMatchObject({ source: SEARCH_NAME, total_unscored: 1 });
    await nextPage(context, SEARCH_NAME);
    expect(jsearchRequests()).toHaveLength(1);
});

test("a search is not fetched again within refresh_hours, and its unscored jobs are still offered", async () => {
    const { context, jsearchRequests } = searchContext();
    await fetchRun(context);
    const next = { ...context, run: newRunState() };
    expect(await nextPage(next, SEARCH_NAME)).toMatchObject({ total_unscored: 1 });
    expect([next.run.sources.get(SEARCH_NAME), jsearchRequests().length]).toEqual([{ outcome: "skipped", reason: "not due", seen: null }, 1]);
});

test("a search is fetched on a schedule that lands seconds short of refresh_hours", async () => {
    const { context, jsearchRequests } = searchContext({ config: testAppSettings({ jsearch: { refresh_hours: 8 } }) }, fetchedHoursAgo(8 - 10 / 3600));
    await fetchRun(context);
    expect([context.run.sources.get(SEARCH_NAME)?.outcome, jsearchRequests().length]).toEqual(["ok", 1]);
});

test("a search is not fetched well inside refresh_hours", async () => {
    const { context, jsearchRequests } = searchContext({ config: testAppSettings({ jsearch: { refresh_hours: 8 } }) }, fetchedHoursAgo(7));
    await fetchRun(context);
    expect([context.run.sources.get(SEARCH_NAME)?.reason, jsearchRequests().length]).toEqual(["not due", 0]);
});

test("a search whose last fetch failed is tried again on the next run, inside refresh_hours", async () => {
    const failing = { last: { at: new Date(TEST_NOW.getTime() - HOUR).toISOString(), outcome: "failing" as const, jobs: 0, cost: 0, reason: "refused" } };
    const { context, jsearchRequests } = searchContext({}, failing);
    await fetchRun(context);
    expect([context.run.sources.get(SEARCH_NAME)?.outcome, jsearchRequests().length]).toEqual(["ok", 1]);
});

test("a search is not fetched once the monthly budget is used", async () => {
    const { context, jsearchRequests } = searchContext();
    for (let index = 0; index < 190; index += 1) await context.apiCalls.record("jsearch", "other", TEST_NOW.toISOString());
    expect(await nextPage(context, SEARCH_NAME)).toMatchObject({ total_unscored: 0 });
    expect([context.run.sources.get(SEARCH_NAME)?.reason, jsearchRequests().length]).toEqual(["budget used", 0]);
});

test("JSearch results that duplicate a company-board job are skipped, since boards are fetched first", async () => {
    const { context } = searchContext();
    expect((await nextPage(context, SEARCH_NAME)).jobs.map((job) => job.job_id)).toEqual([jsearchId("js-linkedin-1")]);
});

test("each search's fetch is logged with the jobs it stored and the duplicates it skipped", async () => {
    const jobLog = memoryTrace();
    const { context } = searchContext({ jobLog });
    await fetchRun(context);
    expect(jobLog.events.at(-1)).toMatchObject({ type: "source_fetch", source: SEARCH_NAME, module: "jsearch", job_count: 1, skipped_duplicates: 1, skipped_publishers: 0 });
});

async function fetchExcluding(excludePublishers: string[]) {
    const jobLog = memoryTrace();
    const { context } = searchContext({ config: testAppSettings({ jsearch: { exclude_publishers: excludePublishers } }), jobLog }, { board: false });
    const served = (await nextPage(context, SEARCH_NAME)).jobs.map((job) => job.job_id);
    return { served, stored: (await context.store.unscoredForSource(SEARCH_NAME)).length, log: jobLog.events.at(-1) };
}

test("JSearch results from an excluded publisher are dropped before storing", async () => {
    const { served, stored, log } = await fetchExcluding(["stripe careers"]);
    expect([served, stored]).toEqual([[jsearchId("js-linkedin-1")], 1]);
    expect(log).toMatchObject({ job_count: 1, skipped_duplicates: 0, skipped_publishers: 1 });
});

test("JSearch results on an excluded domain are dropped before storing", async () => {
    const { served, stored, log } = await fetchExcluding(["stripe.com"]);
    expect([served, stored]).toEqual([[jsearchId("js-linkedin-1")], 1]);
    expect(log).toMatchObject({ job_count: 1, skipped_duplicates: 0, skipped_publishers: 1 });
});

test("a wildcard domain drops results on any subdomain", async () => {
    const { served, log } = await fetchExcluding(["*.linkedin.com"]);
    expect(served).toEqual([jsearchId("js-dup-stripe")]);
    expect(log).toMatchObject({ job_count: 1, skipped_publishers: 1 });
});

test("a result matched by a name and a domain entry is counted once", async () => {
    const { log } = await fetchExcluding(["stripe careers", "stripe.com"]);
    expect(log).toMatchObject({ job_count: 1, skipped_publishers: 1 });
});

test("list_sources shows saved searches next to boards, with how each one's fetch went", async () => {
    const { context } = searchContext();
    await fetchRun(context);
    expect(await invokeTool(context, "list_sources", {})).toEqual([
        { name: "Stripe", module: "greenhouse", fetch: "ok", total_unscored: 1 },
        { name: SEARCH_NAME, module: "jsearch", fetch: "ok", total_unscored: 1 },
    ]);
});
