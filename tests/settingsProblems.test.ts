import { expect, test } from "vitest";
import { fileConfigSchema } from "../src/config/schema.js";
import { mergeSettings } from "../src/config/searchSettings.js";
import type { SaveRequest } from "../src/web/settingsForm.js";
import { sectionProblems } from "../src/web/settingsProblems.js";

const value = (v: unknown) => ({ kind: "value" as const, value: v });
const DEFAULT = { kind: "default" as const };

function problemsOf(settings: object, request: SaveRequest, runtime: object = {}) {
    const result = fileConfigSchema.safeParse(mergeSettings(runtime, settings as Record<string, unknown>));
    return result.success ? [] : sectionProblems(result.error.issues, request);
}

const SCORING: SaveRequest = { section: "scoring", edits: { match_threshold: value(150), title_boosts: value([["++", 10], ["go", 0]]) } };
const FILTERS: SaveRequest = { section: "filters", edits: { include: value([]), exclude: DEFAULT, extra_exclude: DEFAULT, exclude_companies: DEFAULT, exclude_publishers: value([]) } };
const PREFERENCES: SaveRequest = { section: "preferences", edits: { preferences: value("Remote") } };

test("a field's problem goes on its field", () => {
    expect(problemsOf({ match_threshold: 150 }, SCORING)).toEqual([{ field: "match_threshold", entry: null, message: "Too big: expected number to be <=100" }]);
});

test("a list entry's problem goes on its row", () => {
    expect(problemsOf({ exclude_companies: ["acme", "--"] }, FILTERS)).toEqual([{ field: "exclude_companies", entry: 1, message: "filter terms need at least one letter or digit" }]);
});

test("nested settings resolve to their own field and row", () => {
    const problems = problemsOf({ title_filter: { include: ["go", "++"] }, exclude_publishers: ["a.io", "b.io", "--"] }, FILTERS);
    expect(problems.map(({ field, entry }) => [field, entry])).toEqual([
        ["exclude_publishers", 2],
        ["include", 1],
    ]);
});

test("a boost's problem goes on its row, found by the term's position", () => {
    expect(problemsOf({ title_boosts: { "++": 10, go: 0 } }, SCORING).find((problem) => problem.message.startsWith("Too small"))).toEqual({ field: "title_boosts", entry: 1, message: "Too small: expected number to be >=1" });
});

test("a bad record key gives each of its reasons, on its row", () => {
    expect(problemsOf({ title_boosts: { "++": 10 } }, SCORING)).toEqual([{ field: "title_boosts", entry: 0, message: "filter terms need at least one letter or digit" }]);
});

test("a rule with no path goes to the top of the saved section", () => {
    expect(problemsOf({ preferences: "Remote" }, PREFERENCES, { ghost_threshold_days: 90, job_retention_days: 60 })).toEqual([{ field: null, entry: null, message: "job_retention_days must be greater than ghost_threshold_days so repost history survives long enough to flag ghosts" }]);
});

test("a bad runtime value goes to the top of the saved section, with zod's own message", () => {
    expect(problemsOf({ preferences: "Remote" }, PREFERENCES, { http: { timeout_s: 0 } })).toEqual([{ field: null, entry: null, message: "Too small: expected number to be >=1" }]);
});
