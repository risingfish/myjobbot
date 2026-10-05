import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadConfig } from "../src/config/load.js";
import { TEST_SEARCH, testFileConfig } from "./helpers/config.js";
import { makeDataDir, SAMPLE_CONFIG, TEST_ENV } from "./helpers/dataDir.js";

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
  expect(() => testFileConfig({ title_filter: { extra_exclude: ["++"] } })).toThrow(/letter or digit/);
});

test("title boosts default to none and need 1-100 points per term", () => {
  expect(testFileConfig().title_boosts).toEqual({});
  expect(testFileConfig({ title_boosts: { typescript: 10 } }).title_boosts).toEqual({ typescript: 10 });
  expect(() => testFileConfig({ title_boosts: { typescript: 0 } })).toThrow();
  expect(() => testFileConfig({ title_boosts: { typescript: 101 } })).toThrow();
  expect(() => testFileConfig({ title_boosts: { "++": 10 } })).toThrow(/letter or digit/);
});

test("exclude_companies defaults to none and needs a letter or digit per name", () => {
  expect(testFileConfig().exclude_companies).toEqual([]);
  expect(() => testFileConfig({ exclude_companies: ["--"] })).toThrow(/letter or digit/);
});

test("extra_exclude adds to the default exclude terms", () => {
  const exclude = testFileConfig({ title_filter: { extra_exclude: ["staff", "principal"] } }).title_filter.exclude;
  expect(exclude).toEqual(expect.arrayContaining(["intern", "manager", "staff", "principal"]));
});

test("extra_exclude adds to a custom exclude list", () => {
  const filter = { exclude: ["sales"], extra_exclude: ["lead"] };
  expect(testFileConfig({ title_filter: filter }).title_filter.exclude).toEqual(["sales", "lead"]);
});

test("config rejects duplicate company names ignoring case", () => {
  const companies = [
    { name: "Stripe", ats: "greenhouse", slug: "stripe" },
    { name: "stripe", ats: "greenhouse", slug: "stripe-two" },
  ];
  expect(() => testFileConfig({ companies })).toThrow(/names must be unique/);
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

test("config applies search and JSearch defaults", () => {
  const config = testFileConfig({ searches: [TEST_SEARCH] });
  expect(config.searches[0]).toEqual({ ...TEST_SEARCH, country: "us" });
  expect(config.jsearch).toEqual({ monthly_request_cap: 190, refresh_hours: 24, date_posted: "3days" });
});

test("config accepts searches without companies", () => {
  expect(testFileConfig({ companies: [], searches: [TEST_SEARCH] }).companies).toEqual([]);
});

test("config needs at least one company or search", () => {
  expect(() => testFileConfig({ companies: [] })).toThrow(/at least one company or search/);
});

test("config rejects a search named like a company", () => {
  expect(() => testFileConfig({ searches: [{ ...TEST_SEARCH, name: "stripe" }] })).toThrow(/names must be unique/);
});

test("config rejects more searches than the JSearch budget allows", () => {
  const searches = Array.from({ length: 7 }, (_, index) => ({ ...TEST_SEARCH, name: `Search ${index}` }));
  expect(() => testFileConfig({ searches })).toThrow(/monthly_request_cap/);
  expect(testFileConfig({ searches: searches.slice(0, 6) }).searches).toHaveLength(6);
});

test("loadConfig requires JSEARCH_API_KEY when searches are configured", () => {
  const dir = makeDataDir({ ...SAMPLE_CONFIG, searches: [TEST_SEARCH] });
  expect(() => loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir })).toThrow("JSEARCH_API_KEY is required when searches are configured");
  expect(loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir, JSEARCH_API_KEY: "k" }).file.searches).toHaveLength(1);
});
