import { expect, test } from "vitest";
import { loadConfig } from "../src/config/load.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";

test("loadConfig applies defaults", () => {
  const config = loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir() });
  expect(config.file.companies).toHaveLength(2);
  expect(config.file.match_threshold).toBe(70);
  expect(config.file.http.min_interval_ms).toBe(1000);
  expect(config.file.title_filter.include).toContain("engineer");
  expect(config.resume).toContain("Jane Doe");
});

test("loadConfig rejects an unknown board type", () => {
  const dir = makeDataDir("companies:\n  - { name: X, ats: workday, slug: x }\n");
  expect(() => loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir })).toThrow(/ats/);
});

test("loadConfig requires LLM settings", () => {
  expect(() => loadConfig({ MYJOBBOT_DATA_DIR: makeDataDir() })).toThrow(/LLM_BASE_URL/);
});
