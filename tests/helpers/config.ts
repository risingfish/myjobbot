import type { AppConfig } from "../../src/config/load.js";
import { envSchema, fileConfigSchema, type FileConfig } from "../../src/config/schema.js";

export function testFileConfig(overrides: Record<string, unknown> = {}): FileConfig {
    return fileConfigSchema.parse({
        companies: [{ name: "Stripe", ats: "greenhouse", slug: "stripe" }],
        ...overrides,
    });
}

export const SAMPLE_CONFIG = {
    companies: [
        { name: "Stripe", ats: "greenhouse", slug: "stripe" },
        { name: "Palantir", ats: "lever", slug: "palantir" },
    ],
    preferences: "Remote US, senior backend",
};

export const LLM_ENV = { LLM_BASE_URL: "http://127.0.0.1:9/v1", LLM_MODEL: "test-model", LLM_API_KEY: "test-key" };

export const TEST_SEARCH = { name: "Backend remote", query: "senior backend engineer", remote_only: true };

export function testAppConfig(overrides: Record<string, unknown> = {}): AppConfig {
    const env = envSchema.parse(LLM_ENV);
    return { env, file: testFileConfig(overrides), resume: "# Jane Doe\nSenior backend engineer, Go and TypeScript.\n", dataDir: "unused" };
}
