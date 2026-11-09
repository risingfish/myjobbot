import { expect, test } from "vitest";
import { OWNER_ID } from "../src/db/owner.js";
import { userSourceStore } from "../src/db/sourceStore.js";
import { deleteSaved, switchSourceOn } from "../src/web/switchSource.js";
import { newTables } from "./helpers/memoryJobViews.js";
import { MemorySourceStore } from "./helpers/memorySourceStore.js";

const AT = "2026-11-09T10:00:00.000Z";
const SEARCH = { module: "jsearch", name: "Backend", params: { query: "backend", country: "us", remote_only: false }, target: "jsearch:backend|us|false", enabled: false };
const ALERTS = { module: "gmail_alerts", name: "Gmail alerts", params: {}, target: "gmail_alerts", enabled: true };

async function stored() {
    const store = new MemorySourceStore(newTables());
    const sources = userSourceStore(store, OWNER_ID);
    const search = await sources.save(SEARCH, AT);
    await sources.ensureAccountSource({ module: ALERTS.module, name: ALERTS.name }, AT);
    const alerts = (await sources.list()).find((source) => source.module === "gmail_alerts");
    return { sources, search, alerts };
}

test("turning a search on is refused when the month's JSearch budget can't fit it, and allowed when it can", async () => {
    const { sources, search } = await stored();
    const deps = (cap: number) => ({ sources, onForAll: async () => [], userId: OWNER_ID, jsearch: { monthly_request_cap: cap, refresh_hours: 24 }, now: () => new Date(AT) });
    expect(await switchSourceOn(deps(1), { id: search.id, on: true })).toEqual({ ok: false, problem: "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours" });
    expect(await switchSourceOn(deps(200), { id: search.id, on: true })).toEqual({ ok: true });
    expect((await sources.list()).find((source) => source.id === search.id)?.enabled).toBe(true);
});

test("an account source such as Gmail alerts can't be deleted, and a saved one can", async () => {
    const { sources, search, alerts } = await stored();
    expect([await deleteSaved({ sources }, alerts?.id ?? 0), await deleteSaved({ sources }, search.id)]).toEqual([{ ok: false }, { ok: true }]);
    expect((await sources.list()).map((source) => source.module)).toEqual(["gmail_alerts"]);
});
