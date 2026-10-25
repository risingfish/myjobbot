import { expect, test } from "vitest";
import { fileConfigSchema } from "../src/config/schema.js";
import { mergeSettings, sanitizeSearchSettings, splitSettings } from "../src/config/searchSettings.js";
import { FULL_CONFIG, TEST_SEARCH } from "./helpers/config.js";

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

const STRIPE = { name: "Stripe", ats: "greenhouse", slug: "stripe" };

function droppedFrom(stored: Record<string, unknown>) {
    const { settings, notices } = sanitizeSearchSettings(stored);
    return [settings, notices.map((notice) => notice.setting)];
}

test("a bad match threshold is dropped so its default applies, with a notice naming it", () => {
    expect(sanitizeSearchSettings({ match_threshold: 150, preferences: "Remote" })).toEqual({ settings: { preferences: "Remote" }, notices: [{ kind: "fallback", setting: "match_threshold", reason: "Too big: expected number to be <=100" }] });
});

test("preferences of the wrong type are dropped", () => {
    expect(droppedFrom({ preferences: 5 })).toEqual([{}, ["preferences"]]);
});

test("one bad company is left out and the others kept", () => {
    expect(droppedFrom({ companies: [STRIPE, { name: "X", ats: "workday", slug: "x" }] })).toEqual([{ companies: [STRIPE] }, ["companies[1]"]]);
});

test("one bad search is left out and the others kept", () => {
    expect(droppedFrom({ searches: [{ name: "", query: "q" }, TEST_SEARCH] })).toEqual([{ searches: [TEST_SEARCH] }, ["searches[0]"]]);
});

test("a title boost with a bad term and one with bad points are each left out", () => {
    const { settings, notices } = sanitizeSearchSettings({ title_boosts: { typescript: 10, "++": 5, golang: 0 } });
    expect([settings, notices.map((notice) => [notice.setting, notice.reason])]).toEqual([
        { title_boosts: { typescript: 10 } },
        [
            ["title_boosts[1]", "filter terms need at least one letter or digit"],
            ["title_boosts[2]", "Too small: expected number to be >=1"],
        ],
    ]);
});

test("one bad entry in each title filter list is left out", () => {
    const stored = { title_filter: { include: ["engineer", "++"], exclude: ["--", "sales"], extra_exclude: ["staff", ""] } };
    expect(droppedFrom(stored)).toEqual([{ title_filter: { include: ["engineer"], exclude: ["sales"], extra_exclude: ["staff"] } }, ["title_filter.include[1]", "title_filter.exclude[0]", "title_filter.extra_exclude[1]"]]);
});

test("one bad excluded company is left out", () => {
    expect(droppedFrom({ exclude_companies: ["acme", "--"] })).toEqual([{ exclude_companies: ["acme"] }, ["exclude_companies[1]"]]);
});

test("a malformed publisher domain is left out with a fixed reason, and an entry without letters keeps the filter term's reason", () => {
    expect(sanitizeSearchSettings({ exclude_publishers: ["jobmesh.io", "trabajo.*", ""] })).toEqual({
        settings: { exclude_publishers: ["jobmesh.io"] },
        notices: [
            { kind: "fallback", setting: "jsearch.exclude_publishers[1]", reason: "not a valid domain entry" },
            { kind: "fallback", setting: "jsearch.exclude_publishers[2]", reason: "filter terms need at least one letter or digit" },
        ],
    });
});

test("a list whose entries all fail takes its default, while a list stored empty stays empty", () => {
    expect(droppedFrom({ title_filter: { include: ["++"], exclude: [] } })).toEqual([{ title_filter: { exclude: [] } }, ["title_filter.include[0]"]]);
});

test("a setting of the wrong shape is dropped whole with one notice naming it", () => {
    expect(droppedFrom({ companies: 5, title_boosts: ["typescript"] })).toEqual([{}, ["companies", "title_boosts"]]);
});

test("a key that isn't a search setting is dropped with a notice naming it, even one named like an object's own members", () => {
    expect(sanitizeSearchSettings({ http: { timeout_s: 20 } })).toEqual({ settings: {}, notices: [{ kind: "fallback", setting: "http", reason: "not a search setting" }] });
    const inherited = JSON.parse('{"__proto__": 1, "toString": 2}') as Record<string, unknown>;
    expect(sanitizeSearchSettings(inherited).notices.map((notice) => [notice.setting, notice.reason])).toEqual([
        ["__proto__", "not a search setting"],
        ["toString", "not a search setting"],
    ]);
});

test("valid settings pass unchanged with no notices, and no notice holds a value or the preferences text", () => {
    const { search } = splitSettings(FULL_CONFIG);
    expect(sanitizeSearchSettings(search)).toEqual({ settings: search, notices: [] });
    const { notices } = sanitizeSearchSettings({ preferences: ["secret plans"], companies: [{ name: "Hidden Co", ats: "x", slug: "hc" }], title_boosts: { "##": 5 } });
    expect(notices).toHaveLength(3);
    expect(JSON.stringify(notices)).not.toMatch(/secret|Hidden|##/);
});
