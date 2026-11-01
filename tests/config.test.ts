import { expect, test } from "vitest";
import type { Environment } from "../src/config/load.js";
import { appConfigFrom, parseJson } from "../src/config/parse.js";
import { envSchema, settingsSchema } from "../src/config/schema.js";
import { LLM_ENV, SAMPLE_CONFIG, testAppSettings } from "./helpers/config.js";

function configFrom(environment: Environment, config: object = SAMPLE_CONFIG) {
    return appConfigFrom({ env: envSchema.parse(environment), fileRaw: config, resume: "# Jane Doe", dataDir: "data" }, settingsSchema.parse(config));
}

test("the app config applies defaults", () => {
    const config = configFrom(LLM_ENV);
    expect(config.settings).not.toHaveProperty("companies");
    expect(config.settings.match_threshold).toBe(70);
    expect(config.settings.http.min_interval_ms).toBe(1000);
    expect(config.settings.title_filter.include).toContain("engineer");
    expect(config.resume).toContain("Jane Doe");
});

test("config.json parses without any LLM settings", () => {
    const file = settingsSchema.parse(SAMPLE_CONFIG);
    expect(file).not.toHaveProperty("searches");
    expect(file.match_threshold).toBe(70);
});

test("config rejects filter terms without a letter or digit", () => {
    expect(() => testAppSettings({ title_filter: { exclude: ["++"] } })).toThrow(/letter or digit/);
    expect(() => testAppSettings({ title_filter: { extra_exclude: ["++"] } })).toThrow(/letter or digit/);
});

test("title boosts default to none and need 1-100 points per term", () => {
    expect(testAppSettings().title_boosts).toEqual({});
    expect(testAppSettings({ title_boosts: { typescript: 10 } }).title_boosts).toEqual({ typescript: 10 });
    expect(() => testAppSettings({ title_boosts: { typescript: 0 } })).toThrow();
    expect(() => testAppSettings({ title_boosts: { typescript: 101 } })).toThrow();
    expect(() => testAppSettings({ title_boosts: { "++": 10 } })).toThrow(/letter or digit/);
});

test("jsearch.exclude_publishers needs a letter or digit per name", () => {
    expect(() => testAppSettings({ jsearch: { exclude_publishers: ["--"] } })).toThrow(/letter or digit/);
});

test("jsearch.exclude_publishers rejects malformed domain entries by name", () => {
    for (const entry of ["trabajo.*", "https://trabajo.org/", "trabajo.org:443", "*.com"]) {
        expect(() => testAppSettings({ jsearch: { exclude_publishers: [entry] } })).toThrow(`'${entry}' is not a valid domain entry`);
    }
    const entries = ["dailyremote", "jobmesh.io", "*.trabajo.org"];
    expect(testAppSettings({ jsearch: { exclude_publishers: entries } }).jsearch.exclude_publishers).toEqual(entries);
});

test("exclude_companies defaults to none and needs a letter or digit per name", () => {
    expect(testAppSettings().exclude_companies).toEqual([]);
    expect(() => testAppSettings({ exclude_companies: ["--"] })).toThrow(/letter or digit/);
});

test("extra_exclude adds to the default exclude terms", () => {
    const exclude = testAppSettings({ title_filter: { extra_exclude: ["staff", "principal"] } }).title_filter.exclude;
    expect(exclude).toEqual(expect.arrayContaining(["intern", "manager", "staff", "principal"]));
});

test("extra_exclude adds to a custom exclude list", () => {
    const filter = { exclude: ["sales"], extra_exclude: ["lead"] };
    expect(testAppSettings({ title_filter: filter }).title_filter.exclude).toEqual(["sales", "lead"]);
});

test("the app config requires LLM settings", () => {
    expect(() => configFrom({})).toThrow(/LLM_BASE_URL/);
});

test("config rejects retention not longer than ghost threshold", () => {
    const overrides = { ghost_threshold_days: 90, job_retention_days: 60 };
    expect(() => testAppSettings(overrides)).toThrow(/job_retention_days/);
});

test("config.json that isn't valid JSON is reported readably", () => {
    expect(() => parseJson("{ not json", "config.json")).toThrow(/config.json is not valid JSON/);
});

test("careers lookup settings default to small, 16GB-friendly limits and reject out-of-range values", () => {
    expect(testAppSettings().careers_lookup).toEqual({ max_per_run: 10, max_total_minutes: 30, max_minutes: 5, page_chars: 12_000, search_results: 10, max_download_kb: 2048, render_seconds: 15, skip_hosts: ["glassdoor.com", "ziprecruiter.com", "indeed.com", "linkedin.com", "builtin.com", "teamworkonline.com"] });
    expect(testAppSettings({ careers_lookup: { skip_hosts: [] } }).careers_lookup.skip_hosts).toEqual([]);
    expect(() => testAppSettings({ careers_lookup: { page_chars: 500 } })).toThrow();
    expect(() => testAppSettings({ careers_lookup: { search_results: 50 } })).toThrow();
    expect(() => testAppSettings({ careers_lookup: { max_per_run: 0 } })).toThrow();
});

test("the SearXNG address is optional and must be a URL", () => {
    expect(configFrom(LLM_ENV).env.MYJOBBOT_SEARXNG_URL).toBeUndefined();
    expect(configFrom({ ...LLM_ENV, MYJOBBOT_SEARXNG_URL: "https://search.example" }).env.MYJOBBOT_SEARXNG_URL).toBe("https://search.example");
    expect(() => configFrom({ ...LLM_ENV, MYJOBBOT_SEARXNG_URL: "search.example" })).toThrow();
});

test("page rendering has a bounded time limit and an optional LAN probe address", () => {
    for (const render_seconds of [4, 61]) expect(() => testAppSettings({ careers_lookup: { render_seconds } })).toThrow();
    expect(testAppSettings({ careers_lookup: { lan_probe_url: "http://192.168.3.1/" } }).careers_lookup.lan_probe_url).toBe("http://192.168.3.1/");
    expect(() => testAppSettings({ careers_lookup: { lan_probe_url: "router" } })).toThrow();
});

test("the browser service address is optional and must be a WebSocket address", () => {
    expect(configFrom(LLM_ENV).env.MYJOBBOT_BROWSER_URL).toBeUndefined();
    for (const url of ["ws://browser:3000/", "wss://browser.example/"]) expect(configFrom({ ...LLM_ENV, MYJOBBOT_BROWSER_URL: url }).env.MYJOBBOT_BROWSER_URL).toBe(url);
    expect(() => configFrom({ ...LLM_ENV, MYJOBBOT_BROWSER_URL: "http://browser:3000/" })).toThrow();
});

test("the company search makes at most 50 searches a run by default, and refuses a negative limit", () => {
    expect(settingsSchema.parse(SAMPLE_CONFIG).company_search.max_per_run).toBe(50);
    expect(() => settingsSchema.parse({ ...SAMPLE_CONFIG, company_search: { max_per_run: -1 } })).toThrow();
});
