import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
  const dir = makeDataDir({ companies: [{ name: "X", ats: "workday", slug: "x" }] });
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

test("config rejects retention not longer than ghost threshold", () => {
  const overrides = { ghost_threshold_days: 90, job_retention_days: 60 };
  expect(() => testFileConfig(overrides)).toThrow(/job_retention_days/);
});

test("loadConfig reports invalid JSON readably", () => {
  const dir = makeDataDir();
  writeFileSync(join(dir, "config.json"), "{ not json");
  expect(() => loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir })).toThrow(/config.json is not valid JSON/);
});

test("loadConfig asks to convert a leftover config.yaml", () => {
  const dir = makeDataDir();
  rmSync(join(dir, "config.json"));
  writeFileSync(join(dir, "config.yaml"), "companies: []\n");
  expect(() => loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir })).toThrow(/config is now JSON: convert .*config.yaml to .*config.json/);
});
