import type { Stores } from "../../src/db/store.js";
import { dataMarkers } from "../../src/agent/markers.js";
import { PageRenderer } from "../../src/careers/renderState.js";
import { newRunState, type ToolContext } from "../../src/tools/context.js";
import { testFileConfig } from "./config.js";
import { memoryStores } from "./memoryStore.js";
import { memoryTrace } from "./trace.js";

export const TEST_NOW = new Date("2026-10-03T12:00:00.000Z");
export const TEST_RUN_ID = "3f2b8c1e-9a7d-4e21-b0c3-5d6e7f8a9b0c";

export function testContext(overrides: Partial<ToolContext> = {}, stores: Stores = memoryStores()): ToolContext {
    return {
        config: testFileConfig(),
        run: newRunState(),
        runId: "test-run",
        store: stores.jobStore,
        apiCalls: stores.apiCalls,
        http: { getJson: () => Promise.reject(new Error("unexpected HTTP request in test")) },
        now: () => TEST_NOW,
        jobLog: memoryTrace(),
        jsearchApiKey: "test-jsearch-key",
        gmail: { store: stores.gmail, alerts: stores.alerts, key: { status: "missing" }, usable: "Gmail not connected" },
        trace: memoryTrace(),
        chat: () => Promise.reject(new Error("unexpected LLM call in test")),
        careers: { store: stores.careers, searxngUrl: null, lookup: () => Promise.reject(new Error("unexpected DNS lookup in test")), pages: { getText: () => Promise.reject(new Error("unexpected page fetch in test")) }, boards: { getJson: () => Promise.reject(new Error("unexpected board request in test")), postJson: () => Promise.reject(new Error("unexpected board request in test")) }, renderer: offRenderer(stores) },
        markers: dataMarkers(TEST_RUN_ID),
        ...overrides,
    };
}

function offRenderer(stores: Stores): PageRenderer {
    return new PageRenderer({ connect: null, settings: testFileConfig().careers_lookup, lookup: () => Promise.reject(new Error("unexpected DNS lookup in test")), careers: stores.careers, trace: memoryTrace(), runId: "test-run", now: () => TEST_NOW });
}

export function doneContext(): ToolContext {
    const context = testContext();
    context.run.fetches.set("Stripe", Promise.resolve({ seen: TEST_NOW.toISOString(), note: null }));
    return context;
}
