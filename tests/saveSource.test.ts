import { expect, test } from "vitest";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { HttpStatusError } from "../src/http/errors.js";
import type { SourceHttp } from "../src/sources/module.js";
import { saveSource } from "../src/web/saveSource.js";
import { testAppSettings } from "./helpers/config.js";
import { loadFixture } from "./helpers/fixtures.js";
import { routedHttp } from "./helpers/http.js";
import { newTables } from "./helpers/memoryJobViews.js";
import { MemorySourceStore } from "./helpers/memorySourceStore.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { numbered, WORKDAY_PARAMS, workdaySite } from "./helpers/workdaySite.js";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const JSEARCH = testAppSettings().jsearch;

function setup(http: SourceHttp) {
    const tables = newTables();
    const store = new MemorySourceStore(tables);
    const apiCalls = memoryStores(tables).apiCalls;
    const deps = { store, facts: { limits: JSEARCH, met: { jsearch_key: true, gmail: true } }, test: { access: { http, jsearch: { apiKey: "key", settings: JSEARCH } }, apiCalls }, now: () => NOW };
    return { store, apiCalls, deps };
}

const refusing: SourceHttp = { getJson: () => Promise.reject(new HttpStatusError("GET https://boards-api.greenhouse.io/v1/boards/nope/jobs failed with HTTP 404", 404)), postJson: () => Promise.reject(new Error("no posts")) };

test("a source whose test fetch fails is still saved, and marked failing with its reason", async () => {
    const { store, deps } = setup(refusing);
    expect(await saveSource(deps, { id: null, module: "greenhouse", name: "Nope", values: { slug: "nope" } })).toEqual({ ok: true, test: { ok: false, reason: "not found" } });
    expect(await store.list(OWNER_ID)).toMatchObject([{ name: "Nope", enabled: true, last: { at: NOW.toISOString(), outcome: "failing", jobs: 0, reason: "not found" } }]);
});

test("editing a source's fields starts its fetching over, and a passing test is recorded with the jobs it found", async () => {
    const { store, deps } = setup(workdaySite(numbered(3)).http);
    store.seed(OWNER_ID, [{ id: 4, module: "workday", name: "Acme", params: { ...WORKDAY_PARAMS, site: "Old" }, target: "workday:acme.wd5.myworkdayjobs.com/old", enabled: true, companyId: null, cursor: { offset: 40 }, last: null }]);
    const values = { host: WORKDAY_PARAMS.host, tenant: "acme", site: WORKDAY_PARAMS.site };
    expect(await saveSource(deps, { id: 4, module: "workday", name: "Acme", values })).toEqual({ ok: true, test: { ok: true, jobs: 3 } });
    expect(await store.list(OWNER_ID)).toMatchObject([{ id: 4, params: WORKDAY_PARAMS, cursor: null, last: { outcome: "ok", jobs: 3 } }]);
});

test("a JSearch test spends one request and leaves the search due, and a Workday test reads the listing only", async () => {
    const http = routedHttp({ "api.openwebninja.com": loadFixture("jsearch.json") });
    const search = setup(http);
    const saved = await saveSource(search.deps, { id: null, module: "jsearch", name: "Go", values: { query: "go", country: "" } });
    expect([saved.ok, http.requests.length, await search.apiCalls.countSince("jsearch", "2026-10-01T00:00:00.000Z")]).toEqual([true, 1, 1]);
    expect(await search.store.list(OWNER_ID)).toMatchObject([{ params: { query: "go", country: "us", remote_only: false }, last: null }]);
    const site = workdaySite(numbered(25));
    const details: string[] = [];
    const workday = setup({ ...site.http, getJson: async (url) => void details.push(url) });
    await saveSource(workday.deps, { id: null, module: "workday", name: "Acme", values: WORKDAY_PARAMS });
    expect([site.posts.length, details]).toEqual([1, []]);
});
