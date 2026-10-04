import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SAMPLE_CONFIG = `companies:
  - { name: Stripe, ats: greenhouse, slug: stripe }
  - { name: Palantir, ats: lever, slug: palantir }
preferences: Remote US, senior backend
`;

export const TEST_ENV = {
  LLM_BASE_URL: "http://127.0.0.1:9/v1",
  LLM_MODEL: "test-model",
  LLM_API_KEY: "test-key",
  MYJOBBOT_LOG_DIR: mkdtempSync(join(tmpdir(), "myjobbot-log-")),
};

export function makeDataDir(config = SAMPLE_CONFIG): string {
  const dir = mkdtempSync(join(tmpdir(), "myjobbot-"));
  writeFileSync(join(dir, "config.yaml"), config);
  writeFileSync(join(dir, "resume.md"), "# Jane Doe\nSenior backend engineer, Go and TypeScript.\n");
  return dir;
}
