import { expect, test } from "vitest";
import { loadConfig } from "../src/config/load.js";
import { testFileConfig } from "./helpers/config.js";
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

test("config rejects filter terms without a letter or digit", () => {
  expect(() => testFileConfig({ title_filter: { exclude: ["++"] } })).toThrow(/letter or digit/);
});

test("config rejects duplicate company names ignoring case", () => {
  const companies = [
    { name: "Stripe", ats: "greenhouse", slug: "stripe" },
    { name: "stripe", ats: "greenhouse", slug: "stripe-two" },
  ];
  expect(() => testFileConfig({ companies })).toThrow(/company names must be unique/);
});

test("loadConfig requires LLM settings", () => {
  expect(() => loadConfig({ MYJOBBOT_DATA_DIR: makeDataDir() })).toThrow(/LLM_BASE_URL/);
});
