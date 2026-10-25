import { expect, test } from "vitest";
import { checkImport, exportDocument } from "../src/config/importSettings.js";
import { splitSettings } from "../src/config/searchSettings.js";
import { FULL_CONFIG, TEST_SEARCH } from "./helpers/config.js";

const STRIPE = { name: "Stripe", ats: "greenhouse", slug: "stripe" };
const NAME = "/tmp/settings.json";

function imported(document: unknown, runtime: unknown = {}) {
    return checkImport(JSON.stringify(document), NAME, runtime);
}

function searches(count: number) {
    return Array.from({ length: count }, (_, index) => ({ ...TEST_SEARCH, name: `Search ${index}` }));
}

test("valid search settings are accepted and returned raw, with the excluded publishers at the top level", () => {
    const { search, runtime } = splitSettings(FULL_CONFIG);
    expect(imported(exportDocument(search), runtime)).toEqual({ ok: true, settings: search });
});

test("text that isn't JSON is refused with a message naming the file", () => {
    expect(checkImport("{ not json", NAME, {})).toEqual({ ok: false, messages: [expect.stringMatching(/^\/tmp\/settings.json is not valid JSON/)] });
});

test("a runtime setting is refused as belonging in config.json", () => {
    expect(imported({ companies: [STRIPE], http: { timeout_s: 20 } })).toEqual({ ok: false, messages: ["http belongs in config.json, not in imported settings"] });
});

test("a JSearch setting other than the excluded publishers is refused the same way", () => {
    expect(imported({ companies: [STRIPE], jsearch: { refresh_hours: 8, exclude_publishers: ["a.io"] } })).toEqual({ ok: false, messages: ["jsearch.refresh_hours belongs in config.json, not in imported settings"] });
});

test("an unknown key is refused the same way", () => {
    expect(imported({ companies: [STRIPE], foo: 1 })).toEqual({ ok: false, messages: ["foo belongs in config.json, not in imported settings"] });
});

test("a broken rule is refused with today's message, and so is a file with no source", () => {
    expect(imported({ searches: searches(7) })).toEqual({ ok: false, messages: [expect.stringMatching(/monthly_request_cap/)] });
    expect(imported({})).toEqual({ ok: false, messages: ["configure at least one company or search"] });
});

const INVALID: Array<[string, unknown, RegExp, unknown?]> = [
    ["an unknown board type", { companies: [{ name: "X", ats: "workday", slug: "x" }] }, /ats/],
    ["a filter term without a letter or digit", { title_filter: { exclude: ["++"] } }, /letter or digit/],
    ["an extra exclude term without a letter or digit", { title_filter: { extra_exclude: ["++"] } }, /letter or digit/],
    ["a boost of 0 points", { title_boosts: { typescript: 0 } }, /title_boosts/],
    ["a boost of 101 points", { title_boosts: { typescript: 101 } }, /title_boosts/],
    ["a boost term without a letter or digit", { title_boosts: { "++": 10 } }, /letter or digit/],
    ["a publisher without a letter or digit", { jsearch: { exclude_publishers: ["--"] } }, /letter or digit/],
    ["a malformed publisher domain", { jsearch: { exclude_publishers: ["trabajo.*"] } }, /'trabajo\.\*' is not a valid domain entry/],
    ["an excluded company without a letter or digit", { exclude_companies: ["--"] }, /letter or digit/],
    ["duplicate company names", { companies: [STRIPE, { ...STRIPE, name: "stripe", slug: "stripe-two" }] }, /names must be unique/],
    ["no company or search", { companies: [] }, /at least one company or search/],
    ["a search named like a company", { searches: [{ ...TEST_SEARCH, name: "stripe" }] }, /names must be unique/],
    ["more searches than the JSearch budget allows", { searches: searches(7) }, /monthly_request_cap/],
    ["three searches refreshed three times a day", { searches: searches(3) }, /monthly_request_cap/, { jsearch: { refresh_hours: 8 } }],
    ["a source named like the Gmail alerts source", { companies: [{ name: "gmail ALERTS", ats: "greenhouse", slug: "x" }] }, /reserved/],
];

test("each invalid search setting in today's config tests is refused on import with the message loading the file gives (SC-003)", () => {
    for (const [, overrides, message, runtime] of INVALID) {
        const result = imported({ companies: [STRIPE], ...(overrides as object) }, runtime ?? {});
        expect(result.ok ? [] : result.messages.join("\n")).toMatch(message);
    }
});

test("an export puts the excluded publishers inside jsearch and imports back exactly, and nothing stored exports as {} (SC-006)", () => {
    const { search, runtime } = splitSettings(FULL_CONFIG);
    expect(exportDocument(search)).toMatchObject({ jsearch: { exclude_publishers: ["jobmesh.io"] } });
    expect(imported(exportDocument(search), runtime)).toEqual({ ok: true, settings: search });
    expect(exportDocument(null)).toEqual({});
});
