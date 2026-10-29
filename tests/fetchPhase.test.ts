import { expect, test } from "vitest";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import type { SavedSource } from "../src/db/sourceStore.js";
import { HttpStatusError } from "../src/http/errors.js";
import { fetchSources } from "../src/sources/fetchPhase.js";
import type { SourceHttp } from "../src/sources/module.js";
import { sourceHttp } from "../src/sources/sourceHttp.js";
import type { ToolContext } from "../src/tools/context.js";
import { alertContext } from "./helpers/alertContext.js";
import { alertEmail, fixtureJobs, SEARCH_SENDER, searchAlert } from "./helpers/alertEmails.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { TEST_NOW, testContext } from "./helpers/context.js";
import { publicDns } from "./helpers/fakeDns.js";
import { loadFixture } from "./helpers/fixtures.js";
import { routedHttp } from "./helpers/http.js";
import { newTables } from "./helpers/memoryJobViews.js";
import { MemorySourceStore } from "./helpers/memorySourceStore.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { memoryTrace } from "./helpers/trace.js";
import { numbered, WORKDAY_PARAMS, workdaySite } from "./helpers/workdaySite.js";

const HOUR = 3_600_000;
const SEARCH = { query: "senior backend engineer", remote_only: true };

function source(id: number, fields: Pick<SavedSource, "module" | "name" | "params"> & Partial<SavedSource>): SavedSource {
    return { id, target: `${fields.module}:${id}`, enabled: true, companyId: null, cursor: null, last: null, ...fields };
}

function fetchedAt(hoursAgo: number): Partial<SavedSource> {
    return { last: { at: new Date(TEST_NOW.getTime() - hoursAgo * HOUR).toISOString(), outcome: "ok", jobs: 1, cost: 1, reason: null } };
}

function boardsAndSearch(): SourceHttp {
    return { ...routedHttp({ "boards-api.greenhouse.io": greenhouseBoard(["Backend Engineer"]), "api.openwebninja.com": loadFixture("jsearch.json") }), postJson: () => Promise.reject(new Error("no POST here")) };
}

function phaseContext(list: SavedSource[], http: SourceHttp = boardsAndSearch(), base?: ToolContext) {
    const tables = newTables();
    const sources = new MemorySourceStore(tables);
    sources.seed(OWNER_ID, list);
    const trace = memoryTrace();
    const context = { ...(base ?? testContext({}, memoryStores(tables))), trace, saved: { store: sources, list }, sources: sourceHttp({ http, lookup: publicDns() }) };
    return { context, sources, trace };
}

function steps(trace: ReturnType<typeof memoryTrace>) {
    return trace.events.filter((event) => event.type === "source_fetch" || event.type === "source_skipped").map((event) => [event.type, event.source, event.reason ?? event.outcome]);
}

async function recorded(sources: MemorySourceStore) {
    return (await sources.list(OWNER_ID)).map(({ name, cursor, last }) => ({ name, cursor, outcome: last?.outcome ?? null, reason: last?.reason ?? null }));
}

test("sources are fetched one at a time, company sources first, then Gmail alerts, then searches, and the rest are skipped with a reason", async () => {
    const list = [source(1, { module: "jsearch", name: "Backend remote", params: SEARCH }), source(2, { module: "gmail_alerts", name: "Gmail alerts", params: {} }), source(3, { module: "greenhouse", name: "Stripe", params: { slug: "stripe" } }), source(4, { module: "lever", name: "Off", params: { slug: "off" }, enabled: false })];
    const { context, trace } = phaseContext(list);
    await fetchSources(context);
    expect(steps(trace)).toEqual([
        ["source_fetch", "Stripe", "ok"],
        ["source_skipped", "Off", "off"],
        ["source_skipped", "Gmail alerts", "not set up"],
        ["source_fetch", "Backend remote", "ok"],
    ]);
    expect([...context.run.sources.keys()]).toEqual(["Stripe", "Gmail alerts", "Backend remote"]);
});

test("a source whose module isn't shipped, or whose fields fail its rules, is skipped and fetches nothing", async () => {
    const { context, trace } = phaseContext([source(1, { module: "taleo", name: "Taleo Co", params: { slug: "x" } }), source(2, { module: "greenhouse", name: "Blank", params: { slug: "" } })]);
    await fetchSources(context);
    expect(steps(trace)).toEqual([
        ["source_skipped", "Taleo Co", "unknown module"],
        ["source_skipped", "Blank", "invalid fields"],
    ]);
});

test("a saved search is due once its last fetch is refresh_hours old, less the 15-minute leeway", async () => {
    const list = [source(1, { module: "jsearch", name: "Almost a day", params: SEARCH, ...fetchedAt(24 - 10 / 3600) }), source(2, { module: "jsearch", name: "Seven hours", params: { ...SEARCH, country: "ca" }, ...fetchedAt(7) })];
    const { context, trace } = phaseContext(list);
    await fetchSources(context);
    expect(steps(trace)).toEqual([
        ["source_fetch", "Almost a day", "ok"],
        ["source_skipped", "Seven hours", "not due"],
    ]);
});

