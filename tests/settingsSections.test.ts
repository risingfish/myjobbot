import { expect, test } from "vitest";
import { fieldsOf, SECTIONS } from "../src/web/settingsSections.js";

const SEARCH_KEYS = ["preferences", "match_threshold", "resume_view", "title_filter", "body_filter", "title_boosts", "description_boosts", "exclude_companies", "exclude_publishers"];

test("the twelve fields cover the nine search keys, each in one section, with no check path twice", () => {
    expect(SECTIONS).toHaveLength(12);
    expect([...new Set(SECTIONS.map((field) => field.stored[0]))].sort()).toEqual([...SEARCH_KEYS].sort());
    expect(new Set(SECTIONS.map((field) => field.name)).size).toBe(12);
    expect(new Set(SECTIONS.map((field) => field.check.join("."))).size).toBe(12);
    expect(new Set(SECTIONS.map((field) => field.section))).toEqual(new Set(["preferences", "scoring", "filters"]));
});

test("the scoring section owns the threshold, what the model reads about the owner, and both boost lists", () => {
    expect(fieldsOf("scoring").map((field) => field.name)).toEqual(["match_threshold", "resume_view", "title_boosts", "description_boosts"]);
});
