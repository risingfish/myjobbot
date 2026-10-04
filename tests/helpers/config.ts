import { fileConfigSchema, type FileConfig } from "../../src/config/schema.js";

export function testFileConfig(overrides: Record<string, unknown> = {}): FileConfig {
  return fileConfigSchema.parse({
    companies: [{ name: "Stripe", ats: "greenhouse", slug: "stripe" }],
    ...overrides,
  });
}

export const TEST_SEARCH = { name: "Backend remote", query: "senior backend engineer", remote_only: true };
