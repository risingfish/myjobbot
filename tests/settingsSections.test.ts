import { expect, test } from "vitest";
import { SECTIONS } from "../src/web/settingsSections.js";

const SEARCH_KEYS = ["preferences", "match_threshold", "title_filter", "title_boosts", "exclude_companies", "exclude_publishers"];

test("the eight fields cover the six search keys, each in one section, with no check path twice", () => {
    expect(SECTIONS).toHaveLength(8);
    expect([...new Set(SECTIONS.map((field) => field.stored[0]))].sort()).toEqual([...SEARCH_KEYS].sort());
    expect(new Set(SECTIONS.map((field) => field.name)).size).toBe(8);
    expect(new Set(SECTIONS.map((field) => field.check.join("."))).size).toBe(8);
    expect(new Set(SECTIONS.map((field) => field.section))).toEqual(new Set(["preferences", "scoring", "filters"]));
});
