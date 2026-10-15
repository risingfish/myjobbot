import { expect, test } from "vitest";
import type { Environment } from "../src/config/load.js";
import { appConfigFrom, parseFileConfig } from "../src/config/parse.js";
import { LLM_ENV, SAMPLE_CONFIG, TEST_SEARCH, testFileConfig } from "./helpers/config.js";

function configFrom(environment: Environment, config: object = SAMPLE_CONFIG) {
    return appConfigFrom(environment, { configText: JSON.stringify(config), resume: "# Jane Doe", dataDir: "data" });
}

test("the app config applies defaults", () => {
    const config = configFrom(LLM_ENV);
    expect(config.file.companies).toHaveLength(2);
    expect(config.file.match_threshold).toBe(70);
    expect(config.file.http.min_interval_ms).toBe(1000);
    expect(config.file.title_filter.include).toContain("engineer");
    expect(config.resume).toContain("Jane Doe");
});

test("config.json parses without any LLM settings", () => {
    const file = parseFileConfig(JSON.stringify(SAMPLE_CONFIG));
    expect(file.companies).toHaveLength(2);
    expect(file.match_threshold).toBe(70);
});

test("config rejects an unknown board type", () => {
    expect(() => configFrom(LLM_ENV, { companies: [{ name: "X", ats: "workday", slug: "x" }] })).toThrow(/ats/);
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

test("jsearch.exclude_publishers needs a letter or digit per name", () => {
    expect(() => testFileConfig({ jsearch: { exclude_publishers: ["--"] } })).toThrow(/letter or digit/);
});

test("jsearch.exclude_publishers rejects malformed domain entries by name", () => {
    for (const entry of ["trabajo.*", "https://trabajo.org/", "trabajo.org:443", "*.com"]) {
        expect(() => testFileConfig({ jsearch: { exclude_publishers: [entry] } })).toThrow(`'${entry}' is not a valid domain entry`);
    }
    const entries = ["dailyremote", "jobmesh.io", "*.trabajo.org"];
    expect(testFileConfig({ jsearch: { exclude_publishers: entries } }).jsearch.exclude_publishers).toEqual(entries);
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

test("the app config requires LLM settings", () => {
    expect(() => configFrom({})).toThrow(/LLM_BASE_URL/);
});

test("config rejects retention not longer than ghost threshold", () => {
    const overrides = { ghost_threshold_days: 90, job_retention_days: 60 };
    expect(() => testFileConfig(overrides)).toThrow(/job_retention_days/);
});

test("config.json that isn't valid JSON is reported readably", () => {
    expect(() => parseFileConfig("{ not json")).toThrow(/config.json is not valid JSON/);
});

test("config applies search and JSearch defaults", () => {
    const config = testFileConfig({ searches: [TEST_SEARCH] });
    expect(config.searches[0]).toEqual({ ...TEST_SEARCH, country: "us" });
    expect(config.jsearch).toEqual({ monthly_request_cap: 190, refresh_hours: 24, date_posted: "3days", exclude_publishers: [] });
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

test("three refreshes a day fit the budget for two searches but not three", () => {
    const searches = Array.from({ length: 3 }, (_, index) => ({ ...TEST_SEARCH, name: `Search ${index}` }));
    const jsearch = { refresh_hours: 8 };
    expect(testFileConfig({ searches: searches.slice(0, 2), jsearch }).jsearch.refresh_hours).toBe(8);
    expect(() => testFileConfig({ searches, jsearch })).toThrow(/monthly_request_cap/);
});

test("the app config requires JSEARCH_API_KEY when searches are configured", () => {
    const config = { ...SAMPLE_CONFIG, searches: [TEST_SEARCH] };
    expect(() => configFrom(LLM_ENV, config)).toThrow("JSEARCH_API_KEY is required when searches are configured");
    expect(configFrom({ ...LLM_ENV, JSEARCH_API_KEY: "k" }, config).file.searches).toHaveLength(1);
});
