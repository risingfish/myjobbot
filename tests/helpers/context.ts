import { JobStore } from "../../src/db/jobStore.js";
import { openDatabase } from "../../src/db/open.js";
import { newRunState, type ToolContext } from "../../src/tools/context.js";
import { testFileConfig } from "./config.js";
import { memoryTrace } from "./trace.js";

export const TEST_NOW = new Date("2026-10-03T12:00:00.000Z");

export function testContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    config: testFileConfig(),
    run: newRunState(),
    store: new JobStore(openDatabase(":memory:")),
    http: { getJson: () => Promise.reject(new Error("unexpected HTTP request in test")) },
    now: () => TEST_NOW,
    jobLog: memoryTrace(),
    ...overrides,
  };
}
