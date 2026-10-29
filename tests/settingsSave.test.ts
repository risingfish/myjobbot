import { expect, test } from "vitest";
import type { SaveRequest } from "../src/web/settingsForm.js";
import { saveSection } from "../src/web/settingsSave.js";

const value = (v: unknown) => ({ kind: "value" as const, value: v });
const DEFAULT = { kind: "default" as const };
const STORED = { preferences: "Remote" };

function scoring(threshold: unknown, boosts: unknown = []): SaveRequest {
    return { section: "scoring", edits: { match_threshold: value(threshold), title_boosts: value(boosts) } };
}

function filters(edits: Record<string, unknown>): SaveRequest {
    const fields = ["include", "exclude", "extra_exclude", "exclude_companies", "exclude_publishers"];
    return { section: "filters", edits: Object.fromEntries(fields.map((field) => [field, field in edits ? value(edits[field]) : DEFAULT])) };
}

test("a save that passes returns the document to store", () => {
    expect(saveSection(STORED, {}, scoring(75))).toEqual({ toStore: { preferences: "Remote", match_threshold: 75, title_boosts: {} } });
});

test("a save that fails returns its problems and nothing to store", () => {
    expect(saveSection(STORED, {}, scoring(150))).toEqual({ problems: [{ field: "match_threshold", entry: null, message: "Too big: expected number to be <=100" }] });
});

test("a save works with nothing stored yet", () => {
    expect(saveSection(null, {}, scoring(80))).toEqual({ toStore: { match_threshold: 80, title_boosts: {} } });
});

test("a boost term listed twice is refused on its second row", () => {
    expect(saveSection(STORED, {}, scoring(70, [["go", 5], ["go", 6]]))).toEqual({ problems: [{ field: "title_boosts", entry: 1, message: "this term is already boosted above" }] });
});

test("the preferences text is stored exactly as typed, line breaks included", () => {
    const text = "Remote — senior, ünd 🎯\nsecond line\n";
    expect(saveSection({ match_threshold: 60 }, {}, { section: "preferences", edits: { preferences: value(text) } })).toEqual({ toStore: { match_threshold: 60, preferences: text } });
});

const INVALID: Array<[string, SaveRequest, RegExp, string | null, unknown?]> = [
    ["a filter term without a letter or digit", filters({ exclude: ["++"] }), /letter or digit/, "exclude"],
    ["an extra exclude term without a letter or digit", filters({ extra_exclude: ["++"] }), /letter or digit/, "extra_exclude"],
    ["a boost of 0 points", scoring(70, [["typescript", 0]]), /Too small/, "title_boosts"],
    ["a boost of 101 points", scoring(70, [["typescript", 101]]), /Too big/, "title_boosts"],
    ["a boost term without a letter or digit", scoring(70, [["++", 10]]), /letter or digit/, "title_boosts"],
    ["a publisher without a letter or digit", filters({ exclude_publishers: ["--"] }), /letter or digit/, "exclude_publishers"],
    ["a malformed publisher domain", filters({ exclude_publishers: ["trabajo.*"] }), /'trabajo\.\*' is not a valid domain entry/, "exclude_publishers"],
    ["an excluded company without a letter or digit", filters({ exclude_companies: ["--"] }), /letter or digit/, "exclude_companies"],
];

test("each invalid search setting 015's import refused is refused when saved in its section, on its field, with zod's own message (SC-003)", () => {
    for (const [label, request, message, field, runtime] of INVALID) {
        const result = saveSection(STORED, runtime ?? {}, request);
        const problems = "problems" in result ? result.problems : [];
        expect([label, problems.some((problem) => problem.field === field && message.test(problem.message))]).toEqual([label, true]);
    }
});

test("the save is checked against the runtime settings passed in", () => {
    const request = scoring(75);
    expect("toStore" in saveSection(STORED, {}, request)).toBe(true);
    expect(saveSection(STORED, { ghost_threshold_days: 90, job_retention_days: 60 }, request)).toEqual({ problems: [{ field: null, entry: null, message: "job_retention_days must be greater than ghost_threshold_days so repost history survives long enough to flag ghosts" }] });
});
