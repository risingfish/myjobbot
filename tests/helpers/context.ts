import type { Stores } from "../../src/db/store.js";
import { newRunState, type ToolContext } from "../../src/tools/context.js";
import { testFileConfig } from "./config.js";
import { memoryStores } from "./memoryStore.js";
import { memoryTrace } from "./trace.js";

export const TEST_NOW = new Date("2026-10-03T12:00:00.000Z");

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
        ...overrides,
    };
}

export function doneContext(): ToolContext {
    const context = testContext();
    context.run.fetches.set("Stripe", Promise.resolve({ seen: TEST_NOW.toISOString(), note: null }));
    return context;
}
