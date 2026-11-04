import { expect, test } from "vitest";
import { fieldsOf, SECTIONS } from "../src/web/settingsSections.js";

const SEARCH_KEYS = ["preferences", "match_threshold", "title_filter", "body_filter", "title_boosts", "description_boosts", "exclude_companies", "exclude_publishers"];

test("the eleven fields cover the eight search keys, each in one section, with no check path twice", () => {
    expect(SECTIONS).toHaveLength(11);
    expect([...new Set(SECTIONS.map((field) => field.stored[0]))].sort()).toEqual([...SEARCH_KEYS].sort());
    expect(new Set(SECTIONS.map((field) => field.name)).size).toBe(11);
    expect(new Set(SECTIONS.map((field) => field.check.join("."))).size).toBe(11);
    expect(new Set(SECTIONS.map((field) => field.section))).toEqual(new Set(["preferences", "scoring", "filters"]));
});

test("the scoring section owns the threshold and both boost lists", () => {
    expect(fieldsOf("scoring").map((field) => field.name)).toEqual(["match_threshold", "title_boosts", "description_boosts"]);
});
