import { fileConfigSchema, type FileConfig } from "../../src/config/schema.js";

export function testFileConfig(overrides: Record<string, unknown> = {}): FileConfig {
  return fileConfigSchema.parse({
    companies: [{ name: "Stripe", ats: "greenhouse", slug: "stripe" }],
    ...overrides,
  });
}
