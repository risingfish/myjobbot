import { newRunState, type ToolContext } from "../../src/tools/context.js";
import { testFileConfig } from "./config.js";

export function testContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return { config: testFileConfig(), run: newRunState(), ...overrides };
}
