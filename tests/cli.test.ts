import { expect, test } from "vitest";
import { runCli } from "./helpers/cli.js";
import { makeDataDir } from "./helpers/dataDir.js";

test("cli prints usage and exits 2 without a command", () => {
  const result = runCli([]);
  expect(result.status).toBe(2);
  expect(result.stderr).toContain("usage: myjobbot run | serve");
});

test("cli reports configuration errors readably", () => {
  const env = { MYJOBBOT_DATA_DIR: makeDataDir(), LLM_BASE_URL: "not a url", LLM_MODEL: "m", LLM_API_KEY: "k" };
  const result = runCli(["run"], env);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("myjobbot:");
  expect(result.stderr).toContain("LLM_BASE_URL");
});
