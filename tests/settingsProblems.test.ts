import { expect, test } from "vitest";
import { fileConfigSchema } from "../src/config/schema.js";
import { mergeSettings } from "../src/config/searchSettings.js";
import type { SaveRequest } from "../src/web/settingsForm.js";
import { sectionProblems } from "../src/web/settingsProblems.js";
import { TEST_SEARCH } from "./helpers/config.js";

const STRIPE = { name: "Stripe", ats: "greenhouse", slug: "stripe" };
const value = (v: unknown) => ({ kind: "value" as const, value: v });
const DEFAULT = { kind: "default" as const };

function problemsOf(settings: object, request: SaveRequest, runtime: object = {}) {
    const result = fileConfigSchema.safeParse(mergeSettings(runtime, settings as Record<string, unknown>));
    return result.success ? [] : sectionProblems(result.error.issues, request);
}

const SCORING: SaveRequest = { section: "scoring", edits: { match_threshold: value(150), title_boosts: value([["++", 10], ["go", 0]]) } };
const SOURCES: SaveRequest = { section: "sources", edits: { companies: value([]), searches: value([]) } };
const FILTERS: SaveRequest = { section: "filters", edits: { include: value([]), exclude: DEFAULT, extra_exclude: DEFAULT, exclude_companies: DEFAULT, exclude_publishers: value([]) } };
const PREFERENCES: SaveRequest = { section: "preferences", edits: { preferences: value("Remote") } };

test("a field's problem goes on its field", () => {
    expect(problemsOf({ companies: [STRIPE], match_threshold: 150 }, SCORING)).toEqual([{ field: "match_threshold", entry: null, message: "Too big: expected number to be <=100" }]);
});

test("a list entry's problem goes on its row", () => {
    expect(problemsOf({ companies: [STRIPE, { name: "X", ats: "lever", slug: "" }] }, SOURCES)).toEqual([{ field: "companies", entry: 1, message: "Too small: expected string to have >=1 characters" }]);
});

test("nested settings resolve to their own field and row", () => {
    const problems = problemsOf({ companies: [STRIPE], title_filter: { include: ["go", "++"] }, exclude_publishers: ["a.io", "b.io", "--"] }, FILTERS);
    expect(problems.map(({ field, entry }) => [field, entry])).toEqual([
        ["exclude_publishers", 2],
        ["include", 1],
    ]);
});

test("a boost's problem goes on its row, found by the term's position", () => {
    expect(problemsOf({ companies: [STRIPE], title_boosts: { "++": 10, go: 0 } }, SCORING).find((problem) => problem.message.startsWith("Too small"))).toEqual({ field: "title_boosts", entry: 1, message: "Too small: expected number to be >=1" });
});

test("a bad record key gives each of its reasons, on its row", () => {
    expect(problemsOf({ companies: [STRIPE], title_boosts: { "++": 10 } }, SCORING)).toEqual([{ field: "title_boosts", entry: 0, message: "filter terms need at least one letter or digit" }]);
});

test("a rule with no path goes to the top of the saved section", () => {
    expect(problemsOf({ preferences: "Remote" }, PREFERENCES)).toEqual([{ field: null, entry: null, message: "configure at least one company or search" }]);
});

test("the JSearch budget on a Sources save goes to the top of Sources", () => {
    const searches = Array.from({ length: 7 }, (_, index) => ({ ...TEST_SEARCH, name: `Search ${index}` }));
    expect(problemsOf({ searches }, SOURCES)).toEqual([{ field: null, entry: null, message: "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours" }]);
});

test("a bad runtime value goes to the top of the saved section, with zod's own message", () => {
    expect(problemsOf({ companies: [STRIPE], preferences: "Remote" }, PREFERENCES, { http: { timeout_s: 0 } })).toEqual([{ field: null, entry: null, message: "Too small: expected number to be >=1" }]);
});
