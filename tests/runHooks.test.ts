import { expect, test } from "vitest";
import { OWNER_ID } from "../src/db/owner.js";
import { userSourceStore } from "../src/db/sourceStore.js";
import { fetchSources } from "../src/sources/fetchPhase.js";
import { gmailAlertsHook } from "../src/sources/hooks/gmailAlerts.js";
import { MODULES } from "../src/sources/registry.js";
import { hookFor } from "../src/sources/runHooks.js";
import { sourceHttp } from "../src/sources/sourceHttp.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { publicDns } from "./helpers/fakeDns.js";
import { routedHttp } from "./helpers/http.js";
import { newTables } from "./helpers/memoryJobViews.js";
import { MemorySourceStore } from "./helpers/memorySourceStore.js";
import { memoryStores } from "./helpers/memoryStore.js";

test("the Gmail alerts source has the alerts run hook", () => {
    expect(hookFor("gmail_alerts")).toBe(gmailAlertsHook);
});

test("no company board has a run hook", () => {
    expect(MODULES.filter((module) => module.kind === "ats").map((module) => hookFor(module.id))).toEqual(MODULES.filter((module) => module.kind === "ats").map(() => null));
});

test("a board source is fetched and stored without using the Gmail stores", async () => {
    const tables = newTables();
    const sources = new MemorySourceStore(tables);
    const list = [{ id: 1, module: "greenhouse", name: "Stripe", params: { slug: "stripe" }, target: "greenhouse:stripe", enabled: true, companyId: null, cursor: null, last: null }];
    sources.seed(OWNER_ID, list);
    const base = testContext({}, memoryStores(tables));
    const untouchable = new Proxy(base.gmail, { get: (target, name) => (["store", "alerts", "key", "imap"].includes(String(name)) ? Promise.reject(new Error("Gmail was used")) : Reflect.get(target, name)) });
    const http = { ...routedHttp({ "boards-api.greenhouse.io": greenhouseBoard(["Backend Engineer"]) }), postJson: () => Promise.reject(new Error("no POST here")) };
    const context = { ...base, gmail: untouchable, saved: { store: userSourceStore(sources, OWNER_ID), list }, sources: sourceHttp({ http, lookup: publicDns() }) };
    await fetchSources(context);
    expect((await context.store.unscoredForSource({ id: 1, name: "Stripe" })).map((row) => row.title)).toEqual(["Backend Engineer"]);
});