test("a source that reaches its job limit before its last page is recorded partial with where it stopped, and the next run continues from there", async () => {
    const site = workdaySite(numbered(130));
    const first = phaseContext([source(1, { module: "workday", name: "Acme", params: WORKDAY_PARAMS })], site.http);
    await fetchSources(first.context);
    expect(await recorded(first.sources)).toEqual([{ name: "Acme", cursor: { offset: 100 }, outcome: "partial", reason: null }]);
    const next = phaseContext(await first.sources.list(OWNER_ID), site.http);
    await fetchSources(next.context);
    expect([site.posts.at(5), await recorded(next.sources)]).toEqual([expect.objectContaining({ body: expect.objectContaining({ offset: 100 }) }), [{ name: "Acme", cursor: null, outcome: "ok", reason: null }]]);
});

test("after the last page the cursor is cleared, so the next run starts from the first page", async () => {
    const site = workdaySite(numbered(30));
    const first = phaseContext([source(1, { module: "workday", name: "Acme", params: WORKDAY_PARAMS, cursor: { offset: 20 } })], site.http);
    await fetchSources(first.context);
    await fetchSources(phaseContext(await first.sources.list(OWNER_ID), site.http).context);
    expect(site.posts.map((post) => (post as { body: { offset: number } }).body.offset)).toEqual([20, 0, 20]);
});

test("a failing source is recorded failing with a fixed reason, and every other source is still fetched", async () => {
    const http: SourceHttp = {
        getJson: async (url) => (url.includes("greenhouse") ? Promise.reject(new HttpStatusError(`GET ${url} failed with HTTP 404`, 404)) : loadFixture("lever.json")),
        postJson: () => Promise.reject(new Error("no POST here")),
    };
    const { context, sources, trace } = phaseContext([source(1, { module: "greenhouse", name: "Gone", params: { slug: "gone" } }), source(2, { module: "lever", name: "Palantir", params: { slug: "palantir" } })], http);
    await fetchSources(context);
    expect(await recorded(sources)).toEqual([
        { name: "Gone", cursor: null, outcome: "failing", reason: "not found" },
        { name: "Palantir", cursor: null, outcome: "ok", reason: null },
    ]);
    expect(JSON.stringify(trace.events)).not.toContain("HTTP 404");
});

test("a saved search is skipped when this month's requests plus its cost would pass the cap", async () => {
    const { context, trace } = phaseContext([source(1, { module: "jsearch", name: "Backend remote", params: SEARCH })]);
    for (let index = 0; index < 190; index += 1) await context.apiCalls.record("jsearch", "other", TEST_NOW.toISOString());
    await fetchSources(context);
    expect(steps(trace)).toEqual([["source_skipped", "Backend remote", "budget used"]]);
});

test("each fetch traces its pages, jobs, cost and outcome, and a search's cost counts against the month's budget", async () => {
    const { context, trace } = phaseContext([source(1, { module: "jsearch", name: "Backend remote", params: SEARCH })]);
    await fetchSources(context);
    const jobs = (loadFixture("jsearch.json") as { data: { jobs: unknown[] } }).data.jobs.length;
    expect(trace.events.find((event) => event.type === "source_fetch")).toEqual({ type: "source_fetch", source: "Backend remote", module: "jsearch", pages: 1, jobs, cost: 1, outcome: "ok" });
    expect(await context.apiCalls.countSince("jsearch", "2026-10-01T00:00:00.000Z")).toBe(1);
});

test("after the Gmail alerts source, the alert state is recorded and the careers lookup runs for alert jobs", async () => {
    const base = await alertContext({}, [alertEmail(10, SEARCH_SENDER, searchAlert(fixtureJobs(2), "senior engineer"))]);
    const { context, sources } = phaseContext([source(1, { module: "gmail_alerts", name: "Gmail alerts", params: {} })], boardsAndSearch(), base);
    await fetchSources(context);
    expect([(await context.gmail.alerts.state())?.jobs_found, context.trace.events.some((event) => event.type === "careers"), (await recorded(sources))[0]?.outcome]).toEqual([2, true, "ok"]);
});

test("a source whose fetch can't even be recorded is traced by a fixed reason, and the next source is still fetched", async () => {
    const list = [source(1, { module: "greenhouse", name: "Stripe", params: { slug: "stripe" } }), source(2, { module: "jsearch", name: "Backend remote", params: SEARCH })];
    const { context, sources, trace } = phaseContext(list);
    const recordFetch = sources.recordFetch.bind(sources);
    sources.recordFetch = async (key, outcome, cursor) => (key.id === 1 ? Promise.reject(new Error("database gone: secret detail")) : recordFetch(key, outcome, cursor));
    await fetchSources(context);
    expect(trace.events.filter((event) => event.type === "source_fetch_failed")).toEqual([{ type: "source_fetch_failed", source: "Stripe", reason: "unexpected answer" }]);
    expect([(await recorded(sources))[1]?.outcome, JSON.stringify(trace.events).includes("secret detail")]).toEqual(["ok", false]);
});
