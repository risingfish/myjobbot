import { expect, test } from "vitest";
import { fileConfigSchema } from "../src/config/schema.js";
import { mergeSettings, splitSettings } from "../src/config/searchSettings.js";
import { FULL_CONFIG } from "./helpers/config.js";

const SEARCH_PART = {
    companies: FULL_CONFIG.companies,
    searches: FULL_CONFIG.searches,
    preferences: FULL_CONFIG.preferences,
    match_threshold: 60,
    title_filter: { extra_exclude: ["staff"] },
    title_boosts: { typescript: 10, golang: 5 },
    exclude_companies: ["acme"],
    exclude_publishers: ["jobmesh.io"],
};

const RUNTIME_PART = { jsearch: { monthly_request_cap: 100, refresh_hours: 48 }, http: { timeout_s: 20 }, ghost_threshold_days: 30 };

test("the eight search keys go to the search part, and everything else to the runtime part", () => {
    expect(splitSettings(FULL_CONFIG)).toEqual({ search: SEARCH_PART, runtime: RUNTIME_PART });
});

test("jsearch.exclude_publishers moves to the search part, and a jsearch holding nothing else leaves no runtime jsearch", () => {
    expect(splitSettings({ jsearch: { exclude_publishers: ["a.io"] }, http: {} })).toEqual({ search: { exclude_publishers: ["a.io"] }, runtime: { http: {} } });
});

test("unset keys stay absent from both parts", () => {
    expect(splitSettings({ companies: [], agent: {} })).toEqual({ search: { companies: [] }, runtime: { agent: {} } });
});

test("a file with only runtime keys gives an empty search part", () => {
    expect(splitSettings(RUNTIME_PART)).toEqual({ search: {}, runtime: RUNTIME_PART });
});

test("merging puts exclude_publishers back inside jsearch beside the file's other jsearch values", () => {
    expect(mergeSettings({ jsearch: { refresh_hours: 48 } }, { exclude_publishers: ["a.io"] })).toEqual({ jsearch: { refresh_hours: 48, exclude_publishers: ["a.io"] } });
    expect(mergeSettings({}, { exclude_publishers: ["a.io"] })).toEqual({ jsearch: { exclude_publishers: ["a.io"] } });
});

test("merging copies only search keys, and an empty search part leaves the runtime part unchanged", () => {
    expect(mergeSettings(RUNTIME_PART, {})).toEqual(RUNTIME_PART);
    expect(mergeSettings(RUNTIME_PART, { match_threshold: 50, http: { timeout_s: 1 } })).toEqual({ ...RUNTIME_PART, match_threshold: 50 });
});

test("splitting then merging gives back the original file", () => {
    const { search, runtime } = splitSettings(FULL_CONFIG);
    expect(mergeSettings(runtime, search)).toEqual(FULL_CONFIG);
});

test("the merged file parses exactly as the original, and a file that isn't an object still fails as it does today", () => {
    const { search, runtime } = splitSettings(FULL_CONFIG);
    expect(fileConfigSchema.parse(mergeSettings(runtime, search))).toEqual(fileConfigSchema.parse(FULL_CONFIG));
    const notObject = splitSettings([]);
    expect(notObject).toEqual({ search: {}, runtime: [] });
    expect(() => fileConfigSchema.parse(mergeSettings(notObject.runtime, notObject.search))).toThrow();
});
